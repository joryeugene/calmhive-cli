/**
 * AFkExecutor - Handles AFk iteration execution and retry logic
 *
 * Manages the execution of AFk sessions including iteration processing,
 * adaptive retry logic, context monitoring, and progress tracking.
 * Extracted from ProcessManager to provide focused responsibility
 * for AFk execution logic.
 */

const { spawn } = require('child_process');
const AdaptiveRetry = require('../adaptive-retry');
const ContextMonitor = require('../context-monitor');
const ProgressTracker = require('../progress-tracker');
const toolManager = require('../tool-manager');
const ruleInjector = require('../rule-injector');

class AFkExecutor {
  constructor(lifecycleManager, processMonitor, logManager) {
    this.lifecycleManager = lifecycleManager;
    this.processMonitor = processMonitor;
    this.logManager = logManager;
  }

  /**
   * Execute AFk session in background mode
   */
  async executeBackground(session, options = {}) {
    try {
      console.log(`🚀 Starting background AFk session: ${session.id}`);

      await this.lifecycleManager.updateSessionStatus(session.id, 'starting');

      // Start caffeinate to prevent system sleep
      const caffeinatePid = await this.startCaffeinate();

      // Start the execution process
      const executeProcess = spawn('node', [
        '-e',
        `
        const ProcessManager = require('${__dirname}/../process-manager');
        const pm = new ProcessManager();
        pm.runAfkIterations(${JSON.stringify(session)}, ${JSON.stringify(options)})
          .then(() => process.exit(0))
          .catch(err => {
            console.error('AFk execution failed:', err);
            process.exit(1);
          });
        `
      ], {
        detached: true,
        stdio: 'ignore'
      });

      executeProcess.unref();

      // Register process for monitoring
      this.processMonitor.registerProcess(session.id, {
        process: executeProcess,
        pid: executeProcess.pid,
        caffeinatePid,
        startedAt: Date.now(),
        sessionId: session.id,
        task: session.task
      });

      await this.lifecycleManager.updateSessionStatus(session.id, 'running', {
        pid: executeProcess.pid
      });

      console.log(`✅ AFk session ${session.id} started in background (PID: ${executeProcess.pid})`);

      return {
        sessionId: session.id,
        pid: executeProcess.pid,
        caffeinatePid,
        status: 'running'
      };

    } catch (error) {
      await this.lifecycleManager.failSession(session.id, error);
      throw error;
    }
  }

  /**
   * Execute AFk session in foreground mode
   */
  async executeForeground(session, options = {}) {
    let caffeinatePid = null;

    try {
      console.log(`🎯 Starting foreground AFk session: ${session.id}`);

      await this.lifecycleManager.updateSessionStatus(session.id, 'running');

      // Start caffeinate to prevent system sleep
      caffeinatePid = await this.startCaffeinate();

      // Execute iterations directly
      await this.runAfkIterations(session, options);

      await this.lifecycleManager.completeSession(session.id);
      console.log(`✅ AFk session ${session.id} completed successfully`);

      return { sessionId: session.id, status: 'completed' };

    } catch (error) {
      await this.lifecycleManager.failSession(session.id, error);
      throw error;
    } finally {
      // Clean up caffeinate
      if (caffeinatePid) {
        try {
          process.kill(caffeinatePid, 'SIGTERM');
          console.log(`☕ Stopped caffeinate (PID: ${caffeinatePid})`);
        } catch (e) {
          // Caffeinate might already be dead
        }
      }
    }
  }

  /**
   * Run AFk iterations with adaptive retry and progress tracking
   */
  async runAfkIterations(session, options = {}) {
    const logStream = this.logManager.createLogStream(session.id);
    const adaptiveRetry = new AdaptiveRetry();
    const progressTracker = new ProgressTracker(session.id);

    logStream.write(`🚀 Starting AFk session: ${session.id}\n`);
    logStream.write(`📋 Task: ${session.task}\n`);
    logStream.write(`🔢 Iterations: ${session.iterations}\n`);
    logStream.write(`🤖 Model: ${session.model}\n\n`);

    try {
      await progressTracker.start();

      for (let i = 1; i <= session.iterations; i++) {
        const progress = (i / session.iterations) * 100;

        logStream.write(`\n${'='.repeat(50)}\n`);
        logStream.write(`🔄 Starting iteration ${i}/${session.iterations}\n`);
        logStream.write(`${'='.repeat(50)}\n\n`);

        await this.lifecycleManager.updateProgress(session.id, i, progress);

        try {
          await this.runSingleIteration(session, i, logStream, adaptiveRetry, progressTracker);

          logStream.write(`\n✅ Iteration ${i} completed successfully\n`);

          // Brief pause between iterations
          if (i < session.iterations) {
            await this.sleep(2000);
          }

        } catch (iterationError) {
          logStream.write(`\n❌ Iteration ${i} failed: ${iterationError.message}\n`);

          // Check if we should continue or abort
          const shouldContinue = await adaptiveRetry.shouldContinueAfterError(iterationError);

          if (!shouldContinue) {
            throw new Error(`AFk session aborted after iteration ${i}: ${iterationError.message}`);
          }

          logStream.write('⚠️ Continuing to next iteration despite error...\n');
        }
      }

      await progressTracker.complete();
      logStream.write('\n🎉 AFk session completed successfully!\n');

    } catch (error) {
      await progressTracker.fail(error);
      logStream.write(`\n💥 AFk session failed: ${error.message}\n`);
      throw error;
    } finally {
      logStream.end();
    }
  }

  /**
   * Execute a single AFk iteration
   */
  async runSingleIteration(session, iterationNum, logStream, adaptiveRetry, progressTracker = null) {
    const startTime = Date.now();
    logStream.write(`⏰ Iteration ${iterationNum} started at ${new Date().toISOString()}\n`);

    // Build context from previous iterations
    const context = await this.buildIterationContext(session, iterationNum, adaptiveRetry);

    // Prepare Claude command
    const claudeArgs = await this.buildClaudeCommand(session, context, iterationNum);

    logStream.write(`🤖 Executing: claude ${claudeArgs.join(' ')}\n\n`);

    return new Promise((resolve, reject) => {
      const claudeProcess = spawn('claude', claudeArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';
      let outputBuffer = '';

      // Handle stdout
      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        outputBuffer += chunk;

        // Write to log with timestamp prefix
        const lines = chunk.split('\n');
        lines.forEach((line, index) => {
          if (line.trim() || index < lines.length - 1) {
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            logStream.write(`[${timestamp}] ${line}\n`);
          }
        });

        // Progress tracking
        if (progressTracker) {
          progressTracker.processOutput(chunk);
        }
      });

      // Handle stderr
      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;

        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        logStream.write(`[${timestamp}] ERROR: ${chunk}\n`);
      });

      // Handle process completion
      claudeProcess.on('close', async (code) => {
        const duration = Date.now() - startTime;
        const durationSec = (duration / 1000).toFixed(2);

        logStream.write(`\n⏱️ Iteration ${iterationNum} completed in ${durationSec}s (exit code: ${code})\n`);

        if (code === 0) {
          // Success - update session with latest output
          await this.lifecycleManager.updateProgress(
            session.id,
            iterationNum,
            (iterationNum / session.iterations) * 100,
            stdout.slice(-2000) // Keep last 2000 chars
          );

          // Record successful iteration for adaptive retry
          adaptiveRetry.recordSuccess(duration);

          resolve({
            success: true,
            output: stdout,
            duration,
            exitCode: code
          });
        } else {
          // Failure - record for adaptive retry
          const error = new Error(`Claude process failed with exit code ${code}`);
          error.stderr = stderr;
          error.stdout = stdout;
          error.exitCode = code;
          error.iteration = iterationNum;

          adaptiveRetry.recordFailure(error, duration);
          reject(error);
        }
      });

      // Handle process errors
      claudeProcess.on('error', (error) => {
        logStream.write(`\n💥 Process error in iteration ${iterationNum}: ${error.message}\n`);

        adaptiveRetry.recordFailure(error, Date.now() - startTime);
        reject(error);
      });

      // Set up timeout
      const timeout = setTimeout(() => {
        logStream.write(`\n⏰ Iteration ${iterationNum} timed out, killing process...\n`);
        claudeProcess.kill('SIGKILL');

        const timeoutError = new Error(`Iteration ${iterationNum} timed out`);
        timeoutError.timeout = true;
        adaptiveRetry.recordFailure(timeoutError, Date.now() - startTime);
        reject(timeoutError);
      }, 300000); // 5 minute timeout

      claudeProcess.on('close', () => clearTimeout(timeout));
    });
  }

  /**
   * Build context for the current iteration
   */
  async buildIterationContext(session, iterationNum, adaptiveRetry) {
    const context = {
      sessionId: session.id,
      currentIteration: iterationNum,
      totalIterations: session.iterations,
      progress: (iterationNum / session.iterations) * 100,
      previousFailures: adaptiveRetry.getFailureHistory(),
      retryCount: adaptiveRetry.getRetryCount()
    };

    // Add context from previous iterations if available
    if (iterationNum > 1) {
      const previousSession = await this.lifecycleManager.getSession(session.id);
      if (previousSession && previousSession.output) {
        context.previousOutput = previousSession.output.slice(-1000); // Last 1000 chars
      }
    }

    return context;
  }

  /**
   * Build Claude command arguments for execution
   */
  async buildClaudeCommand(session, context, iterationNum) {
    const args = [];

    // Add chain type flag
    if (session.chainType === 'chain') {
      args.push('-c');
    }

    // Add model specification
    if (session.model && session.model !== 'claude-3-5-sonnet-20240620') {
      args.push('--model', session.model);
    }

    // Build the prompt with context
    let prompt = session.task;

    if (iterationNum > 1) {
      prompt += '\n\n--- Context ---\n';
      prompt += `This is iteration ${iterationNum} of ${session.iterations}.\n`;

      if (context.previousOutput) {
        prompt += `Previous output: ${context.previousOutput}\n`;
      }

      if (context.previousFailures.length > 0) {
        prompt += `Previous failures to avoid: ${context.previousFailures.slice(-2).map(f => f.message).join(', ')}\n`;
      }

      prompt += '--- End Context ---\n';
    }

    args.push('-p', prompt);

    return args;
  }

  /**
   * Start caffeinate to prevent system sleep
   */
  async startCaffeinate() {
    return new Promise((resolve, reject) => {
      const caffeinate = spawn('caffeinate', ['-d'], {
        detached: true,
        stdio: 'ignore'
      });

      caffeinate.unref();

      setTimeout(() => {
        if (caffeinate.pid) {
          console.log(`☕ Started caffeinate (PID: ${caffeinate.pid})`);
          resolve(caffeinate.pid);
        } else {
          reject(new Error('Failed to start caffeinate'));
        }
      }, 1000);

      caffeinate.on('error', (error) => {
        console.error('⚠️ Failed to start caffeinate:', error.message);
        resolve(null); // Non-critical, continue without caffeinate
      });
    });
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AFkExecutor;
