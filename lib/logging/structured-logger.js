/**
 * Structured Error Logging Framework for Calmhive
 * 
 * Provides consistent, structured logging throughout the application with:
 * - JSON-structured log entries for machine parsing
 * - Error correlation and tracking
 * - Performance metrics integration
 * - Log level management
 * - Multiple output targets (console, file, external systems)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class StructuredLogger {
  constructor(context = {}, options = {}) {
    this.context = context;
    this.logLevel = options.logLevel || process.env.CALMHIVE_LOG_LEVEL || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    this.enableMetrics = options.enableMetrics !== false;
    
    // Log file configuration
    this.logDir = options.logDir || path.join(os.homedir(), '.claude/calmhive/logs');
    this.errorLogFile = path.join(this.logDir, 'errors.jsonl');
    this.generalLogFile = path.join(this.logDir, 'general.jsonl');
    this.performanceLogFile = path.join(this.logDir, 'performance.jsonl');
    
    // Correlation tracking
    this.correlationId = this.generateCorrelationId();
    this.sessionMetrics = new Map();
    
    // Log level hierarchy
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create log directory ${this.logDir}:`, error.message);
    }
  }

  /**
   * Generate correlation ID for tracking related log entries
   */
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level) {
    const currentLevel = this.logLevels[this.logLevel] || 2;
    const messageLevel = this.logLevels[level] || 2;
    return messageLevel <= currentLevel;
  }

  /**
   * Create structured log entry
   */
  createLogEntry(level, message, data = {}, error = null) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      correlationId: this.correlationId,
      context: this.context,
      pid: process.pid,
      ...data
    };

    // Add error details if provided
    if (error) {
      entry.error = this.serializeError(error);
    }

    // Add performance data if available
    if (data.performance) {
      entry.performance = data.performance;
    }

    // Add stack trace for errors
    if (level === 'error' && !error) {
      entry.stack = new Error().stack;
    }

    return entry;
  }

  /**
   * Serialize error object for logging
   */
  serializeError(error) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      context: error.context,
      stack: error.stack,
      timestamp: error.timestamp,
      // Include custom error properties
      ...(error.toJSON ? error.toJSON() : {})
    };
  }

  /**
   * Write log entry to file
   */
  writeToFile(entry, filename) {
    if (!this.enableFile) return;

    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filename, logLine);
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error.message);
      console.error('Original log entry:', entry);
    }
  }

  /**
   * Output to console with formatting
   */
  writeToConsole(entry) {
    if (!this.enableConsole) return;

    const { timestamp, level, message, context, error } = entry;
    const contextStr = context.component ? `[${context.component}]` : '';
    const timeStr = timestamp.substring(11, 19); // Extract HH:MM:SS
    
    // Color coding for different log levels
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[32m', // Green
      trace: '\x1b[90m'  // Gray
    };
    
    const resetColor = '\x1b[0m';
    const color = colors[level] || '';
    
    // Format console output
    let output = `${color}[${timeStr}] ${level.toUpperCase()} ${contextStr}: ${message}${resetColor}`;
    
    // Add error details for console
    if (error) {
      output += `\n${color}  Error: ${error.name} - ${error.message}${resetColor}`;
      if (error.context) {
        output += `\n${color}  Context: ${JSON.stringify(error.context)}${resetColor}`;
      }
    }
    
    // Output based on level
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Error logging with enhanced context
   */
  error(message, error = null, metadata = {}) {
    if (!this.shouldLog('error')) return;

    const entry = this.createLogEntry('error', message, metadata, error);
    
    this.writeToConsole(entry);
    this.writeToFile(entry, this.errorLogFile);
    this.writeToFile(entry, this.generalLogFile);
    
    // Track error metrics
    if (this.enableMetrics) {
      this.recordErrorMetric(entry);
    }
  }

  /**
   * Warning logging
   */
  warn(message, metadata = {}) {
    if (!this.shouldLog('warn')) return;

    const entry = this.createLogEntry('warn', message, metadata);
    
    this.writeToConsole(entry);
    this.writeToFile(entry, this.generalLogFile);
  }

  /**
   * Info logging
   */
  info(message, metadata = {}) {
    if (!this.shouldLog('info')) return;

    const entry = this.createLogEntry('info', message, metadata);
    
    this.writeToConsole(entry);
    this.writeToFile(entry, this.generalLogFile);
  }

  /**
   * Debug logging
   */
  debug(message, metadata = {}) {
    if (!this.shouldLog('debug')) return;

    const entry = this.createLogEntry('debug', message, metadata);
    
    this.writeToConsole(entry);
    this.writeToFile(entry, this.generalLogFile);
  }

  /**
   * Trace logging
   */
  trace(message, metadata = {}) {
    if (!this.shouldLog('trace')) return;

    const entry = this.createLogEntry('trace', message, metadata);
    
    this.writeToConsole(entry);
    this.writeToFile(entry, this.generalLogFile);
  }

  /**
   * Performance logging
   */
  performance(operation, duration, metadata = {}) {
    const entry = this.createLogEntry('info', `Performance: ${operation}`, {
      ...metadata,
      performance: {
        operation,
        duration,
        timestamp: Date.now()
      }
    });
    
    this.writeToFile(entry, this.performanceLogFile);
    
    // Also log slow operations as warnings
    const slowThreshold = metadata.slowThreshold || 5000; // 5 seconds
    if (duration > slowThreshold) {
      this.warn(`Slow operation detected: ${operation} took ${duration}ms`, {
        performance: { operation, duration },
        ...metadata
      });
    }
  }

  /**
   * Record error metrics
   */
  recordErrorMetric(entry) {
    const key = `${entry.context.component || 'unknown'}:${entry.error?.name || 'unknown'}`;
    
    if (!this.sessionMetrics.has(key)) {
      this.sessionMetrics.set(key, {
        count: 0,
        firstSeen: entry.timestamp,
        lastSeen: entry.timestamp,
        examples: []
      });
    }
    
    const metric = this.sessionMetrics.get(key);
    metric.count++;
    metric.lastSeen = entry.timestamp;
    
    // Keep last 3 examples
    metric.examples.push({
      message: entry.message,
      timestamp: entry.timestamp,
      context: entry.error?.context
    });
    
    if (metric.examples.length > 3) {
      metric.examples.shift();
    }
  }

  /**
   * Get error metrics summary
   */
  getErrorMetrics() {
    const summary = {
      totalUniqueErrors: this.sessionMetrics.size,
      errors: {}
    };
    
    for (const [key, metric] of this.sessionMetrics) {
      summary.errors[key] = {
        count: metric.count,
        firstSeen: metric.firstSeen,
        lastSeen: metric.lastSeen,
        recentExamples: metric.examples
      };
    }
    
    return summary;
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext = {}) {
    return new StructuredLogger(
      { ...this.context, ...additionalContext },
      {
        logLevel: this.logLevel,
        enableConsole: this.enableConsole,
        enableFile: this.enableFile,
        enableMetrics: this.enableMetrics,
        logDir: this.logDir
      }
    );
  }

  /**
   * Create logger for specific operation with performance tracking
   */
  withOperation(operationName, metadata = {}) {
    const startTime = Date.now();
    const operationLogger = this.child({ 
      operation: operationName,
      operationId: this.generateCorrelationId(),
      ...metadata 
    });

    return {
      logger: operationLogger,
      complete: (result = 'success', additionalMetadata = {}) => {
        const duration = Date.now() - startTime;
        
        operationLogger.performance(operationName, duration, {
          result,
          ...metadata,
          ...additionalMetadata
        });
        
        operationLogger.info(`Operation completed: ${operationName}`, {
          duration,
          result,
          ...additionalMetadata
        });
      },
      fail: (error, additionalMetadata = {}) => {
        const duration = Date.now() - startTime;
        
        operationLogger.error(`Operation failed: ${operationName}`, error, {
          duration,
          ...metadata,
          ...additionalMetadata
        });
      }
    };
  }

  /**
   * Flush any pending log writes
   */
  flush() {
    // For now, we're using synchronous writes, so no flushing needed
    // In a production system, you might want to implement async writes with buffering
  }

  /**
   * Close logger and clean up resources
   */
  close() {
    this.flush();
    
    // Write final metrics summary
    if (this.enableMetrics && this.sessionMetrics.size > 0) {
      const summary = this.getErrorMetrics();
      this.info('Session error metrics summary', { errorMetrics: summary });
    }
  }
}

/**
 * Logger factory for creating loggers with consistent configuration
 */
class LoggerFactory {
  constructor(globalOptions = {}) {
    this.globalOptions = globalOptions;
    this.loggers = new Map();
  }

  /**
   * Get or create logger for component
   */
  getLogger(component, additionalContext = {}) {
    const key = `${component}:${JSON.stringify(additionalContext)}`;
    
    if (!this.loggers.has(key)) {
      const logger = new StructuredLogger(
        { component, ...additionalContext },
        this.globalOptions
      );
      this.loggers.set(key, logger);
    }
    
    return this.loggers.get(key);
  }

  /**
   * Close all loggers
   */
  closeAll() {
    for (const logger of this.loggers.values()) {
      logger.close();
    }
    this.loggers.clear();
  }

  /**
   * Get all error metrics from all loggers
   */
  getAllErrorMetrics() {
    const allMetrics = {};
    
    for (const [key, logger] of this.loggers) {
      allMetrics[key] = logger.getErrorMetrics();
    }
    
    return allMetrics;
  }
}

// Global logger factory instance
const globalLoggerFactory = new LoggerFactory({
  logLevel: process.env.CALMHIVE_LOG_LEVEL || 'info',
  enableConsole: process.env.CALMHIVE_DISABLE_CONSOLE_LOGS !== 'true',
  enableFile: process.env.CALMHIVE_DISABLE_FILE_LOGS !== 'true',
  enableMetrics: process.env.CALMHIVE_DISABLE_METRICS !== 'true'
});

// Convenience function to get logger
function getLogger(component, context = {}) {
  return globalLoggerFactory.getLogger(component, context);
}

module.exports = {
  StructuredLogger,
  LoggerFactory,
  globalLoggerFactory,
  getLogger
};