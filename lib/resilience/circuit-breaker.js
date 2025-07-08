/**
 * Circuit Breaker Pattern Implementation for Calmhive
 *
 * Provides resilience against cascading failures from external dependencies like:
 * - Claude API calls
 * - Database connections
 * - Process spawning operations
 * - File system operations
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 */

const {
  APIError,
  NetworkTimeoutError,
  ProcessError,
  DatabaseError
} = require('../errors/base-error');

class CircuitBreakerError extends Error {
  constructor(message, state, details = {}) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.state = state;
    this.details = details;
  }
}

class CircuitBreaker {
  constructor(options = {}) {
    // Circuit breaker configuration
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2; // For HALF_OPEN state
    this.timeout = options.timeout || 60000; // Time to wait before transitioning to HALF_OPEN
    this.monitoringPeriod = options.monitoringPeriod || 300000; // 5 minutes

    // State management
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;

    // Statistics
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.responseTimeSum = 0;
    this.slowRequestCount = 0;

    // Monitoring
    this.recentFailures = [];
    this.recentSuccesses = [];
    this.slowRequestThreshold = options.slowRequestThreshold || 5000; // 5 seconds

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onFailure = options.onFailure || (() => {});
    this.onSuccess = options.onSuccess || (() => {});

    // Error classification
    this.isRetryableError = options.isRetryableError || this.defaultRetryableErrorCheck;

    console.log(`🔧 Circuit breaker '${this.name}' initialized`);
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute(operation, context = {}) {
    const startTime = Date.now();
    this.totalRequests++;

    // Check circuit state
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        this.recordFailure(new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN`,
          this.state,
          {
            failureCount: this.failureCount,
            nextAttemptTime: this.nextAttemptTime,
            lastFailureTime: this.lastFailureTime
          }
        ), startTime);

        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN - requests blocked until ${new Date(this.nextAttemptTime).toISOString()}`,
          this.state
        );
      }

      // Transition to HALF_OPEN for testing
      this.transitionTo('HALF_OPEN');
    }

    try {
      // Execute the operation
      const result = await operation();

      // Record success
      this.recordSuccess(startTime);

      return result;

    } catch (error) {
      // Record failure
      this.recordFailure(error, startTime);

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  recordSuccess(startTime) {
    const responseTime = Date.now() - startTime;
    this.responseTimeSum += responseTime;

    // Track slow requests
    if (responseTime > this.slowRequestThreshold) {
      this.slowRequestCount++;
      console.warn(`⚠️ Slow request detected in '${this.name}': ${responseTime}ms`);
    }

    this.totalSuccesses++;
    this.successCount++;
    this.recentSuccesses.push({
      timestamp: Date.now(),
      responseTime
    });

    // Clean old successes
    this.cleanOldRecords(this.recentSuccesses);

    // State transitions based on success
    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.successThreshold) {
        this.transitionTo('CLOSED');
        this.resetCounts();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }

    this.onSuccess({
      circuitBreaker: this.name,
      responseTime,
      state: this.state,
      stats: this.getStats()
    });
  }

  /**
   * Record failed operation
   */
  recordFailure(error, startTime) {
    const responseTime = Date.now() - startTime;

    this.totalFailures++;
    this.lastFailureTime = Date.now();

    // Only count retryable errors toward circuit breaking
    if (this.isRetryableError(error)) {
      this.failureCount++;

      this.recentFailures.push({
        timestamp: this.lastFailureTime,
        error: error.message,
        type: error.constructor.name,
        responseTime
      });

      // Clean old failures
      this.cleanOldRecords(this.recentFailures);

      // State transitions based on failure
      if (this.state === 'HALF_OPEN') {
        // Any failure in HALF_OPEN goes back to OPEN
        this.transitionTo('OPEN');
        this.nextAttemptTime = Date.now() + this.timeout;
      } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
        // Too many failures in CLOSED state
        this.transitionTo('OPEN');
        this.nextAttemptTime = Date.now() + this.timeout;
      }
    }

    this.onFailure({
      circuitBreaker: this.name,
      error,
      responseTime,
      state: this.state,
      stats: this.getStats()
    });
  }

  /**
   * Default retryable error classification
   */
  defaultRetryableErrorCheck(error) {
    // Network timeouts and API errors are typically retryable
    if (error instanceof NetworkTimeoutError ||
        error instanceof APIError ||
        error instanceof DatabaseError) {
      return true;
    }

    // Process errors may be retryable depending on cause
    if (error instanceof ProcessError) {
      return true;
    }

    // Check for common retryable error codes
    if (error.code && ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)) {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.statusCode && [429, 500, 502, 503, 504].includes(error.statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Transition circuit breaker state
   */
  transitionTo(newState) {
    if (this.state === newState) {return;}

    const oldState = this.state;
    this.state = newState;

    console.log(`🔄 Circuit breaker '${this.name}' transitioned: ${oldState} → ${newState}`);

    // Reset counters based on state
    if (newState === 'CLOSED') {
      this.resetCounts();
    } else if (newState === 'HALF_OPEN') {
      this.successCount = 0; // Only reset success count for testing
    }

    this.onStateChange(oldState, newState, this.getStats());
  }

  /**
   * Reset failure and success counts
   */
  resetCounts() {
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Clean old records outside monitoring period
   */
  cleanOldRecords(records) {
    const cutoff = Date.now() - this.monitoringPeriod;

    // Remove records older than monitoring period
    const originalLength = records.length;
    records.splice(0, records.findIndex(record => record.timestamp > cutoff));

    if (records.length < originalLength) {
      console.log(`🧹 Cleaned ${originalLength - records.length} old records from '${this.name}'`);
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    const averageResponseTime = this.totalSuccesses > 0
      ? this.responseTimeSum / this.totalSuccesses
      : 0;

    const successRate = this.totalRequests > 0
      ? (this.totalSuccesses / this.totalRequests) * 100
      : 0;

    const recentFailureRate = this.recentFailures.length > 0
      ? (this.recentFailures.length / (this.recentFailures.length + this.recentSuccesses.length)) * 100
      : 0;

    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      recentFailureRate: Math.round(recentFailureRate * 100) / 100,
      slowRequestCount: this.slowRequestCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      recentFailures: this.recentFailures.length,
      recentSuccesses: this.recentSuccesses.length
    };
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy() {
    const stats = this.getStats();

    return {
      healthy: this.state === 'CLOSED' && stats.recentFailureRate < 20,
      state: this.state,
      issues: this.getHealthIssues(stats)
    };
  }

  /**
   * Get health issues
   */
  getHealthIssues(stats) {
    const issues = [];

    if (this.state === 'OPEN') {
      issues.push(`Circuit is OPEN due to ${this.failureCount} failures`);
    }

    if (this.state === 'HALF_OPEN') {
      issues.push('Circuit is in HALF_OPEN state, testing recovery');
    }

    if (stats.recentFailureRate > 50) {
      issues.push(`High recent failure rate: ${stats.recentFailureRate}%`);
    }

    if (stats.averageResponseTime > this.slowRequestThreshold) {
      issues.push(`High average response time: ${stats.averageResponseTime}ms`);
    }

    if (this.slowRequestCount > 10) {
      issues.push(`${this.slowRequestCount} slow requests detected`);
    }

    return issues;
  }

  /**
   * Force circuit to specific state (for testing/manual intervention)
   */
  forceState(state, reason = 'manual intervention') {
    console.log(`🔧 Forcing circuit breaker '${this.name}' to ${state}: ${reason}`);
    this.transitionTo(state);

    if (state === 'OPEN') {
      this.nextAttemptTime = Date.now() + this.timeout;
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    console.log(`🔄 Resetting circuit breaker '${this.name}'`);
    this.transitionTo('CLOSED');
    this.resetCounts();
    this.recentFailures.length = 0;
    this.recentSuccesses.length = 0;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.responseTimeSum = 0;
    this.slowRequestCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }
}

/**
 * Circuit Breaker Manager - manages multiple circuit breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.circuitBreakers = new Map();
    this.globalStats = {
      totalCircuitBreakers: 0,
      openCircuits: 0,
      halfOpenCircuits: 0,
      closedCircuits: 0
    };
  }

  /**
   * Create or get circuit breaker
   */
  getCircuitBreaker(name, options = {}) {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new CircuitBreaker({
        ...options,
        name,
        onStateChange: (oldState, newState, stats) => {
          this.updateGlobalStats();
          if (options.onStateChange) {
            options.onStateChange(oldState, newState, stats);
          }
        }
      });

      this.circuitBreakers.set(name, circuitBreaker);
      this.updateGlobalStats();
    }

    return this.circuitBreakers.get(name);
  }

  /**
   * Update global statistics
   */
  updateGlobalStats() {
    this.globalStats.totalCircuitBreakers = this.circuitBreakers.size;
    this.globalStats.openCircuits = 0;
    this.globalStats.halfOpenCircuits = 0;
    this.globalStats.closedCircuits = 0;

    for (const cb of this.circuitBreakers.values()) {
      switch (cb.state) {
      case 'OPEN':
        this.globalStats.openCircuits++;
        break;
      case 'HALF_OPEN':
        this.globalStats.halfOpenCircuits++;
        break;
      case 'CLOSED':
        this.globalStats.closedCircuits++;
        break;
      }
    }
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats() {
    const stats = {
      global: this.globalStats,
      circuitBreakers: {}
    };

    for (const [name, cb] of this.circuitBreakers) {
      stats.circuitBreakers[name] = cb.getStats();
    }

    return stats;
  }

  /**
   * Get system health
   */
  getSystemHealth() {
    const unhealthy = [];
    let totalHealthy = 0;

    for (const [name, cb] of this.circuitBreakers) {
      const health = cb.isHealthy();
      if (health.healthy) {
        totalHealthy++;
      } else {
        unhealthy.push({
          name,
          state: health.state,
          issues: health.issues
        });
      }
    }

    return {
      healthy: unhealthy.length === 0,
      totalCircuitBreakers: this.circuitBreakers.size,
      healthyCircuits: totalHealthy,
      unhealthyCircuits: unhealthy.length,
      issues: unhealthy
    };
  }
}

// Global circuit breaker manager instance
const globalCircuitBreakerManager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerManager,
  globalCircuitBreakerManager
};
