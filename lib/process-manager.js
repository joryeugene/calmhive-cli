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
    const { spawn } = require('child_process');
    
    // Clean up any sessions marked as running that aren't actually running
    const sessions = await this.db.getAllSessions();
    const staleSessions = sessions.filter(s => s.status === 'running');
    
    for (const session of staleSessions) {
      let isActive = false;
      
      // First check if we're tracking this process
      if (this.activeProcesses.has(session.id)) {
        const processInfo = this.activeProcesses.get(session.id);
        try {
          // Check if process is still alive
          process.kill(processInfo.pid, 0);
          isActive = true;
        } catch (e) {
          // Process is dead, remove from tracking
          this.activeProcesses.delete(session.id);
          isActive = false;
        }
      }
      
      // If not tracked, search by PID or command pattern
      if (!isActive && session.pid) {
        try {
          process.kill(session.pid, 0);
          isActive = true;
        } catch (e) {
          isActive = false;
        }
      }
      
      // Last resort: search for Claude processes with our flags
      if (!isActive) {
        isActive = await new Promise((resolve) => {
          const ps = spawn('ps', ['aux']);
          let output = '';
          
          ps.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          ps.on('close', () => {
            // Look for Claude processes with -p -c flags (AFk pattern)
            const hasClaudeProcess = output.includes('claude -p -c') || 
                                   output.includes('claude -c -p') ||
                                   (session.pid && output.includes(session.pid.toString()));
            resolve(hasClaudeProcess);
          });
        });
      }
      
      if (!isActive) {
        // Session is stale - mark as error
        console.log(`🧹 Cleaning up stale session: ${session.id}`);
        await this.db.updateSession(session.id, {
          status: 'error',
          error: 'Session terminated unexpectedly',
          completed_at: Date.now(),
          pid: null
        });
      } else {
        // Session is actually running - make sure it's tracked
        console.log(`✅ Confirmed running session: ${session.id}`);
      }
    }
  }

  async restoreRunningSessions() {
    const { spawn } = require('child_process');
    
    // Check sessions marked as error that might actually be running
    const sessions = await this.db.getAllSessions();
    const errorSessions = sessions.filter(s => s.status === 'error');
    
    for (const session of errorSessions) {
      // Check if this process is actually running
      const isActive = await new Promise((resolve) => {
        const ps = spawn('ps', ['aux']);
        let output = '';
        
        ps.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        ps.on('close', () => {
          const hasAfkProcess = output.includes(`commands/afk`) && 
                               (output.includes(session.id) || output.includes(session.task.substring(0, 50)));
          resolve(hasAfkProcess);
        });
      });
      
      if (isActive) {
        // Session is actually running - restore it
        console.log(`🔄 Restoring running session: ${session.id}`);
        await this.db.updateSession(session.id, {
          status: 'running',
          error: null
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
      
      logStream.write(`[${new Date().toISOString()}] Session ${session.id} started\n`);
      logStream.write(`[${new Date().toISOString()}] Task: ${task}\n`);
      logStream.write(`[${new Date().toISOString()}] Iterations: ${session.iterations_planned}\n\n`);

      // Initialize adaptive retry for usage limits
      const adaptiveRetry = new AdaptiveRetry();
      
      // Run iterations
      for (let i = 1; i <= session.iterations_planned; i++) {
        console.log(`\n🚀 Starting iteration ${i} of ${session.iterations_planned}`);
        
        await this.db.updateSession(session.id, {
          iterations_completed: i - 1,
          status: 'running'
        });

        let success = await this.runSingleIteration(session, i, logStream, adaptiveRetry);
        
        if (!success) {
          // Check if we should retry with fresh context
          if (session.needsContextReset && !session.failedAfterReset) {
            console.log(`🔄 Retrying iteration ${i} with fresh context...`);
            session.failedAfterReset = false;
            i--; // Retry the same iteration
            continue;
          }
          
          // Handle usage limits with exponential backoff
          const delay = adaptiveRetry.getNextDelay();
          const delayMinutes = Math.round(delay / 60000);
          console.log(`⏳ Usage limit likely hit. Waiting ${delayMinutes} minutes before retry...`);
          console.log(`⏰ Next retry at: ${new Date(Date.now() + delay).toLocaleTimeString()}`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the same iteration
          console.log(`🔄 Retrying iteration ${i} after usage limit delay...`);
          i--;
          continue;
        }
        
        // Reset the failed flag on success
        session.failedAfterReset = false;

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
      if (iterationNum > 1 && !session.needsContextReset) {
        args.push('-c');
      }
      
      // Reset context flag after using it
      if (session.needsContextReset) {
        console.log(`🔄 Starting iteration ${iterationNum} with fresh context (no -c flag)`);
        session.needsContextReset = false;
      }
      
      const allTools = toolManager.getAllToolsArray();
      args.push('--allowedTools', ...allTools);

      // Spawn claude with retry detection
      const claudeProcess = spawn('claude', args, {
        cwd: session.working_directory,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Track the process immediately
      this.activeProcesses.set(session.id, {
        process: claudeProcess,
        iteration: iterationNum,
        pid: claudeProcess.pid
      });
      
      // Update session with current PID
      this.db.updateSession(session.id, {
        pid: claudeProcess.pid
      }).catch(console.error);
      
      let stderrOutput = '';
      let stdoutOutput = '';
      let needsContextReset = false;
      
      claudeProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
        // Check for usage limit indicators
        if (stderrOutput.includes('rate limit') || stderrOutput.includes('usage limit') || stderrOutput.includes('quota') ||
            stderrOutput.includes('Claude Max usage limit reached') || 
            stderrOutput.includes('Your limit will reset at')) {
          console.log(`⚠️ Usage limit detected in stderr - triggering retry mechanism`);
          adaptiveRetry.recordFailure();
        }
      });

      claudeProcess.stdout.on('data', (data) => {
        stdoutOutput += data.toString();
        // Check for context limit indicators and trigger compact instead of reset
        if (stdoutOutput.includes('Prompt is too long') || 
            stdoutOutput.includes('Context low') || 
            stdoutOutput.includes('Run /compact to compact') ||
            stdoutOutput.includes('/compact')) {
          console.log(`🔄 Context limit detected, will send /compact command to continue with compressed context`);
          // Send compact command to the running process
          try {
            claudeProcess.stdin.write('\n/compact\n');
            console.log(`📦 Sent /compact command to compress context and continue`);
          } catch (e) {
            console.log(`⚠️ Failed to send /compact, will reset context on next iteration: ${e.message}`);
            needsContextReset = true;
          }
        }
        
        // Check for usage limit indicators
        if (stdoutOutput.includes('Claude Max usage limit reached') || 
            stdoutOutput.includes('Your limit will reset at') ||
            stdoutOutput.includes('upgrade to a higher plan')) {
          console.log(`⚠️ Usage limit detected - triggering retry mechanism`);
          adaptiveRetry.recordFailure();
        }
      });

      // Send prompt - minimal for continuation
      let prompt;
      if (iterationNum === 1) {
        prompt = `${session.task}

This is iteration ${iterationNum} of ${session.iterations_planned} for AFk session ${session.id}.

Requirements:
- Use available tools to make progress on the task
- Document your work clearly
- If you complete the task, verify it works properly
- If context becomes low, use /compact to compress and continue (preferred over stopping)

lets bee friends`;
      } else {
        // Minimal prompt for continuation (context from -c flag)
        prompt = `Continue iteration ${iterationNum}/${session.iterations_planned}.

If context becomes low, use /compact to compress and continue working.

lets bee friends`;
      }

      claudeProcess.stdin.write(prompt);
      claudeProcess.stdin.end();

      // Log output
      claudeProcess.stdout.pipe(logStream, { end: false });
      claudeProcess.stderr.pipe(logStream, { end: false });

      logStream.write(`\n[${new Date().toISOString()}] === ITERATION ${iterationNum} START ===\n`);

      // Wait for completion
      claudeProcess.on('exit', (code) => {
        logStream.write(`[${new Date().toISOString()}] === ITERATION ${iterationNum} END (code: ${code}) ===\n`);
        
        // Clean up process tracking
        this.activeProcesses.delete(session.id);
        
        if (needsContextReset) {
          logStream.write(`[${new Date().toISOString()}] Context reset needed for next iteration\n`);
          // Mark this session to reset context on next iteration
          session.needsContextReset = true;
        }
        
        // PRIORITY 1: Check for usage limits FIRST (most important to catch)
        const hasUsageLimitMessage = stdoutOutput.includes('Claude Max usage limit reached') || 
                                   stdoutOutput.includes('Your limit will reset at') ||
                                   stdoutOutput.includes('upgrade to a higher plan') ||
                                   stderrOutput.includes('Claude Max usage limit reached') || 
                                   stderrOutput.includes('Your limit will reset at') ||
                                   stderrOutput.includes('usage limit');
        
        if (hasUsageLimitMessage && code !== 0) {
          console.log(`⚠️ Usage limit detected in output - triggering exponential backoff`);
          console.log(`📝 Output snippet: ${stdoutOutput.substring(stdoutOutput.length - 200)}`);
          adaptiveRetry.recordFailure();
          // Return false to trigger retry logic with proper delay
          resolve(false);
        }
        // PRIORITY 2: Check if exit was due to context issues (only if NOT usage limit)
        else if (code === 1 && iterationNum > 1 && !session.contextResetAttempted && !hasUsageLimitMessage) {
          console.log(`⚠️ Iteration ${iterationNum} exited with code 1 - likely context issue, will retry with fresh context`);
          session.needsContextReset = true;
          session.contextResetAttempted = true;
          // Still resolve true to retry with fresh context
          resolve(true);
        } else if (code === 0) {
          adaptiveRetry.recordSuccess();
          session.contextResetAttempted = false; // Reset flag on success
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

    // Kill the actual Claude process
    let killed = false;
    
    // Method 1: Use tracked process
    if (this.activeProcesses.has(sessionId)) {
      const processInfo = this.activeProcesses.get(sessionId);
      try {
        process.kill(processInfo.pid, 'SIGTERM');
        console.log(`🛑 Killed tracked process PID ${processInfo.pid}`);
        killed = true;
      } catch (e) {
        console.log(`⚠️ Failed to kill tracked process: ${e.message}`);
      }
      this.activeProcesses.delete(sessionId);
    }
    
    // Method 2: Use stored PID
    if (!killed && session.pid) {
      try {
        process.kill(session.pid, 'SIGTERM');
        console.log(`🛑 Killed session process PID ${session.pid}`);
        killed = true;
      } catch (e) {
        console.log(`⚠️ Failed to kill session process: ${e.message}`);
      }
    }
    
    // Method 3: Find and kill orphan Claude processes
    if (!killed) {
      console.log(`🔍 Searching for orphan Claude processes...`);
      const { spawn } = require('child_process');
      
      const killOrphans = await new Promise((resolve) => {
        const ps = spawn('ps', ['aux']);
        let output = '';
        
        ps.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        ps.on('close', () => {
          const lines = output.split('\n');
          let killedCount = 0;
          
          for (const line of lines) {
            // Look for Claude processes with AFk flags
            if (line.includes('claude') && (line.includes('-p -c') || line.includes('-c -p'))) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[1];
              if (pid && !isNaN(pid)) {
                try {
                  process.kill(parseInt(pid), 'SIGTERM');
                  console.log(`🛑 Killed orphan Claude process PID ${pid}`);
                  killedCount++;
                } catch (e) {
                  // Process might already be dead
                }
              }
            }
          }
          resolve(killedCount > 0);
        });
      });
      
      if (killOrphans) {
        killed = true;
      }
    }

    // Update session status
    await this.db.updateSession(sessionId, {
      status: 'stopped',
      completed_at: Date.now(),
      pid: null
    });

    // Clean up any remaining tracking
    await this.cleanup(sessionId);

    console.log(`✅ Session ${sessionId} stopped${killed ? ' (process killed)' : ''}`);
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

  async killOrphanProcesses() {
    console.log(`🔍 Searching for orphan Claude processes...`);
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const ps = spawn('ps', ['aux']);
      let output = '';
      
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ps.on('close', () => {
        const lines = output.split('\n');
        let killedCount = 0;
        const killedPids = [];
        
        for (const line of lines) {
          // Look for Claude processes with AFk flags
          if (line.includes('claude') && (line.includes('-p -c') || line.includes('-c -p'))) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[1];
            if (pid && !isNaN(pid)) {
              try {
                process.kill(parseInt(pid), 'SIGTERM');
                console.log(`🛑 Killed orphan Claude process PID ${pid}`);
                killedPids.push(pid);
                killedCount++;
              } catch (e) {
                console.log(`⚠️ Failed to kill PID ${pid}: ${e.message}`);
              }
            }
          }
        }
        
        if (killedCount > 0) {
          console.log(`✅ Killed ${killedCount} orphan processes: ${killedPids.join(', ')}`);
        } else {
          console.log(`✅ No orphan Claude processes found`);
        }
        
        resolve({ killed: killedCount, pids: killedPids });
      });
    });
  }

  async getStatus() {
    // Return all sessions - the AfkCommand will handle filtering
    return await this.db.getAllSessions();
  }
}

module.exports = ProcessManager;