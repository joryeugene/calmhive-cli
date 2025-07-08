/**
 * LogManager - Handles log file management and output streaming
 *
 * Manages log file creation, streaming, tailing, and cleanup operations.
 * Extracted from ProcessManager to provide focused responsibility
 * for log management and output handling.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class LogManager {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(__dirname, '..', '..', 'logs');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB default
    this.logRetentionDays = options.logRetentionDays || 30;
    this.ensureLogDir();
  }

  /**
   * Ensures the log directory exists
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Create a log file path for a session
   */
  getLogPath(sessionId) {
    return path.join(this.logDir, `${sessionId}.log`);
  }

  /**
   * Create a writable log stream for a session
   */
  createLogStream(sessionId) {
    const logPath = this.getLogPath(sessionId);

    // Create write stream with auto-close
    const stream = fs.createWriteStream(logPath, {
      flags: 'a', // append mode
      encoding: 'utf8',
      autoClose: true
    });

    // Add session header
    const timestamp = new Date().toISOString();
    stream.write(`\n${'='.repeat(60)}\n`);
    stream.write(`AFk Session Log: ${sessionId}\n`);
    stream.write(`Started: ${timestamp}\n`);
    stream.write(`${'='.repeat(60)}\n\n`);

    // Handle stream errors
    stream.on('error', (error) => {
      console.error(`❌ Log stream error for ${sessionId}:`, error.message);
    });

    return stream;
  }

  /**
   * Append text to a session log
   */
  async appendToLog(sessionId, text) {
    const logPath = this.getLogPath(sessionId);
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logEntry = `[${timestamp}] ${text}\n`;

    try {
      await fs.promises.appendFile(logPath, logEntry);
    } catch (error) {
      console.error(`❌ Failed to append to log ${sessionId}:`, error.message);
    }
  }

  /**
   * Read the entire log for a session
   */
  async readLog(sessionId) {
    const logPath = this.getLogPath(sessionId);

    try {
      return await fs.promises.readFile(logPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Log file doesn't exist
      }
      throw error;
    }
  }

  /**
   * Read the last N lines from a log file
   */
  async readLogTail(sessionId, lines = 100) {
    const logPath = this.getLogPath(sessionId);

    if (!fs.existsSync(logPath)) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const tail = spawn('tail', ['-n', lines.toString(), logPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      tail.stdout.on('data', (data) => {
        output += data.toString();
      });

      tail.stderr.on('data', (data) => {
        error += data.toString();
      });

      tail.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`tail command failed: ${error}`));
        }
      });

      tail.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Tail logs in real-time for a session
   */
  async tailLogs(sessionId, options = {}) {
    const logPath = this.getLogPath(sessionId);

    if (!fs.existsSync(logPath)) {
      throw new Error(`Log file not found for session: ${sessionId}`);
    }

    const lines = options.lines || 20;
    const follow = options.follow !== false; // Default to true

    return new Promise((resolve, reject) => {
      const tailArgs = ['-n', lines.toString()];
      if (follow) {
        tailArgs.push('-f');
      }
      tailArgs.push(logPath);

      const tail = spawn('tail', tailArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Handle output
      tail.stdout.on('data', (data) => {
        process.stdout.write(data);
      });

      tail.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      // Handle termination
      tail.on('close', (code) => {
        resolve(code);
      });

      tail.on('error', (error) => {
        reject(error);
      });

      // Handle Ctrl+C to stop tailing
      process.on('SIGINT', () => {
        tail.kill('SIGTERM');
        resolve(0);
      });

      return tail;
    });
  }

  /**
   * Get log file statistics
   */
  async getLogStats(sessionId) {
    const logPath = this.getLogPath(sessionId);

    try {
      const stats = await fs.promises.stat(logPath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        lines: await this.countLogLines(logPath)
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * Count lines in a log file
   */
  async countLogLines(logPath) {
    return new Promise((resolve, reject) => {
      const wc = spawn('wc', ['-l', logPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';

      wc.stdout.on('data', (data) => {
        output += data.toString();
      });

      wc.on('close', (code) => {
        if (code === 0) {
          const lines = parseInt(output.trim().split(' ')[0]) || 0;
          resolve(lines);
        } else {
          resolve(0);
        }
      });

      wc.on('error', () => resolve(0));
    });
  }

  /**
   * Search logs for specific patterns
   */
  async searchLogs(sessionId, pattern, options = {}) {
    const logPath = this.getLogPath(sessionId);

    if (!fs.existsSync(logPath)) {
      return [];
    }

    const caseInsensitive = options.caseInsensitive !== false;
    const maxResults = options.maxResults || 100;

    return new Promise((resolve, reject) => {
      const grepArgs = [];
      if (caseInsensitive) {grepArgs.push('-i');}
      grepArgs.push('-n', pattern, logPath);

      const grep = spawn('grep', grepArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      grep.stdout.on('data', (data) => {
        output += data.toString();
      });

      grep.stderr.on('data', (data) => {
        error += data.toString();
      });

      grep.on('close', (code) => {
        // grep returns 1 if no matches found, which is normal
        if (code === 0 || code === 1) {
          const lines = output.trim().split('\n')
            .filter(line => line.length > 0)
            .slice(0, maxResults)
            .map(line => {
              const match = line.match(/^(\d+):(.*)$/);
              return match ? {
                lineNumber: parseInt(match[1]),
                content: match[2]
              } : { lineNumber: 0, content: line };
            });
          resolve(lines);
        } else {
          reject(new Error(`grep command failed: ${error}`));
        }
      });

      grep.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs() {
    const cutoffTime = Date.now() - (this.logRetentionDays * 24 * 60 * 60 * 1000);

    try {
      const files = await fs.promises.readdir(this.logDir);
      const logFiles = files.filter(file => file.endsWith('.log'));

      let removedCount = 0;
      let totalSize = 0;

      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);

        try {
          const stats = await fs.promises.stat(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            totalSize += stats.size;
            await fs.promises.unlink(filePath);
            removedCount++;
            console.log(`🗑️ Removed old log file: ${file}`);
          }
        } catch (error) {
          console.error(`⚠️ Error processing log file ${file}:`, error.message);
        }
      }

      const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
      console.log(`🧹 Cleaned up ${removedCount} log files (${sizeMB}MB freed)`);

      return { removedCount, totalSize };

    } catch (error) {
      console.error('❌ Error during log cleanup:', error.message);
      return { removedCount: 0, totalSize: 0 };
    }
  }

  /**
   * Rotate logs if they exceed maximum size
   */
  async rotateLogs(sessionId) {
    const logPath = this.getLogPath(sessionId);

    try {
      const stats = await fs.promises.stat(logPath);

      if (stats.size > this.maxLogSize) {
        const rotatedPath = `${logPath}.${Date.now()}`;
        await fs.promises.rename(logPath, rotatedPath);

        console.log(`🔄 Rotated log file: ${sessionId} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);

        // Compress rotated log
        try {
          const gzip = spawn('gzip', [rotatedPath]);
          await new Promise(resolve => gzip.on('close', resolve));
        } catch (error) {
          console.error('⚠️ Failed to compress rotated log:', error.message);
        }

        return true;
      }

      return false;

    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Error checking log size for ${sessionId}:`, error.message);
      }
      return false;
    }
  }

  /**
   * Get all log files with metadata
   */
  async getAllLogs() {
    try {
      const files = await fs.promises.readdir(this.logDir);
      const logFiles = files.filter(file => file.endsWith('.log'));

      const logs = await Promise.all(logFiles.map(async (file) => {
        const sessionId = file.replace('.log', '');
        const stats = await this.getLogStats(sessionId);

        return {
          sessionId,
          file,
          ...stats
        };
      }));

      return logs.sort((a, b) => b.modified - a.modified);

    } catch (error) {
      console.error('❌ Error reading log directory:', error.message);
      return [];
    }
  }
}

module.exports = LogManager;
