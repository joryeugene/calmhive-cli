/**
 * String utility functions for common operations
 * Provides safe, tested string manipulation methods
 */

class StringUtils {
  /**
   * Capitalizes the first letter of a string
   * @param {string} str - The string to capitalize
   * @returns {string} String with first letter capitalized
   * @throws {Error} If input is not a string
   */
  static capitalize(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    if (str.length === 0) {
      return str;
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Converts string to camelCase
   * @param {string} str - The string to convert
   * @returns {string} String in camelCase format
   * @throws {Error} If input is not a string
   */
  static toCamelCase(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase())
      .replace(/^[A-Z]/, (match) => match.toLowerCase());
  }

  /**
   * Converts string to kebab-case
   * @param {string} str - The string to convert
   * @returns {string} String in kebab-case format
   * @throws {Error} If input is not a string
   */
  static toKebabCase(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Converts string to snake_case
   * @param {string} str - The string to convert
   * @returns {string} String in snake_case format
   * @throws {Error} If input is not a string
   */
  static toSnakeCase(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase()
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Truncates a string to specified length with optional suffix
   * @param {string} str - The string to truncate
   * @param {number} length - Maximum length
   * @param {string} suffix - Suffix to append (default: '...')
   * @returns {string} Truncated string
   * @throws {Error} If input is not a string or length is not a positive number
   */
  static truncate(str, length, suffix = '...') {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    if (!Number.isInteger(length) || length < 0) {
      throw new Error('Length must be a non-negative integer');
    }
    if (typeof suffix !== 'string') {
      throw new Error('Suffix must be a string');
    }

    if (str.length <= length) {
      return str;
    }

    const truncateLength = Math.max(0, length - suffix.length);
    return str.slice(0, truncateLength) + suffix;
  }

  /**
   * Removes leading and trailing whitespace and normalizes internal whitespace
   * @param {string} str - The string to clean
   * @returns {string} Cleaned string
   * @throws {Error} If input is not a string
   */
  static clean(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    return str.trim().replace(/\s+/g, ' ');
  }

  /**
   * Escapes HTML special characters
   * @param {string} str - The string to escape
   * @returns {string} HTML-escaped string
   * @throws {Error} If input is not a string
   */
  static escapeHtml(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#x27;',
      '/': '&#x2F;'
    };
    return str.replace(/[&<>"'\/]/g, (match) => htmlEscapes[match]);
  }

  /**
   * Unescapes HTML entities
   * @param {string} str - The string to unescape
   * @returns {string} HTML-unescaped string
   * @throws {Error} If input is not a string
   */
  static unescapeHtml(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    const htmlUnescapes = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': '\'',
      '&#x2F;': '/'
    };
    return str.replace(/&(?:amp|lt|gt|quot|#x27|#x2F);/g, (match) => htmlUnescapes[match]);
  }

  /**
   * Generates a slug from a string (URL-friendly version)
   * @param {string} str - The string to slugify
   * @returns {string} URL-friendly slug
   * @throws {Error} If input is not a string
   */
  static slugify(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Counts the number of words in a string
   * @param {string} str - The string to count words in
   * @returns {number} Number of words
   * @throws {Error} If input is not a string
   */
  static wordCount(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    const cleaned = str.trim();
    if (cleaned === '') {
      return 0;
    }
    return cleaned.split(/\s+/).length;
  }

  /**
   * Reverses a string
   * @param {string} str - The string to reverse
   * @returns {string} Reversed string
   * @throws {Error} If input is not a string
   */
  static reverse(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    return str.split('').reverse().join('');
  }

  /**
   * Checks if a string is a palindrome (ignoring case and spaces)
   * @param {string} str - The string to check
   * @returns {boolean} True if string is a palindrome
   * @throws {Error} If input is not a string
   */
  static isPalindrome(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleaned === cleaned.split('').reverse().join('');
  }

  /**
   * Pads a string to a target length with specified character
   * @param {string} str - The string to pad
   * @param {number} length - Target length
   * @param {string} padChar - Character to pad with (default: ' ')
   * @param {string} direction - 'left', 'right', or 'both' (default: 'left')
   * @returns {string} Padded string
   * @throws {Error} If inputs are invalid
   */
  static pad(str, length, padChar = ' ', direction = 'left') {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    if (!Number.isInteger(length) || length < 0) {
      throw new Error('Length must be a non-negative integer');
    }
    if (typeof padChar !== 'string' || padChar.length !== 1) {
      throw new Error('Pad character must be a single character string');
    }
    if (!['left', 'right', 'both'].includes(direction)) {
      throw new Error('Direction must be "left", "right", or "both"');
    }

    const padding = length - str.length;
    if (padding <= 0) {
      return str;
    }

    switch (direction) {
    case 'left':
      return padChar.repeat(padding) + str;
    case 'right':
      return str + padChar.repeat(padding);
    case 'both':
      const leftPadding = Math.floor(padding / 2);
      const rightPadding = padding - leftPadding;
      return padChar.repeat(leftPadding) + str + padChar.repeat(rightPadding);
    default:
      return str;
    }
  }

  /**
   * Extracts all email addresses from a string
   * @param {string} str - The string to extract emails from
   * @returns {string[]} Array of email addresses found
   * @throws {Error} If input is not a string
   */
  static extractEmails(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return str.match(emailRegex) || [];
  }

  /**
   * Formats a duration in milliseconds to human-readable string
   * @param {number} milliseconds - Duration in milliseconds
   * @param {boolean} short - Use short format (default: false)
   * @returns {string} Formatted duration string
   * @throws {Error} If input is not a number
   */
  static formatDuration(milliseconds, short = false) {
    if (typeof milliseconds !== 'number' || milliseconds < 0) {
      throw new Error('Input must be a non-negative number');
    }

    const units = [
      { name: 'day', short: 'd', value: 24 * 60 * 60 * 1000 },
      { name: 'hour', short: 'h', value: 60 * 60 * 1000 },
      { name: 'minute', short: 'm', value: 60 * 1000 },
      { name: 'second', short: 's', value: 1000 },
      { name: 'millisecond', short: 'ms', value: 1 }
    ];

    if (milliseconds === 0) {
      return short ? '0ms' : '0 milliseconds';
    }

    const parts = [];
    let remaining = milliseconds;

    for (const unit of units) {
      const count = Math.floor(remaining / unit.value);
      if (count > 0) {
        const label = short ? unit.short : count === 1 ? unit.name : `${unit.name}s`;
        const separator = short ? '' : ' ';
        parts.push(`${count}${separator}${label}`);
        remaining -= count * unit.value;
      }
      if (parts.length >= 2) {break;} // Limit to 2 most significant units
    }

    return parts.join(short ? ' ' : ', ');
  }

  /**
   * Formats bytes to human-readable string
   * @param {number} bytes - Number of bytes
   * @param {number} decimals - Number of decimal places (default: 2)
   * @returns {string} Formatted bytes string
   * @throws {Error} If input is not a number
   */
  static formatBytes(bytes, decimals = 2) {
    if (typeof bytes !== 'number' || bytes < 0) {
      throw new Error('Input must be a non-negative number');
    }
    if (!Number.isInteger(decimals) || decimals < 0) {
      throw new Error('Decimals must be a non-negative integer');
    }

    if (bytes === 0) {return '0 Bytes';}

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Formats a timestamp to human-readable string
   * @param {number|Date} timestamp - Timestamp or Date object
   * @param {string} format - Format type: 'full', 'date', 'time', 'relative' (default: 'full')
   * @returns {string} Formatted timestamp string
   * @throws {Error} If input is invalid
   */
  static formatTimestamp(timestamp, format = 'full') {
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      throw new Error('Input must be a number or Date object');
    }

    if (isNaN(date.getTime())) {
      throw new Error('Invalid date provided');
    }

    if (!['full', 'date', 'time', 'relative'].includes(format)) {
      throw new Error('Format must be "full", "date", "time", or "relative"');
    }

    switch (format) {
    case 'date':
      return date.toLocaleDateString();
    case 'time':
      return date.toLocaleTimeString();
    case 'relative':
      return this.formatRelativeTime(date);
    case 'full':
    default:
      return date.toLocaleString();
    }
  }

  /**
   * Formats a date to relative time string (e.g., "2 hours ago")
   * @param {Date} date - Date object
   * @returns {string} Relative time string
   */
  static formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 0) {
      return 'in the future';
    }

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {return `${days} day${days === 1 ? '' : 's'} ago`;}
    if (hours > 0) {return `${hours} hour${hours === 1 ? '' : 's'} ago`;}
    if (minutes > 0) {return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;}
    if (seconds > 5) {return `${seconds} seconds ago`;}
    return 'just now';
  }

  /**
   * Formats a number with thousands separators and decimal places
   * @param {number} num - Number to format
   * @param {number} decimals - Number of decimal places (default: 0)
   * @param {string} locale - Locale for formatting (default: 'en-US')
   * @returns {string} Formatted number string
   * @throws {Error} If input is not a number
   */
  static formatNumber(num, decimals = 0, locale = 'en-US') {
    if (typeof num !== 'number') {
      throw new Error('Input must be a number');
    }
    if (!Number.isInteger(decimals) || decimals < 0) {
      throw new Error('Decimals must be a non-negative integer');
    }
    if (typeof locale !== 'string') {
      throw new Error('Locale must be a string');
    }

    return num.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Validates and normalizes a URL
   * @param {string} url - URL to validate
   * @param {boolean} allowRelative - Allow relative URLs (default: false)
   * @returns {string|null} Normalized URL or null if invalid
   * @throws {Error} If input is not a string
   */
  static normalizeUrl(url, allowRelative = false) {
    if (typeof url !== 'string') {
      throw new Error('Input must be a string');
    }

    try {
      // Handle relative URLs
      if (allowRelative && !url.includes('://')) {
        return url.startsWith('/') ? url : `/${url}`;
      }

      const urlObj = new URL(url);
      return urlObj.href;
    } catch (error) {
      return null;
    }
  }

  /**
   * Safely encodes a string to Base64
   * @param {string} str - String to encode
   * @returns {string} Base64 encoded string
   * @throws {Error} If input is not a string
   */
  static toBase64(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    return Buffer.from(str, 'utf8').toString('base64');
  }

  /**
   * Safely decodes a Base64 string
   * @param {string} base64 - Base64 string to decode
   * @returns {string|null} Decoded string or null if invalid
   * @throws {Error} If input is not a string
   */
  static fromBase64(base64) {
    if (typeof base64 !== 'string') {
      throw new Error('Input must be a string');
    }

    // Validate Base64 format (only A-Z, a-z, 0-9, +, /, = allowed)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64)) {
      return null;
    }

    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      // Verify round-trip to ensure it was valid Base64
      const reencoded = Buffer.from(decoded, 'utf8').toString('base64');
      if (reencoded !== base64 && base64 !== '') {
        return null;
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Safely parses JSON string with error handling
   * @param {string} jsonStr - JSON string to parse
   * @param {*} defaultValue - Default value if parsing fails
   * @returns {*} Parsed object or default value
   * @throws {Error} If input is not a string
   */
  static safeJsonParse(jsonStr, defaultValue = null) {
    if (typeof jsonStr !== 'string') {
      throw new Error('Input must be a string');
    }
    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * Safely stringifies object to JSON with formatting
   * @param {*} obj - Object to stringify
   * @param {number} spaces - Number of spaces for indentation (default: 0)
   * @returns {string|null} JSON string or null if fails
   */
  static safeJsonStringify(obj, spaces = 0) {
    if (!Number.isInteger(spaces) || spaces < 0) {
      throw new Error('Spaces must be a non-negative integer');
    }
    try {
      return JSON.stringify(obj, null, spaces);
    } catch (error) {
      return null;
    }
  }
}

module.exports = StringUtils;
