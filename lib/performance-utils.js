/**
 * Performance utility functions for timing, benchmarking, and monitoring
 * Provides simple tools for measuring execution time and performance
 */
class PerformanceUtils {
  /**
     * Create a new timer instance
     * @returns {Object} Timer object with start, stop, and elapsed methods
     */
  static createTimer() {
    let startTime = null;
    let endTime = null;

    return {
      /**
             * Start the timer
             * @returns {Object} Timer instance for chaining
             */
      start() {
        startTime = process.hrtime.bigint();
        endTime = null;
        return this;
      },

      /**
             * Stop the timer
             * @returns {Object} Timer instance for chaining
             */
      stop() {
        if (startTime === null) {
          throw new Error('Timer not started');
        }
        endTime = process.hrtime.bigint();
        return this;
      },

      /**
             * Get elapsed time in milliseconds
             * @returns {number} Elapsed time in milliseconds
             */
      elapsed() {
        if (startTime === null) {
          throw new Error('Timer not started');
        }
        const end = endTime || process.hrtime.bigint();
        return Number(end - startTime) / 1_000_000; // Convert nanoseconds to milliseconds
      },

      /**
             * Get elapsed time in nanoseconds
             * @returns {number} Elapsed time in nanoseconds
             */
      elapsedNanos() {
        if (startTime === null) {
          throw new Error('Timer not started');
        }
        const end = endTime || process.hrtime.bigint();
        return Number(end - startTime);
      },

      /**
             * Reset the timer
             * @returns {Object} Timer instance for chaining
             */
      reset() {
        startTime = null;
        endTime = null;
        return this;
      }
    };
  }

  /**
     * Measure execution time of a function
     * @param {Function} fn - Function to measure
     * @param {...any} args - Arguments to pass to the function
     * @returns {Object} Result object with elapsed time and function result
     * @throws {Error} If fn is not a function
     */
  static measure(fn, ...args) {
    if (typeof fn !== 'function') {
      throw new Error('First argument must be a function');
    }

    const timer = this.createTimer();
    timer.start();

    try {
      const result = fn(...args);
      timer.stop();

      return {
        result,
        elapsed: timer.elapsed(),
        elapsedNanos: timer.elapsedNanos()
      };
    } catch (error) {
      timer.stop();
      throw error;
    }
  }

  /**
     * Measure execution time of an async function
     * @param {Function} fn - Async function to measure
     * @param {...any} args - Arguments to pass to the function
     * @returns {Promise<Object>} Result object with elapsed time and function result
     * @throws {Error} If fn is not a function
     */
  static async measureAsync(fn, ...args) {
    if (typeof fn !== 'function') {
      throw new Error('First argument must be a function');
    }

    const timer = this.createTimer();
    timer.start();

    try {
      const result = await fn(...args);
      timer.stop();

      return {
        result,
        elapsed: timer.elapsed(),
        elapsedNanos: timer.elapsedNanos()
      };
    } catch (error) {
      timer.stop();
      throw error;
    }
  }

  /**
     * Benchmark a function by running it multiple times
     * @param {Function} fn - Function to benchmark
     * @param {number} iterations - Number of iterations to run
     * @param {...any} args - Arguments to pass to the function
     * @returns {Object} Benchmark results with statistics
     * @throws {Error} If fn is not a function or iterations is invalid
     */
  static benchmark(fn, iterations = 100, ...args) {
    if (typeof fn !== 'function') {
      throw new Error('First argument must be a function');
    }
    if (!Number.isInteger(iterations) || iterations <= 0) {
      throw new Error('Iterations must be a positive integer');
    }

    const times = [];

    for (let i = 0; i < iterations; i++) {
      const measurement = this.measure(fn, ...args);
      times.push(measurement.elapsed);
    }

    return this._calculateStats(times, iterations);
  }

  /**
     * Benchmark an async function by running it multiple times
     * @param {Function} fn - Async function to benchmark
     * @param {number} iterations - Number of iterations to run
     * @param {...any} args - Arguments to pass to the function
     * @returns {Promise<Object>} Benchmark results with statistics
     * @throws {Error} If fn is not a function or iterations is invalid
     */
  static async benchmarkAsync(fn, iterations = 100, ...args) {
    if (typeof fn !== 'function') {
      throw new Error('First argument must be a function');
    }
    if (!Number.isInteger(iterations) || iterations <= 0) {
      throw new Error('Iterations must be a positive integer');
    }

    const times = [];

    for (let i = 0; i < iterations; i++) {
      const measurement = await this.measureAsync(fn, ...args);
      times.push(measurement.elapsed);
    }

    return this._calculateStats(times, iterations);
  }

  /**
     * Add a delay/sleep function
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after the delay
     * @throws {Error} If ms is not a positive number
     */
  static sleep(ms) {
    if (typeof ms !== 'number' || ms < 0) {
      throw new Error('Sleep duration must be a non-negative number');
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Get current memory usage
     * @returns {Object} Memory usage statistics
     */
  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,              // Resident Set Size
      heapTotal: usage.heapTotal,  // Total heap size
      heapUsed: usage.heapUsed,    // Used heap size
      external: usage.external,    // External memory usage
      arrayBuffers: usage.arrayBuffers || 0  // ArrayBuffer memory usage
    };
  }

  /**
     * Format memory size in human-readable format
     * @param {number} bytes - Memory size in bytes
     * @returns {string} Formatted memory size
     * @throws {Error} If bytes is not a number
     */
  static formatMemorySize(bytes) {
    if (typeof bytes !== 'number' || bytes < 0) {
      throw new Error('Bytes must be a non-negative number');
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
     * Calculate statistics from timing measurements
     * @private
     * @param {number[]} times - Array of timing measurements
     * @param {number} iterations - Number of iterations
     * @returns {Object} Statistics object
     */
  static _calculateStats(times, iterations) {
    times.sort((a, b) => a - b);

    const total = times.reduce((sum, time) => sum + time, 0);
    const average = total / iterations;
    const min = times[0];
    const max = times[times.length - 1];
    const median = times[Math.floor(times.length / 2)];

    // Calculate standard deviation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / iterations;
    const stdDev = Math.sqrt(variance);

    return {
      iterations,
      total,
      average,
      median,
      min,
      max,
      stdDev,
      times: [...times] // Return copy of times array
    };
  }
}

module.exports = PerformanceUtils;
