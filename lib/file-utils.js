/**
 * File utility functions for file operations, integrity checking, and safe file handling
 * Provides cryptographic hashing and secure file operations for the Calmhive system
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

class FileUtils {
  /**
   * Calculates hash of a file using specified algorithm
   * @param {string} filePath - Path to the file
   * @param {string} algorithm - Hash algorithm ('sha256', 'md5', 'sha1', 'sha512')
   * @param {string} encoding - Output encoding ('hex', 'base64', 'binary')
   * @returns {Promise<string>} File hash
   * @throws {Error} If file doesn't exist or hash fails
   */
  static async getFileHash(filePath, algorithm = 'sha256', encoding = 'hex') {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('File path must be a non-empty string');
    }

    const validAlgorithms = ['sha256', 'md5', 'sha1', 'sha512', 'blake2b512'];
    if (!validAlgorithms.includes(algorithm)) {
      throw new Error(`Algorithm must be one of: ${validAlgorithms.join(', ')}`);
    }

    const validEncodings = ['hex', 'base64', 'binary'];
    if (!validEncodings.includes(encoding)) {
      throw new Error(`Encoding must be one of: ${validEncodings.join(', ')}`);
    }

    try {
      await access(filePath, fs.constants.F_OK);
    } catch (error) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest(encoding)));
      stream.on('error', error => reject(new Error(`Failed to read file: ${error.message}`)));
    });
  }

  /**
   * Verifies file integrity against expected hash
   * @param {string} filePath - Path to the file
   * @param {string} expectedHash - Expected hash value
   * @param {string} algorithm - Hash algorithm used
   * @param {string} encoding - Hash encoding
   * @returns {Promise<boolean>} True if file matches expected hash
   * @throws {Error} If verification fails
   */
  static async verifyFileIntegrity(filePath, expectedHash, algorithm = 'sha256', encoding = 'hex') {
    if (typeof expectedHash !== 'string' || !expectedHash.trim()) {
      throw new Error('Expected hash must be a non-empty string');
    }

    try {
      const actualHash = await this.getFileHash(filePath, algorithm, encoding);
      return actualHash === expectedHash.toLowerCase();
    } catch (error) {
      throw new Error(`Integrity verification failed: ${error.message}`);
    }
  }

  /**
   * Safely reads a file with size and encoding validation
   * @param {string} filePath - Path to the file
   * @param {Object} options - Options object
   * @param {string} options.encoding - File encoding ('utf8', 'binary', etc.)
   * @param {number} options.maxSize - Maximum file size in bytes
   * @param {boolean} options.throwOnLarge - Throw error if file exceeds maxSize
   * @returns {Promise<string|Buffer>} File contents
   * @throws {Error} If file operations fail
   */
  static async safeReadFile(filePath, options = {}) {
    const {
      encoding = 'utf8',
      maxSize = 10 * 1024 * 1024, // 10MB default
      throwOnLarge = true
    } = options;

    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('File path must be a non-empty string');
    }

    if (typeof maxSize !== 'number' || maxSize <= 0) {
      throw new Error('Max size must be a positive number');
    }

    try {
      const stats = await stat(filePath);

      if (stats.size > maxSize) {
        if (throwOnLarge) {
          throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed (${maxSize} bytes)`);
        }
        // Return truncated content if not throwing
        const buffer = Buffer.alloc(maxSize);
        const fd = await promisify(fs.open)(filePath, 'r');
        const { bytesRead } = await promisify(fs.read)(fd, buffer, 0, maxSize, 0);
        await promisify(fs.close)(fd);
        return encoding === 'binary' ? buffer.slice(0, bytesRead) : buffer.slice(0, bytesRead).toString(encoding);
      }

      return await readFile(filePath, encoding === 'binary' ? null : encoding);
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Safely writes file with backup and atomic operations
   * @param {string} filePath - Path to write to
   * @param {string|Buffer} content - Content to write
   * @param {Object} options - Options object
   * @param {string} options.encoding - File encoding
   * @param {boolean} options.backup - Create backup before writing
   * @param {boolean} options.atomic - Use atomic write operation
   * @returns {Promise<void>}
   * @throws {Error} If write operations fail
   */
  static async safeWriteFile(filePath, content, options = {}) {
    const {
      encoding = 'utf8',
      backup = false,
      atomic = true
    } = options;

    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('File path must be a non-empty string');
    }

    if (content === null || content === undefined) {
      throw new Error('Content cannot be null or undefined');
    }

    const dir = path.dirname(filePath);

    // Ensure directory exists
    try {
      await promisify(fs.mkdir)(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dir}: ${error.message}`);
    }

    // Create backup if requested and file exists
    if (backup) {
      try {
        await access(filePath, fs.constants.F_OK);
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await promisify(fs.copyFile)(filePath, backupPath);
      } catch (error) {
        // File doesn't exist, no backup needed
      }
    }

    try {
      if (atomic) {
        // Atomic write using temporary file
        const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
        await writeFile(tempPath, content, encoding);
        await promisify(fs.rename)(tempPath, filePath);
      } else {
        await writeFile(filePath, content, encoding);
      }
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Checks if path is safe (prevents directory traversal attacks)
   * @param {string} basePath - Base directory path
   * @param {string} userPath - User-provided path to validate
   * @returns {boolean} True if path is safe
   */
  static isSafePath(basePath, userPath) {
    if (typeof basePath !== 'string' || typeof userPath !== 'string') {
      return false;
    }

    if (!basePath.trim() || !userPath.trim()) {
      return false;
    }

    try {
      const resolvedBase = path.resolve(basePath);
      const resolvedUser = path.resolve(basePath, userPath);

      // Check if resolved user path starts with base path
      return resolvedUser.startsWith(resolvedBase + path.sep) || resolvedUser === resolvedBase;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets file metadata including size, timestamps, and permissions
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} File metadata object
   * @throws {Error} If file doesn't exist or stat fails
   */
  static async getFileMetadata(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('File path must be a non-empty string');
    }

    try {
      const stats = await stat(filePath);

      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        permissions: {
          readable: !!(stats.mode & parseInt('400', 8)),
          writable: !!(stats.mode & parseInt('200', 8)),
          executable: !!(stats.mode & parseInt('100', 8))
        },
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
      };
    } catch (error) {
      throw new Error(`Failed to get metadata for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Compares two files for equality (content-based)
   * @param {string} filePath1 - First file path
   * @param {string} filePath2 - Second file path
   * @param {string} algorithm - Hash algorithm for comparison
   * @returns {Promise<boolean>} True if files are identical
   * @throws {Error} If comparison fails
   */
  static async compareFiles(filePath1, filePath2, algorithm = 'sha256') {
    if (typeof filePath1 !== 'string' || typeof filePath2 !== 'string') {
      throw new Error('File paths must be strings');
    }

    try {
      const [hash1, hash2] = await Promise.all([
        this.getFileHash(filePath1, algorithm),
        this.getFileHash(filePath2, algorithm)
      ]);

      return hash1 === hash2;
    } catch (error) {
      throw new Error(`File comparison failed: ${error.message}`);
    }
  }

  /**
   * Creates a file checksum manifest for a directory
   * @param {string} dirPath - Directory path to process
   * @param {Object} options - Options object
   * @param {string} options.algorithm - Hash algorithm
   * @param {string[]} options.extensions - File extensions to include
   * @param {boolean} options.recursive - Process subdirectories
   * @returns {Promise<Object>} Manifest object with file hashes
   * @throws {Error} If manifest creation fails
   */
  static async createChecksumManifest(dirPath, options = {}) {
    const {
      algorithm = 'sha256',
      extensions = [],
      recursive = false
    } = options;

    if (typeof dirPath !== 'string' || !dirPath.trim()) {
      throw new Error('Directory path must be a non-empty string');
    }

    try {
      await access(dirPath, fs.constants.F_OK);
      const stats = await stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }
    } catch (error) {
      throw new Error(`Directory access failed: ${error.message}`);
    }

    const manifest = {
      algorithm,
      created: new Date().toISOString(),
      directory: dirPath,
      files: {}
    };

    async function processDirectory(currentDir, relativePath = '') {
      const entries = await promisify(fs.readdir)(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativeFilePath = path.join(relativePath, entry.name);

        if (entry.isFile()) {
          if (extensions.length === 0 || extensions.includes(path.extname(entry.name))) {
            try {
              const hash = await FileUtils.getFileHash(fullPath, algorithm);
              manifest.files[relativeFilePath] = hash;
            } catch (error) {
              // Skip files that can't be read
              manifest.files[relativeFilePath] = `ERROR: ${error.message}`;
            }
          }
        } else if (entry.isDirectory() && recursive) {
          await processDirectory(fullPath, relativeFilePath);
        }
      }
    }

    await processDirectory(dirPath);
    return manifest;
  }

  /**
   * Validates file against a checksum manifest
   * @param {string} filePath - File to validate
   * @param {Object} manifest - Checksum manifest
   * @returns {Promise<Object>} Validation result
   */
  static async validateAgainstManifest(filePath, manifest) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('File path must be a non-empty string');
    }

    if (!manifest || typeof manifest !== 'object') {
      throw new Error('Manifest must be an object');
    }

    if (!manifest.files || typeof manifest.files !== 'object') {
      throw new Error('Manifest must contain a files object');
    }

    const algorithm = manifest.algorithm || 'sha256';
    const relativePath = path.relative(manifest.directory || '', filePath);
    const expectedHash = manifest.files[relativePath];

    if (!expectedHash) {
      return {
        valid: false,
        reason: 'File not found in manifest',
        file: filePath,
        relativePath
      };
    }

    if (expectedHash.startsWith('ERROR:')) {
      return {
        valid: false,
        reason: 'File had errors in manifest',
        file: filePath,
        relativePath,
        manifestError: expectedHash
      };
    }

    try {
      const actualHash = await this.getFileHash(filePath, algorithm);
      const valid = actualHash === expectedHash;

      return {
        valid,
        reason: valid ? 'File matches manifest' : 'Hash mismatch',
        file: filePath,
        relativePath,
        expectedHash,
        actualHash
      };
    } catch (error) {
      return {
        valid: false,
        reason: 'Failed to calculate file hash',
        file: filePath,
        relativePath,
        error: error.message
      };
    }
  }
}

module.exports = FileUtils;
