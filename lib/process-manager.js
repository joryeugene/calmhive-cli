// lib/process-manager.js
// V3 ProcessManager - Proper lifecycle control for all Calmhive sessions
// Eliminates phantom processes and provides reliable process management

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const SessionDatabase = require('./session-database');
const toolManager = require('./tool-manager');
const AdaptiveRetry = require('./adaptive-retry');

class ProcessManager {
  constructor(database = null, options = {}) {
    this.db = database || new SessionDatabase();
    this.activeProcesses = new Map(); // Track running processes in memory
    this.processes = this.activeProcesses;
    this.logDir = path.join(os.homedir(), '.claude/calmhive/v3/logs');
    
    // Configuration options
    this.options = {
      maxMemoryMB: options.maxMemoryMB || 512,
      maxConcurrentProcesses: options.maxConcurrentProcesses || 5,
      ...options
    };
    
    // Ensure log directory exists
    fs.ensureDirSync(this.logDir);
    
    // Setup cleanup on process exit
    this.setupCleanupHandlers();
  }
  
  setupCleanupHandlers() {
    // Skip handler setup in test environment or for short-lived commands
    if (process.env.NODE_ENV === 'test') return;
    
    // Skip cleanup handlers for status/query commands to avoid SQLite crashes
    const args = process.argv;
    if (args.includes('status') || args.includes('stats') || args.includes('tail')) {
      return;
    }
    
    // Also skip if this IS an AFk child process (spawned by AFk)
    if (process.env.AFk_SESSION_ID) {
      return;
    }
    
    // Skip cleanup for AFk parent processes managing iterations
    if (process.env.AFk_PARENT_MANAGER) {
      return;
    }
    
    // Only setup handlers once globally
    if (ProcessManager.handlersSetup) return;
    ProcessManager.handlersSetup = true;
    
    // Increase max listeners to avoid warnings
    process.setMaxListeners(20);
    
    const cleanup = async () => {
      // console.log('🧹 Cleaning up active processes...');
      for (const [sessionId, { process }] of this.activeProcesses) {
        try {
          process.kill('SIGTERM');
          await this.db.updateSession(sessionId, {
            status: 'stopped',
            completed_at: Date.now()
          });
        } catch (e) {
          // Process might already be dead
        }
      }
      
      // Safely close database connection with timeout
      try {
        // Set a timeout to prevent hanging
        const closePromise = this.db.close();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database close timeout')), 2000)
        );
        
        await Promise.race([closePromise, timeoutPromise]);
      } catch (e) {
        // Database might already be closed or timeout occurred
        // Force exit without throwing to prevent NAPI crashes
      }
    };
    
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('exit', cleanup);
  }
  
  async createSession(config) {
    // Create session without starting it
    const session = await this.db.createSession({
      type: config.type || 'afk',
      task: config.task,
      iterations: config.iterations || 10,
      workingDir: config.workingDir || process.cwd(),
      metadata: JSON.stringify(config.metadata || {})
    });
    
    return session;
  }
  
  async startSession(sessionId) {
    // Start a previously created session
    const session = await this.db.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (session.status === 'running') {
      throw new Error(`Session ${sessionId} is already running`);
    }
    
    // Setup logging
    const logFile = path.join(this.logDir, `${session.id}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    // Build Claude command
    const claudeArgs = this.buildClaudeArgs(session, {});
    
    try {
      // Start Claude process
      const claudeProcess = spawn('claude', claudeArgs, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Track process
      this.activeProcesses.set(session.id, {
        process: claudeProcess,
        logStream: logStream,
        startedAt: Date.now()
      });
      
      // Update session with PID
      await this.db.updateSession(session.id, {
        pid: claudeProcess.pid,
        status: 'running',
        started_at: Date.now()
      });
      
      // Setup event handlers
      this.setupProcessMonitoring(session.id, claudeProcess, logStream);
      
      return session;
    } catch (error) {
      // Update session to failed state
      await this.db.updateSession(session.id, {
        status: 'failed',
        error: error.message,
        ended_at: Date.now()
      });
      
      // Clean up log stream
      logStream.end();
      
      throw error;
    }
  }
  
  async restartSession(sessionId) {
    // Stop if running
    const session = await this.db.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (session.status === 'running') {
      await this.stopSession(sessionId);
    }
    
    // Reset restart count
    session.restartCount = (session.restartCount || 0) + 1;
    if (session.restartCount > 3) {
      throw new Error('Max restart attempts exceeded');
    }
    
    // Start again
    return await this.startSession(sessionId);
  }
  
  async startAfkSession(task, options = {}) {
    try {
      // 1. Create session record
      const session = await this.db.createSession({
        type: 'afk',
        task,
        iterations: options.iterations || 10,
        workingDir: options.workingDir || process.cwd(),
        // Claude Code handles model selection automatically
        metadata: JSON.stringify({
          customSteps: options.customSteps || false,
          webhookUrl: options.webhook,
          checkpointInterval: options.checkpointInterval || 1800
        })
      });
      
      // console.log(`🚀 Starting AFk session: ${session.id}`);
      // console.log(`📋 Task: ${task}`);
      // console.log(`🔄 Iterations: ${session.iterations_planned}`);
      
      // 2. Setup logging
      const logFile = path.join(this.logDir, `${session.id}.log`);
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      
      // Log session start
      logStream.write(`[${new Date().toISOString()}] Session ${session.id} started\\n`);
      logStream.write(`[${new Date().toISOString()}] Task: ${task}\\n`);
      logStream.write(`[${new Date().toISOString()}] Iterations: ${session.iterations_planned}\\n\\n`);
      
      // 3. Build Claude command
      const claudeArgs = this.buildClaudeArgs(session, options);
      
      // 4. Start iteration manager for AFk processes with multiple iterations
      if (session.type === 'afk' && session.iterations_planned > 1) {
        // Mark this as the parent AFk manager
        process.env.AFk_PARENT_MANAGER = 'true';
        
        // Start the iteration loop instead of single process
        return this.runIterations(session, logFile, logStream, options);
      }
      
      // 4. Start Claude process (single iteration or non-AFk)
      const claudeProcess = spawn('claude', claudeArgs, {
        cwd: session.working_directory,
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],  // Need pipe for stdin when using -p
        env: {
          ...process.env,
          AFk_SESSION_ID: session.id,
          AFk_ITERATION: '1'
        }
      });
      
      // Send prompt via stdin for -p mode
      if (session.type === 'afk') {
        const metadata = JSON.parse(session.metadata);
        let prompt;
        if (metadata.customSteps) {
          prompt = this.buildCustomStepsPrompt(session);
        } else {
          prompt = this.buildDefaultAfkPrompt(session);
        }
        claudeProcess.stdin.write(prompt);
        claudeProcess.stdin.end();
      }
      
      // Pipe output to log file
      claudeProcess.stdout.pipe(logStream);
      claudeProcess.stderr.pipe(logStream);
      
      // 5. Update session with PID
      await this.db.updateSession(session.id, { 
        pid: claudeProcess.pid,
        status: 'running'
      });
      
      // 6. Track process and setup monitoring
      this.activeProcesses.set(session.id, {
        process: claudeProcess,
        logStream,
        session
      });
      
      this.setupProcessMonitoring(session.id, claudeProcess, logStream);
      
      // console.log(`✅ AFk session started with PID: ${claudeProcess.pid}`);
      // console.log(`📊 Monitor with: calmhive status`);
      // console.log(`📝 View logs: calmhive tail ${session.id}`);
      
      return session;
      
    } catch (error) {
      console.error('❌ Failed to start AFk session:', error);
      throw error;
    }
  }
  
  buildClaudeArgs(session, options) {
    const args = [];
    
    // Claude Code handles model selection automatically - no need to specify
    
    // Use non-interactive print mode for background processes
    args.push('-p');
    
    // Only use continuation mode for iterations 2+ to maintain AFk context
    // First iteration should start fresh without pulling in unrelated context
    const currentIteration = process.env.AFk_ITERATION ? 
      parseInt(process.env.AFk_ITERATION) : 1;
    
    if (currentIteration > 1) {
      args.push('-c');
    }
    
    // Allow ALL tools including MCP tools for AFk tasks
    const allTools = toolManager.getAllToolsArray();
    args.push('--allowedTools', ...allTools);
    
    // For AFk sessions using -p flag, prompt will be sent via stdin
    
    return args;
  }
  
  buildCustomStepsPrompt(session) {
    // Get current iteration from environment or session
    const iteration = process.env.AFk_ITERATION ? 
      parseInt(process.env.AFk_ITERATION) : 
      session.iterations_completed + 1;
    
    return `
<afk_iteration>
  <session_id>${session.id}</session_id>
  <iteration>${iteration} of ${session.iterations_planned}</iteration>
  <task>${session.task}</task>
  <timestamp>${new Date().toISOString()}</timestamp>
</afk_iteration>

<sequential_thinking_mandate>
  You MUST use mcp__sequentialthinking__sequentialthinking_tools for this AFk iteration.
  Execute systematic analysis with minimum 8 sequential thinking steps.
  Each step must build on the previous, leading to actionable implementation.
</sequential_thinking_mandate>

<afk_execution_rules>
  <rule priority="1">Continue working on: ${session.task}</rule>
  <rule priority="2">This is iteration ${iteration} of ${session.iterations_planned}</rule>
  <rule priority="3">Save insights with mcp__memento__create_entities</rule>
  <rule priority="4">Update progress with TodoWrite</rule>
  <rule priority="5">Chain tools without interruption</rule>
  <rule priority="6">NEVER claim completion without verification</rule>
</afk_execution_rules>

<knowledge_persistence>
  Create knowledge entities capturing:
  - Key decisions made this iteration
  - Implementation patterns discovered  
  - Problems solved and solutions applied
  - Next iteration recommendations
</knowledge_persistence>

🙇☁️🐝 lets bee friends 🌟🍯
    `.trim();
  }
  
  buildDefaultAfkPrompt(session) {
    // Get current iteration from environment or session
    const iteration = process.env.AFk_ITERATION ? 
      parseInt(process.env.AFk_ITERATION) : 
      session.iterations_completed + 1;
    
    return `
Continue working on: ${session.task}

This is iteration ${iteration} of ${session.iterations_planned} for AFk session ${session.id}.

Requirements:
- Use available tools to make progress on the task
- Document your work clearly
- If you complete the task, verify it works properly
- Save any important insights or patterns you discover

🙇☁️🐝 lets bee friends 🌟🍯
    `.trim();
  }
  
  async runIterations(session, logFile, logStream, options) {
    // console.log(`🔄 Starting AFk iteration manager for ${session.iterations_planned} iterations`);
    
    // Initialize adaptive retry for handling usage limits
    const adaptiveRetry = new AdaptiveRetry();
    
    const runSingleIteration = async (iterationNum) => {
      // console.log(`\n🚀 Starting iteration ${iterationNum} of ${session.iterations_planned}`);
      
      // Update session iteration count
      await this.db.updateSession(session.id, {
        iterations_completed: iterationNum - 1,
        status: 'running'
      });
      
      // Build Claude args for this iteration
      const claudeArgs = this.buildClaudeArgs(session, options);
      
      // Try to spawn Claude with adaptive retry for usage limits
      const spawnClaude = async () => {
        const claudeProcess = spawn('claude', claudeArgs, {
          cwd: session.working_directory,
          detached: false, // Not detached - parent manages it
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            AFk_SESSION_ID: session.id,
            AFk_ITERATION: String(iterationNum)
          }
        });
        
        // Quick check if process started successfully
        return new Promise((resolve) => {
          let started = false;
          let errorOutput = '';
          
          // Timeout to detect if Claude can't start (likely usage limit)
          const startupTimeout = setTimeout(() => {
            if (!started) {
              // console.log(`⚠️ Claude process failed to start - possible usage limit`);
              claudeProcess.kill();
              resolve(false); // Indicates failure to start
            }
          }, 15000); // 15 second timeout
          
          // If we get any stdout data, process started successfully
          claudeProcess.stdout.once('data', () => {
            started = true;
            clearTimeout(startupTimeout);
            resolve(claudeProcess); // Success!
          });
          
          // Capture stderr for diagnostics
          claudeProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            // Check for usage limit indicators
            if (errorOutput.includes('rate limit') || 
                errorOutput.includes('usage limit') ||
                errorOutput.includes('quota exceeded')) {
              started = true; // Prevent timeout from firing
              clearTimeout(startupTimeout);
              claudeProcess.kill();
              // console.log(`📊 Usage limit detected: ${errorOutput.slice(0, 100)}...`);
              resolve(false);
            }
          });
          
          claudeProcess.on('error', (err) => {
            started = true; // Prevent timeout from firing
            clearTimeout(startupTimeout);
            console.error(`❌ Process spawn error: ${err.message}`);
            resolve(false);
          });
          
          // If process exits immediately, likely a startup issue
          claudeProcess.on('exit', (code) => {
            if (!started) {
              clearTimeout(startupTimeout);
              // console.log(`⚠️ Claude exited immediately with code ${code}`);
              resolve(false);
            }
          });
        });
      };
      
      // Use adaptive retry to handle usage limits
      let claudeProcess;
      try {
        claudeProcess = await adaptiveRetry.waitWithRetry(spawnClaude, 5);
      } catch (error) {
        console.error(`❌ Failed to start iteration ${iterationNum} after retries:`, error);
        return false;
      }
      
      if (!claudeProcess) {
        return false; // Failed to start even after retries
      }
      
      // Track this process temporarily
      this.activeProcesses.set(`${session.id}-iter-${iterationNum}`, {
        process: claudeProcess,
        logStream: logStream,
        session: session
      });
      
      // Send prompt for this iteration
      const metadata = JSON.parse(session.metadata);
      let prompt;
      if (metadata.customSteps) {
        // Update session object with current iteration for prompt building
        session.iterations_completed = iterationNum - 1;
        prompt = this.buildCustomStepsPrompt(session);
      } else {
        // Update session object with current iteration for prompt building
        session.iterations_completed = iterationNum - 1;
        prompt = this.buildDefaultAfkPrompt(session);
      }
      claudeProcess.stdin.write(prompt);
      claudeProcess.stdin.end();
      
      // Pipe output to log
      claudeProcess.stdout.pipe(logStream, { end: false });
      claudeProcess.stderr.pipe(logStream, { end: false });
      
      // Log iteration start
      logStream.write(`\n[${new Date().toISOString()}] === ITERATION ${iterationNum} START ===\n`);
      
      // Wait for this iteration to complete
      return new Promise((resolve) => {
        claudeProcess.on('exit', async (code, signal) => {
          // console.log(`📊 Iteration ${iterationNum} completed (code: ${code}`);
          logStream.write(`[${new Date().toISOString()}] === ITERATION ${iterationNum} END (code: ${code}) ===\n`);
          
          // Update completed iterations in database
          await this.db.updateSession(session.id, {
            iterations_completed: iterationNum
          });
          
          // Remove from active processes
          this.activeProcesses.delete(`${session.id}-iter-${iterationNum}`);
          
          resolve(code === 0);
        });
        
        claudeProcess.on('error', (err) => {
          console.error(`❌ Iteration ${iterationNum} error:`, err);
          logStream.write(`[${new Date().toISOString()}] Iteration ${iterationNum} error: ${err.message}\n`);
          this.activeProcesses.delete(`${session.id}-iter-${iterationNum}`);
          resolve(false);
        });
      });
    };
    
    // Update session PID to current process for monitoring
    await this.db.updateSession(session.id, { 
      pid: process.pid,
      status: 'running'
    });
    
    // Track this parent process
    this.activeProcesses.set(session.id, {
      process: process,
      logStream,
      session,
      isParentManager: true
    });
    
    // Run all iterations
    let allIterationsSuccessful = true;
    for (let i = 1; i <= session.iterations_planned; i++) {
      const success = await runSingleIteration(i);
      
      if (!success) {
        console.error(`❌ Iteration ${i} failed, stopping AFk session`);
        allIterationsSuccessful = false;
        break;
      }
      
      // Add delay between iterations (except after last one)
      if (i < session.iterations_planned) {
        // Get the current delay from adaptive retry (will be base delay if no failures)
        const delay = adaptiveRetry.getNextDelay();
        // console.log(`⏱️ Waiting ${delay/1000} seconds before next iteration...`);
        logStream.write(`[${new Date().toISOString()}] Waiting ${delay/1000} seconds before next iteration...\n`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reset delay if we successfully started this iteration
        if (success) {
          adaptiveRetry.recordSuccess();
        }
      }
    }
    
    // All iterations complete - update final count first
    const finalIterationsCompleted = session.iterations_planned;
    await this.db.updateSession(session.id, {
      iterations_completed: finalIterationsCompleted
    });
    
    const finalStatus = allIterationsSuccessful ? 'completed' : 'error';
    
    await this.db.updateSession(session.id, {
      status: finalStatus,
      completed_at: Date.now()
    });
    
    // console.log(`✅ AFk session completed: ${finalIterationsCompleted}/${session.iterations_planned} iterations`);
    // console.log(`📊 Final status: ${finalStatus}`);
    logStream.write(`[${new Date().toISOString()}] AFk session completed with status: ${finalStatus}\n`);
    logStream.end();
    
    // Clean up tracking
    this.cleanup(session.id);
    
    return session;
  }
  
  setupProcessMonitoring(sessionId, claudeProcess, logStream) {
    // Handle process exit
    claudeProcess.on('exit', async (code, signal) => {
      // console.log(`\\n📊 AFk session ${sessionId} ended (code: ${code}, signal: ${signal})`);
      
      const endTime = new Date().toISOString();
      logStream.write(`[${endTime}] Process ended with code ${code}\\n`);
      
      // Update session status
      const status = code === 0 ? 'completed' : 'error';
      await this.db.updateSession(sessionId, {
        status,
        completed_at: Date.now()
      });
      
      // Cleanup
      this.cleanup(sessionId);
    });
    
    // Handle process errors
    claudeProcess.on('error', async (err) => {
      console.error(`❌ AFk session ${sessionId} error:`, err);
      
      const errorTime = new Date().toISOString();
      logStream.write(`[${errorTime}] Process error: ${err.message}\\n`);
      
      await this.db.updateSession(sessionId, {
        status: 'error',
        completed_at: Date.now()
      });
      
      this.cleanup(sessionId);
    });
    
    // Periodic health check to catch zombie processes
    const healthCheck = setInterval(async () => {
      if (!this.isProcessAlive(claudeProcess.pid)) {
        // console.log(`🧹 Detected dead process for session ${sessionId}, cleaning up`);
        clearInterval(healthCheck);
        
        await this.db.updateSession(sessionId, {
          status: 'error',
          completed_at: Date.now()
        });
        
        this.cleanup(sessionId);
      }
    }, 30000); // Check every 30 seconds
    
    // Store health check timer for cleanup
    const tracked = this.activeProcesses.get(sessionId);
    if (tracked) {
      tracked.healthCheck = healthCheck;
    }
  }
  
  getProcessHealth(sessionId) {
    const processInfo = this.activeProcesses.get(sessionId);
    if (!processInfo) {
      return { status: 'not_found' };
    }
    
    const { process, startedAt } = processInfo;
    const runtime = Date.now() - startedAt;
    
    return {
      status: 'running',
      pid: process.pid,
      runtime: runtime,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : null
    };
  }
  
  async isStalled(sessionId) {
    const session = await this.db.getSession(sessionId);
    if (!session || session.status !== 'running') {
      return false;
    }
    
    // Consider stalled if no update in 5 minutes
    const lastUpdate = session.updated_at || session.started_at;
    return (Date.now() - lastUpdate) > (5 * 60 * 1000);
  }
  
  async updateProgress(sessionId, progress) {
    const session = await this.db.getSession(sessionId);
    const currentMetadata = JSON.parse(session.metadata || '{}');
    
    await this.db.updateSession(sessionId, {
      iterations_completed: progress.current_iteration,
      updated_at: Date.now(),
      metadata: JSON.stringify({
        ...currentMetadata,
        lastProgress: progress.message
      })
    });
  }
  
  async stopSession(sessionId, forceKill = false) {
    // First try to find session by partial ID
    let session = await this.db.findSessionByPartialId(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (session.status !== 'running') {
      throw new Error(`Session ${sessionId} is not running (status: ${session.status})`);
    }
    
    // console.log(`🛑 Stopping session: ${sessionId}`);
    
    // Kill the process if it exists
    if (session.pid) {
      try {
        if (forceKill) {
          // Force kill immediately
          process.kill(session.pid, 'SIGKILL');
          // console.log(`💀 Sent SIGKILL to process ${session.pid}`);
        } else {
          // Try graceful termination first
          process.kill(session.pid, 'SIGTERM');
          // console.log(`📨 Sent SIGTERM to process ${session.pid}`);
          
          // Escalate to SIGKILL after 5 seconds
          setTimeout(() => {
            try {
              if (this.isProcessAlive(session.pid)) {
                process.kill(session.pid, 'SIGKILL');
                // console.log(`💀 Sent SIGKILL to process ${session.pid}`);
              }
            } catch (e) {
              // Process already dead
            }
          }, 5000);
        }
        
      } catch (err) {
        // console.log(`⚠️ Process ${session.pid} already terminated`);
      }
    }
    
    // Update session status
    await this.db.updateSession(sessionId, {
      status: 'stopped',
      completed_at: Date.now()
    });
    
    // Cleanup tracking
    this.cleanup(sessionId);
    
    // console.log(`✅ Session ${sessionId} stopped`);
    return { success: true };
  }
  
  async getStatus() {
    // Get all sessions from database
    const sessions = await this.db.getAllSessions();
    
    // Verify running processes are actually alive
    const updates = [];
    for (const session of sessions) {
      if (session.status === 'running' && session.pid) {
        const isAlive = this.isProcessAlive(session.pid);
        if (!isAlive) {
          // console.log(`🧹 Cleaning up dead session: ${session.id}`);
          updates.push(
            this.db.updateSession(session.id, {
              status: 'error',
              completed_at: Date.now()
            })
          );
        }
      }
    }
    
    // Wait for all updates to complete
    if (updates.length > 0) {
      await Promise.all(updates);
      // Return fresh data after cleanup
      return await this.db.getAllSessions();
    }
    
    return sessions;
  }
  
  async tailLogs(sessionId) {
    // First try to find session by partial ID
    let session = await this.db.findSessionByPartialId(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const logFile = path.join(this.logDir, `${session.id}.log`);
    
    if (!fs.existsSync(logFile)) {
      throw new Error(`Log file not found for session ${session.id}`);
    }
    
    // console.log(`📝 Tailing logs for session ${session.id}:`);
    // console.log(`📁 Log file: ${logFile}\\n`);
    
    // Use tail -f to follow the log
    const tail = spawn('tail', ['-f', logFile], {
      stdio: 'inherit'
    });
    
    // Handle Ctrl+C to stop tailing
    process.on('SIGINT', () => {
      tail.kill('SIGTERM');
      // console.log('\\n📝 Stopped tailing logs');
    });
    
    return tail;
  }
  
  cleanup(sessionId) {
    const tracked = this.activeProcesses.get(sessionId);
    if (tracked) {
      // Clear health check timer
      if (tracked.healthCheck) {
        clearInterval(tracked.healthCheck);
      }
      
      // Close log stream
      if (tracked.logStream && !tracked.logStream.destroyed) {
        tracked.logStream.end();
      }
      
      // Remove from tracking
      this.activeProcesses.delete(sessionId);
    }
  }
  
  isProcessAlive(pid) {
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists without killing
      return true;
    } catch (err) {
      return false;
    }
  }
  
  async cleanupCompleted(olderThanDays = 7) {
    const cleaned = await this.db.cleanupOldSessions(olderThanDays);
    
    // Also clean up old log files
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let logsCleaned = 0;
    
    try {
      const logFiles = fs.readdirSync(this.logDir);
      for (const file of logFiles) {
        const logPath = path.join(this.logDir, file);
        const stat = fs.statSync(logPath);
        
        if (stat.mtime.getTime() < cutoff) {
          fs.unlinkSync(logPath);
          logsCleaned++;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not clean up old log files:', error.message);
    }
    
    if (logsCleaned > 0) {
      // console.log(`🧹 Cleaned up ${logsCleaned} old log files`);
    }
    
    return { sessions: cleaned, logs: logsCleaned };
  }
  
  async getSessionStats() {
    return await this.db.getSessionStats();
  }
  
  async getActiveSessions() {
    const sessions = await this.db.getAllSessions();
    return sessions.filter(s => s.status === 'running');
  }
  
  async cleanupOldSessions(days = 7) {
    return await this.cleanupCompleted(days);
  }
  
  async getSessionLogs(sessionId) {
    const logFile = path.join(this.logDir, `${sessionId}.log`);
    try {
      return await fs.readFile(logFile, 'utf8');
    } catch (error) {
      return '';
    }
  }
  
  async checkStalledSessions() {
    const sessions = await this.getActiveSessions();
    const stalled = [];
    for (const session of sessions) {
      if (await this.isStalled(session.id)) {
        stalled.push(session.id);
      }
    }
    return stalled;
  }

  async getResourceStats(sessionId) {
    const session = await this.db.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const stats = {
      sessionId,
      status: session.status,
      pid: session.pid,
      memory: 0,
      cpu: 0,
      uptime: 0
    };

    if (session.pid && this.isProcessAlive(session.pid)) {
      try {
        // Get process stats using ps command
        const { execSync } = require('child_process');
        const psOutput = execSync(`ps -o pid,rss,pcpu,etime -p ${session.pid}`).toString();
        const lines = psOutput.trim().split('\n');
        
        if (lines.length > 1) {
          const parts = lines[1].trim().split(/\s+/);
          if (parts.length >= 4) {
            stats.memory = parseInt(parts[1], 10) / 1024; // Convert KB to MB
            stats.cpu = parseFloat(parts[2]);
            
            // Parse elapsed time (format can be [DD-]HH:MM:SS or MM:SS)
            const etime = parts[3];
            const timeParts = etime.split(/[-:]/);
            if (timeParts.length === 2) {
              // MM:SS
              stats.uptime = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
            } else if (timeParts.length === 3) {
              // HH:MM:SS
              stats.uptime = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
            } else if (timeParts.length === 4) {
              // DD-HH:MM:SS
              stats.uptime = parseInt(timeParts[0]) * 86400 + parseInt(timeParts[1]) * 3600 + 
                           parseInt(timeParts[2]) * 60 + parseInt(timeParts[3]);
            }
          }
        }
      } catch (error) {
        // Process might have died between check and stats
        console.warn(`⚠️  Could not get stats for process ${session.pid}`);
      }
    }

    return stats;
  }

  // Add close method for proper cleanup
  async close() {
    // Stop all active processes
    for (const [sessionId, { process }] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
      } catch (e) {
        // Process might already be dead
      }
    }
    
    // Clear the map
    this.activeProcesses.clear();
    
    // Close database connection
    if (this.db) {
      await this.db.close();
    }
  }

  async enforceResourceLimits() {
    const sessions = await this.getActiveSessions();
    const killed = [];

    for (const session of sessions) {
      if (session.pid && this.isProcessAlive(session.pid)) {
        try {
          const stats = await this.getResourceStats(session.id);
          
          // Check memory limit
          if (stats.memory > this.options.maxMemoryMB) {
            console.warn(`⚠️  Session ${session.id} exceeds memory limit: ${stats.memory}MB > ${this.options.maxMemoryMB}MB`);
            await this.stopSession(session.id, true); // Force kill
            killed.push({
              sessionId: session.id,
              reason: 'memory_exceeded',
              usage: stats.memory,
              limit: this.options.maxMemoryMB
            });
          }
        } catch (error) {
          console.error(`❌ Error checking resources for ${session.id}:`, error.message);
        }
      }
    }

    // Check concurrent process limit
    const runningCount = sessions.filter(s => s.status === 'running').length;
    if (runningCount > this.options.maxConcurrentProcesses) {
      console.warn(`⚠️  Too many concurrent processes: ${runningCount} > ${this.options.maxConcurrentProcesses}`);
      
      // Kill oldest processes first
      const toKill = sessions
        .filter(s => s.status === 'running')
        .sort((a, b) => a.started_at - b.started_at)
        .slice(0, runningCount - this.options.maxConcurrentProcesses);
      
      for (const session of toKill) {
        await this.stopSession(session.id, true);
        killed.push({
          sessionId: session.id,
          reason: 'concurrent_limit',
          limit: this.options.maxConcurrentProcesses
        });
      }
    }

    return killed;
  }

  // Alias for compatibility
  async stop(sessionId, forceKill = false) {
    return this.stopSession(sessionId, forceKill);
  }
}

module.exports = ProcessManager;