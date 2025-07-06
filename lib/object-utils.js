/**
 * Object utility functions for common operations
 * Provides safe, tested object manipulation methods
 */

class ObjectUtils {
  /**
   * Creates a deep clone of an object
   * @param {*} obj - The object to clone
   * @returns {*} Deep cloned object
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof RegExp) {
      return new RegExp(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    if (typeof obj === 'object') {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  }

  /**
   * Deep merges multiple objects
   * @param {...Object} objects - Objects to merge
   * @returns {Object} Merged object
   */
  static deepMerge(...objects) {
    if (objects.length === 0) {
      return {};
    }

    const result = {};

    for (const obj of objects) {
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        continue;
      }

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (
            result[key] &&
            typeof result[key] === 'object' &&
            !Array.isArray(result[key]) &&
            obj[key] &&
            typeof obj[key] === 'object' &&
            !Array.isArray(obj[key])
          ) {
            result[key] = this.deepMerge(result[key], obj[key]);
          } else {
            result[key] = this.deepClone(obj[key]);
          }
        }
      }
    }

    return result;
  }

  /**
   * Safely gets a nested property using dot notation
   * @param {Object} obj - The object to access
   * @param {string} path - Dot notation path (e.g., 'user.profile.name')
   * @param {*} defaultValue - Default value if property doesn't exist
   * @returns {*} The property value or default value
   * @throws {Error} If obj is not an object or path is not a string
   */
  static safeGet(obj, path, defaultValue = undefined) {
    if (obj === null || typeof obj !== 'object') {
      throw new Error('First argument must be an object');
    }
    if (typeof path !== 'string') {
      throw new Error('Path must be a string');
    }

    if (path === '') {
      return defaultValue;
    }

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[key];
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Safely sets a nested property using dot notation
   * @param {Object} obj - The object to modify
   * @param {string} path - Dot notation path (e.g., 'user.profile.name')
   * @param {*} value - Value to set
   * @returns {Object} The modified object
   * @throws {Error} If obj is not an object or path is not a string
   */
  static safeSet(obj, path, value) {
    if (obj === null || typeof obj !== 'object') {
      throw new Error('First argument must be an object');
    }
    if (typeof path !== 'string') {
      throw new Error('Path must be a string');
    }

    if (path === '') {
      throw new Error('Path cannot be empty');
    }

    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return obj;
  }

  /**
   * Flattens a nested object into a single level with dot notation keys
   * @param {Object} obj - The object to flatten
   * @param {string} prefix - Prefix for keys (used internally for recursion)
   * @returns {Object} Flattened object
   * @throws {Error} If obj is not an object
   */
  static flatten(obj, prefix = '') {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Input must be an object');
    }

    const result = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, this.flatten(value, newKey));
        } else {
          result[newKey] = value;
        }
      }
    }

    return result;
  }

  /**
   * Creates a new object with only the specified properties
   * @param {Object} obj - The source object
   * @param {string[]} keys - Array of property names to pick
   * @returns {Object} Object with only the picked properties
   * @throws {Error} If obj is not an object or keys is not an array
   */
  static pick(obj, keys) {
    if (obj === null || typeof obj !== 'object') {
      throw new Error('First argument must be an object');
    }
    if (!Array.isArray(keys)) {
      throw new Error('Keys must be an array');
    }

    const result = {};
    for (const key of keys) {
      if (typeof key !== 'string') {
        throw new Error('All keys must be strings');
      }
      if (obj.hasOwnProperty(key)) {
        result[key] = obj[key];
      }
    }

    return result;
  }

  /**
   * Creates a new object without the specified properties
   * @param {Object} obj - The source object
   * @param {string[]} keys - Array of property names to omit
   * @returns {Object} Object without the omitted properties
   * @throws {Error} If obj is not an object or keys is not an array
   */
  static omit(obj, keys) {
    if (obj === null || typeof obj !== 'object') {
      throw new Error('First argument must be an object');
    }
    if (!Array.isArray(keys)) {
      throw new Error('Keys must be an array');
    }

    const omitSet = new Set();
    for (const key of keys) {
      if (typeof key !== 'string') {
        throw new Error('All keys must be strings');
      }
      omitSet.add(key);
    }

    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && !omitSet.has(key)) {
        result[key] = obj[key];
      }
    }

    return result;
  }

  /**
   * Checks if an object is empty (has no own properties)
   * @param {*} obj - The value to check
   * @returns {boolean} True if object is empty or not an object
   */
  static isEmpty(obj) {
    if (obj === null || obj === undefined) {
      return true;
    }

    if (typeof obj !== 'object') {
      return false;
    }

    if (Array.isArray(obj)) {
      return obj.length === 0;
    }

    return Object.keys(obj).length === 0;
  }

  /**
   * Performs deep equality comparison between two values
   * @param {*} obj1 - First value
   * @param {*} obj2 - Second value
   * @returns {boolean} True if values are deeply equal
   */
  static isEqual(obj1, obj2) {
    if (obj1 === obj2) {
      return true;
    }

    if (obj1 === null || obj2 === null || obj1 === undefined || obj2 === undefined) {
      return obj1 === obj2;
    }

    if (typeof obj1 !== typeof obj2) {
      return false;
    }

    if (typeof obj1 !== 'object') {
      return obj1 === obj2;
    }

    if (Array.isArray(obj1) !== Array.isArray(obj2)) {
      return false;
    }

    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) {
        return false;
      }
      for (let i = 0; i < obj1.length; i++) {
        if (!this.isEqual(obj1[i], obj2[i])) {
          return false;
        }
      }
      return true;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false;
      }
      if (!this.isEqual(obj1[key], obj2[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets all keys from an object, including nested keys with dot notation
   * @param {Object} obj - The object to get keys from
   * @param {string} prefix - Prefix for keys (used internally for recursion)
   * @returns {string[]} Array of all keys including nested ones
   * @throws {Error} If obj is not an object
   */
  static getAllKeys(obj, prefix = '') {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Input must be an object');
    }

    const keys = [];

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.push(fullKey);

        const value = obj[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          keys.push(...this.getAllKeys(value, fullKey));
        }
      }
    }

    return keys;
  }

  /**
   * Transforms object values using a mapping function
   * @param {Object} obj - The object to transform
   * @param {Function} mapFn - Function to transform each value
   * @returns {Object} Object with transformed values
   * @throws {Error} If obj is not an object or mapFn is not a function
   */
  static mapValues(obj, mapFn) {
    if (obj === null || typeof obj !== 'object') {
      throw new Error('First argument must be an object');
    }
    if (typeof mapFn !== 'function') {
      throw new Error('Map function must be a function');
    }

    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = mapFn(obj[key], key, obj);
      }
    }

    return result;
  }

  /**
   * Transforms object keys using a mapping function
   * @param {Object} obj - The object to transform
   * @param {Function} mapFn - Function to transform each key
   * @returns {Object} Object with transformed keys
   * @throws {Error} If obj is not an object or mapFn is not a function
   */
  static mapKeys(obj, mapFn) {
    if (obj === null || typeof obj !== 'object') {
      throw new Error('First argument must be an object');
    }
    if (typeof mapFn !== 'function') {
      throw new Error('Map function must be a function');
    }

    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = mapFn(key, obj[key], obj);
        if (typeof newKey !== 'string') {
          throw new Error('Map function must return a string');
        }
        result[newKey] = obj[key];
      }
    }

    return result;
  }
}

module.exports = ObjectUtils;