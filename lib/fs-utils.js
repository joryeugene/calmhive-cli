/**
 * File system utility functions for safe file and directory operations
 * Provides tested, secure file system methods with comprehensive error handling
 */

const fs = require('fs');
const path = require('path');

class FileSystemUtils {
  /**
   * Ensures a directory exists, creating it if necessary
   * @param {string} dirPath - Absolute path to directory
   * @returns {boolean} True if directory exists/was created
   * @throws {Error} If directory cannot be created or path is invalid
   */
  static ensureDirectoryExists(dirPath) {
    if (typeof dirPath !== 'string') {
      throw new Error('Directory path must be a string');
    }

    if (!path.isAbsolute(dirPath)) {
      throw new Error('Directory path must be absolute');
    }

    if (fs.existsSync(dirPath)) {
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        throw new Error(`Path exists but is not a directory: ${dirPath}`);
      }
      return true;
    }

    try {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Creates a directory tree from an array of paths
   * @param {string[]} paths - Array of absolute directory paths
   * @returns {string[]} Array of directories that were created
   * @throws {Error} If any path is invalid or creation fails
   */
  static createDirectoryTree(paths) {
    if (!Array.isArray(paths)) {
      throw new Error('Paths must be an array');
    }

    const created = [];
    for (const dirPath of paths) {
      if (!fs.existsSync(dirPath)) {
        this.ensureDirectoryExists(dirPath);
        created.push(dirPath);
      }
    }

    return created;
  }

  /**
   * Safely writes content to a file with error handling
   * @param {string} filePath - Absolute path to file
   * @param {string|Buffer} content - Content to write
   * @param {Object} options - Write options (encoding, mode, flag)
   * @returns {boolean} True if write succeeded
   * @throws {Error} If write operation fails
   */
  static safeWriteFile(filePath, content, options = {}) {
    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }

    if (!path.isAbsolute(filePath)) {
      throw new Error('File path must be absolute');
    }

    if (content === null || content === undefined) {
      throw new Error('Content cannot be null or undefined');
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(filePath);
    this.ensureDirectoryExists(parentDir);

    const writeOptions = {
      encoding: 'utf8',
      mode: 0o644,
      flag: 'w',
      ...options
    };

    try {
      fs.writeFileSync(filePath, content, writeOptions);
      return true;
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Safely reads a file with fallback to default value
   * @param {string} filePath - Absolute path to file
   * @param {*} defaultValue - Value to return if file doesn't exist or read fails
   * @param {Object} options - Read options (encoding, flag)
   * @returns {string|*} File content or default value
   * @throws {Error} If path is invalid
   */
  static safeReadFile(filePath, defaultValue = null, options = {}) {
    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }

    if (!path.isAbsolute(filePath)) {
      throw new Error('File path must be absolute');
    }

    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }

    const readOptions = {
      encoding: 'utf8',
      flag: 'r',
      ...options
    };

    try {
      return fs.readFileSync(filePath, readOptions);
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * Safely deletes a file if it exists
   * @param {string} filePath - Absolute path to file
   * @returns {boolean} True if file was deleted or didn't exist
   * @throws {Error} If deletion fails or path is invalid
   */
  static safeDeleteFile(filePath) {
    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }

    if (!path.isAbsolute(filePath)) {
      throw new Error('File path must be absolute');
    }

    if (!fs.existsSync(filePath)) {
      return true; // Already doesn't exist
    }

    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Validates and normalizes a file system path
   * @param {string} inputPath - Path to validate
   * @param {string} type - Expected type: 'file', 'directory', or 'any'
   * @returns {string} Normalized absolute path
   * @throws {Error} If path is invalid or type doesn't match
   */
  static validatePath(inputPath, type = 'any') {
    if (typeof inputPath !== 'string') {
      throw new Error('Path must be a string');
    }

    if (!['file', 'directory', 'any'].includes(type)) {
      throw new Error('Type must be "file", "directory", or "any"');
    }

    const normalized = path.resolve(inputPath);

    if (fs.existsSync(normalized)) {
      const stat = fs.statSync(normalized);

      if (type === 'file' && !stat.isFile()) {
        throw new Error(`Path exists but is not a file: ${normalized}`);
      }

      if (type === 'directory' && !stat.isDirectory()) {
        throw new Error(`Path exists but is not a directory: ${normalized}`);
      }
    }

    return normalized;
  }

  /**
   * Safely resolves a relative path against a base path
   * @param {string} basePath - Base directory path (absolute)
   * @param {string} relativePath - Relative path to resolve
   * @returns {string} Safe resolved absolute path
   * @throws {Error} If path resolution would escape base directory
   */
  static resolveSafePath(basePath, relativePath) {
    if (typeof basePath !== 'string') {
      throw new Error('Base path must be a string');
    }

    if (typeof relativePath !== 'string') {
      throw new Error('Relative path must be a string');
    }

    if (!path.isAbsolute(basePath)) {
      throw new Error('Base path must be absolute');
    }

    const resolvedPath = path.resolve(basePath, relativePath);
    const normalizedBase = path.normalize(basePath);

    // Ensure resolved path is within base directory (prevent directory traversal)
    if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
      throw new Error(`Resolved path escapes base directory: ${resolvedPath}`);
    }

    return resolvedPath;
  }

  /**
   * Gets the age of a file in milliseconds
   * @param {string} filePath - Absolute path to file
   * @returns {number} Age in milliseconds since last modification
   * @throws {Error} If file doesn't exist or path is invalid
   */
  static getFileAge(filePath) {
    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }

    if (!path.isAbsolute(filePath)) {
      throw new Error('File path must be absolute');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    try {
      const stat = fs.statSync(filePath);
      return Date.now() - stat.mtime.getTime();
    } catch (error) {
      throw new Error(`Failed to get file age for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Gets the size of a file in bytes
   * @param {string} filePath - Absolute path to file
   * @returns {number} File size in bytes
   * @throws {Error} If file doesn't exist or path is invalid
   */
  static getFileSize(filePath) {
    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }

    if (!path.isAbsolute(filePath)) {
      throw new Error('File path must be absolute');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    try {
      const stat = fs.statSync(filePath);
      return stat.size;
    } catch (error) {
      throw new Error(`Failed to get file size for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Compares modification times of two files
   * @param {string} file1Path - Absolute path to first file
   * @param {string} file2Path - Absolute path to second file
   * @returns {boolean} True if file1 is newer than file2
   * @throws {Error} If either file doesn't exist or paths are invalid
   */
  static isFileNewer(file1Path, file2Path) {
    if (typeof file1Path !== 'string' || typeof file2Path !== 'string') {
      throw new Error('File paths must be strings');
    }

    if (!path.isAbsolute(file1Path) || !path.isAbsolute(file2Path)) {
      throw new Error('File paths must be absolute');
    }

    if (!fs.existsSync(file1Path)) {
      throw new Error(`File does not exist: ${file1Path}`);
    }

    if (!fs.existsSync(file2Path)) {
      throw new Error(`File does not exist: ${file2Path}`);
    }

    try {
      const stat1 = fs.statSync(file1Path);
      const stat2 = fs.statSync(file2Path);
      return stat1.mtime > stat2.mtime;
    } catch (error) {
      throw new Error(`Failed to compare file times: ${error.message}`);
    }
  }

  /**
   * Creates a backup copy of a file in a specified directory
   * @param {string} filePath - Absolute path to file to backup
   * @param {string} backupDir - Directory to store backup (will be created if needed)
   * @param {string} suffix - Suffix to add to backup filename (default: timestamp)
   * @returns {string} Path to backup file
   * @throws {Error} If backup operation fails
   */
  static createBackup(filePath, backupDir, suffix = null) {
    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }

    if (typeof backupDir !== 'string') {
      throw new Error('Backup directory must be a string');
    }

    if (!path.isAbsolute(filePath)) {
      throw new Error('File path must be absolute');
    }

    if (!path.isAbsolute(backupDir)) {
      throw new Error('Backup directory must be absolute');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    // Ensure backup directory exists
    this.ensureDirectoryExists(backupDir);

    // Generate backup filename
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const name = path.basename(fileName, ext);
    const backupSuffix = suffix || Date.now().toString();
    const backupFileName = `${name}.${backupSuffix}${ext}`;
    const backupPath = path.join(backupDir, backupFileName);

    try {
      fs.copyFileSync(filePath, backupPath);
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Rotates files matching a pattern, keeping only the most recent files
   * @param {string} pattern - Glob pattern for files to rotate
   * @param {number} maxCount - Maximum number of files to keep
   * @returns {string[]} Array of deleted file paths
   * @throws {Error} If rotation fails
   */
  static rotateFiles(pattern, maxCount) {
    if (typeof pattern !== 'string') {
      throw new Error('Pattern must be a string');
    }

    if (!Number.isInteger(maxCount) || maxCount < 1) {
      throw new Error('Max count must be a positive integer');
    }

    const glob = require('glob');

    try {
      const files = glob.sync(pattern);

      if (files.length <= maxCount) {
        return []; // No files to delete
      }

      // Sort by modification time (newest first)
      const fileStats = files.map(file => ({
        path: file,
        mtime: fs.statSync(file).mtime
      }));

      fileStats.sort((a, b) => b.mtime - a.mtime);

      // Delete oldest files
      const filesToDelete = fileStats.slice(maxCount);
      const deletedFiles = [];

      for (const fileInfo of filesToDelete) {
        try {
          fs.unlinkSync(fileInfo.path);
          deletedFiles.push(fileInfo.path);
        } catch (error) {
          console.warn(`Failed to delete ${fileInfo.path}: ${error.message}`);
        }
      }

      return deletedFiles;
    } catch (error) {
      throw new Error(`Failed to rotate files: ${error.message}`);
    }
  }

  /**
   * Safely parses JSON from a file with error handling
   * @param {string} filePath - Absolute path to JSON file
   * @param {*} defaultValue - Default value if file doesn't exist or parsing fails
   * @returns {*} Parsed JSON object or default value
   * @throws {Error} If path is invalid
   */
  static safeReadJsonFile(filePath, defaultValue = {}) {
    const content = this.safeReadFile(filePath, null);

    if (content === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * Safely writes an object to a JSON file with formatting
   * @param {string} filePath - Absolute path to JSON file
   * @param {*} data - Data to write as JSON
   * @param {number} spaces - Number of spaces for indentation (default: 2)
   * @returns {boolean} True if write succeeded
   * @throws {Error} If write operation fails
   */
  static safeWriteJsonFile(filePath, data, spaces = 2) {
    if (!Number.isInteger(spaces) || spaces < 0) {
      throw new Error('Spaces must be a non-negative integer');
    }

    try {
      const jsonContent = JSON.stringify(data, null, spaces);
      return this.safeWriteFile(filePath, jsonContent);
    } catch (error) {
      throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
    }
  }
}

module.exports = FileSystemUtils;
