#!/usr/bin/env node

/**
 * Production-Optimized Enhanced Logger
 *
 * Features:
 * - Optimized for production environments
 * - Async batch writing with performance optimizations
 * - Error handling and graceful degradation
 * - Memory-efficient log rotation
 * - Production-ready defaults
 * - Configurable compression and performance tuning
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class ProductionLogger extends EventEmitter {
  constructor(options = {}) {
    super();

    // Production-optimized defaults
    this.options = {
      logFile: options.logFile || null,
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB for production
      maxFiles: options.maxFiles || 10, // Keep more rotated files
      logLevel: options.logLevel || 'INFO',
      enableStreaming: options.enableStreaming || false,
      enableMetrics: options.enableMetrics || true,
      bufferSize: options.bufferSize || 1000, // Larger buffer for production
      asyncWrites: options.asyncWrites || true,
      batchSize: options.batchSize || 50,
      flushInterval: options.flushInterval || 5000, // 5 seconds
      errorThreshold: options.errorThreshold || 100, // Max errors before degradation
      enableGracefulDegradation: options.enableGracefulDegradation !== false,
      performanceMode: options.performanceMode || 'balanced', // 'fast', 'balanced', 'safe'
      ...options
    };

    this.startTime = Date.now();
    this.logBuffer = [];
    this.writeQueue = [];
    this.errorCount = 0;
    this.degradedMode = false;

    this.metrics = {
      totalLogs: 0,
      logsByLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 },
      avgLogSize: 0,
      peakMemoryUsage: 0,
      currentFileSize: 0,
      writeErrors: 0,
      flushCount: 0,
      degradationEvents: 0
    };

    this.logLevels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    this.currentLogLevel = this.logLevels[this.options.logLevel];

    this.setupLogger();
  }

  async setupLogger() {
    try {
      await this.setupLogFile();
      this.setupMetricsTracking();
      this.setupBatchWriter();
      this.setupGracefulShutdown();

      this.info('Production Logger initialized', {
        options: this.sanitizeOptions(),
        performanceMode: this.options.performanceMode
      });
    } catch (error) {
      this.handleSetupError(error);
    }
  }

  sanitizeOptions() {
    const { logFile, maxFileSize, maxFiles, logLevel, performanceMode } = this.options;
    return { logFile, maxFileSize, maxFiles, logLevel, performanceMode };
  }

  async setupLogFile() {
    if (this.options.logFile) {
      const logDir = path.dirname(this.options.logFile);

      try {
        await fs.mkdir(logDir, { recursive: true });

        // Check current file size if exists
        if (fsSync.existsSync(this.options.logFile)) {
          const stats = await fs.stat(this.options.logFile);
          this.metrics.currentFileSize = stats.size;
        }
      } catch (error) {
        if (this.options.enableGracefulDegradation) {
          this.enterDegradedMode('Log directory setup failed', error);
        } else {
          throw error;
        }
      }
    }
  }

  setupMetricsTracking() {
    if (this.options.enableMetrics) {
      this.metricsInterval = setInterval(() => {
        try {
          const memUsage = process.memoryUsage();
          this.metrics.peakMemoryUsage = Math.max(
            this.metrics.peakMemoryUsage,
            memUsage.heapUsed
          );

          this.emit('metrics', {
            timestamp: new Date().toISOString(),
            memory: memUsage,
            logs: this.metrics,
            degradedMode: this.degradedMode,
            queueSize: this.writeQueue.length
          });
        } catch (error) {
          this.handleMetricsError(error);
        }
      }, 30000);
    }
  }

  setupBatchWriter() {
    if (this.options.asyncWrites) {
      this.flushInterval = setInterval(() => {
        this.flushWriteQueue().catch(error => {
          this.handleWriteError(error);
        });
      }, this.options.flushInterval);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async () => {
      try {
        await this.flush();
        this.destroy();
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGUSR2', shutdown); // For nodemon
  }

  shouldLog(level) {
    return this.logLevels[level] >= this.currentLogLevel;
  }

  async rotateLogFile() {
    if (!this.options.logFile || !fsSync.existsSync(this.options.logFile)) {return;}

    try {
      const logDir = path.dirname(this.options.logFile);
      const logName = path.basename(this.options.logFile, path.extname(this.options.logFile));
      const logExt = path.extname(this.options.logFile);

      // Rotate existing files
      for (let i = this.options.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(logDir, `${logName}.${i}${logExt}`);
        const newFile = path.join(logDir, `${logName}.${i + 1}${logExt}`);

        if (fsSync.existsSync(oldFile)) {
          if (i === this.options.maxFiles - 1) {
            await fs.unlink(oldFile); // Delete oldest file
          } else {
            await fs.rename(oldFile, newFile);
          }
        }
      }

      // Move current file to .1
      const rotatedFile = path.join(logDir, `${logName}.1${logExt}`);
      await fs.rename(this.options.logFile, rotatedFile);

      this.metrics.currentFileSize = 0;
      this.info('Log file rotated', { rotatedTo: rotatedFile });

    } catch (error) {
      this.handleRotationError(error);
    }
  }

  log(level, message, data = null, context = {}) {
    if (!this.shouldLog(level)) {return;}

    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        data,
        context,
        elapsed: Date.now() - this.startTime,
        pid: process.pid
      };

      // Update metrics
      this.metrics.totalLogs++;
      this.metrics.logsByLevel[level]++;

      // Add to buffer for streaming
      this.logBuffer.push(logEntry);
      if (this.logBuffer.length > this.options.bufferSize) {
        this.logBuffer.shift(); // Remove oldest entry
      }

      // Format and output
      const formattedMessage = this.formatLogMessage(logEntry);

      // Console output (always synchronous for immediate feedback)
      console.log(formattedMessage);

      // File writing (async or sync based on configuration)
      if (this.options.logFile && !this.degradedMode) {
        if (this.options.asyncWrites) {
          this.queueWrite(formattedMessage);
        } else {
          this.writeSync(formattedMessage);
        }
      }

      // Emit for real-time streaming
      if (this.options.enableStreaming) {
        this.emit('log', logEntry);
      }

      return logEntry;

    } catch (error) {
      this.handleLogError(error, level, message);
    }
  }

  formatLogMessage(logEntry) {
    const { timestamp, level, message, data, context, pid } = logEntry;
    const formattedMessage = `[${timestamp}] [${level.padEnd(5)}] [PID:${pid}] ${message}`;
    const formattedData = data ? ` | Data: ${JSON.stringify(data)}` : '';
    const formattedContext = Object.keys(context).length > 0 ? ` | Context: ${JSON.stringify(context)}` : '';
    return formattedMessage + formattedData + formattedContext;
  }

  queueWrite(message) {
    this.writeQueue.push(message + '\n');

    if (this.writeQueue.length >= this.options.batchSize) {
      this.flushWriteQueue().catch(error => {
        this.handleWriteError(error);
      });
    }
  }

  async flushWriteQueue() {
    if (this.writeQueue.length === 0) {return;}

    const batch = this.writeQueue.splice(0, this.options.batchSize);
    const content = batch.join('');

    try {
      // Check for rotation before writing
      const messageSize = Buffer.byteLength(content, 'utf8');
      if (this.metrics.currentFileSize + messageSize > this.options.maxFileSize) {
        await this.rotateLogFile();
      }

      await fs.appendFile(this.options.logFile, content);
      this.metrics.currentFileSize += messageSize;
      this.metrics.flushCount++;

    } catch (error) {
      // Re-queue failed writes for retry
      this.writeQueue.unshift(...batch);
      throw error;
    }
  }

  writeSync(message) {
    try {
      const content = message + '\n';
      const messageSize = Buffer.byteLength(content, 'utf8');

      if (this.metrics.currentFileSize + messageSize > this.options.maxFileSize) {
        // Note: Sync rotation is simplified for performance
        this.rotateLogFileSync();
      }

      fsSync.appendFileSync(this.options.logFile, content);
      this.metrics.currentFileSize += messageSize;

    } catch (error) {
      this.handleWriteError(error);
    }
  }

  rotateLogFileSync() {
    try {
      const logDir = path.dirname(this.options.logFile);
      const logName = path.basename(this.options.logFile, path.extname(this.options.logFile));
      const logExt = path.extname(this.options.logFile);
      const rotatedFile = path.join(logDir, `${logName}.1${logExt}`);

      if (fsSync.existsSync(rotatedFile)) {
        fsSync.unlinkSync(rotatedFile);
      }
      fsSync.renameSync(this.options.logFile, rotatedFile);
      this.metrics.currentFileSize = 0;

    } catch (error) {
      this.handleRotationError(error);
    }
  }

  // Error handling methods
  handleSetupError(error) {
    console.error('Logger setup error:', error.message);
    if (this.options.enableGracefulDegradation) {
      this.enterDegradedMode('Setup failed', error);
    } else {
      throw error;
    }
  }

  handleLogError(error, level, message) {
    this.errorCount++;
    if (this.errorCount > this.options.errorThreshold) {
      this.enterDegradedMode('Too many log errors', error);
    }
    console.error(`Log error [${level}]: ${message}`, error.message);
  }

  handleWriteError(error) {
    this.metrics.writeErrors++;
    if (this.options.enableGracefulDegradation && this.metrics.writeErrors > 10) {
      this.enterDegradedMode('Persistent write errors', error);
    }
  }

  handleMetricsError(error) {
    // Silently handle metrics errors to avoid cascading failures
    this.metrics.writeErrors++;
  }

  handleRotationError(error) {
    console.error('Log rotation error:', error.message);
    // Continue logging to current file even if rotation fails
  }

  enterDegradedMode(reason, error) {
    if (!this.degradedMode) {
      this.degradedMode = true;
      this.metrics.degradationEvents++;

      console.warn(`Logger entering degraded mode: ${reason}`, error?.message);

      // Disable file writing in degraded mode
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }

      this.emit('degraded', { reason, error: error?.message, timestamp: new Date().toISOString() });
    }
  }

  // Public API methods
  debug(message, data = null, context = {}) {
    return this.log('DEBUG', message, data, context);
  }

  info(message, data = null, context = {}) {
    return this.log('INFO', message, data, context);
  }

  warn(message, data = null, context = {}) {
    return this.log('WARN', message, data, context);
  }

  error(message, data = null, context = {}) {
    return this.log('ERROR', message, data, context);
  }

  // Enhanced search with performance optimizations
  searchLogs(query, options = {}) {
    const {
      level = null,
      timeRange = null,
      limit = 100,
      useIndex = true
    } = options;

    let results = [...this.logBuffer];

    // Performance optimization: early filtering
    if (level) {
      results = results.filter(log => log.level === level);
    }

    if (timeRange?.start && timeRange?.end) {
      const start = new Date(timeRange.start);
      const end = new Date(timeRange.end);
      results = results.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= start && logTime <= end;
      });
    }

    if (query) {
      const searchRegex = new RegExp(query, 'i');
      results = results.filter(log => {
        const searchText = `${log.message} ${JSON.stringify(log.data || {})}`;
        return searchRegex.test(searchText);
      });
    }

    return results.slice(0, limit);
  }

  // Performance monitoring
  async benchmark(name, operation, iterations = 1000) {
    this.info(`Starting production benchmark: ${name}`, { iterations });
    const startTime = Date.now();
    const startMem = process.memoryUsage().heapUsed;

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        await operation(i);
        successful++;
      } catch (error) {
        failed++;
        if (failed > iterations * 0.1) { // Stop if >10% failure rate
          break;
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    const endMem = process.memoryUsage().heapUsed;

    const result = {
      name,
      iterations: successful + failed,
      successful,
      failed,
      successRate: `${(successful / (successful + failed) * 100).toFixed(2)}%`,
      totalDuration,
      avgDuration: (totalDuration / (successful + failed)).toFixed(2),
      throughput: `${((successful + failed) / totalDuration * 1000).toFixed(2)} ops/sec`,
      memoryDelta: endMem - startMem
    };

    this.info(`Production benchmark completed: ${name}`, result);
    return result;
  }

  // Production utilities
  async flush() {
    if (this.options.asyncWrites && this.writeQueue.length > 0) {
      await this.flushWriteQueue();
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      currentMemory: process.memoryUsage(),
      bufferSize: this.logBuffer.length,
      queueSize: this.writeQueue.length,
      degradedMode: this.degradedMode,
      errorCount: this.errorCount
    };
  }

  async destroy() {
    try {
      await this.flush();

      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }

      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }

      this.removeAllListeners();
      this.info('Production Logger destroyed');

    } catch (error) {
      console.error('Error during logger destruction:', error);
    }
  }
}

module.exports = ProductionLogger;
