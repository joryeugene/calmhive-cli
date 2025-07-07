/**
 * ID generation utilities for creating various types of identifiers
 * Provides safe, tested methods for generating unique identifiers
 */

const crypto = require('crypto');

class IdUtils {
  /**
   * Generates a random alphanumeric ID with specified length
   * @param {number} length - Length of the ID to generate (default: 8)
   * @param {boolean} includeNumbers - Include numbers 0-9 (default: true)
   * @param {boolean} includeUppercase - Include uppercase letters (default: true)
   * @param {boolean} includeLowercase - Include lowercase letters (default: true)
   * @returns {string} Random alphanumeric ID
   * @throws {Error} If length is not a positive integer or no character sets are enabled
   */
  static generateRandomId(length = 8, includeNumbers = true, includeUppercase = true, includeLowercase = true) {
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error('Length must be a positive integer');
    }

    let characters = '';
    if (includeNumbers) {
      characters += '0123456789';
    }
    if (includeUppercase) {
      characters += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    if (includeLowercase) {
      characters += 'abcdefghijklmnopqrstuvwxyz';
    }

    if (characters.length === 0) {
      throw new Error('At least one character set must be enabled');
    }

    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * Generates a cryptographically secure random ID using Node.js crypto
   * @param {number} bytes - Number of random bytes to generate (default: 16)
   * @param {string} encoding - Encoding format: 'hex', 'base64', 'base64url' (default: 'hex')
   * @returns {string} Cryptographically secure random ID
   * @throws {Error} If bytes is not a positive integer or encoding is invalid
   */
  static generateSecureId(bytes = 16, encoding = 'hex') {
    if (!Number.isInteger(bytes) || bytes <= 0) {
      throw new Error('Bytes must be a positive integer');
    }
    if (!['hex', 'base64', 'base64url'].includes(encoding)) {
      throw new Error('Encoding must be "hex", "base64", or "base64url"');
    }

    return crypto.randomBytes(bytes).toString(encoding);
  }

  /**
   * Generates a UUID v4 (random UUID)
   * @returns {string} UUID v4 string
   */
  static generateUuid() {
    return crypto.randomUUID();
  }

  /**
   * Generates a short ID similar to nanoid (URL-safe characters)
   * @param {number} length - Length of the ID (default: 10)
   * @returns {string} Short URL-safe ID
   * @throws {Error} If length is not a positive integer
   */
  static generateNanoId(length = 10) {
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error('Length must be a positive integer');
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return result;
  }

  /**
   * Generates a session ID with timestamp prefix
   * @param {string} prefix - Prefix for the session ID (default: 'session')
   * @param {number} randomLength - Length of random part (default: 8)
   * @returns {string} Session ID with format: prefix-timestamp-randomId
   * @throws {Error} If prefix is not a string or randomLength is not a positive integer
   */
  static generateSessionId(prefix = 'session', randomLength = 8) {
    if (typeof prefix !== 'string') {
      throw new Error('Prefix must be a string');
    }
    if (!Number.isInteger(randomLength) || randomLength <= 0) {
      throw new Error('Random length must be a positive integer');
    }

    const timestamp = Date.now();
    const randomPart = this.generateRandomId(randomLength, true, false, true);
    return `${prefix}-${timestamp}-${randomPart}`;
  }

  /**
   * Generates a slug-like ID suitable for URLs and filenames
   * @param {number} length - Length of the slug (default: 12)
   * @param {string} separator - Separator character (default: '-')
   * @returns {string} URL and filename safe slug
   * @throws {Error} If length is not a positive integer or separator is not a single character
   */
  static generateSlugId(length = 12, separator = '-') {
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error('Length must be a positive integer');
    }
    if (typeof separator !== 'string' || separator.length !== 1) {
      throw new Error('Separator must be a single character');
    }

    // Generate in chunks of 4 characters separated by the separator
    const chunkSize = 4;
    const chunks = Math.ceil(length / chunkSize);
    const parts = [];

    for (let i = 0; i < chunks; i++) {
      const chunkLength = i === chunks - 1 ? length % chunkSize || chunkSize : chunkSize;
      parts.push(this.generateRandomId(chunkLength, true, false, true));
    }

    return parts.join(separator);
  }

  /**
   * Generates a human-readable ID using word-like patterns
   * @param {number} syllables - Number of syllables (default: 3)
   * @param {boolean} includeNumbers - Include numbers at the end (default: true)
   * @returns {string} Human-readable ID
   * @throws {Error} If syllables is not a positive integer
   */
  static generateHumanReadableId(syllables = 3, includeNumbers = true) {
    if (!Number.isInteger(syllables) || syllables <= 0) {
      throw new Error('Syllables must be a positive integer');
    }

    const consonants = 'bcdfghjklmnpqrstvwxyz';
    const vowels = 'aeiou';

    let result = '';

    for (let i = 0; i < syllables; i++) {
      // Add consonant
      result += consonants[Math.floor(Math.random() * consonants.length)];
      // Add vowel
      result += vowels[Math.floor(Math.random() * vowels.length)];
    }

    if (includeNumbers) {
      result += Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    }

    return result;
  }

  /**
   * Generates a color-based ID using hex color codes
   * @param {boolean} includeHash - Include # prefix (default: false)
   * @returns {string} Hex color ID
   */
  static generateColorId(includeHash = false) {
    const color = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    return includeHash ? `#${color}` : color;
  }

  /**
   * Generates a timestamp-based ID with optional random suffix
   * @param {boolean} includeRandom - Include random suffix (default: true)
   * @param {number} randomLength - Length of random suffix (default: 4)
   * @returns {string} Timestamp-based ID
   * @throws {Error} If randomLength is not a positive integer
   */
  static generateTimestampId(includeRandom = true, randomLength = 4) {
    if (!Number.isInteger(randomLength) || randomLength <= 0) {
      throw new Error('Random length must be a positive integer');
    }

    const timestamp = Date.now().toString();

    if (!includeRandom) {
      return timestamp;
    }

    const randomSuffix = this.generateRandomId(randomLength, true, false, true);
    return `${timestamp}-${randomSuffix}`;
  }

  /**
   * Validates if a string is a valid UUID v4
   * @param {string} id - ID string to validate
   * @returns {boolean} True if valid UUID v4
   * @throws {Error} If input is not a string
   */
  static isValidUuid(id) {
    if (typeof id !== 'string') {
      throw new Error('Input must be a string');
    }

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(id);
  }

  /**
   * Validates if a string contains only URL-safe characters
   * @param {string} id - ID string to validate
   * @returns {boolean} True if URL-safe
   * @throws {Error} If input is not a string
   */
  static isUrlSafe(id) {
    if (typeof id !== 'string') {
      throw new Error('Input must be a string');
    }

    const urlSafeRegex = /^[A-Za-z0-9._~-]+$/;
    return urlSafeRegex.test(id);
  }

  /**
   * Validates if a string contains only filename-safe characters
   * @param {string} id - ID string to validate
   * @returns {boolean} True if filename-safe
   * @throws {Error} If input is not a string
   */
  static isFilenameSafe(id) {
    if (typeof id !== 'string') {
      throw new Error('Input must be a string');
    }

    // Avoid reserved characters and names on various systems
    const reservedChars = /[<>:"/\\|?*]/;
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

    return !reservedChars.test(id) && !reservedNames.test(id) && id.trim() === id;
  }

  /**
   * Shortens a long ID while preserving uniqueness characteristics
   * @param {string} id - ID to shorten
   * @param {number} length - Target length (default: 8)
   * @param {boolean} preserveEnds - Preserve start and end of original ID (default: true)
   * @returns {string} Shortened ID
   * @throws {Error} If input is not a string or length is not a positive integer
   */
  static shortenId(id, length = 8, preserveEnds = true) {
    if (typeof id !== 'string') {
      throw new Error('Input must be a string');
    }
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error('Length must be a positive integer');
    }

    if (id.length <= length) {
      return id;
    }

    if (!preserveEnds) {
      return id.substring(0, length);
    }

    // Preserve start and end
    const startLength = Math.floor(length / 2);
    const endLength = length - startLength;

    return id.substring(0, startLength) + id.substring(id.length - endLength);
  }

  /**
   * Generates multiple unique IDs at once
   * @param {number} count - Number of IDs to generate
   * @param {Function} generator - Generator function to use (default: generateNanoId)
   * @param {...*} args - Arguments to pass to the generator function
   * @returns {string[]} Array of unique IDs
   * @throws {Error} If count is not a positive integer or generator is not a function
   */
  static generateBatch(count, generator = this.generateNanoId, ...args) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error('Count must be a positive integer');
    }
    if (typeof generator !== 'function') {
      throw new Error('Generator must be a function');
    }

    const ids = new Set();
    const maxAttempts = count * 10; // Prevent infinite loops
    let attempts = 0;

    while (ids.size < count && attempts < maxAttempts) {
      const id = generator.call(this, ...args);
      ids.add(id);
      attempts++;
    }

    if (ids.size < count) {
      throw new Error('Could not generate enough unique IDs');
    }

    return Array.from(ids);
  }
}

module.exports = IdUtils;
