/**
 * Adaptive retry mechanism for handling Claude usage limits with exponential backoff
 *
 * Implements sophisticated retry logic with exponential backoff to handle transient failures,
 * particularly useful for API rate limiting and usage limit scenarios.
 *
 * @example
 * const retry = new AdaptiveRetry();
 *
 * // Simple usage
 * retry.recordFailure(); // Usage limit hit
 * const delay = retry.getNextDelay(); // Returns increasing delay
 *
 * // With retry wrapper
 * const result = await retry.waitWithRetry(async () => {
 *   return await someAPICall();
 * }, 3);
 */
class AdaptiveRetry {
  /**
   * Creates a new AdaptiveRetry instance with default configuration
   *
   * @param {Object} options - Configuration options
   * @param {number} options.baseDelay - Base delay in milliseconds (default: 30000)
   * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 3600000)
   * @param {number} options.backoffMultiplier - Exponential backoff multiplier (default: 2)
   */
  constructor(options = {}) {
    this.baseDelay = options.baseDelay || 30000; // 30 seconds base
    this.maxDelay = options.maxDelay || 3600000; // 1 hour max
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.consecutiveFailures = 0;
  }

  /**
   * Calculates the next delay using exponential backoff algorithm
   *
   * The delay progression follows: 30s, 1m, 2m, 4m, 8m, 16m, 32m, 60m (max)
   * Each failure doubles the delay until maxDelay is reached.
   *
   * @returns {number} Delay in milliseconds for the next retry
   *
   * @example
   * const retry = new AdaptiveRetry();
   * retry.recordFailure(); // First failure
   * console.log(retry.getNextDelay()); // 30000 (30 seconds)
   * retry.recordFailure(); // Second failure
   * console.log(retry.getNextDelay()); // 60000 (1 minute)
   */
  getNextDelay() {
    // Calculate exponential backoff: 30s, 1m, 2m, 4m, 8m, 16m, 32m, 60m (max)
    const delay = Math.min(
      this.baseDelay * Math.pow(this.backoffMultiplier, this.consecutiveFailures),
      this.maxDelay
    );
    return delay;
  }

  /**
   * Records a successful operation and resets the failure count
   *
   * This should be called when an operation succeeds to reset the exponential
   * backoff progression. Future failures will start from the base delay again.
   *
   * @example
   * const retry = new AdaptiveRetry();
   * retry.recordFailure(); // Failure count: 1
   * retry.recordSuccess(); // Failure count: 0 (reset)
   */
  recordSuccess() {
    // Reset on successful iteration
    this.consecutiveFailures = 0;
  }

  /**
   * Records a failed operation and increments the failure count
   *
   * This increases the consecutive failure count, which affects the delay
   * calculation for subsequent retry attempts. Each failure increases the
   * exponential backoff delay.
   *
   * @example
   * const retry = new AdaptiveRetry();
   * retry.recordFailure(); // Failure count: 1, next delay: 30s
   * retry.recordFailure(); // Failure count: 2, next delay: 60s
   */
  recordFailure() {
    this.consecutiveFailures++;
  }

  /**
   * Executes a function with automatic retry logic and exponential backoff
   *
   * This method wraps any async function with intelligent retry behavior.
   * It automatically handles failures with exponential backoff delays and
   * tracks success/failure state for optimal retry timing.
   *
   * @param {Function} spawner - Async function to execute with retry logic
   * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
   * @returns {Promise<*>} Result from the spawner function if successful
   * @throws {Error} If all retry attempts are exhausted
   *
   * @example
   * const retry = new AdaptiveRetry();
   *
   * // Retry an API call with automatic backoff
   * const result = await retry.waitWithRetry(async () => {
   *   const response = await fetch('/api/data');
   *   if (!response.ok) return false; // Trigger retry
   *   return await response.json();
   * }, 3);
   *
   * // Retry with Claude AFk session
   * const session = await retry.waitWithRetry(async () => {
   *   return await processManager.runSingleIteration(sessionData);
   * });
   */
  async waitWithRetry(spawner, maxRetries = 5) {
    if (typeof spawner !== 'function') {
      throw new Error('Spawner must be a function');
    }
    if (!Number.isInteger(maxRetries) || maxRetries < 1) {
      throw new Error('Max retries must be a positive integer');
    }

    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const result = await spawner();

        // If successful, reset failure count
        if (result) {
          this.recordSuccess();
          return result;
        }

        // If spawn returned false (likely usage limit)
        attempts++;
        this.recordFailure();

        const delay = this.getNextDelay();
        // console.log(`⏳ Usage limit likely hit. Waiting ${delay/1000}s before retry (attempt ${attempts}/${maxRetries})...`);

        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.error('❌ Error in retry loop:', error);
        attempts++;

        if (attempts >= maxRetries) {
          throw error;
        }

        const delay = this.getNextDelay();
        // console.log(`⏳ Error occurred. Waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts`);
  }

  /**
   * Gets the current state of the retry mechanism
   *
   * @returns {Object} Current retry state
   * @returns {number} returns.consecutiveFailures - Number of consecutive failures
   * @returns {number} returns.nextDelay - Next delay in milliseconds
   * @returns {number} returns.baseDelay - Base delay configuration
   * @returns {number} returns.maxDelay - Maximum delay configuration
   *
   * @example
   * const retry = new AdaptiveRetry();
   * retry.recordFailure();
   * const state = retry.getState();
   * console.log(`Next retry in ${state.nextDelay / 1000} seconds`);
   */
  getState() {
    return {
      consecutiveFailures: this.consecutiveFailures,
      nextDelay: this.getNextDelay(),
      baseDelay: this.baseDelay,
      maxDelay: this.maxDelay,
      backoffMultiplier: this.backoffMultiplier
    };
  }

  /**
   * Resets the retry state to initial conditions
   *
   * Clears all failure history and resets delays to base level.
   * Useful when starting a new operation context.
   *
   * @example
   * const retry = new AdaptiveRetry();
   * retry.recordFailure();
   * retry.recordFailure();
   * retry.reset(); // Back to clean state
   * console.log(retry.getNextDelay()); // Back to base delay
   */
  reset() {
    this.consecutiveFailures = 0;
  }
}

module.exports = AdaptiveRetry;
