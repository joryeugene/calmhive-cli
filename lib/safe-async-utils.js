/**
 * Safe async operation utilities
 * Provides common patterns for robust async programming with proper error handling
 */

const { CalmhiveError } = require('./errors/base-error');

class SafeAsyncUtils {
  /**
   * Executes an async operation with timeout protection
   * @param {Function} operation - Async function to execute
   * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
   * @param {string} operationName - Name for error reporting (default: 'operation')
   * @returns {Promise<*>} Result of the operation
   * @throws {Error} If operation times out or fails
   */
  static withTimeout(operation, timeoutMs = 5000, operationName = 'operation') {
    if (typeof operation !== 'function') {
      throw new Error('Operation must be a function');
    }

    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Timeout must be a positive integer');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new CalmhiveError(`${operationName} timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR', {
          timeoutMs,
          operationName
        }));
      }, timeoutMs);

      const executeOperation = async () => {
        try {
          const result = await operation();
          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      executeOperation();
    });
  }

  /**
   * Retries an async operation with exponential backoff
   * @param {Function} operation - Async function to retry
   * @param {object} options - Retry configuration
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.baseDelayMs - Base delay in milliseconds (default: 100)
   * @param {number} options.maxDelayMs - Maximum delay in milliseconds (default: 5000)
   * @param {Function} options.shouldRetry - Function to determine if error is retryable
   * @returns {Promise<*>} Result of the operation
   * @throws {Error} Final error after all retries exhausted
   */
  static withRetry(operation, options = {}) {
    if (typeof operation !== 'function') {
      throw new Error('Operation must be a function');
    }

    const defaults = {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      shouldRetry: () => true
    };
    const opts = { ...defaults, ...options };

    return (async () => {
      let lastError;
      let attempt = 0;

      while (attempt <= opts.maxRetries) {
        try {
          return await operation();
        } catch (error) {
          lastError = error;
          attempt++;

          if (attempt > opts.maxRetries || !opts.shouldRetry(error)) {
            throw error;
          }

          // Exponential backoff with jitter
          const delay = Math.min(
            opts.baseDelayMs * Math.pow(2, attempt - 1),
            opts.maxDelayMs
          );
          const jitter = Math.random() * 0.1 * delay;

          await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
      }

      throw lastError;
    })();
  }

  /**
   * Executes async operations in parallel with controlled concurrency
   * @param {Array} items - Items to process
   * @param {Function} operation - Async function to apply to each item
   * @param {object} options - Execution options
   * @param {number} options.concurrency - Maximum concurrent operations (default: 3)
   * @param {boolean} options.failFast - Stop on first error (default: false)
   * @returns {Promise<Array>} Array of results (or errors if failFast is false)
   */
  static parallelMap(items, operation, options = {}) {
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    if (typeof operation !== 'function') {
      throw new Error('Operation must be a function');
    }

    const defaults = {
      concurrency: 3,
      failFast: false
    };
    const opts = { ...defaults, ...options };

    if (!Number.isInteger(opts.concurrency) || opts.concurrency <= 0) {
      throw new Error('Concurrency must be a positive integer');
    }

    const results = new Array(items.length);
    const errors = [];
    let completed = 0;
    let nextIndex = 0;

    return new Promise((resolve, reject) => {
      if (items.length === 0) {
        resolve([]);
        return;
      }

      const processNext = async () => {
        if (nextIndex >= items.length) {
          return;
        }

        const currentIndex = nextIndex++;

        try {
          results[currentIndex] = await operation(items[currentIndex], currentIndex);
        } catch (error) {
          if (opts.failFast) {
            reject(error);
            return;
          }
          results[currentIndex] = error;
          errors.push({ index: currentIndex, error });
        }

        completed++;

        if (completed === items.length) {
          if (errors.length > 0 && opts.failFast) {
            reject(errors[0].error);
          } else {
            resolve(results);
          }
        } else {
          // Process next item if there are more
          processNext();
        }
      };

      // Start initial concurrent batch
      const initialConcurrency = Math.min(opts.concurrency, items.length);
      for (let i = 0; i < initialConcurrency; i++) {
        processNext();
      }
    });
  }

  /**
   * Executes an async operation with a fallback function
   * @param {Function} primary - Primary async operation
   * @param {Function} fallback - Fallback async operation
   * @param {object} options - Execution options
   * @param {Function} options.shouldFallback - Function to determine if fallback should be used
   * @returns {Promise<*>} Result from primary or fallback operation
   */
  static withFallback(primary, fallback, options = {}) {
    if (typeof primary !== 'function') {
      throw new Error('Primary operation must be a function');
    }

    if (typeof fallback !== 'function') {
      throw new Error('Fallback operation must be a function');
    }

    const defaults = {
      shouldFallback: (error) => true
    };
    const opts = { ...defaults, ...options };

    return (async () => {
      try {
        return await primary();
      } catch (error) {
        if (opts.shouldFallback(error)) {
          return await fallback();
        }
        throw error;
      }
    })();
  }

  /**
   * Creates a debounced version of an async function
   * @param {Function} operation - Async function to debounce
   * @param {number} delayMs - Debounce delay in milliseconds
   * @returns {Function} Debounced function
   */
  static debounce(operation, delayMs = 300) {
    if (typeof operation !== 'function') {
      throw new Error('Operation must be a function');
    }

    if (!Number.isInteger(delayMs) || delayMs < 0) {
      throw new Error('Delay must be a non-negative integer');
    }

    let timeoutId = null;

    return function debounced(...args) {
      return new Promise((resolve, reject) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(async () => {
          try {
            const result = await operation.apply(this, args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, delayMs);
      });
    };
  }

  /**
   * Creates a throttled version of an async function
   * @param {Function} operation - Async function to throttle
   * @param {number} intervalMs - Throttle interval in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(operation, intervalMs = 1000) {
    if (typeof operation !== 'function') {
      throw new Error('Operation must be a function');
    }

    if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
      throw new Error('Interval must be a positive integer');
    }

    let lastExecution = 0;
    let inProgress = false;

    return async function throttled(...args) {
      const now = Date.now();

      if (inProgress || now - lastExecution < intervalMs) {
        throw new CalmhiveError('Function call throttled', 'THROTTLED_ERROR', {
          intervalMs,
          timeSinceLastCall: now - lastExecution
        });
      }

      inProgress = true;
      lastExecution = now;

      try {
        return await operation.apply(this, args);
      } finally {
        inProgress = false;
      }
    };
  }
}

module.exports = SafeAsyncUtils;
