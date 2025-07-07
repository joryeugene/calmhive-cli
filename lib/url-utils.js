/**
 * URL utility functions for URL manipulation, building, and parsing
 * Provides safe, tested URL operations for network requests and API calls
 */

class URLUtils {
  /**
   * Builds a URL from base URL and query parameters
   * @param {string} baseUrl - Base URL
   * @param {Object} params - Query parameters as key-value pairs
   * @returns {string} Complete URL with query string
   * @throws {Error} If base URL is invalid or params is not an object
   */
  static buildURL(baseUrl, params = {}) {
    if (typeof baseUrl !== 'string') {
      throw new Error('Base URL must be a string');
    }

    if (!baseUrl.trim()) {
      throw new Error('Base URL cannot be empty');
    }

    if (params === null || typeof params !== 'object' || Array.isArray(params)) {
      throw new Error('Parameters must be an object');
    }

    // Validate base URL format
    try {
      new URL(baseUrl);
    } catch (error) {
      throw new Error(`Invalid base URL: ${baseUrl}`);
    }

    const url = new URL(baseUrl);

    // Add query parameters
    Object.keys(params).forEach(key => {
      const value = params[key];
      // Skip null/undefined values
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  /**
   * Parses a URL into its components
   * @param {string} urlString - URL to parse
   * @returns {Object} URL components (protocol, hostname, port, pathname, query, hash)
   * @throws {Error} If URL is invalid
   */
  static parseURL(urlString) {
    if (typeof urlString !== 'string') {
      throw new Error('URL must be a string');
    }

    if (!urlString.trim()) {
      throw new Error('URL cannot be empty');
    }

    try {
      const url = new URL(urlString);
      const query = {};

      // Convert URLSearchParams to plain object
      for (const [key, value] of url.searchParams) {
        if (query[key]) {
          // Handle multiple values for same parameter
          if (Array.isArray(query[key])) {
            query[key].push(value);
          } else {
            query[key] = [query[key], value];
          }
        } else {
          query[key] = value;
        }
      }

      return {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || null,
        pathname: url.pathname,
        query: query,
        hash: url.hash || null,
        origin: url.origin
      };
    } catch (error) {
      throw new Error(`Invalid URL: ${urlString}`);
    }
  }

  /**
   * Validates if a string is a valid URL
   * @param {string} urlString - URL to validate
   * @returns {boolean} True if URL is valid
   */
  static isValidURL(urlString) {
    if (typeof urlString !== 'string' || !urlString.trim()) {
      return false;
    }

    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalizes a URL by removing default ports and trailing slashes
   * @param {string} urlString - URL to normalize
   * @returns {string} Normalized URL
   * @throws {Error} If URL is invalid
   */
  static normalizeURL(urlString) {
    if (typeof urlString !== 'string') {
      throw new Error('URL must be a string');
    }

    if (!urlString.trim()) {
      throw new Error('URL cannot be empty');
    }

    try {
      const url = new URL(urlString);

      // Remove default ports
      if ((url.protocol === 'http:' && url.port === '80') ||
          (url.protocol === 'https:' && url.port === '443')) {
        url.port = '';
      }

      // Remove trailing slash from pathname (except for root)
      if (url.pathname !== '/' && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
      }

      return url.toString();
    } catch (error) {
      throw new Error(`Invalid URL: ${urlString}`);
    }
  }

  /**
   * Extracts the domain from a URL
   * @param {string} urlString - URL to extract domain from
   * @returns {string} Domain name
   * @throws {Error} If URL is invalid
   */
  static extractDomain(urlString) {
    if (typeof urlString !== 'string') {
      throw new Error('URL must be a string');
    }

    if (!urlString.trim()) {
      throw new Error('URL cannot be empty');
    }

    try {
      const url = new URL(urlString);
      return url.hostname;
    } catch (error) {
      throw new Error(`Invalid URL: ${urlString}`);
    }
  }

  /**
   * Joins URL path segments safely
   * @param {string} baseUrl - Base URL
   * @param {...string} segments - Path segments to join
   * @returns {string} Complete URL with joined path
   * @throws {Error} If base URL is invalid
   */
  static joinPath(baseUrl, ...segments) {
    if (typeof baseUrl !== 'string') {
      throw new Error('Base URL must be a string');
    }

    if (!baseUrl.trim()) {
      throw new Error('Base URL cannot be empty');
    }

    try {
      const url = new URL(baseUrl);

      // Clean and join path segments
      const cleanSegments = segments
        .filter(segment => segment !== null && segment !== undefined && segment !== '')
        .map(segment => String(segment).replace(/^\/+|\/+$/g, ''));

      if (cleanSegments.length > 0) {
        const newPath = url.pathname.replace(/\/+$/, '') + '/' + cleanSegments.join('/');
        url.pathname = newPath;
      }

      return url.toString();
    } catch (error) {
      throw new Error(`Invalid base URL: ${baseUrl}`);
    }
  }

  /**
   * Checks if two URLs are equivalent (ignoring query parameter order)
   * @param {string} url1 - First URL
   * @param {string} url2 - Second URL
   * @returns {boolean} True if URLs are equivalent
   * @throws {Error} If either URL is invalid
   */
  static areEquivalent(url1, url2) {
    if (typeof url1 !== 'string' || typeof url2 !== 'string') {
      throw new Error('Both URLs must be strings');
    }

    try {
      const parsed1 = new URL(url1);
      const parsed2 = new URL(url2);

      // Compare basic components
      if (parsed1.protocol !== parsed2.protocol ||
          parsed1.hostname !== parsed2.hostname ||
          parsed1.port !== parsed2.port ||
          parsed1.pathname !== parsed2.pathname ||
          parsed1.hash !== parsed2.hash) {
        return false;
      }

      // Compare search parameters (order-independent)
      const params1 = Array.from(parsed1.searchParams.entries()).sort();
      const params2 = Array.from(parsed2.searchParams.entries()).sort();

      if (params1.length !== params2.length) {
        return false;
      }

      for (let i = 0; i < params1.length; i++) {
        if (params1[i][0] !== params2[i][0] || params1[i][1] !== params2[i][1]) {
          return false;
        }
      }

      return true;
    } catch (error) {
      throw new Error('Invalid URL provided for comparison');
    }
  }

  /**
   * Adds or updates a query parameter in a URL
   * @param {string} urlString - URL to modify
   * @param {string} key - Parameter key
   * @param {string|number|boolean} value - Parameter value
   * @returns {string} URL with updated parameter
   * @throws {Error} If URL is invalid or key is not a string
   */
  static setQueryParam(urlString, key, value) {
    if (typeof urlString !== 'string') {
      throw new Error('URL must be a string');
    }

    if (typeof key !== 'string') {
      throw new Error('Parameter key must be a string');
    }

    if (!urlString.trim()) {
      throw new Error('URL cannot be empty');
    }

    if (!key.trim()) {
      throw new Error('Parameter key cannot be empty');
    }

    try {
      const url = new URL(urlString);

      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      } else {
        url.searchParams.delete(key);
      }

      return url.toString();
    } catch (error) {
      throw new Error(`Invalid URL: ${urlString}`);
    }
  }
}

module.exports = URLUtils;
