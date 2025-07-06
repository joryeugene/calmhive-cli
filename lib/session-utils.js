/**
 * Session utility functions for AFk session ID management
 * Provides safe, tested methods for session ID generation, validation, and parsing
 */

const crypto = require('crypto');

class SessionUtils {
  /**
   * Generates a new AFk session ID with timestamp and random suffix
   * @param {string} prefix - Session type prefix (default: 'afk')
   * @param {Date} [timestamp] - Custom timestamp (default: current time)
   * @returns {string} Generated session ID in format: prefix-timestamp-random
   * @throws {Error} If prefix is invalid
   */
  static generateSessionId(prefix = 'afk', timestamp = null) {
    if (typeof prefix !== 'string' || prefix.length === 0) {
      throw new Error('Prefix must be a non-empty string');
    }
    
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(prefix)) {
      throw new Error('Prefix must contain only lowercase letters, numbers, and hyphens');
    }

    const ts = timestamp ? timestamp.getTime() : Date.now();
    const timestampPart = Math.floor(ts / 1000); // Unix timestamp in seconds
    
    // Generate 8-character random alphanumeric suffix
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    
    return `${prefix}-${timestampPart}-${randomSuffix}`;
  }

  /**
   * Validates if a string is a properly formatted session ID
   * @param {string} sessionId - The session ID to validate
   * @param {object} options - Validation options
   * @param {string[]} [options.allowedPrefixes] - Allowed prefixes (default: ['afk'])
   * @param {boolean} [options.strict=true] - Strict validation (exact format)
   * @returns {boolean} True if session ID is valid format
   * @throws {Error} If input is not a string
   */
  static isValidSessionId(sessionId, options = {}) {
    if (typeof sessionId !== 'string') {
      throw new Error('Session ID must be a string');
    }

    const defaults = {
      allowedPrefixes: ['afk'],
      strict: true
    };
    const opts = { ...defaults, ...options };

    if (sessionId.length === 0) {
      return false;
    }

    // Basic format: prefix-timestamp-random
    // Example: afk-1640995200-a1b2c3d4
    const parts = sessionId.split('-');
    
    if (opts.strict && parts.length !== 3) {
      return false;
    }
    
    if (parts.length < 3) {
      return false;
    }

    const [prefix, timestampStr, randomPart] = parts;

    // Validate prefix
    if (opts.allowedPrefixes.length > 0 && !opts.allowedPrefixes.includes(prefix)) {
      return false;
    }

    // Validate timestamp part (should be numeric)
    if (!/^\d+$/.test(timestampStr)) {
      return false;
    }

    const timestamp = parseInt(timestampStr, 10);
    // Reasonable timestamp range (year 2020-2040)
    if (timestamp < 1577836800 || timestamp > 2208988800) {
      return false;
    }

    // Validate random part (should be 8 hex characters)
    if (opts.strict && !/^[a-f0-9]{8}$/.test(randomPart)) {
      return false;
    }

    // Non-strict: allow any alphanumeric string
    if (!opts.strict && !/^[a-zA-Z0-9]+$/.test(randomPart)) {
      return false;
    }

    return true;
  }

  /**
   * Parses a session ID into its components
   * @param {string} sessionId - The session ID to parse
   * @returns {object} Parsed components: {prefix, timestamp, randomPart, createdAt}
   * @throws {Error} If session ID is invalid
   */
  static parseSessionId(sessionId) {
    if (!this.isValidSessionId(sessionId, { strict: false })) {
      throw new Error('Invalid session ID format');
    }

    const parts = sessionId.split('-');
    const [prefix, timestampStr, ...randomParts] = parts;
    const randomPart = randomParts.join('-'); // Handle multi-part random sections

    const timestamp = parseInt(timestampStr, 10);
    const createdAt = new Date(timestamp * 1000);

    return {
      prefix,
      timestamp,
      randomPart,
      createdAt,
      full: sessionId
    };
  }

  /**
   * Extracts the creation timestamp from a session ID
   * @param {string} sessionId - The session ID
   * @returns {Date} Creation date of the session
   * @throws {Error} If session ID is invalid
   */
  static getSessionTimestamp(sessionId) {
    const parsed = this.parseSessionId(sessionId);
    return parsed.createdAt;
  }

  /**
   * Calculates the age of a session in milliseconds
   * @param {string} sessionId - The session ID
   * @param {Date} [referenceTime] - Reference time (default: current time)
   * @returns {number} Age in milliseconds
   * @throws {Error} If session ID is invalid
   */
  static getSessionAge(sessionId, referenceTime = null) {
    const createdAt = this.getSessionTimestamp(sessionId);
    const reference = referenceTime || new Date();
    return reference.getTime() - createdAt.getTime();
  }

  /**
   * Checks if a session is older than a specified duration
   * @param {string} sessionId - The session ID
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @param {Date} [referenceTime] - Reference time (default: current time)
   * @returns {boolean} True if session is older than maxAge
   * @throws {Error} If session ID is invalid or maxAge is not a number
   */
  static isSessionOlderThan(sessionId, maxAgeMs, referenceTime = null) {
    if (typeof maxAgeMs !== 'number' || maxAgeMs < 0) {
      throw new Error('Max age must be a non-negative number');
    }

    const age = this.getSessionAge(sessionId, referenceTime);
    return age > maxAgeMs;
  }

  /**
   * Sorts session IDs by creation time
   * @param {string[]} sessionIds - Array of session IDs
   * @param {boolean} [ascending=true] - Sort order (true for oldest first)
   * @returns {string[]} Sorted array of session IDs
   * @throws {Error} If any session ID is invalid
   */
  static sortSessionsByAge(sessionIds, ascending = true) {
    if (!Array.isArray(sessionIds)) {
      throw new Error('Session IDs must be an array');
    }

    // Validate all session IDs first
    for (const sessionId of sessionIds) {
      if (!this.isValidSessionId(sessionId, { strict: false })) {
        throw new Error(`Invalid session ID: ${sessionId}`);
      }
    }

    return sessionIds.slice().sort((a, b) => {
      const timestampA = this.getSessionTimestamp(a).getTime();
      const timestampB = this.getSessionTimestamp(b).getTime();
      
      return ascending ? timestampA - timestampB : timestampB - timestampA;
    });
  }

  /**
   * Filters sessions by age criteria
   * @param {string[]} sessionIds - Array of session IDs
   * @param {object} criteria - Filter criteria
   * @param {number} [criteria.olderThan] - Include sessions older than (ms)
   * @param {number} [criteria.newerThan] - Include sessions newer than (ms)
   * @param {Date} [criteria.referenceTime] - Reference time (default: current time)
   * @returns {string[]} Filtered array of session IDs
   * @throws {Error} If any session ID is invalid
   */
  static filterSessionsByAge(sessionIds, criteria = {}) {
    if (!Array.isArray(sessionIds)) {
      throw new Error('Session IDs must be an array');
    }

    const { olderThan, newerThan, referenceTime = new Date() } = criteria;

    return sessionIds.filter(sessionId => {
      const age = this.getSessionAge(sessionId, referenceTime);
      
      if (olderThan !== undefined && age <= olderThan) {
        return false;
      }
      
      if (newerThan !== undefined && age >= newerThan) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Extracts the prefix from a session ID
   * @param {string} sessionId - The session ID
   * @returns {string} The session prefix
   * @throws {Error} If session ID is invalid
   */
  static getSessionPrefix(sessionId) {
    const parsed = this.parseSessionId(sessionId);
    return parsed.prefix;
  }

  /**
   * Groups sessions by their prefix
   * @param {string[]} sessionIds - Array of session IDs
   * @returns {object} Object with prefixes as keys and session arrays as values
   * @throws {Error} If any session ID is invalid
   */
  static groupSessionsByPrefix(sessionIds) {
    if (!Array.isArray(sessionIds)) {
      throw new Error('Session IDs must be an array');
    }

    const groups = {};
    
    for (const sessionId of sessionIds) {
      const prefix = this.getSessionPrefix(sessionId);
      
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      
      groups[prefix].push(sessionId);
    }
    
    return groups;
  }

  /**
   * Formats session age as human-readable string
   * @param {string} sessionId - The session ID
   * @param {Date} [referenceTime] - Reference time (default: current time)
   * @returns {string} Human-readable age (e.g., "2h 30m ago")
   * @throws {Error} If session ID is invalid
   */
  static formatSessionAge(sessionId, referenceTime = null) {
    const ageMs = this.getSessionAge(sessionId, referenceTime);
    
    if (ageMs < 0) {
      return 'in the future';
    }
    
    if (ageMs < 60000) { // Less than 1 minute
      const seconds = Math.floor(ageMs / 1000);
      return `${seconds}s ago`;
    }
    
    if (ageMs < 3600000) { // Less than 1 hour
      const minutes = Math.floor(ageMs / 60000);
      return `${minutes}m ago`;
    }
    
    if (ageMs < 86400000) { // Less than 1 day
      const hours = Math.floor(ageMs / 3600000);
      const minutes = Math.floor((ageMs % 3600000) / 60000);
      return minutes > 0 ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
    }
    
    const days = Math.floor(ageMs / 86400000);
    const hours = Math.floor((ageMs % 86400000) / 3600000);
    return hours > 0 ? `${days}d ${hours}h ago` : `${days}d ago`;
  }
}

module.exports = SessionUtils;