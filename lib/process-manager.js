const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const SessionDatabase = require('./session-database');
const AdaptiveRetry = require('./adaptive-retry');
const toolManager = require('./tool-manager');

class ProcessManager {
  constructor() {
    this.db = new SessionDatabase();
    this.activeProcesses = new Map();
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDir();
    this.setupCleanup();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  setupCleanup() {
    process.setMaxListeners(20);
    
    const cleanup = async () => {
      for (const [sessionId, { process }] of this.activeProcesses) {
        try {
          process.kill('SIGTERM');
        } catch (e) {
          // Process might already be dead
        }
      }
    };
    
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  async cleanupStaleSessions() {
    // Clean up any sessions marked as running that aren't actually running
    const sessions = await this.db.getAllSessions();
    const staleSessions = sessions.filter(s => s.status === 'running');
    
    for (const session of staleSessions) {
      // Check if this process is actually running
      const isActive = this.activeProcesses.has(session.id);
      
      if (!isActive) {
        // Session is stale - mark as error
        console.log(`🧹 Cleaning up stale session: ${session.id}`);
        await this.db.updateSession(session.id, {
          status: 'error',
          error: 'Session terminated unexpectedly',
          completed_at: Date.now()
        });
      }
    }
  }

  async startAfkSession(task, options = {}) {
    try {
      const metadata = {
        customSteps: options.customSteps === true,
        checkpointInterval: options.checkpointInterval || 1800
      };

      const session = await this.db.createSession({
        type: 'afk',
        task,
        status: 'running',
        iterations: options.iterations || 10,  // Database expects 'iterations' not 'iterations_planned'
        working_directory: process.cwd(),
        model: options.model || null,
        metadata: JSON.stringify(metadata)
      });

      const logFile = path.join(this.logDir, `${session.id}.log`);
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      
      logStream.write(`[${new Date().toISOString()}] Session ${session.id} started\\n`);
      logStream.write(`[${new Date().toISOString()}] Task: ${task}\\n`);
      logStream.write(`[${new Date().toISOString()}] Iterations: ${session.iterations_planned}\\n\\n`);

      // Initialize adaptive retry for usage limits
      const adaptiveRetry = new AdaptiveRetry();
      
      // Run iterations
      for (let i = 1; i <= session.iterations_planned; i++) {
        console.log(`\\n🚀 Starting iteration ${i} of ${session.iterations_planned}`);
        
        await this.db.updateSession(session.id, {
          iterations_completed: i - 1,
          status: 'running'
        });

        const success = await this.runSingleIteration(session, i, logStream, adaptiveRetry);
        
        if (!success) {
          console.error(`❌ Iteration ${i} failed`);
          break;
        }

        // Update completed count and record success
        await this.db.updateSession(session.id, {
          iterations_completed: i
        });
        adaptiveRetry.recordSuccess();

        // Wait between iterations using adaptive delay
        if (i < session.iterations_planned) {
          const delay = adaptiveRetry.getNextDelay() / 6; // Reduce delay for normal operation
          const delaySeconds = Math.max(5, delay / 1000); // Minimum 5 seconds
          console.log(`⏱️ Waiting ${delaySeconds} seconds before next iteration...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
      }

      await this.db.updateSession(session.id, {
        status: 'completed',
        completed_at: Date.now()
      });

      logStream.end();
      return session;

    } catch (error) {
      console.error('❌ Failed to start AFk session:', error);
      throw error;
    }
  }

  async runSingleIteration(session, iterationNum, logStream, adaptiveRetry) {
    return new Promise((resolve) => {
      // Build claude command
      const args = ['-p'];
      if (iterationNum > 1) {
        args.push('-c');
      }
      
      const allTools = toolManager.getAllToolsArray();
      args.push('--allowedTools', ...allTools);

      // Spawn claude with retry detection
      const claudeProcess = spawn('claude', args, {
        cwd: session.working_directory,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stderrOutput = '';
      claudeProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
        // Check for usage limit indicators
        if (stderrOutput.includes('rate limit') || stderrOutput.includes('usage limit') || stderrOutput.includes('quota')) {
          adaptiveRetry.recordFailure();
        }
      });

      // Send prompt - shorter for continuation
      let prompt;
      if (iterationNum === 1) {
        prompt = `${session.task}

This is iteration ${iterationNum} of ${session.iterations_planned} for AFk session ${session.id}.

Requirements:
- Use available tools to make progress on the task
- Document your work clearly
- If you complete the task, verify it works properly

lets bee friends`;
      } else {
        // Much shorter prompt for continuation
        prompt = `Continue with iteration ${iterationNum} of ${session.iterations_planned} for AFk session ${session.id}.

lets bee friends`;
      }

      claudeProcess.stdin.write(prompt);
      claudeProcess.stdin.end();

      // Log output
      claudeProcess.stdout.pipe(logStream, { end: false });
      claudeProcess.stderr.pipe(logStream, { end: false });

      logStream.write(`\\n[${new Date().toISOString()}] === ITERATION ${iterationNum} START ===\\n`);

      // Wait for completion
      claudeProcess.on('exit', (code) => {
        logStream.write(`[${new Date().toISOString()}] === ITERATION ${iterationNum} END (code: ${code}) ===\\n`);
        
        if (code === 0) {
          adaptiveRetry.recordSuccess();
          resolve(true);
        } else {
          adaptiveRetry.recordFailure();
          resolve(false);
        }
      });

      claudeProcess.on('error', (err) => {
        console.error(`❌ Iteration ${iterationNum} error:`, err);
        adaptiveRetry.recordFailure();
        resolve(false);
      });
    });
  }

  async cleanup(sessionId) {
    const processInfo = this.activeProcesses.get(sessionId);
    if (processInfo) {
      try {
        processInfo.process.kill('SIGTERM');
      } catch (e) {
        // Already dead
      }
      this.activeProcesses.delete(sessionId);
    }
  }

  // Expose SessionDatabase methods needed by afk command and tests
  async getStatus() {
    return this.db.getAllSessions();
  }

  async getActiveSessions() {
    return this.db.getActiveSessions();
  }

  async getSessionStats() {
    return this.db.getSessionStats();
  }

  async stopSession(sessionId) {
    // First check if session exists
    const session = await this.db.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update session status
    await this.db.updateSession(sessionId, {
      status: 'stopped',
      completed_at: Date.now()
    });

    // Clean up any active process
    await this.cleanup(sessionId);

    console.log(`✅ Session ${sessionId} stopped`);
  }

  async tailLogs(sessionId) {
    const session = await this.db.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const logFile = path.join(this.logDir, `${sessionId}.log`);
    
    if (!fs.existsSync(logFile)) {
      console.log(`📝 No logs found for session ${sessionId}`);
      return;
    }

    // Use tail command to follow the log
    const tail = spawn('tail', ['-f', logFile], {
      stdio: 'inherit'
    });

    // Handle cleanup on exit
    process.on('SIGINT', () => {
      tail.kill();
      process.exit(0);
    });

    return new Promise((resolve) => {
      tail.on('exit', resolve);
    });
  }

  async cleanupCompleted(days = 7) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const sessions = await this.db.getAllSessions();
    
    let cleaned = 0;
    let logs = 0;
    for (const session of sessions) {
      if (session.status === 'completed' && session.completed_at < cutoff) {
        // Remove log file
        const logFile = path.join(this.logDir, `${session.id}.log`);
        if (fs.existsSync(logFile)) {
          fs.unlinkSync(logFile);
          logs++;
        }
        
        // Remove from database
        await this.db.deleteSession(session.id);
        cleaned++;
      }
    }

    return { sessions: cleaned, logs: logs };
  }

  async getStatus() {
    // Return all sessions - the AfkCommand will handle filtering
    return await this.db.getAllSessions();
  }
}

module.exports = ProcessManager;