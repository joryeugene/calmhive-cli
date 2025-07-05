#!/usr/bin/env node

/**
 * Enhanced Detailed Logger with Advanced Features
 *
 * Features:
 * - Log rotation and size management
 * - Real-time streaming capabilities
 * - Log filtering and search
 * - Performance monitoring
 * - AFk integration support
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class EnhancedLogger extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      logFile: options.logFile || null,
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB default
      maxFiles: options.maxFiles || 5,
      logLevel: options.logLevel || 'INFO',
      enableStreaming: options.enableStreaming || false,
      enableMetrics: options.enableMetrics || true,
      bufferSize: options.bufferSize || 100,
      ...options
    };

    this.startTime = Date.now();
    this.logBuffer = [];
    this.metrics = {
      totalLogs: 0,
      logsByLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 },
      avgLogSize: 0,
      peakMemoryUsage: 0,
      currentFileSize: 0
    };

    this.logLevels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    this.currentLogLevel = this.logLevels[this.options.logLevel];

    this.setupLogFile();
    this.setupMetricsTracking();
  }

  setupLogFile() {
    if (this.options.logFile) {
      const logDir = path.dirname(this.options.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Check current file size
      if (fs.existsSync(this.options.logFile)) {
        this.metrics.currentFileSize = fs.statSync(this.options.logFile).size;
      }

      this.info('Enhanced Logger initialized', {
        logFile: this.options.logFile,
        maxFileSize: this.options.maxFileSize,
        maxFiles: this.options.maxFiles,
        streamingEnabled: this.options.enableStreaming
      });
    }
  }

  setupMetricsTracking() {
    if (this.options.enableMetrics) {
      // Track memory usage every 30 seconds
      this.metricsInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        this.metrics.peakMemoryUsage = Math.max(
          this.metrics.peakMemoryUsage,
          memUsage.heapUsed
        );

        this.emit('metrics', {
          timestamp: new Date().toISOString(),
          memory: memUsage,
          logs: this.metrics
        });
      }, 30000);
    }
  }

  shouldLog(level) {
    return this.logLevels[level] >= this.currentLogLevel;
  }

  rotateLogFile() {
    if (!this.options.logFile || !fs.existsSync(this.options.logFile)) {return;}

    const logDir = path.dirname(this.options.logFile);
    const logName = path.basename(this.options.logFile, path.extname(this.options.logFile));
    const logExt = path.extname(this.options.logFile);

    // Rotate existing files
    for (let i = this.options.maxFiles - 1; i >= 1; i--) {
      const oldFile = path.join(logDir, `${logName}.${i}${logExt}`);
      const newFile = path.join(logDir, `${logName}.${i + 1}${logExt}`);

      if (fs.existsSync(oldFile)) {
        if (i === this.options.maxFiles - 1) {
          fs.unlinkSync(oldFile); // Delete oldest file
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Move current file to .1
    const rotatedFile = path.join(logDir, `${logName}.1${logExt}`);
    fs.renameSync(this.options.logFile, rotatedFile);

    this.metrics.currentFileSize = 0;
    this.info('Log file rotated', { rotatedTo: rotatedFile });
  }

  log(level, message, data = null, context = {}) {
    if (!this.shouldLog(level)) {return;}

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      context,
      elapsed: Date.now() - this.startTime,
      pid: process.pid,
      memory: process.memoryUsage().heapUsed
    };

    // Update metrics
    this.metrics.totalLogs++;
    this.metrics.logsByLevel[level]++;

    // Format log message
    const formattedMessage = `[${timestamp}] [${level.padEnd(5)}] [PID:${process.pid}] ${message}`;
    const formattedData = data ? ` | Data: ${JSON.stringify(data)}` : '';
    const formattedContext = Object.keys(context).length > 0 ? ` | Context: ${JSON.stringify(context)}` : '';
    const fullMessage = formattedMessage + formattedData + formattedContext;

    // Add to buffer for streaming
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.options.bufferSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }

    // Output to console
    console.log(fullMessage);

    // Write to file with rotation check
    if (this.options.logFile) {
      const messageSize = Buffer.byteLength(fullMessage + '\n', 'utf8');

      if (this.metrics.currentFileSize + messageSize > this.options.maxFileSize) {
        this.rotateLogFile();
      }

      fs.appendFileSync(this.options.logFile, fullMessage + '\n');
      this.metrics.currentFileSize += messageSize;
    }

    // Emit for real-time streaming
    if (this.options.enableStreaming) {
      this.emit('log', logEntry);
    }

    return logEntry;
  }

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

  // Log filtering and search
  searchLogs(query, options = {}) {
    const {
      level = null,
      timeRange = null,
      dataFilter = null,
      limit = 100
    } = options;

    let results = [...this.logBuffer];

    // Filter by level
    if (level) {
      results = results.filter(log => log.level === level);
    }

    // Filter by time range
    if (timeRange && timeRange.start && timeRange.end) {
      const start = new Date(timeRange.start);
      const end = new Date(timeRange.end);
      results = results.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= start && logTime <= end;
      });
    }

    // Text search in message and data
    if (query) {
      results = results.filter(log => {
        const searchText = `${log.message} ${JSON.stringify(log.data || {})}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });
    }

    // Custom data filter
    if (dataFilter && typeof dataFilter === 'function') {
      results = results.filter(dataFilter);
    }

    return results.slice(0, limit);
  }

  // Performance testing utilities
  async benchmark(name, operation, iterations = 1000) {
    this.info(`Starting benchmark: ${name}`, { iterations });
    const startTime = Date.now();
    const startMem = process.memoryUsage().heapUsed;

    const results = [];
    for (let i = 0; i < iterations; i++) {
      const iterStart = Date.now();
      try {
        const result = await operation(i);
        const duration = Date.now() - iterStart;
        results.push({ iteration: i, duration, success: true, result });
      } catch (error) {
        const duration = Date.now() - iterStart;
        results.push({ iteration: i, duration, success: false, error: error.message });
        this.warn(`Benchmark iteration ${i} failed`, { error: error.message });
      }
    }

    const totalDuration = Date.now() - startTime;
    const endMem = process.memoryUsage().heapUsed;
    const memoryDelta = endMem - startMem;

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;

    const benchmarkResult = {
      name,
      iterations,
      totalDuration,
      avgDuration: avgDuration.toFixed(2),
      successRate: `${(successful.length / iterations * 100).toFixed(2)}%`,
      throughput: `${(iterations / totalDuration * 1000).toFixed(2)} ops/sec`,
      memoryDelta,
      successful: successful.length,
      failed: failed.length
    };

    this.info(`Benchmark completed: ${name}`, benchmarkResult);
    return { summary: benchmarkResult, results };
  }

  // Stress testing
  async stressTest(duration = 60000) {
    this.info('Starting stress test', { duration: `${duration}ms` });
    const startTime = Date.now();
    let operations = 0;

    while (Date.now() - startTime < duration) {
      const testData = {
        operation: operations++,
        timestamp: Date.now(),
        randomData: Math.random().toString(36).substring(7)
      };

      this.debug(`Stress test operation ${operations}`, testData);

      // Simulate some work
      await new Promise(resolve => setImmediate(resolve));
    }

    const actualDuration = Date.now() - startTime;
    const throughput = operations / actualDuration * 1000;

    this.info('Stress test completed', {
      operations,
      duration: actualDuration,
      throughput: `${throughput.toFixed(2)} ops/sec`,
      avgOpDuration: `${(actualDuration / operations).toFixed(2)}ms`
    });

    return { operations, duration: actualDuration, throughput };
  }

  // Stream logs to external systems
  createLogStream() {
    const { Readable } = require('stream');

    return new Readable({
      objectMode: true,
      read() {
        // Stream will be fed by log events
      }
    });
  }

  // Export logs in various formats
  exportLogs(format = 'json', options = {}) {
    const logs = this.searchLogs(options.query || '', options);

    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(logs, null, 2);

    case 'csv':
      if (logs.length === 0) {return '';}
      const headers = Object.keys(logs[0]).join(',');
      const rows = logs.map(log =>
        Object.values(log).map(val =>
          typeof val === 'object' ? JSON.stringify(val) : val
        ).join(',')
      );
      return [headers, ...rows].join('\n');

    case 'text':
      return logs.map(log =>
        `[${log.timestamp}] [${log.level}] ${log.message}${log.data ? ' | ' + JSON.stringify(log.data) : ''}`
      ).join('\n');

    default:
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      currentMemory: process.memoryUsage(),
      bufferSize: this.logBuffer.length
    };
  }

  // Cleanup
  destroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.removeAllListeners();
    this.info('Enhanced Logger destroyed');
  }
}

module.exports = EnhancedLogger;
