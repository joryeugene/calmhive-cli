/**
 * Enhanced ProcessManager with improved error handling and comprehensive process lifecycle management
 *
 * @class EnhancedProcessManager
 * @description Manages Claude process sessions with robust error handling, timeout protection,
 * and graceful shutdown capabilities. Fixes critical anti-patterns identified in code analysis.
 *
 * Key improvements over basic ProcessManager:
 * - Silent error swallowing eliminated with specific error types
 * - Timeout protection for all process operations
 * - Detailed context in error messages for debugging
 * - Race condition prevention with session locking
 * - Graceful shutdown with fallback to force termination
 * - Resource cleanup with proper lifecycle management
 *
 * @since v3.0.0
 * @author Calmhive Team
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

// Import custom error classes
const {
  ProcessError,
  ProcessKillError,
  ProcessSpawnError,
  ProcessTimeoutError,
  SessionError,
  SessionNotFoundError,
  SessionTimeoutError,
  ResourceError,
  ValidationError,
  RequiredFieldError
} = require('./errors/base-error');

class EnhancedProcessManager {
  /**
   * Creates an instance of EnhancedProcessManager
   *
   * @param {Object} options - Configuration options
   * @param {number} [options.defaultTimeout=300000] - Default timeout for process operations (5 minutes)
   * @param {number} [options.cleanupTimeout=10000] - Timeout for graceful cleanup operations (10 seconds)
   * @param {number} [options.maxProcesses=10] - Maximum number of concurrent processes
   * @param {string} [options.logDir] - Custom log directory path
   */
  constructor(options = {}) {
    this.db = new SessionDatabase();
    this.activeProcesses = new Map(); // Map<sessionId, processInfo>
    this.logDir = options.logDir || path.join(__dirname, '..', 'logs');
    this.processTimeouts = new Map(); // Map<sessionId, timeoutId> - Track process timeouts
    this.sessionLocks = new Map(); // Map<sessionId, boolean> - Prevent race conditions

    // Configuration with defensive defaults
    this.defaultTimeout = options.defaultTimeout || 300000; // 5 minutes
    this.cleanupTimeout = options.cleanupTimeout || 10000;   // 10 seconds
    this.maxProcesses = options.maxProcesses || 10;

    this.ensureLogDir();
    this.setupCleanup();
  }

  /**
   * Enhanced directory creation with proper error handling
   *
   * @throws {ResourceError} When log directory cannot be created
   */
  ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`✅ Created log directory: ${this.logDir}`);
      }
    } catch (error) {
      throw new ResourceError(
        `Failed to create log directory: ${error.message}`,
        'directory',
        { path: this.logDir, cause: error.message }
      );
    }
  }

  /**
   * Enhanced cleanup with detailed error handling and timeout protection
   */
  setupCleanup() {
    process.setMaxListeners(20);

    const cleanup = async () => {
      console.log('🧹 Starting graceful shutdown...');
      const cleanupPromises = [];

      for (const [sessionId, processInfo] of this.activeProcesses) {
        cleanupPromises.push(this.gracefulProcessShutdown(sessionId, processInfo));
      }

      try {
        // Wait for all cleanups with timeout
        await Promise.race([
          Promise.all(cleanupPromises),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Cleanup timeout')), this.cleanupTimeout)
          )
        ]);
        console.log('✅ Graceful shutdown completed');
      } catch (error) {
        console.error('⚠️ Graceful shutdown timed out, forcing cleanup');
        await this.forceCleanup();
      }
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  /**
   * Graceful process shutdown with detailed error tracking
   */
  async gracefulProcessShutdown(sessionId, processInfo) {
    const startTime = Date.now();

    try {
      // First try graceful termination
      if (this.isProcessAlive(processInfo.pid)) {
        console.log(`🔄 Gracefully terminating process ${processInfo.pid} for session ${sessionId}`);
        process.kill(processInfo.pid, 'SIGTERM');

        // Wait for graceful shutdown
        await this.waitForProcessDeath(processInfo.pid, 5000);
        console.log(`✅ Process ${processInfo.pid} terminated gracefully`);
      }

      // Clean up caffeinate process
      if (processInfo.caffeinatePid) {
        await this.terminateCaffeinate(processInfo.caffeinatePid, sessionId);
      }

    } catch (error) {
      // If graceful fails, try force kill
      console.warn(`⚠️ Graceful shutdown failed for ${sessionId}, attempting force kill`);
      await this.forceKillProcess(processInfo.pid, sessionId);
    } finally {
      // Always clean up tracking
      this.activeProcesses.delete(sessionId);
      this.clearProcessTimeout(sessionId);

      const duration = Date.now() - startTime;
      console.log(`🏁 Cleanup completed for session ${sessionId} in ${duration}ms`);
    }
  }

  /**
   * Enhanced caffeinate termination with proper error handling
   */
  async terminateCaffeinate(caffeinatePid, sessionId) {
    try {
      // Check if caffeinate process exists
      if (!this.isProcessAlive(caffeinatePid)) {
        console.log(`✅ Caffeinate process ${caffeinatePid} already terminated`);
        return;
      }

      console.log(`🔄 Terminating caffeinate process ${caffeinatePid} for session ${sessionId}`);
      process.kill(caffeinatePid, 'SIGTERM');

      // Wait for termination
      await this.waitForProcessDeath(caffeinatePid, 3000);
      console.log(`✅ Caffeinate process ${caffeinatePid} terminated successfully`);

    } catch (error) {
      if (error.code === 'ESRCH') {
        console.log(`✅ Caffeinate process ${caffeinatePid} already terminated`);
      } else if (error.code === 'EPERM') {
        console.warn(`⚠️ No permission to kill caffeinate process ${caffeinatePid}`);
      } else {
        console.error(`❌ Failed to terminate caffeinate ${caffeinatePid}: ${error.message}`);
        throw new ProcessKillError(caffeinatePid, 'SIGTERM');
      }
    }
  }

  /**
   * Force kill process with detailed error reporting
   */
  async forceKillProcess(pid, sessionId) {
    try {
      if (this.isProcessAlive(pid)) {
        console.log(`💀 Force killing process ${pid} for session ${sessionId}`);
        process.kill(pid, 'SIGKILL');

        // Verify the kill worked
        await this.waitForProcessDeath(pid, 2000);
        console.log(`✅ Process ${pid} force killed successfully`);
      }
    } catch (error) {
      if (error.code === 'ESRCH') {
        console.log(`✅ Process ${pid} already terminated`);
      } else {
        console.error(`❌ Force kill failed for process ${pid}: ${error.message}`);
        throw new ProcessKillError(pid, 'SIGKILL');
      }
    }
  }

  /**
   * Check if process is alive with proper error classification
   */
  isProcessAlive(pid) {
    if (!pid) {return false;}

    try {
      // Signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch (error) {
      switch (error.code) {
      case 'ESRCH':
        // Process doesn't exist
        return false;
      case 'EPERM':
        // Process exists but we don't have permission - still alive
        console.warn(`⚠️ No permission to check process ${pid}, assuming alive`);
        return true;
      default:
        console.error(`❌ Unexpected error checking process ${pid}: ${error.message}`);
        return false;
      }
    }
  }

  /**
   * Wait for process to die with timeout
   */
  async waitForProcessDeath(pid, timeout = 5000) {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (!this.isProcessAlive(pid)) {
          resolve();
          return;
        }

        if (Date.now() - start > timeout) {
          reject(new ProcessTimeoutError(pid, timeout));
          return;
        }

        setTimeout(check, 100); // Check every 100ms
      };

      check();
    });
  }

  /**
   * Enhanced session status checking with race condition protection
   */
  async isSessionActive(session) {
    // Prevent race conditions with session locks
    if (this.sessionLocks.has(session.id)) {
      console.log(`🔒 Session ${session.id} is locked, waiting...`);
      return false;
    }

    this.sessionLocks.set(session.id, true);

    try {
      return await this._checkSessionActiveInternal(session);
    } finally {
      this.sessionLocks.delete(session.id);
    }
  }

  /**
   * Internal session activity check with detailed validation
   */
  async _checkSessionActiveInternal(session) {
    let isActive = false;

    // Step 1: Check our active process tracking
    if (this.activeProcesses.has(session.id)) {
      const processInfo = this.activeProcesses.get(session.id);

      if (this.isProcessAlive(processInfo.pid)) {
        console.log(`✅ Session ${session.id} confirmed active via process tracking`);
        isActive = true;
      } else {
        console.log(`🧹 Process ${processInfo.pid} for session ${session.id} is dead, removing from tracking`);
        this.activeProcesses.delete(session.id);
        isActive = false;
      }
    }

    // Step 2: Check by PID if available
    if (!isActive && session.pid) {
      if (this.isProcessAlive(session.pid)) {
        console.log(`✅ Session ${session.id} confirmed active via PID ${session.pid}`);
        isActive = true;
      } else {
        console.log(`💀 PID ${session.pid} for session ${session.id} is not alive`);
      }
    }

    // Step 3: Search for Claude processes (last resort)
    if (!isActive) {
      try {
        isActive = await this.searchForClaudeProcess(session);
        if (isActive) {
          console.log(`🔍 Session ${session.id} found via process search`);
        }
      } catch (error) {
        console.error(`❌ Failed to search for Claude processes: ${error.message}`);
      }
    }

    return isActive;
  }

  /**
   * Search for Claude processes with timeout protection
   */
  async searchForClaudeProcess(session) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ProcessTimeoutError(null, 5000));
      }, 5000);

      const ps = spawn('ps', ['aux']);
      let output = '';

      ps.stdout.on('data', (data) => {
        output += data.toString();
      });

      ps.stderr.on('data', (data) => {
        console.warn(`⚠️ ps command stderr: ${data.toString()}`);
      });

      ps.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new ProcessError(`ps command failed with exit code ${code}`, null, { exitCode: code }));
          return;
        }

        // Look for Claude processes with AFk pattern
        const patterns = [
          'claude -p -c',
          'claude -c -p',
          session.pid ? session.pid.toString() : null
        ].filter(Boolean);

        const hasProcess = patterns.some(pattern => output.includes(pattern));
        resolve(hasProcess);
      });

      ps.on('error', (error) => {
        clearTimeout(timeout);
        reject(new ProcessSpawnError('ps', ['aux'], error.message));
      });
    });
  }

  /**
   * Enhanced validation with specific error types
   */
  validateSessionConfig(config) {
    if (!config) {
      throw new RequiredFieldError('config');
    }

    if (!config.task || typeof config.task !== 'string') {
      throw new RequiredFieldError('task');
    }

    if (config.task.trim().length === 0) {
      throw new ValidationError('Task cannot be empty', 'task', config.task);
    }

    if (config.iterations && (typeof config.iterations !== 'number' || config.iterations < 1)) {
      throw new ValidationError('Iterations must be a positive number', 'iterations', config.iterations);
    }
  }

  /**
   * Set timeout for process operations
   */
  setProcessTimeout(sessionId, timeout = this.defaultTimeout) {
    if (this.processTimeouts.has(sessionId)) {
      clearTimeout(this.processTimeouts.get(sessionId));
    }

    const timeoutId = setTimeout(() => {
      console.warn(`⏰ Process timeout for session ${sessionId}`);
      this.handleProcessTimeout(sessionId);
    }, timeout);

    this.processTimeouts.set(sessionId, timeoutId);
  }

  /**
   * Clear process timeout
   */
  clearProcessTimeout(sessionId) {
    if (this.processTimeouts.has(sessionId)) {
      clearTimeout(this.processTimeouts.get(sessionId));
      this.processTimeouts.delete(sessionId);
    }
  }

  /**
   * Handle process timeout
   */
  async handleProcessTimeout(sessionId) {
    console.error(`❌ Process timeout for session ${sessionId}`);

    const processInfo = this.activeProcesses.get(sessionId);
    if (processInfo) {
      await this.forceKillProcess(processInfo.pid, sessionId);
    }

    // Update session status
    try {
      await this.db.updateSession(sessionId, {
        status: 'error',
        error: 'Process timed out',
        completed_at: Date.now()
      });
    } catch (error) {
      console.error(`❌ Failed to update session ${sessionId} after timeout: ${error.message}`);
    }
  }

  /**
   * Force cleanup all processes
   */
  async forceCleanup() {
    console.log('💀 Force cleanup initiated');

    for (const [sessionId, processInfo] of this.activeProcesses) {
      try {
        if (this.isProcessAlive(processInfo.pid)) {
          process.kill(processInfo.pid, 'SIGKILL');
        }
        if (processInfo.caffeinatePid && this.isProcessAlive(processInfo.caffeinatePid)) {
          process.kill(processInfo.caffeinatePid, 'SIGKILL');
        }
      } catch (error) {
        console.error(`❌ Force cleanup failed for session ${sessionId}: ${error.message}`);
      }
    }

    this.activeProcesses.clear();
    this.processTimeouts.clear();
    this.sessionLocks.clear();
  }
}

module.exports = EnhancedProcessManager;
