const { CalmhiveError, ProcessError, DatabaseError, APIError, NetworkTimeoutError } = require('../errors/base-error');
const { CircuitBreaker } = require('./circuit-breaker');
const AdaptiveRetry = require('../adaptive-retry');

class AutoRecoveryManager {
  constructor(options = {}) {
    this.circuitBreaker = new CircuitBreaker({
      name: 'auto-recovery',
      failureThreshold: options.failureThreshold || 3,
      timeout: options.timeout || 30000
    });

    this.adaptiveRetry = new AdaptiveRetry({
      maxRetries: options.maxRetries || 5,
      baseDelay: options.baseDelay || 1000
    });

    this.recoveryStrategies = new Map();
    this.setupDefaultStrategies();
  }

  setupDefaultStrategies() {
    // Process restart strategy
    this.recoveryStrategies.set('ProcessError', async (error, context) => {
      if (error instanceof ProcessError && error.code === 'PROCESS_DIED') {
        console.log(`🔄 Auto-recovery: Restarting process for session ${context.sessionId}`);
        return await this.restartProcess(context);
      }
      return null;
    });

    // Database reconnection strategy
    this.recoveryStrategies.set('DatabaseError', async (error, context) => {
      if (error instanceof DatabaseError && error.code === 'CONNECTION_LOST') {
        console.log('🔄 Auto-recovery: Reconnecting database');
        return await this.reconnectDatabase(context);
      }
      return null;
    });

    // API retry strategy
    this.recoveryStrategies.set('APIError', async (error, context) => {
      if (error instanceof APIError && [429, 503, 502].includes(error.statusCode)) {
        console.log('🔄 Auto-recovery: Retrying API call with backoff');
        return await this.retryApiCall(context);
      }
      return null;
    });

    // Network timeout recovery
    this.recoveryStrategies.set('NetworkTimeoutError', async (error, context) => {
      console.log('🔄 Auto-recovery: Implementing network recovery');
      return await this.handleNetworkTimeout(context);
    });
  }

  async attemptRecovery(error, context) {
    const errorType = error.constructor.name;
    const strategy = this.recoveryStrategies.get(errorType);

    if (!strategy) {
      console.log(`ℹ️  No auto-recovery strategy for ${errorType}`);
      return null;
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        return await strategy(error, context);
      });
    } catch (recoveryError) {
      console.error(`❌ Auto-recovery failed for ${errorType}:`, recoveryError.message);
      throw new CalmhiveError(
        `Recovery failed: ${recoveryError.message}`,
        'RECOVERY_FAILED',
        { originalError: error, recoveryError, context }
      );
    }
  }

  async restartProcess(context) {
    // Implementation for process restart
    // Would integrate with ProcessManager
    return { action: 'process_restarted', sessionId: context.sessionId };
  }

  async reconnectDatabase(context) {
    // Implementation for database reconnection
    // Would integrate with SessionDatabase
    return { action: 'database_reconnected' };
  }

  async retryApiCall(context) {
    // Implementation for API retry with backoff
    return await this.adaptiveRetry.execute(context.operation);
  }

  async handleNetworkTimeout(context) {
    // Implementation for network recovery
    return { action: 'network_recovered' };
  }

  // Method to register custom recovery strategies
  registerRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  // Health check method
  getRecoveryStats() {
    return {
      circuitBreakerState: this.circuitBreaker.getState(),
      registeredStrategies: Array.from(this.recoveryStrategies.keys()),
      lastRecoveryAttempt: this.lastRecoveryAttempt
    };
  }
}

module.exports = AutoRecoveryManager;
