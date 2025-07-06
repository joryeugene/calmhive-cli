/**
 * Mathematical utility functions for common operations
 * Provides safe, tested mathematical methods with proper validation
 */

class MathUtils {
  /**
   * Clamps a number within the inclusive lower and upper bounds
   * @param {number} value - The number to clamp
   * @param {number} min - The lower bound
   * @param {number} max - The upper bound
   * @returns {number} The clamped number
   * @throws {Error} If inputs are not numbers or bounds are invalid
   */
  static clamp(value, min, max) {
    if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {
      throw new Error('All inputs must be numbers');
    }
    if (isNaN(value) || isNaN(min) || isNaN(max)) {
      throw new Error('Inputs cannot be NaN');
    }
    if (min > max) {
      throw new Error('Min cannot be greater than max');
    }
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Linear interpolation between two values
   * @param {number} start - The start value
   * @param {number} end - The end value
   * @param {number} t - The interpolation factor (0 to 1)
   * @returns {number} The interpolated value
   * @throws {Error} If inputs are not numbers
   */
  static lerp(start, end, t) {
    if (typeof start !== 'number' || typeof end !== 'number' || typeof t !== 'number') {
      throw new Error('All inputs must be numbers');
    }
    if (isNaN(start) || isNaN(end) || isNaN(t)) {
      throw new Error('Inputs cannot be NaN');
    }
    return start + (end - start) * t;
  }

  /**
   * Rounds a number to specified decimal places
   * @param {number} value - The number to round
   * @param {number} decimals - Number of decimal places (default: 0)
   * @returns {number} The rounded number
   * @throws {Error} If inputs are not numbers or decimals is negative
   */
  static roundTo(value, decimals = 0) {
    if (typeof value !== 'number') {
      throw new Error('Value must be a number');
    }
    if (typeof decimals !== 'number' || !Number.isInteger(decimals)) {
      throw new Error('Decimals must be an integer');
    }
    if (isNaN(value)) {
      throw new Error('Value cannot be NaN');
    }
    if (decimals < 0) {
      throw new Error('Decimals cannot be negative');
    }
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Checks if a number is within the specified range (inclusive)
   * @param {number} value - The number to check
   * @param {number} min - The minimum value
   * @param {number} max - The maximum value
   * @returns {boolean} True if value is within range
   * @throws {Error} If inputs are not numbers or bounds are invalid
   */
  static isInRange(value, min, max) {
    if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {
      throw new Error('All inputs must be numbers');
    }
    if (isNaN(value) || isNaN(min) || isNaN(max)) {
      throw new Error('Inputs cannot be NaN');
    }
    if (min > max) {
      throw new Error('Min cannot be greater than max');
    }
    return value >= min && value <= max;
  }

  /**
   * Calculates the average of an array of numbers
   * @param {number[]} numbers - Array of numbers
   * @returns {number} The average value
   * @throws {Error} If input is not an array or contains non-numbers
   */
  static average(numbers) {
    if (!Array.isArray(numbers)) {
      throw new Error('Input must be an array');
    }
    if (numbers.length === 0) {
      throw new Error('Array cannot be empty');
    }
    for (let i = 0; i < numbers.length; i++) {
      if (typeof numbers[i] !== 'number') {
        throw new Error('All array elements must be numbers');
      }
      if (isNaN(numbers[i])) {
        throw new Error('Array elements cannot be NaN');
      }
    }
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  /**
   * Calculates the sum of an array of numbers
   * @param {number[]} numbers - Array of numbers
   * @returns {number} The sum of all numbers
   * @throws {Error} If input is not an array or contains non-numbers
   */
  static sum(numbers) {
    if (!Array.isArray(numbers)) {
      throw new Error('Input must be an array');
    }
    if (numbers.length === 0) {
      return 0;
    }
    for (let i = 0; i < numbers.length; i++) {
      if (typeof numbers[i] !== 'number') {
        throw new Error('All array elements must be numbers');
      }
      if (isNaN(numbers[i])) {
        throw new Error('Array elements cannot be NaN');
      }
    }
    return numbers.reduce((sum, num) => sum + num, 0);
  }

  /**
   * Finds the maximum value in an array of numbers
   * @param {number[]} numbers - Array of numbers
   * @returns {number} The maximum value
   * @throws {Error} If input is not an array or contains non-numbers
   */
  static max(numbers) {
    if (!Array.isArray(numbers)) {
      throw new Error('Input must be an array');
    }
    if (numbers.length === 0) {
      throw new Error('Array cannot be empty');
    }
    for (let i = 0; i < numbers.length; i++) {
      if (typeof numbers[i] !== 'number') {
        throw new Error('All array elements must be numbers');
      }
      if (isNaN(numbers[i])) {
        throw new Error('Array elements cannot be NaN');
      }
    }
    return Math.max(...numbers);
  }

  /**
   * Finds the minimum value in an array of numbers
   * @param {number[]} numbers - Array of numbers
   * @returns {number} The minimum value
   * @throws {Error} If input is not an array or contains non-numbers
   */
  static min(numbers) {
    if (!Array.isArray(numbers)) {
      throw new Error('Input must be an array');
    }
    if (numbers.length === 0) {
      throw new Error('Array cannot be empty');
    }
    for (let i = 0; i < numbers.length; i++) {
      if (typeof numbers[i] !== 'number') {
        throw new Error('All array elements must be numbers');
      }
      if (isNaN(numbers[i])) {
        throw new Error('Array elements cannot be NaN');
      }
    }
    return Math.min(...numbers);
  }

  /**
   * Generates a random number between min and max (inclusive)
   * @param {number} min - The minimum value
   * @param {number} max - The maximum value
   * @returns {number} A random number between min and max
   * @throws {Error} If inputs are not numbers or bounds are invalid
   */
  static randomBetween(min, max) {
    if (typeof min !== 'number' || typeof max !== 'number') {
      throw new Error('Both inputs must be numbers');
    }
    if (isNaN(min) || isNaN(max)) {
      throw new Error('Inputs cannot be NaN');
    }
    if (min > max) {
      throw new Error('Min cannot be greater than max');
    }
    return Math.random() * (max - min) + min;
  }

  /**
   * Generates a random integer between min and max (inclusive)
   * @param {number} min - The minimum value
   * @param {number} max - The maximum value
   * @returns {number} A random integer between min and max
   * @throws {Error} If inputs are not integers or bounds are invalid
   */
  static randomIntBetween(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error('Both inputs must be integers');
    }
    if (min > max) {
      throw new Error('Min cannot be greater than max');
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = MathUtils;
