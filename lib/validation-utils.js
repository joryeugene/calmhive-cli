/**
 * Validation utility functions for common data formats
 * Provides safe, tested validation methods for various data types
 */

class ValidationUtils {
  /**
   * Validates if a string is a properly formatted email address
   * @param {string} email - The email string to validate
   * @returns {boolean} True if email is valid format
   * @throws {Error} If input is not a string
   */
  static isEmail(email) {
    if (typeof email !== 'string') {
      throw new Error('Input must be a string');
    }

    if (email.length === 0) {
      return false;
    }

    // More comprehensive email regex than basic patterns
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    // Basic length checks
    if (email.length > 254) { // RFC 5321 limit
      return false;
    }

    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      return false;
    }

    // Local part length check (RFC 5321)
    if (localPart.length > 64) {
      return false;
    }

    return emailRegex.test(email);
  }

  /**
   * Validates if a string is a properly formatted US phone number
   * @param {string} phone - The phone string to validate
   * @param {boolean} allowInternational - Allow international formats (default: false)
   * @returns {boolean} True if phone number is valid format
   * @throws {Error} If input is not a string
   */
  static isPhone(phone, allowInternational = false) {
    if (typeof phone !== 'string') {
      throw new Error('Input must be a string');
    }

    if (phone.length === 0) {
      return false;
    }

    // Remove all non-digit characters except + for international
    const digitsOnly = phone.replace(/[^\d+]/g, '');

    if (allowInternational) {
      // International format: +1 to +999 followed by 6-15 digits
      const intlRegex = /^\+[1-9]\d{6,14}$/;
      return intlRegex.test(digitsOnly);
    }

    // US format: 10 digits, optionally with +1 prefix
    const usRegex = /^(\+1)?[2-9]\d{2}[2-9]\d{2}\d{4}$/;
    return usRegex.test(digitsOnly);
  }

  /**
   * Validates if a string is a properly formatted URL
   * @param {string} url - The URL string to validate
   * @param {object} options - Validation options
   * @param {boolean} options.requireProtocol - Require http/https protocol (default: true)
   * @param {string[]} options.allowedProtocols - Allowed protocols (default: ['http', 'https'])
   * @returns {boolean} True if URL is valid format
   * @throws {Error} If input is not a string
   */
  static isUrl(url, options = {}) {
    if (typeof url !== 'string') {
      throw new Error('Input must be a string');
    }

    const defaults = {
      requireProtocol: true,
      allowedProtocols: ['http', 'https']
    };
    const opts = { ...defaults, ...options };

    if (url.length === 0) {
      return false;
    }

    try {
      const urlObj = new URL(url);

      if (opts.requireProtocol && !opts.allowedProtocols.includes(urlObj.protocol.slice(0, -1))) {
        return false;
      }

      // Basic hostname validation
      if (!urlObj.hostname || urlObj.hostname.length === 0) {
        return false;
      }

      // Prevent localhost in production contexts (can be overridden in options)
      if (opts.disallowLocalhost && ['localhost', '127.0.0.1', '::1'].includes(urlObj.hostname)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates if a string is a properly formatted IPv4 address
   * @param {string} ip - The IP string to validate
   * @returns {boolean} True if IP address is valid format
   * @throws {Error} If input is not a string
   */
  static isIpv4(ip) {
    if (typeof ip !== 'string') {
      throw new Error('Input must be a string');
    }

    if (ip.length === 0) {
      return false;
    }

    const parts = ip.split('.');
    if (parts.length !== 4) {
      return false;
    }

    return parts.every(part => {
      // Check if part is a valid number string
      if (!/^\d+$/.test(part)) {
        return false;
      }

      // Check for leading zeros (except single '0')
      if (part.length > 1 && part[0] === '0') {
        return false;
      }

      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Validates if a string is a properly formatted UUID (v4)
   * @param {string} uuid - The UUID string to validate
   * @param {number} version - UUID version to validate (default: 4)
   * @returns {boolean} True if UUID is valid format
   * @throws {Error} If input is not a string
   */
  static isUuid(uuid, version = 4) {
    if (typeof uuid !== 'string') {
      throw new Error('Input must be a string');
    }

    if (!Number.isInteger(version) || version < 1 || version > 5) {
      throw new Error('Version must be an integer between 1 and 5');
    }

    if (uuid.length === 0) {
      return false;
    }

    // UUID format: 8-4-4-4-12 hex characters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(uuid)) {
      return false;
    }

    // Check version-specific format
    const versionChar = uuid.charAt(14);
    return versionChar === version.toString();
  }

  /**
   * Validates password strength based on configurable criteria
   * @param {string} password - The password to validate
   * @param {object} options - Validation criteria
   * @param {number} options.minLength - Minimum length (default: 8)
   * @param {boolean} options.requireUppercase - Require uppercase letter (default: true)
   * @param {boolean} options.requireLowercase - Require lowercase letter (default: true)
   * @param {boolean} options.requireNumbers - Require numbers (default: true)
   * @param {boolean} options.requireSpecialChars - Require special characters (default: true)
   * @returns {object} Validation result with passed status and details
   * @throws {Error} If input is not a string
   */
  static validatePassword(password, options = {}) {
    if (typeof password !== 'string') {
      throw new Error('Input must be a string');
    }

    const defaults = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    };
    const opts = { ...defaults, ...options };

    const result = {
      isValid: true,
      checks: {},
      score: 0,
      feedback: []
    };

    // Length check
    result.checks.length = password.length >= opts.minLength;
    if (!result.checks.length) {
      result.isValid = false;
      result.feedback.push(`Password must be at least ${opts.minLength} characters long`);
    } else {
      result.score += 1;
    }

    // Uppercase check
    if (opts.requireUppercase) {
      result.checks.uppercase = /[A-Z]/.test(password);
      if (!result.checks.uppercase) {
        result.isValid = false;
        result.feedback.push('Password must contain at least one uppercase letter');
      } else {
        result.score += 1;
      }
    }

    // Lowercase check
    if (opts.requireLowercase) {
      result.checks.lowercase = /[a-z]/.test(password);
      if (!result.checks.lowercase) {
        result.isValid = false;
        result.feedback.push('Password must contain at least one lowercase letter');
      } else {
        result.score += 1;
      }
    }

    // Numbers check
    if (opts.requireNumbers) {
      result.checks.numbers = /\d/.test(password);
      if (!result.checks.numbers) {
        result.isValid = false;
        result.feedback.push('Password must contain at least one number');
      } else {
        result.score += 1;
      }
    }

    // Special characters check
    if (opts.requireSpecialChars) {
      result.checks.specialChars = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
      if (!result.checks.specialChars) {
        result.isValid = false;
        result.feedback.push('Password must contain at least one special character');
      } else {
        result.score += 1;
      }
    }

    // Bonus points for longer passwords
    if (password.length >= 12) {
      result.score += 1;
    }
    if (password.length >= 16) {
      result.score += 1;
    }

    return result;
  }

  /**
   * Validates if a string is a properly formatted US ZIP code
   * @param {string} zip - The ZIP code to validate
   * @param {boolean} allowExtended - Allow ZIP+4 format (default: true)
   * @returns {boolean} True if ZIP code is valid format
   * @throws {Error} If input is not a string
   */
  static isZipCode(zip, allowExtended = true) {
    if (typeof zip !== 'string') {
      throw new Error('Input must be a string');
    }

    if (zip.length === 0) {
      return false;
    }

    if (allowExtended) {
      // Allow both 12345 and 12345-6789 formats
      const zipRegex = /^\d{5}(-\d{4})?$/;
      return zipRegex.test(zip);
    } else {
      // Only 5-digit format
      const zipRegex = /^\d{5}$/;
      return zipRegex.test(zip);
    }
  }

  /**
   * Validates if a value is a positive integer within optional bounds
   * @param {*} value - The value to validate
   * @param {object} options - Validation options
   * @param {number} options.min - Minimum value (inclusive, default: 1)
   * @param {number} options.max - Maximum value (inclusive, default: no limit)
   * @returns {boolean} True if value is a valid positive integer
   */
  static isPositiveInteger(value, options = {}) {
    const defaults = {
      min: 1,
      max: Number.MAX_SAFE_INTEGER
    };
    const opts = { ...defaults, ...options };

    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return false;
    }

    return value >= opts.min && value <= opts.max;
  }

  /**
   * Validates if a string contains only alphanumeric characters
   * @param {string} str - The string to validate
   * @param {boolean} allowSpaces - Allow spaces in the string (default: false)
   * @returns {boolean} True if string is alphanumeric
   * @throws {Error} If input is not a string
   */
  static isAlphanumeric(str, allowSpaces = false) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }

    if (str.length === 0) {
      return false;
    }

    const regex = allowSpaces ? /^[a-zA-Z0-9\s]+$/ : /^[a-zA-Z0-9]+$/;
    return regex.test(str);
  }
}

module.exports = ValidationUtils;
