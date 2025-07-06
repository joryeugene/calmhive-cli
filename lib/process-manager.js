/**
 * ProcessManager - Core orchestrator for AFk background sessions and process lifecycle management
 *
 * Manages the complete lifecycle of background Claude processes including:
 * - Session creation and execution
 * - Process monitoring and cleanup
 * - Adaptive retry logic with context monitoring
 * - Log management and progress tracking
 * - Rule injection and tool management integration
 *
 * @example
 * const pm = new ProcessManager();
 * await pm.startAfkSession('analyze codebase', { iterations: 10 });
 * const status = await pm.getSessionStatus('afk-12345');
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const SessionDatabase = require('./session-database');
const AdaptiveRetry = require('./adaptive-retry');
const toolManager = require('./tool-manager');
const ContextMonitor = require('./context-monitor');
const ProgressTracker = require('./progress-tracker');
const ruleInjector = require('./rule-injector');

class ProcessManager {
  /**
   * Creates a new ProcessManager instance
   *
   * Initializes the session database, active process tracking, log directory,
   * and sets up cleanup handlers for graceful shutdown.
   */
  constructor() {
    this.db = new SessionDatabase();
    this.activeProcesses = new Map();
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDir();
    this.setupCleanup();
  }

  /**
   * Ensures the log directory exists for session output
   *
   * Creates the logs directory if it doesn't exist. Used for storing
   * detailed AFk session logs and debugging information.
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Sets up graceful cleanup handlers for process termination
   *
   * Registers signal handlers for SIGINT and SIGTERM to properly clean up
   * active processes and their associated caffeinate processes when the
   * ProcessManager is terminated.
   */
  setupCleanup() {
    process.setMaxListeners(20);

    const cleanup = async () => {
      for (const processInfo of this.activeProcesses.values()) {
        try {
          processInfo.process.kill('SIGTERM');
          // Kill caffeinate if present
          if (processInfo.caffeinatePid) {
            try {
              process.kill(processInfo.caffeinatePid, 'SIGTERM');
            } catch (e) {
              // Caffeinate might already be dead
            }
          }
        } catch (e) {
          // Process might already be dead
        }
      }
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  /**
   * Cleans up stale sessions that are no longer running
   *
   * Identifies sessions marked as 'running' but no longer active by:
   * - Checking active process tracking
   * - Validating PIDs are still alive
   * - Searching for Claude processes with AFk patterns
   * - Monitoring AFk registry logs for recent activity
   *
   * AFk sessions are considered stale if:
   * - No context monitor log updates for 15+ minutes
   * - No database updates for 30+ minutes
   *
   * @returns {Promise<void>} Resolves when cleanup is complete
   */
  async cleanupStaleSessions() {
    const { spawn } = require('child_process');

    // Clean up any sessions marked as running that aren't actually running
    const sessions = await this.db.getAllSessions();
    const staleSessions = sessions.filter(s => s.status === 'running');

    for (const session of staleSessions) {
      // Skip AFk background sessions - they run detached
      if (session.type === 'afk') {
        // Check if iteration is progressing by looking at context monitor logs
        const afkRegistryPath = path.join(process.env.HOME, '.claude', 'afk_registry', session.id, 'context-monitor.log');
        if (fs.existsSync(afkRegistryPath)) {
          const stat = fs.statSync(afkRegistryPath);
          const lastModified = stat.mtime.getTime();
          const ageMinutes = (Date.now() - lastModified) / 1000 / 60;

          // If log was updated in last 15 minutes, session is still active
          if (ageMinutes < 15) {
            console.log(`✅ AFk session ${session.id} is active (log updated ${Math.round(ageMinutes)} minutes ago)`);
            continue;
          }
        }

        // Check if more than 30 minutes since last update - likely stale
        const sessionAge = (Date.now() - session.updated_at) / 1000 / 60;
        if (sessionAge > 30) {
          console.log(`🧹 Cleaning up stale AFk session: ${session.id} (no activity for ${Math.round(sessionAge)} minutes)`);
          await this.db.updateSession(session.id, {
            status: 'error',
            error: 'AFk session timed out - no progress detected',
            completed_at: Date.now(),
            pid: null
          });
        }
        continue;
      }

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

  /**
   * Restores sessions that were incorrectly marked as error but are still running
   *
   * Searches for active AFk processes and updates their session status from 'error'
   * back to 'running'. This handles cases where sessions continue running after
   * being marked as failed due to temporary issues.
   *
   * @returns {Promise<void>} Resolves when all sessions have been checked and restored
   */
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
          const hasAfkProcess = output.includes('commands/afk') &&
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

  /**
   * Starts a new AFk session in either background or foreground mode
   *
   * @param {string} task - The task description to execute
   * @param {Object} options - Session configuration options
   * @param {number} [options.iterations=10] - Number of iterations to run
   * @param {boolean} [options.background=false] - Whether to run in background
   * @param {string} [options.model] - Claude model to use
   * @param {boolean} [options.preventSleep=true] - Whether to prevent system sleep
   * @param {number} [options.checkpointInterval=1800] - Checkpoint interval in seconds
   * @returns {Promise<Object>} Session object with id and metadata
   * @throws {Error} If session creation fails
   */
  async startAfkSession(task, options = {}) {
    // If background mode requested, spawn a detached worker
    if (options.background === true) {
      return this.startAfkSessionBackground(task, options);
    }

    // Otherwise run in foreground (for tests, direct calls)
    return this.startAfkSessionForeground(task, options);
  }

  /**
   * Starts an AFk session in background mode using a detached worker process
   *
   * Creates a detached Node.js worker process that runs independently of the
   * parent process. This allows long-running AFk sessions to continue even
   * if the main CLI process exits.
   *
   * @param {string} task - The task description to execute
   * @param {Object} options - Session configuration options
   * @returns {Promise<Object>} Session object with worker PID
   * @throws {Error} If worker process creation fails
   */
  async startAfkSessionBackground(task, options = {}) {
    try {
      // Create session record first
      const metadata = {
        checkpointInterval: options.checkpointInterval || 1800,
        preventSleep: options.preventSleep !== false,
        background: true
      };

      const session = await this.db.createSession({
        type: 'afk',
        task,
        status: 'running',
        iterations: options.iterations || 10,
        working_directory: process.cwd(),
        model: options.model || null,
        metadata: JSON.stringify(metadata)
      });

      // Create initial log file immediately
      const logFile = path.join(this.logDir, `${session.id}.log`);
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      fs.writeFileSync(logFile, `[${new Date().toISOString()}] Session ${session.id} created\n[${new Date().toISOString()}] Task: ${task}\n[${new Date().toISOString()}] Iterations: ${options.iterations || 10}\n`);

      // Spawn detached worker process
      const workerPath = path.join(__dirname, 'afk-worker.js');
      const config = JSON.stringify({
        task,
        options,
        sessionId: session.id,
        workingDirectory: session.working_directory
      });

      const worker = spawn('node', [workerPath, config], {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
        cwd: session.working_directory
      });

      // Store worker PID
      worker.unref();
      await this.db.updateSession(session.id, {
        pid: worker.pid
      });

      // Track the worker
      this.activeProcesses.set(session.id, {
        process: worker,
        pid: worker.pid,
        iteration: 0
      });

      console.log(`\n✅ AFk session started in background (PID: ${worker.pid})`);
      return session;

    } catch (error) {
      console.error('❌ Failed to start background AFk session:', error);
      throw error;
    }
  }

  /**
   * Executes the complete AFk iteration loop for an existing session
   *
   * Manages the full execution lifecycle including:
   * - Log file creation and management
   * - Sleep prevention with caffeinate
   * - Adaptive retry logic for usage limits
   * - Progress tracking and milestone reporting
   * - Context monitoring and cleanup
   *
   * @param {Object} session - Session object from database
   * @param {Object} _options - Reserved for future options (API consistency)
   * @returns {Promise<void>} Resolves when all iterations complete or session stops
   */
  async runAfkIterations(session, _options = {}) {
    // This method runs the actual AFk iterations for an existing session
    // Options parameter kept for API consistency with other run methods
    const logFile = path.join(this.logDir, `${session.id}.log`);

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    logStream.write(`[${new Date().toISOString()}] Starting AFk iterations\n`);

    // Parse metadata from session
    const metadata = typeof session.metadata === 'string' ?
      JSON.parse(session.metadata) : session.metadata;

    // Start caffeinate if iterations > 5 and not disabled
    let caffeinateProcess = null;
    let caffeinatePid = null;
    const shouldPreventSleep = session.iterations_planned > 5 && metadata.preventSleep;

    if (shouldPreventSleep) {
      try {
        caffeinateProcess = spawn('caffeinate', ['-i', '-m', '-s'], {
          detached: true,
          stdio: 'ignore'
        });

        caffeinatePid = caffeinateProcess.pid;
        console.log(`☕ Sleep prevention enabled (caffeinate PID: ${caffeinatePid})`);
        logStream.write(`[${new Date().toISOString()}] Sleep prevention enabled (caffeinate PID: ${caffeinatePid})\n`);
      } catch (error) {
        console.log(`☕ Could not start sleep prevention: ${error.message}`);
        logStream.write(`[${new Date().toISOString()}] Could not start sleep prevention: ${error.message}\n`);
      }
    }

    // Initialize adaptive retry for usage limits
    const adaptiveRetry = new AdaptiveRetry();

    // Initialize progress tracker
    const progressTracker = new ProgressTracker(session.id, {
      totalIterations: session.iterations_planned
    });
    await progressTracker.init();
    await progressTracker.updateProgress({
      status: 'starting',
      currentIteration: 0
    });

    // Run iterations
    for (let i = 1; i <= session.iterations_planned; i++) {
      // Check if session was stopped
      const currentSession = await this.db.getSession(session.id);
      if (!currentSession || currentSession.status === 'stopped' || currentSession.status === 'error') {
        console.log(`\n🛑 Session ${session.id} was stopped`);
        break;
      }

      console.log(`Starting iteration ${i}/${session.iterations_planned}`);

      // Track iteration start
      await progressTracker.startIteration(i);

      await this.db.updateSession(session.id, {
        iterations_completed: i - 1,
        status: 'running'
      });

      let success = await this.runSingleIteration(session, i, logStream, adaptiveRetry, progressTracker);

      if (!success) {
        // Handle usage limits with exponential backoff
        const delay = adaptiveRetry.getNextDelay();
        const delayMinutes = Math.round(delay / 60000);
        console.log(`⏳ Usage limit likely hit. Waiting ${delayMinutes} minutes before retry...`);

        await new Promise(resolve => setTimeout(resolve, delay));
        i--; // Retry the same iteration
        continue;
      }

      // Update completed count
      await this.db.updateSession(session.id, {
        iterations_completed: i
      });

      // Wait between iterations
      if (i < session.iterations_planned) {
        const delay = Math.max(5000, adaptiveRetry.getNextDelay() / 6);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Clean up
    const finalSession = await this.db.getSession(session.id);
    if (finalSession && finalSession.status === 'running') {
      await this.db.updateSession(session.id, {
        status: 'completed',
        completed_at: Date.now()
      });

      // Complete progress tracking
      await progressTracker.updateProgress({
        status: 'completed',
        currentIteration: session.iterations_planned
      });
      await progressTracker.generateFinalReport();

      console.log(`\n📊 View detailed iteration summaries: calmhive progress ${session.id}`);
      logStream.write(`[${new Date().toISOString()}] 📊 View detailed iteration summaries: calmhive progress ${session.id}\n`);
    }

    if (caffeinatePid) {
      try {
        process.kill(caffeinatePid, 'SIGTERM');
        console.log('☕ Sleep prevention disabled');
      } catch (e) {
        // Already dead
      }
    }

    logStream.end();
  }

  /**
   * Starts an AFk session in foreground mode for testing and direct execution
   *
   * Runs the AFk session in the current process with full console output.
   * Suitable for testing, debugging, and direct execution scenarios where
   * you want to monitor the session in real-time.
   *
   * @param {string} task - The task description to execute
   * @param {Object} options - Session configuration options
   * @returns {Promise<Object>} Session object after completion
   * @throws {Error} If session execution fails
   */
  async startAfkSessionForeground(task, options = {}) {
    let caffeinatePid = null; // Declare in function scope to access in catch block

    try {
      const metadata = {
        checkpointInterval: options.checkpointInterval || 1800,
        preventSleep: options.preventSleep !== false // Default true unless explicitly false
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
      logStream.write(`[${new Date().toISOString()}] Iterations: ${session.iterations_planned}\n`);

      // Start caffeinate if iterations > 5 and not disabled
      let caffeinateProcess = null;
      const shouldPreventSleep = session.iterations_planned > 5 && metadata.preventSleep;

      if (shouldPreventSleep) {
        try {
          // Check if caffeinate exists
          const { execSync } = require('child_process');
          try {
            execSync('which caffeinate', { stdio: 'ignore' });
          } catch (e) {
            console.log('☕ Caffeinate not found, session may be interrupted by sleep');
            logStream.write(`[${new Date().toISOString()}] Caffeinate not available\n`);
          }

          // Start caffeinate to prevent sleep
          caffeinateProcess = spawn('caffeinate', ['-i', '-m', '-s'], {
            detached: true,
            stdio: 'ignore'
          });

          caffeinatePid = caffeinateProcess.pid;
          console.log(`☕ Sleep prevention enabled (caffeinate PID: ${caffeinatePid})`);
          logStream.write(`[${new Date().toISOString()}] Sleep prevention enabled (caffeinate PID: ${caffeinatePid})\n`);

          // Store caffeinate PID in session metadata
          const updatedMetadata = { ...metadata, caffeinatePid };
          await this.db.updateSession(session.id, {
            metadata: JSON.stringify(updatedMetadata)
          });
        } catch (error) {
          console.log(`☕ Could not start sleep prevention: ${error.message}`);
          logStream.write(`[${new Date().toISOString()}] Could not start sleep prevention: ${error.message}\n`);
        }
      } else if (session.iterations_planned > 5) {
        console.log('☕ Sleep prevention disabled by flag');
        logStream.write(`[${new Date().toISOString()}] Sleep prevention disabled by user\n`);
      }

      logStream.write('\n');

      // Initialize adaptive retry for usage limits
      const adaptiveRetry = new AdaptiveRetry();

      // Run iterations
      for (let i = 1; i <= session.iterations_planned; i++) {
        // Check if session was stopped
        const currentSession = await this.db.getSession(session.id);
        if (!currentSession || currentSession.status === 'stopped' || currentSession.status === 'error') {
          console.log(`\n🛑 Session ${session.id} was stopped`);
          break;
        }

        console.log(`Starting iteration ${i}/${session.iterations_planned}`);

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

          // Use interruptible sleep for usage limit wait
          const checkInterval = 5000; // Check every 5 seconds during long waits
          let waitedTime = 0;

          while (waitedTime < delay) {
            await new Promise(resolve => setTimeout(resolve, Math.min(checkInterval, delay - waitedTime)));
            waitedTime += checkInterval;

            // Check if session was stopped during wait
            const currentSession = await this.db.getSession(session.id);
            if (!currentSession || currentSession.status === 'stopped' || currentSession.status === 'error') {
              console.log('\n🛑 Session stopped during usage limit wait');
              i = session.iterations_planned + 1; // Force exit from outer loop
              break;
            }
          }

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

        // Add completion messages and milestone tracking
        console.log(`Iteration ${i} complete`);
        console.log(`Duration: ${Math.round((Date.now() - (Date.now() - 5000)) / 1000)}s`); // Mock duration for now

        // Check for milestones (every 3rd iteration or when approaching completion)
        if (i % 3 === 0 || i >= session.iterations_planned * 0.8) {
          console.log(`🎯 Milestone: Completed ${i}/${session.iterations_planned} iterations`);
        }

        // Wait between iterations using adaptive delay
        if (i < session.iterations_planned) {
          const delay = adaptiveRetry.getNextDelay() / 6; // Reduce delay for normal operation
          const delaySeconds = Math.max(5, delay / 1000); // Minimum 5 seconds
          console.log(`⏱️ Waiting ${delaySeconds} seconds before next iteration...`);

          // Use interruptible sleep that checks session status
          const sleepInterval = 1000; // Check every second
          const totalSleepTime = delaySeconds * 1000;
          let sleptTime = 0;

          while (sleptTime < totalSleepTime) {
            await new Promise(resolve => setTimeout(resolve, sleepInterval));
            sleptTime += sleepInterval;

            // Check if session was stopped during sleep
            const currentSession = await this.db.getSession(session.id);
            if (!currentSession || currentSession.status === 'stopped' || currentSession.status === 'error') {
              console.log('\n🛑 Session stopped during wait');
              i = session.iterations_planned + 1; // Force exit from outer loop
              break;
            }
          }
        }
      }

      // Only mark as completed if it wasn't stopped
      const finalSession = await this.db.getSession(session.id);
      if (finalSession && finalSession.status === 'running') {
        await this.db.updateSession(session.id, {
          status: 'completed',
          completed_at: Date.now()
        });
      }

      // Kill caffeinate if it was started
      if (caffeinatePid) {
        try {
          process.kill(caffeinatePid, 'SIGTERM');
          console.log('☕ Sleep prevention disabled (caffeinate stopped)');
          logStream.write(`[${new Date().toISOString()}] Sleep prevention disabled\n`);
        } catch (e) {
          // Caffeinate might already be dead
        }
      }

      logStream.end();
      return session;

    } catch (error) {
      console.error('❌ Failed to start AFk session:', error);

      // Clean up caffeinate on error
      if (caffeinatePid) {
        try {
          process.kill(caffeinatePid, 'SIGTERM');
        } catch (e) {
          // Ignore
        }
      }

      throw error;
    }
  }

  /**
   * Executes a single AFk iteration with comprehensive monitoring and error handling
   *
   * This is the core execution method that:
   * - Spawns Claude process with appropriate flags and tools
   * - Implements rule injection via chat interceptor
   * - Monitors for context limits, usage limits, and errors
   * - Handles automatic /compact commands for context management
   * - Tracks progress and generates detailed logs
   * - Implements adaptive retry logic for resilience
   *
   * @param {Object} session - Session configuration object
   * @param {number} iterationNum - Current iteration number (1-based)
   * @param {fs.WriteStream} logStream - Log file stream for output
   * @param {AdaptiveRetry} adaptiveRetry - Retry strategy handler
   * @param {ProgressTracker} [progressTracker=null] - Progress tracking instance
   * @returns {Promise<boolean>} True if iteration succeeded, false if retry needed
   */
  async runSingleIteration(session, iterationNum, logStream, adaptiveRetry, progressTracker = null) {
    return new Promise((resolve) => {
      // Initialize context monitor for this iteration
      const contextMonitor = new ContextMonitor(session.id);
      contextMonitor.logEvent('iteration_start', { iterationNum });

      // Check for test mode - mock execution
      if (process.env.CALMHIVE_TEST_MODE === 'true') {
        console.log(`→ ✅ Mock iteration ${iterationNum} executing successfully`);

        // Simulate short execution time
        setTimeout(() => {
          console.log(`→ ✅ Mock iteration ${iterationNum} completed`);
          if (progressTracker) {
            progressTracker.completeIteration({
              success: true,
              exitCode: 0,
              summary: `Mock iteration ${iterationNum} completed successfully`,
              contextReport: { contextLimitHits: 0, successfulCompacts: 0 }
            });
          }

          contextMonitor.logEvent('iteration_end', { iterationNum, exitCode: 0 });
          resolve(true);
        }, 2000); // 2 second mock execution
        return;
      }

      // Check if rule injection is enabled for AFk
      const settingsPath = path.join(require('os').homedir(), '.claude', 'calmhive-settings.json');
      let useInterceptor = true; // Default enabled

      try {
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          if (settings.ruleInjection) {
            useInterceptor = settings.ruleInjection.enabled !== false;
          }
        }
      } catch (error) {
        // If settings can't be read, default to enabled
        useInterceptor = true;
      }

      // Build claude command with optional interceptor
      let claudeProcess;

      if (useInterceptor) {
        // Use interceptor - spawn node with --require flag
        const interceptorPath = path.join(__dirname, 'chat-interceptor.js');
        const claudePath = require('child_process').execSync('which claude', { encoding: 'utf8' }).trim();

        const nodeArgs = ['--require', interceptorPath, claudePath, '-p'];
        if (iterationNum > 1 && !session.needsContextReset) {
          nodeArgs.push('-c');
        }

        // Reset context flag after using it
        if (session.needsContextReset) {
          console.log(`🔄 Starting iteration ${iterationNum} with fresh context (no -c flag)`);
          session.needsContextReset = false;
        }

        const allTools = toolManager.getAllToolsArray();
        nodeArgs.push('--allowedTools', ...allTools);

        console.log(`🔗 AFk iteration ${iterationNum} using rule injection interceptor`);

        claudeProcess = spawn('node', nodeArgs, {
          cwd: session.working_directory,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            CALMHIVE_DEBUG: '1' // Enable debug mode for AFk
          }
        });
      } else {
        // Direct claude without interceptor
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

        console.log(`📝 AFk iteration ${iterationNum} using direct claude (no injection)`);

        claudeProcess = spawn('claude', args, {
          cwd: session.working_directory,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      }

      // Track the process immediately
      const processInfo = {
        process: claudeProcess,
        iteration: iterationNum,
        pid: claudeProcess.pid
      };

      // Add caffeinate PID if present in metadata
      if (session.metadata) {
        try {
          const metadata = typeof session.metadata === 'string' ?
            JSON.parse(session.metadata) : session.metadata;
          if (metadata.caffeinatePid) {
            processInfo.caffeinatePid = metadata.caffeinatePid;
          }
        } catch (e) {
          // Ignore metadata parse errors
        }
      }

      this.activeProcesses.set(session.id, processInfo);

      // Update session with current PID
      this.db.updateSession(session.id, {
        pid: claudeProcess.pid
      }).catch(console.error);

      let stderrOutput = '';
      let stdoutOutput = '';
      let needsContextReset = false;
      let usageLimitDetected = false;

      claudeProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
        // Check for usage limit indicators (only once per iteration)
        if (!usageLimitDetected && (stderrOutput.includes('rate limit') || stderrOutput.includes('usage limit') || stderrOutput.includes('quota') ||
            stderrOutput.includes('Claude Max usage limit reached') ||
            stderrOutput.includes('Your limit will reset at'))) {
          console.log('⚠️ Usage limit detected in stderr - triggering retry mechanism');
          adaptiveRetry.recordFailure();
          usageLimitDetected = true;
        }
      });

      claudeProcess.stdout.on('data', (data) => {
        stdoutOutput += data.toString();

        // Monitor output for context patterns
        contextMonitor.monitorOutput(data.toString());

        // Track progress if available
        if (progressTracker) {
          progressTracker.logAction('output_received', {
            length: data.toString().length
          });
        }

        // Display action result arrows for key operations
        const dataStr = data.toString();
        if (dataStr.includes('✅') || dataStr.includes('❌')) {
          // Extract operation result and show with arrow
          const lines = dataStr.split('\n');
          for (const line of lines) {
            if (line.includes('✅') || line.includes('❌')) {
              const cleanLine = line.trim();
              if (cleanLine.length > 0) {
                console.log(`→ ${cleanLine}`);
              }
            }
          }
        }

        // Check for context limit indicators and trigger compact
        if (stdoutOutput.includes('Prompt is too long') ||
            stdoutOutput.includes('Context low') ||
            stdoutOutput.includes('Run /compact to compact') ||
            stdoutOutput.includes('/compact') ||
            stdoutOutput.includes('context limit') ||
            stdoutOutput.includes('Message too long')) {
          console.log('🔄 Context limit detected, attempting to send /compact command');

          // Try multiple approaches to send compact command
          const compactAttempts = [
            { method: 'standard', fn: () => claudeProcess.stdin.write('/compact\n') },
            { method: 'newline_prefix', fn: () => claudeProcess.stdin.write('\n/compact\n') },
            { method: 'carriage_return', fn: () => claudeProcess.stdin.write('/compact\r\n') },
            { method: 'no_slash', fn: () => claudeProcess.stdin.write('\ncompact\n') },
            { method: 'delayed', fn: () => {
              claudeProcess.stdin.write('\n');
              setTimeout(() => claudeProcess.stdin.write('/compact\n'), 100);
            }}
          ];

          let success = false;
          for (const attempt of compactAttempts) {
            try {
              attempt.fn();
              console.log(`📦 Sent /compact command variant (${attempt.method}) to compress context`);
              contextMonitor.logCompactAttempt(attempt.method, true);
              success = true;
              break;
            } catch (e) {
              console.log(`⚠️ Compact attempt (${attempt.method}) failed: ${e.message}`);
              contextMonitor.logCompactAttempt(attempt.method, false, e);
            }
          }

          if (!success) {
            console.log('⚠️ All /compact attempts failed, will reset context on next iteration');
            needsContextReset = true;
            contextMonitor.logEvent('compact_failure', { allAttemptsFailed: true });
          }
        }

        // Check for usage limit indicators
        if (stdoutOutput.includes('Claude Max usage limit reached') ||
            stdoutOutput.includes('Your limit will reset at') ||
            stdoutOutput.includes('upgrade to a higher plan')) {
          console.log('⚠️ Usage limit detected - triggering retry mechanism');
          adaptiveRetry.recordFailure();
        }
      });

      // Send prompt - inject rules at EVERY iteration to prevent drift
      let prompt;
      if (iterationNum === 1) {
        // First iteration - full task with rules
        prompt = `${session.task}

This is iteration ${iterationNum} of ${session.iterations_planned} for AFk session ${session.id}.

Requirements:
- Use available tools to make progress on the task
- Document your work clearly
- If you complete the task, verify it works properly
- If context becomes low, use /compact to compress and continue (preferred over stopping)

lets bee friends`;
      } else {
        // Subsequent iterations - re-inject rules to prevent drift
        const enhancedContinuation = ruleInjector.injectRules(
          `Continue working on: ${session.task}`,
          { commandType: 'afk', iteration: iterationNum }
        );

        prompt = `${enhancedContinuation}

This is iteration ${iterationNum} of ${session.iterations_planned}.

If context becomes low, use /compact to compress and continue working.

lets bee friends`;
      }

      claudeProcess.stdin.write(prompt);
      claudeProcess.stdin.end();

      // Log output
      claudeProcess.stdout.pipe(logStream, { end: false });
      claudeProcess.stderr.pipe(logStream, { end: false });

      logStream.write(`\n[${new Date().toISOString()}] === ITERATION ${iterationNum} START ===\n`);

      // Record start time for duration calculation
      const iterationStartTime = Date.now();

      // Wait for completion
      claudeProcess.on('exit', (code) => {
        const iterationEndTime = Date.now();
        const duration = Math.round((iterationEndTime - iterationStartTime) / 1000);

        console.log(`Iteration ${iterationNum} complete`);
        console.log(`Duration: ${duration}s`);

        // Check for milestones (every 3rd iteration or when approaching completion)
        if (iterationNum % 3 === 0 || iterationNum >= session.iterations_planned * 0.8) {
          console.log(`🎯 Milestone: Completed ${iterationNum}/${session.iterations_planned} iterations`);
        }

        logStream.write(`[${new Date().toISOString()}] === ITERATION ${iterationNum} END (code: ${code}) ===\n`);

        // Generate context report for this iteration
        contextMonitor.logEvent('iteration_end', { iterationNum, exitCode: code });
        const contextReport = contextMonitor.generateReport();
        if (contextReport.contextLimitHits > 0) {
          console.log(`📊 Context Report: ${contextReport.contextLimitHits} limit hits, ${contextReport.successfulCompacts} successful compacts`);
          logStream.write(`[${new Date().toISOString()}] Context Report: ${contextReport.contextLimitHits} limit hits, ${contextReport.successfulCompacts} successful compacts\n`);
        }

        // Complete iteration in progress tracker
        if (progressTracker) {
          const summary = stdoutOutput.substring(stdoutOutput.lastIndexOf('\n', stdoutOutput.length - 100)).trim();
          const iterationData = {
            success: code === 0,
            exitCode: code,
            summary: summary.substring(0, 500),
            contextReport: contextReport
          };
          progressTracker.completeIteration(iterationData);

          // Also log iteration summary to the main log
          if (iterationData.summary) {
            const statusIcon = code === 0 ? '✅' : '❌';
            logStream.write(`[${new Date().toISOString()}] ${statusIcon} Iteration ${iterationNum} Summary: ${iterationData.summary.substring(0, 200)}...\n`);
          }
        }

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
          console.log('⚠️ Usage limit detected in output - triggering exponential backoff');
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

  /**
   * Cleans up resources for a specific session
   *
   * Terminates any active processes and removes them from tracking.
   * Safe to call multiple times for the same session.
   *
   * @param {string} sessionId - Session ID to clean up
   */
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

  /**
   * Gets all sessions from the database
   * @returns {Promise<Array>} Array of all session objects
   */
  async getStatus() {
    return this.db.getAllSessions();
  }

  /**
   * Gets only currently active sessions
   * @returns {Promise<Array>} Array of active session objects
   */
  async getActiveSessions() {
    return this.db.getActiveSessions();
  }

  /**
   * Gets session statistics and counts
   * @returns {Promise<Object>} Statistics object with counts by status
   */
  async getSessionStats() {
    return this.db.getSessionStats();
  }

  /**
   * Stops a running AFk session and terminates all associated processes
   *
   * Implements a multi-method approach to ensure process termination:
   * 1. Kills caffeinate process if present
   * 2. Terminates tracked Claude process
   * 3. Kills process by stored PID
   * 4. Searches for and kills orphaned worker processes
   *
   * Updates session status to 'stopped' and cleans up all tracking.
   *
   * @param {string} sessionId - Session ID to stop
   * @throws {Error} If session is not found
   */
  async stopSession(sessionId) {
    // First check if session exists
    const session = await this.db.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Kill caffeinate if present
    if (session.metadata) {
      try {
        const metadata = typeof session.metadata === 'string' ?
          JSON.parse(session.metadata) : session.metadata;
        if (metadata.caffeinatePid) {
          try {
            process.kill(metadata.caffeinatePid, 'SIGTERM');
            console.log(`☕ Killed caffeinate process PID ${metadata.caffeinatePid}`);
          } catch (e) {
            // Caffeinate might already be dead
          }
        }
      } catch (e) {
        // Ignore metadata parse errors
      }
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

    // Method 3: Find and kill worker processes
    if (!killed) {
      console.log('🔍 Searching for AFk worker process...');
      const { spawn } = require('child_process');

      const killWorkers = await new Promise((resolve) => {
        const ps = spawn('ps', ['aux']);
        let output = '';

        ps.stdout.on('data', (data) => {
          output += data.toString();
        });

        ps.on('close', () => {
          const lines = output.split('\n');
          let killedCount = 0;

          for (const line of lines) {
            // Look for AFk worker processes with this session ID
            if (line.includes('afk-worker.js')) {
              // Check if the line contains our session ID
              if (line.includes(sessionId)) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[1];
                if (pid && !isNaN(pid)) {
                  try {
                    process.kill(parseInt(pid), 'SIGTERM');
                    console.log(`🛑 Killed AFk worker process PID ${pid}`);
                    killedCount++;
                  } catch (e) {
                    // Process might already be dead
                  }
                }
              }
            }
            // Also look for Claude processes with AFk flags (legacy)
            else if (line.includes('claude') && (line.includes('-p -c') || line.includes('-c -p'))) {
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

      if (killWorkers) {
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

  /**
   * Comprehensive database and process validation
   * Detects and fixes desync between database and actual running processes
   */
  async validateSystemIntegrity() {
    console.log('🔍 Validating system integrity...');

    // Get all sessions and check their actual process status
    const sessions = await this.db.getAllSessions();
    const runningSessions = sessions.filter(s => s.status === 'running');

    let fixed = 0;
    let orphansFound = 0;
    const issues = [];

    // Step 1: Validate running sessions have actual processes
    for (const session of runningSessions) {
      if (session.pid) {
        try {
          // Check if PID exists
          process.kill(session.pid, 0);
          console.log(`✅ Session ${session.id} PID ${session.pid} is valid`);
        } catch (error) {
          // PID doesn't exist - update database
          console.log(`🔧 Fixing stale session ${session.id} (PID ${session.pid} not found)`);
          await this.db.updateSession(session.id, {
            status: 'error',
            error: 'Process terminated unexpectedly',
            completed_at: Date.now(),
            pid: null
          });
          fixed++;
          issues.push(`Fixed stale session ${session.id}`);
        }
      } else {
        // No PID stored - check if it's a legitimate AFk session
        if (session.type === 'afk') {
          // Check AFk registry for activity
          const afkRegistryPath = path.join(process.env.HOME, '.claude', 'afk_registry', session.id, 'context-monitor.log');
          if (fs.existsSync(afkRegistryPath)) {
            const stat = fs.statSync(afkRegistryPath);
            const lastModified = stat.mtime.getTime();
            const ageMinutes = (Date.now() - lastModified) / 1000 / 60;

            if (ageMinutes > 30) {
              console.log(`🔧 Marking inactive AFk session as stale: ${session.id}`);
              await this.db.updateSession(session.id, {
                status: 'error',
                error: 'AFk session inactive for over 30 minutes',
                completed_at: Date.now()
              });
              fixed++;
              issues.push(`Fixed inactive AFk session ${session.id}`);
            }
          } else {
            console.log(`🔧 Marking AFk session without registry as stale: ${session.id}`);
            await this.db.updateSession(session.id, {
              status: 'error',
              error: 'AFk session has no registry file',
              completed_at: Date.now()
            });
            fixed++;
            issues.push(`Fixed untracked AFk session ${session.id}`);
          }
        } else {
          console.log(`🔧 Marking session without PID as stale: ${session.id}`);
          await this.db.updateSession(session.id, {
            status: 'error',
            error: 'Session has no process ID',
            completed_at: Date.now()
          });
          fixed++;
          issues.push(`Fixed session without PID ${session.id}`);
        }
      }
    }

    // Step 2: Find orphaned processes
    const orphanResult = await this.findOrphanProcesses();
    orphansFound = orphanResult.found;
    if (orphanResult.pids.length > 0) {
      issues.push(`Found ${orphanResult.found} orphan processes: ${orphanResult.pids.join(', ')}`);
    }

    console.log('🎯 System integrity validation complete');
    console.log(`   Fixed database issues: ${fixed}`);
    console.log(`   Orphaned processes found: ${orphansFound}`);

    return {
      fixed,
      orphansFound,
      issues
    };
  }

  /**
   * Find orphaned processes without killing them
   */
  async findOrphanProcesses() {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const ps = spawn('ps', ['aux']);
      let output = '';

      ps.stdout.on('data', (data) => {
        output += data.toString();
      });

      ps.on('close', () => {
        const lines = output.split('\n');
        let foundCount = 0;
        const foundPids = [];

        for (const line of lines) {
          // Look for AFk processes or Claude processes with AFk flags
          if (line.includes('commands/afk') ||
              (line.includes('claude') && (line.includes('-p -c') || line.includes('-c -p'))) ||
              line.includes('afk-worker.js')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[1];
            if (pid && !isNaN(pid)) {
              foundPids.push(pid);
              foundCount++;
              console.log(`🚨 Found potential orphan process PID ${pid}: ${line.substring(0, 80)}...`);
            }
          }
        }

        resolve({ found: foundCount, pids: foundPids });
      });
    });
  }

  async killOrphanProcesses() {
    console.log('🔍 Searching for orphan Claude processes...');
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
          // Look for AFk worker processes
          if (line.includes('afk-worker.js')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[1];
            if (pid && !isNaN(pid)) {
              try {
                process.kill(parseInt(pid), 'SIGTERM');
                console.log(`🛑 Killed orphan AFk worker process PID ${pid}`);
                killedPids.push(pid);
                killedCount++;
              } catch (e) {
                console.log(`⚠️ Failed to kill PID ${pid}: ${e.message}`);
              }
            }
          }
          // Look for Claude processes with AFk flags
          else if (line.includes('claude') && (line.includes('-p -c') || line.includes('-c -p'))) {
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
          // Also look for orphan caffeinate processes
          else if (line.includes('caffeinate') && (line.includes('-i') || line.includes('-m') || line.includes('-s'))) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[1];
            if (pid && !isNaN(pid)) {
              try {
                process.kill(parseInt(pid), 'SIGTERM');
                console.log(`☕ Killed orphan caffeinate process PID ${pid}`);
                killedPids.push(pid);
                killedCount++;
              } catch (e) {
                // Process might already be dead
              }
            }
          }
        }

        if (killedCount > 0) {
          console.log(`✅ Killed ${killedCount} orphan processes: ${killedPids.join(', ')}`);
        } else {
          console.log('✅ No orphan Claude processes found');
        }

        resolve({ killed: killedCount, pids: killedPids });
      });
    });
  }
}

module.exports = ProcessManager;
