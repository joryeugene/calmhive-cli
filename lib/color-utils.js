/**
 * Color utility functions for common color operations
 * Provides safe, tested color manipulation methods with proper validation
 */

class ColorUtils {
  /**
   * Converts a hex color string to RGB values
   * @param {string} hex - Hex color string (with or without #)
   * @returns {Object} Object with r, g, b properties (0-255)
   * @throws {Error} If input is not a valid hex color
   */
  static hexToRgb(hex) {
    if (typeof hex !== 'string') {
      throw new Error('Input must be a string');
    }

    // Remove # if present and normalize
    const cleanHex = hex.replace('#', '').toLowerCase();

    // Validate hex format
    if (!/^[0-9a-f]{6}$/.test(cleanHex) && !/^[0-9a-f]{3}$/.test(cleanHex)) {
      throw new Error('Input must be a valid hex color (3 or 6 characters)');
    }

    let normalizedHex = cleanHex;

    // Expand 3-character hex to 6-character
    if (cleanHex.length === 3) {
      normalizedHex = cleanHex.split('').map(char => char + char).join('');
    }

    const r = parseInt(normalizedHex.slice(0, 2), 16);
    const g = parseInt(normalizedHex.slice(2, 4), 16);
    const b = parseInt(normalizedHex.slice(4, 6), 16);

    return { r, g, b };
  }

  /**
   * Converts RGB values to hex color string
   * @param {number} r - Red value (0-255)
   * @param {number} g - Green value (0-255)
   * @param {number} b - Blue value (0-255)
   * @returns {string} Hex color string with # prefix
   * @throws {Error} If inputs are not valid RGB values
   */
  static rgbToHex(r, g, b) {
    if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') {
      throw new Error('All RGB values must be numbers');
    }

    if (!Number.isInteger(r) || !Number.isInteger(g) || !Number.isInteger(b)) {
      throw new Error('All RGB values must be integers');
    }

    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      throw new Error('All RGB values must be between 0 and 255');
    }

    const toHex = (value) => {
      const hex = value.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Validates if a string is a valid hex color
   * @param {string} hex - String to validate
   * @returns {boolean} True if valid hex color
   * @throws {Error} If input is not a string
   */
  static isValidHex(hex) {
    if (typeof hex !== 'string') {
      throw new Error('Input must be a string');
    }

    const cleanHex = hex.replace('#', '');
    return /^[0-9a-f]{6}$/i.test(cleanHex) || /^[0-9a-f]{3}$/i.test(cleanHex);
  }

  /**
   * Lightens a hex color by a percentage
   * @param {string} hex - Hex color string
   * @param {number} percent - Percentage to lighten (0-100)
   * @returns {string} Lightened hex color
   * @throws {Error} If inputs are invalid
   */
  static lighten(hex, percent) {
    if (typeof percent !== 'number') {
      throw new Error('Percent must be a number');
    }

    if (percent < 0 || percent > 100) {
      throw new Error('Percent must be between 0 and 100');
    }

    const { r, g, b } = this.hexToRgb(hex);
    const factor = percent / 100;

    const newR = Math.min(255, Math.round(r + (255 - r) * factor));
    const newG = Math.min(255, Math.round(g + (255 - g) * factor));
    const newB = Math.min(255, Math.round(b + (255 - b) * factor));

    return this.rgbToHex(newR, newG, newB);
  }

  /**
   * Darkens a hex color by a percentage
   * @param {string} hex - Hex color string
   * @param {number} percent - Percentage to darken (0-100)
   * @returns {string} Darkened hex color
   * @throws {Error} If inputs are invalid
   */
  static darken(hex, percent) {
    if (typeof percent !== 'number') {
      throw new Error('Percent must be a number');
    }

    if (percent < 0 || percent > 100) {
      throw new Error('Percent must be between 0 and 100');
    }

    const { r, g, b } = this.hexToRgb(hex);
    const factor = percent / 100;

    const newR = Math.max(0, Math.round(r * (1 - factor)));
    const newG = Math.max(0, Math.round(g * (1 - factor)));
    const newB = Math.max(0, Math.round(b * (1 - factor)));

    return this.rgbToHex(newR, newG, newB);
  }

  /**
   * Calculates the relative luminance of a color
   * @param {string} hex - Hex color string
   * @returns {number} Relative luminance (0-1)
   * @throws {Error} If input is invalid hex color
   */
  static getLuminance(hex) {
    const { r, g, b } = this.hexToRgb(hex);

    // Convert to linear RGB
    const toLinear = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };

    const rLinear = toLinear(r);
    const gLinear = toLinear(g);
    const bLinear = toLinear(b);

    // Calculate relative luminance using WCAG formula
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  }

  /**
   * Calculates the contrast ratio between two colors
   * @param {string} color1 - First hex color
   * @param {string} color2 - Second hex color
   * @returns {number} Contrast ratio (1-21)
   * @throws {Error} If inputs are invalid hex colors
   */
  static getContrastRatio(color1, color2) {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Checks if color combination meets WCAG accessibility standards
   * @param {string} foreground - Foreground color hex
   * @param {string} background - Background color hex
   * @param {string} level - WCAG level: 'AA', 'AAA' (default: 'AA')
   * @param {string} size - Text size: 'normal', 'large' (default: 'normal')
   * @returns {boolean} True if contrast ratio meets requirements
   * @throws {Error} If inputs are invalid
   */
  static meetsWcagContrast(foreground, background, level = 'AA', size = 'normal') {
    if (!['AA', 'AAA'].includes(level)) {
      throw new Error('Level must be "AA" or "AAA"');
    }

    if (!['normal', 'large'].includes(size)) {
      throw new Error('Size must be "normal" or "large"');
    }

    const ratio = this.getContrastRatio(foreground, background);

    // WCAG requirements
    const requirements = {
      'AA': { normal: 4.5, large: 3.0 },
      'AAA': { normal: 7.0, large: 4.5 }
    };

    return ratio >= requirements[level][size];
  }

  /**
   * Generates a random hex color
   * @returns {string} Random hex color
   */
  static random() {
    const randomValue = () => Math.floor(Math.random() * 256);
    return this.rgbToHex(randomValue(), randomValue(), randomValue());
  }

  /**
   * Blends two colors together
   * @param {string} color1 - First hex color
   * @param {string} color2 - Second hex color
   * @param {number} ratio - Blend ratio (0-1, 0 = all color1, 1 = all color2)
   * @returns {string} Blended hex color
   * @throws {Error} If inputs are invalid
   */
  static blend(color1, color2, ratio = 0.5) {
    if (typeof ratio !== 'number') {
      throw new Error('Ratio must be a number');
    }

    if (ratio < 0 || ratio > 1) {
      throw new Error('Ratio must be between 0 and 1');
    }

    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    const blendedR = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio);
    const blendedG = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio);
    const blendedB = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio);

    return this.rgbToHex(blendedR, blendedG, blendedB);
  }

  /**
   * Converts RGB to HSL color space
   * @param {number} r - Red value (0-255)
   * @param {number} g - Green value (0-255)
   * @param {number} b - Blue value (0-255)
   * @returns {Object} Object with h (0-360), s (0-100), l (0-100) properties
   * @throws {Error} If inputs are invalid
   */
  static rgbToHsl(r, g, b) {
    if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') {
      throw new Error('All RGB values must be numbers');
    }

    if (!Number.isInteger(r) || !Number.isInteger(g) || !Number.isInteger(b)) {
      throw new Error('All RGB values must be integers');
    }

    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      throw new Error('All RGB values must be between 0 and 255');
    }

    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const diff = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (diff !== 0) {
      s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

      switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / diff + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / diff + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / diff + 4;
        break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  /**
   * Converts hex color to HSL
   * @param {string} hex - Hex color string
   * @returns {Object} Object with h (0-360), s (0-100), l (0-100) properties
   * @throws {Error} If input is invalid hex color
   */
  static hexToHsl(hex) {
    const { r, g, b } = this.hexToRgb(hex);
    return this.rgbToHsl(r, g, b);
  }
}

module.exports = ColorUtils;
