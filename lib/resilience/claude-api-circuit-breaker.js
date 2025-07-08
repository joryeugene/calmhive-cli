/**
 * Claude API Circuit Breaker Integration
 * 
 * Demonstrates how to integrate circuit breaker pattern with Claude API calls
 * and other external dependencies in the Calmhive system.
 */

const { globalCircuitBreakerManager } = require('./circuit-breaker');
const { 
  APIError, 
  UsageLimitError, 
  NetworkTimeoutError,
  ProcessError,
  ProcessSpawnError 
} = require('../errors/base-error');

class ClaudeAPICircuitBreaker {
  constructor() {
    // Create circuit breaker for Claude API calls
    this.claudeAPI = globalCircuitBreakerManager.getCircuitBreaker('claude-api', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000, // 30 seconds before retry
      slowRequestThreshold: 10000, // 10 seconds is considered slow
      isRetryableError: this.isClaudeRetryableError,
      onStateChange: this.onClaudeStateChange,
      onFailure: this.onClaudeFailure
    });

    // Create circuit breaker for process spawning
    this.processSpawn = globalCircuitBreakerManager.getCircuitBreaker('process-spawn', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000, // 1 minute before retry
      isRetryableError: this.isProcessRetryableError,
      onStateChange: this.onProcessStateChange
    });

    // Create circuit breaker for file system operations
    this.fileSystem = globalCircuitBreakerManager.getCircuitBreaker('file-system', {
      failureThreshold: 10,
      successThreshold: 5,
      timeout: 10000, // 10 seconds before retry
      isRetryableError: this.isFileSystemRetryableError
    });
  }

  /**
   * Execute Claude API call with circuit breaker protection
   */
  async executeClaudeCommand(command, args, options = {}) {
    return this.claudeAPI.execute(async () => {
      console.log(`🚀 Executing Claude command: ${command} ${args.join(' ')}`);
      
      // Simulate Claude API call with proper error handling
      const { spawn } = require('child_process');
      
      return new Promise((resolve, reject) => {
        const process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.workingDir || process.cwd(),
          env: { ...process.env, ...options.env }
        });

        let stdout = '';
        let stderr = '';
        let hasTimedOut = false;

        // Set up timeout
        const timeout = setTimeout(() => {
          hasTimedOut = true;
          process.kill('SIGKILL');
          reject(new NetworkTimeoutError('claude-api', options.timeout || 30000));
        }, options.timeout || 30000);

        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
          stderr += data.toString();
          
          // Check for usage limit patterns
          if (this.isUsageLimitError(stderr)) {
            clearTimeout(timeout);
            process.kill('SIGTERM');
            reject(new UsageLimitError(this.extractResetTime(stderr)));
          }
        });

        process.on('close', (code) => {
          clearTimeout(timeout);
          
          if (hasTimedOut) return; // Already handled by timeout

          if (code === 0) {
            resolve({
              stdout,
              stderr,
              exitCode: code
            });
          } else {
            // Classify the error based on exit code and stderr
            const error = this.classifyClaudeError(code, stderr);
            reject(error);
          }
        });

        process.on('error', (error) => {
          clearTimeout(timeout);
          reject(new ProcessSpawnError(command, args, error.message));
        });
      });
    });
  }

  /**
   * Execute process spawn with circuit breaker protection
   */
  async executeProcessSpawn(command, args, options = {}) {
    return this.processSpawn.execute(async () => {
      const { spawn } = require('child_process');
      
      console.log(`🔧 Spawning process: ${command} ${args.join(' ')}`);
      
      return new Promise((resolve, reject) => {
        const process = spawn(command, args, options);
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve({ exitCode: code, pid: process.pid });
          } else {
            reject(new ProcessError(
              `Process ${command} exited with code ${code}`,
              process.pid,
              { command, args, exitCode: code }
            ));
          }
        });

        process.on('error', (error) => {
          reject(new ProcessSpawnError(command, args, error.message));
        });
      });
    });
  }

  /**
   * Execute file system operation with circuit breaker protection
   */
  async executeFileSystemOperation(operation, ...args) {
    return this.fileSystem.execute(async () => {
      const fs = require('fs').promises;
      
      try {
        return await fs[operation](...args);
      } catch (error) {
        // Wrap in appropriate error type
        throw new Error(`File system operation '${operation}' failed: ${error.message}`);
      }
    });
  }

  /**
   * Check if Claude API error is retryable
   */
  isClaudeRetryableError(error) {
    // Usage limits are retryable (with backoff)
    if (error instanceof UsageLimitError) {
      return true;
    }

    // Network timeouts are retryable
    if (error instanceof NetworkTimeoutError) {
      return true;
    }

    // API errors with specific codes are retryable
    if (error instanceof APIError) {
      return [429, 500, 502, 503, 504].includes(error.context?.statusCode);
    }

    // Process spawn failures might be retryable
    if (error instanceof ProcessSpawnError) {
      return true;
    }

    return false;
  }

  /**
   * Check if process error is retryable
   */
  isProcessRetryableError(error) {
    if (error instanceof ProcessSpawnError) {
      // ENOENT is usually not retryable (command not found)
      return error.context?.cause !== 'ENOENT';
    }

    if (error instanceof ProcessError) {
      // Exit codes that might be retryable
      const retryableExitCodes = [1, 130, 143]; // General errors, SIGINT, SIGTERM
      return retryableExitCodes.includes(error.context?.exitCode);
    }

    return false;
  }

  /**
   * Check if file system error is retryable
   */
  isFileSystemRetryableError(error) {
    // Temporary failures that might resolve
    const retryableCodes = ['EMFILE', 'ENFILE', 'EAGAIN', 'EBUSY'];
    return retryableCodes.includes(error.code);
  }

  /**
   * Check if stderr indicates usage limit
   */
  isUsageLimitError(stderr) {
    const usageLimitPatterns = [
      'usage limit',
      'rate limit',
      'quota exceeded',
      'too many requests',
      'limit exceeded'
    ];

    const lowerStderr = stderr.toLowerCase();
    return usageLimitPatterns.some(pattern => lowerStderr.includes(pattern));
  }

  /**
   * Extract reset time from usage limit error
   */
  extractResetTime(stderr) {
    // Try to extract reset time from error message
    const resetMatch = stderr.match(/reset in (\d+) (seconds?|minutes?|hours?)/i);
    if (resetMatch) {
      const value = parseInt(resetMatch[1]);
      const unit = resetMatch[2].toLowerCase();
      
      let milliseconds = value * 1000; // Default to seconds
      if (unit.startsWith('minute')) {
        milliseconds = value * 60 * 1000;
      } else if (unit.startsWith('hour')) {
        milliseconds = value * 60 * 60 * 1000;
      }
      
      return Date.now() + milliseconds;
    }

    // Default to 15 minutes if we can't parse
    return Date.now() + (15 * 60 * 1000);
  }

  /**
   * Classify Claude API errors based on exit code and stderr
   */
  classifyClaudeError(exitCode, stderr) {
    const lowerStderr = stderr.toLowerCase();

    // Usage limit detection
    if (this.isUsageLimitError(stderr)) {
      return new UsageLimitError(this.extractResetTime(stderr));
    }

    // Network/API errors
    if (lowerStderr.includes('network') || lowerStderr.includes('connection')) {
      return new APIError(
        'Network error during Claude API call',
        'claude-api',
        null,
        { exitCode, stderr }
      );
    }

    // Authentication errors
    if (lowerStderr.includes('auth') || lowerStderr.includes('permission')) {
      return new APIError(
        'Authentication error',
        'claude-api',
        401,
        { exitCode, stderr }
      );
    }

    // Generic API error
    return new APIError(
      `Claude API call failed with exit code ${exitCode}`,
      'claude-api',
      exitCode,
      { stderr }
    );
  }

  /**
   * Handle Claude API state changes
   */
  onClaudeStateChange(oldState, newState, stats) {
    console.log(`🔄 Claude API circuit breaker: ${oldState} → ${newState}`);
    
    if (newState === 'OPEN') {
      console.warn(`⚠️ Claude API circuit breaker is OPEN - ${stats.failureCount} failures detected`);
      console.warn(`⏰ Next attempt allowed at: ${new Date(stats.nextAttemptTime).toISOString()}`);
    } else if (newState === 'HALF_OPEN') {
      console.log('🔍 Claude API circuit breaker testing recovery...');
    } else if (newState === 'CLOSED') {
      console.log('✅ Claude API circuit breaker recovered');
    }
  }

  /**
   * Handle Claude API failures
   */
  onClaudeFailure({ error, responseTime, stats }) {
    console.error(`❌ Claude API failure: ${error.message} (${responseTime}ms)`);
    
    if (error instanceof UsageLimitError) {
      console.warn(`⏰ Usage limit hit, reset time: ${new Date(error.resetTime).toISOString()}`);
    }
    
    if (stats.recentFailureRate > 50) {
      console.warn(`⚠️ High Claude API failure rate: ${stats.recentFailureRate}%`);
    }
  }

  /**
   * Handle process state changes
   */
  onProcessStateChange(oldState, newState, stats) {
    console.log(`🔄 Process spawn circuit breaker: ${oldState} → ${newState}`);
    
    if (newState === 'OPEN') {
      console.warn(`⚠️ Process spawning is failing - ${stats.failureCount} failures`);
    }
  }

  /**
   * Get comprehensive health status
   */
  getHealthStatus() {
    return {
      claudeAPI: this.claudeAPI.isHealthy(),
      processSpawn: this.processSpawn.isHealthy(),
      fileSystem: this.fileSystem.isHealthy(),
      overall: globalCircuitBreakerManager.getSystemHealth()
    };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats() {
    return {
      claudeAPI: this.claudeAPI.getStats(),
      processSpawn: this.processSpawn.getStats(),
      fileSystem: this.fileSystem.getStats(),
      global: globalCircuitBreakerManager.getAllStats()
    };
  }

  /**
   * Force recovery for manual intervention
   */
  forceRecovery(component, reason = 'manual intervention') {
    switch (component) {
      case 'claude-api':
        this.claudeAPI.forceState('CLOSED', reason);
        break;
      case 'process-spawn':
        this.processSpawn.forceState('CLOSED', reason);
        break;
      case 'file-system':
        this.fileSystem.forceState('CLOSED', reason);
        break;
      case 'all':
        this.claudeAPI.forceState('CLOSED', reason);
        this.processSpawn.forceState('CLOSED', reason);
        this.fileSystem.forceState('CLOSED', reason);
        break;
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }
}

// Export singleton instance
const claudeAPICircuitBreaker = new ClaudeAPICircuitBreaker();

module.exports = {
  ClaudeAPICircuitBreaker,
  claudeAPICircuitBreaker
};