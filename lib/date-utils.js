/**
 * Date utility functions for date manipulation, validation, and calculations
 * Complements the date formatting functions in string-utils.js
 */

class DateUtils {
  /**
   * Adds time to a date object
   * @param {Date} date - Base date
   * @param {number} amount - Amount to add (can be negative for subtraction)
   * @param {string} unit - Time unit: 'milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'
   * @returns {Date} New date object with time added
   * @throws {Error} If parameters are invalid
   */
  static addTime(date, amount, unit) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('First parameter must be a valid Date object');
    }
    if (typeof amount !== 'number' || !isFinite(amount)) {
      throw new Error('Amount must be a finite number');
    }
    if (typeof unit !== 'string') {
      throw new Error('Unit must be a string');
    }

    const validUnits = ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
    if (!validUnits.includes(unit)) {
      throw new Error(`Unit must be one of: ${validUnits.join(', ')}`);
    }

    const result = new Date(date);

    switch (unit) {
    case 'milliseconds':
      result.setMilliseconds(result.getMilliseconds() + amount);
      break;
    case 'seconds':
      result.setSeconds(result.getSeconds() + amount);
      break;
    case 'minutes':
      result.setMinutes(result.getMinutes() + amount);
      break;
    case 'hours':
      result.setTime(result.getTime() + (amount * 60 * 60 * 1000));
      break;
    case 'days':
      result.setDate(result.getDate() + amount);
      break;
    case 'weeks':
      result.setDate(result.getDate() + (amount * 7));
      break;
    case 'months':
      result.setMonth(result.getMonth() + amount);
      break;
    case 'years':
      result.setFullYear(result.getFullYear() + amount);
      break;
    }

    return result;
  }

  /**
   * Checks if a date is within a time range
   * @param {Date} date - Date to check
   * @param {Date} startTime - Range start (inclusive)
   * @param {Date} endTime - Range end (inclusive)
   * @returns {boolean} True if date is within range
   * @throws {Error} If parameters are invalid
   */
  static isWithinTimeRange(date, startTime, endTime) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Date must be a valid Date object');
    }
    if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
      throw new Error('Start time must be a valid Date object');
    }
    if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
      throw new Error('End time must be a valid Date object');
    }
    if (startTime > endTime) {
      throw new Error('Start time must be before or equal to end time');
    }

    return date >= startTime && date <= endTime;
  }

  /**
   * Parses human-readable time strings into milliseconds
   * @param {string} timeString - Time string like "2h 30m", "1d", "45s"
   * @returns {number} Duration in milliseconds
   * @throws {Error} If string format is invalid
   */
  static parseTimeString(timeString) {
    if (typeof timeString !== 'string') {
      throw new Error('Input must be a string');
    }

    const cleanString = timeString.trim().toLowerCase();
    if (!cleanString) {
      throw new Error('Time string cannot be empty');
    }

    // Handle simple numbers as milliseconds
    if (/^\d+$/.test(cleanString)) {
      return parseInt(cleanString, 10);
    }

    const units = {
      ms: 1,
      millisecond: 1,
      milliseconds: 1,
      s: 1000,
      sec: 1000,
      second: 1000,
      seconds: 1000,
      m: 60 * 1000,
      min: 60 * 1000,
      minute: 60 * 1000,
      minutes: 60 * 1000,
      h: 60 * 60 * 1000,
      hr: 60 * 60 * 1000,
      hour: 60 * 60 * 1000,
      hours: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000
    };

    // Match patterns like "2h", "30m", "1d 2h 30m"
    const regex = /(\d+(?:\.\d+)?)\s*([a-z]+)/g;
    let totalMs = 0;
    let match;
    let hasMatches = false;

    while ((match = regex.exec(cleanString)) !== null) {
      hasMatches = true;
      const value = parseFloat(match[1]);
      const unit = match[2];

      if (!units.hasOwnProperty(unit)) {
        throw new Error(`Unknown time unit: ${unit}`);
      }

      totalMs += value * units[unit];
    }

    if (!hasMatches) {
      throw new Error(`Invalid time string format: ${timeString}`);
    }

    return Math.round(totalMs);
  }

  /**
   * Checks if a date falls on a business day (Monday-Friday)
   * @param {Date} date - Date to check
   * @returns {boolean} True if it's a business day
   * @throws {Error} If date is invalid
   */
  static isBusinessDay(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Input must be a valid Date object');
    }

    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * Calculates the number of business days between two dates
   * @param {Date} startDate - Start date (inclusive)
   * @param {Date} endDate - End date (inclusive)
   * @returns {number} Number of business days
   * @throws {Error} If dates are invalid
   */
  static getBusinessDays(startDate, endDate) {
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      throw new Error('Start date must be a valid Date object');
    }
    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      throw new Error('End date must be a valid Date object');
    }
    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }

    let count = 0;
    const current = new Date(startDate);
    // Normalize to start of day to avoid time issues
    current.setHours(0, 0, 0, 0);
    const endNormalized = new Date(endDate);
    endNormalized.setHours(0, 0, 0, 0);

    while (current <= endNormalized) {
      if (this.isBusinessDay(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Gets the start of day (00:00:00.000)
   * @param {Date} date - Input date
   * @returns {Date} New date at start of day
   * @throws {Error} If date is invalid
   */
  static startOfDay(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Input must be a valid Date object');
    }

    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Gets the end of day (23:59:59.999)
   * @param {Date} date - Input date
   * @returns {Date} New date at end of day
   * @throws {Error} If date is invalid
   */
  static endOfDay(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Input must be a valid Date object');
    }

    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Gets the start of week (Sunday 00:00:00.000)
   * @param {Date} date - Input date
   * @returns {Date} New date at start of week
   * @throws {Error} If date is invalid
   */
  static startOfWeek(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Input must be a valid Date object');
    }

    const result = new Date(date);
    const dayOfWeek = result.getDay();
    result.setDate(result.getDate() - dayOfWeek);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Gets the end of week (Saturday 23:59:59.999)
   * @param {Date} date - Input date
   * @returns {Date} New date at end of week
   * @throws {Error} If date is invalid
   */
  static endOfWeek(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Input must be a valid Date object');
    }

    const result = new Date(date);
    const dayOfWeek = result.getDay();
    result.setDate(result.getDate() + (6 - dayOfWeek));
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Validates if input is a valid date
   * @param {*} input - Input to validate
   * @returns {boolean} True if valid date
   */
  static isValidDate(input) {
    return input instanceof Date && !isNaN(input.getTime());
  }

  /**
   * Clamps a date between min and max dates
   * @param {Date} date - Date to clamp
   * @param {Date} minDate - Minimum allowed date
   * @param {Date} maxDate - Maximum allowed date
   * @returns {Date} Clamped date
   * @throws {Error} If parameters are invalid
   */
  static clampDate(date, minDate, maxDate) {
    if (!this.isValidDate(date)) {
      throw new Error('Date must be a valid Date object');
    }
    if (!this.isValidDate(minDate)) {
      throw new Error('Min date must be a valid Date object');
    }
    if (!this.isValidDate(maxDate)) {
      throw new Error('Max date must be a valid Date object');
    }
    if (minDate > maxDate) {
      throw new Error('Min date must be before or equal to max date');
    }

    if (date < minDate) {return new Date(minDate);}
    if (date > maxDate) {return new Date(maxDate);}
    return new Date(date);
  }

  /**
   * Gets the difference between two dates in specified unit
   * @param {Date} date1 - First date
   * @param {Date} date2 - Second date
   * @param {string} unit - Unit: 'milliseconds', 'seconds', 'minutes', 'hours', 'days'
   * @returns {number} Difference (date1 - date2)
   * @throws {Error} If parameters are invalid
   */
  static dateDiff(date1, date2, unit = 'milliseconds') {
    if (!this.isValidDate(date1)) {
      throw new Error('First date must be a valid Date object');
    }
    if (!this.isValidDate(date2)) {
      throw new Error('Second date must be a valid Date object');
    }

    const validUnits = ['milliseconds', 'seconds', 'minutes', 'hours', 'days'];
    if (!validUnits.includes(unit)) {
      throw new Error(`Unit must be one of: ${validUnits.join(', ')}`);
    }

    const diffMs = date1.getTime() - date2.getTime();

    switch (unit) {
    case 'milliseconds':
      return diffMs;
    case 'seconds':
      return Math.floor(diffMs / 1000);
    case 'minutes':
      return Math.floor(diffMs / (1000 * 60));
    case 'hours':
      return Math.floor(diffMs / (1000 * 60 * 60));
    case 'days':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    default:
      return diffMs;
    }
  }
}

module.exports = DateUtils;
