/**
 * Array utility functions for common operations
 * Provides safe, tested array manipulation methods
 *
 * MODERNIZED: Now using lodash for battle-tested implementations
 * Maintains 100% API compatibility with previous version
 */

const _ = require('lodash');

class ArrayUtils {
  /**
   * Splits an array into chunks of specified size
   * @param {Array} array - The array to chunk
   * @param {number} size - The size of each chunk
   * @returns {Array[]} Array of chunks
   * @throws {Error} If size is not a positive integer
   */
  static chunk(array, size) {
    if (!Array.isArray(array)) {
      throw new Error('First argument must be an array');
    }
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error('Chunk size must be a positive integer');
    }

    return _.chunk(array, size);
  }

  /**
   * Flattens a nested array structure
   * @param {Array} array - The array to flatten
   * @param {number} depth - Maximum depth to flatten (default: Infinity)
   * @returns {Array} Flattened array
   */
  static flatten(array, depth = Infinity) {
    if (!Array.isArray(array)) {
      throw new Error('First argument must be an array');
    }
    if (depth !== Infinity && (!Number.isInteger(depth) || depth < 0)) {
      throw new Error('Depth must be a non-negative integer');
    }

    if (depth === Infinity) {
      return _.flattenDeep(array);
    }

    if (depth === 0) {
      return array.slice();
    }

    // For specific depth, use native flat() method (more efficient than lodash)
    return array.flat(depth);
  }

  /**
   * Removes duplicate values from an array
   * @param {Array} array - The array to deduplicate
   * @param {Function} keyFn - Optional function to generate comparison key
   * @returns {Array} Array with duplicates removed
   */
  static unique(array, keyFn = null) {
    if (!Array.isArray(array)) {
      throw new Error('First argument must be an array');
    }
    if (keyFn && typeof keyFn !== 'function') {
      throw new Error('Key function must be a function');
    }

    if (keyFn) {
      return _.uniqBy(array, keyFn);
    }

    return _.uniq(array);
  }

  /**
   * Returns the intersection of multiple arrays
   * @param {...Array} arrays - Arrays to intersect
   * @returns {Array} Intersection of all arrays
   */
  static intersection(...arrays) {
    if (arrays.length === 0) {
      return [];
    }

    for (const array of arrays) {
      if (!Array.isArray(array)) {
        throw new Error('All arguments must be arrays');
      }
    }

    if (arrays.length === 1) {
      return [...arrays[0]];
    }

    return _.intersection(...arrays);
  }

  /**
   * Groups array elements by a key function
   * @param {Array} array - The array to group
   * @param {Function} keyFn - Function to generate group keys
   * @returns {Object} Object with grouped elements
   */
  static groupBy(array, keyFn) {
    if (!Array.isArray(array)) {
      throw new Error('First argument must be an array');
    }
    if (typeof keyFn !== 'function') {
      throw new Error('Key function must be a function');
    }

    return _.groupBy(array, keyFn);
  }

  /**
   * Safely gets an element from an array at the specified index
   * @param {Array} array - The array to access
   * @param {number} index - The index to access
   * @param {*} defaultValue - Default value if index is out of bounds
   * @returns {*} The element at index or default value
   */
  static safeGet(array, index, defaultValue = undefined) {
    if (!Array.isArray(array)) {
      throw new Error('First argument must be an array');
    }
    if (!Number.isInteger(index)) {
      throw new Error('Index must be an integer');
    }

    // Handle negative indices as out of bounds (return default)
    if (index < 0 || index >= array.length) {
      return defaultValue;
    }
    return array[index];
  }

  /**
   * Compares two arrays for equality (shallow comparison)
   * @param {Array} array1 - First array
   * @param {Array} array2 - Second array
   * @returns {boolean} True if arrays are equal
   */
  static isEqual(array1, array2) {
    if (!Array.isArray(array1) || !Array.isArray(array2)) {
      return false;
    }

    if (array1.length !== array2.length) {
      return false;
    }

    // Shallow comparison - check each element with ===
    return array1.every((value, index) => value === array2[index]);
  }

  /**
   * Returns elements in the first array that are not in the second array
   * @param {Array} array1 - The array to find differences from
   * @param {Array} array2 - The array to compare against
   * @returns {Array} Elements in array1 that are not in array2
   */
  static difference(array1, array2) {
    if (!Array.isArray(array1)) {
      throw new Error('First argument must be an array');
    }
    if (!Array.isArray(array2)) {
      throw new Error('Second argument must be an array');
    }

    if (array2.length === 0) {
      return array1.slice();
    }

    return _.difference(array1, array2);
  }

  /**
   * Splits an array into two arrays based on a predicate function
   * @param {Array} array - The array to partition
   * @param {Function} predicate - Function that returns true/false for each element
   * @returns {Array[]} Array containing [truthyItems, falsyItems]
   */
  static partition(array, predicate) {
    if (!Array.isArray(array)) {
      throw new Error('First argument must be an array');
    }
    if (typeof predicate !== 'function') {
      throw new Error('Predicate must be a function');
    }

    // Use manual implementation to ensure predicate gets (element, index, array)
    const truthy = [];
    const falsy = [];

    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      if (predicate(item, i, array)) {
        truthy.push(item);
      } else {
        falsy.push(item);
      }
    }

    return [truthy, falsy];
  }

  /**
   * Returns a new array with elements randomly shuffled using Fisher-Yates algorithm
   * @param {Array} array - The array to shuffle
   * @returns {Array} A new array with elements randomly shuffled
   */
  static shuffle(array) {
    if (!Array.isArray(array)) {
      throw new Error('First argument must be an array');
    }

    if (array.length <= 1) {
      return array.slice();
    }

    return _.shuffle(array);
  }
}

module.exports = ArrayUtils;
