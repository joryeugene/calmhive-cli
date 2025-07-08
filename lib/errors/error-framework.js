/**
 * Standardized Error Handling Framework
 * 
 * Provides consistent error handling across all Calmhive modules with:
 * - Structured error types with categorization
 * - Error context and stack trace management
 * - Recovery strategy integration
 * - Logging and monitoring integration
 * - Circuit breaker compatibility
 */

/**
 * Base error class for all Calmhive errors
 */
class CalmhiveError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    
    // Error metadata
    this.category = options.category || 'UNKNOWN';
    this.code = options.code || 'UNKNOWN_ERROR';
    this.severity = options.severity || 'medium';
    this.context = options.context || {};
    this.timestamp = Date.now();
    this.retryable = options.retryable !== false; // Default to retryable
    this.userMessage = options.userMessage || null;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Chain original error if provided
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Convert error to structured object for logging/serialization
   */
  toObject() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      code: this.code,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      userMessage: this.userMessage,
      stack: this.stack,
      cause: this.cause ? (this.cause.toObject ? this.cause.toObject() : this.cause.message) : null
    };
  }

  /**
   * Get user-friendly message
   */
  getUserMessage() {
    return this.userMessage || this.message;
  }

  /**
   * Check if error is retryable
   */
  isRetryable() {
    return this.retryable;
  }

  /**
   * Get error severity
   */
  getSeverity() {
    return this.severity;
  }
}

/**
 * Session-related errors
 */
class SessionError extends CalmhiveError {
  constructor(message, options = {}) {
    super(message, {
      category: 'SESSION',
      ...options
    });
  }
}

class SessionNotFoundError extends SessionError {
  constructor(sessionId, options = {}) {
    super(`Session not found: ${sessionId}`, {
      code: 'SESSION_NOT_FOUND',
      context: { sessionId },
      userMessage: 'The requested session could not be found.',
      retryable: false,
      ...options
    });
  }
}

class SessionStateError extends SessionError {
  constructor(sessionId, currentState, expectedState, options = {}) {
    super(`Invalid session state: ${currentState}, expected: ${expectedState}`, {
      code: 'SESSION_INVALID_STATE',
      context: { sessionId, currentState, expectedState },
      userMessage: 'Session is in an unexpected state. Please try refreshing.',
      ...options
    });
  }
}

class SessionTimeoutError extends SessionError {
  constructor(sessionId, timeout, options = {}) {
    super(`Session timed out after ${timeout}ms`, {
      code: 'SESSION_TIMEOUT',
      severity: 'high',
      context: { sessionId, timeout },
      userMessage: 'Session took too long to complete and was terminated.',
      retryable: true,
      ...options
    });
  }
}

/**
 * Process-related errors
 */
class ProcessError extends CalmhiveError {
  constructor(message, options = {}) {
    super(message, {
      category: 'PROCESS',
      ...options
    });
  }
}

class ProcessSpawnError extends ProcessError {
  constructor(command, error, options = {}) {
    super(`Failed to spawn process: ${command}`, {
      code: 'PROCESS_SPAWN_FAILED',
      severity: 'high',
      context: { command, originalError: error.message },
      userMessage: 'Failed to start the required process. Please check system resources.',
      cause: error,
      ...options
    });
  }
}

class ProcessKillError extends ProcessError {
  constructor(pid, signal, options = {}) {
    super(`Failed to kill process ${pid} with signal ${signal}`, {
      code: 'PROCESS_KILL_FAILED',
      context: { pid, signal },
      userMessage: 'Unable to stop the process. You may need to manually terminate it.',
      ...options
    });
  }
}

/**
 * Database-related errors
 */
class DatabaseError extends CalmhiveError {
  constructor(message, options = {}) {
    super(message, {
      category: 'DATABASE',
      ...options
    });
  }
}

class DatabaseConnectionError extends DatabaseError {
  constructor(error, options = {}) {
    super('Database connection failed', {
      code: 'DB_CONNECTION_FAILED',
      severity: 'critical',
      context: { originalError: error.message },
      userMessage: 'Unable to connect to the database. Please check the system status.',
      cause: error,
      retryable: true,
      ...options
    });
  }
}

class DatabaseTransactionError extends DatabaseError {
  constructor(operation, error, options = {}) {
    super(`Database transaction failed: ${operation}`, {
      code: 'DB_TRANSACTION_FAILED',
      severity: 'high',
      context: { operation, originalError: error.message },
      userMessage: 'Database operation failed. Your changes may not have been saved.',
      cause: error,
      retryable: true,
      ...options
    });
  }
}

class DatabaseLockError extends DatabaseError {
  constructor(table, timeout, options = {}) {
    super(`Database lock timeout on ${table} after ${timeout}ms`, {
      code: 'DB_LOCK_TIMEOUT',
      context: { table, timeout },
      userMessage: 'Database is busy. Please try again in a moment.',
      retryable: true,
      ...options
    });
  }
}

/**
 * Network/API-related errors
 */
class NetworkError extends CalmhiveError {
  constructor(message, options = {}) {
    super(message, {
      category: 'NETWORK',
      ...options
    });
  }
}

class ClaudeAPIError extends NetworkError {
  constructor(status, message, options = {}) {
    super(`Claude API error (${status}): ${message}`, {
      code: 'CLAUDE_API_ERROR',
      severity: status >= 500 ? 'high' : 'medium',
      context: { status, apiMessage: message },
      userMessage: 'Claude API is experiencing issues. Please try again later.',
      retryable: status >= 500 || status === 429, // Retry server errors and rate limits
      ...options
    });
  }
}

class NetworkTimeoutError extends NetworkError {
  constructor(url, timeout, options = {}) {
    super(`Network request timed out: ${url}`, {
      code: 'NETWORK_TIMEOUT',
      context: { url, timeout },
      userMessage: 'Network request timed out. Please check your connection.',
      retryable: true,
      ...options
    });
  }
}

/**
 * File system errors
 */
class FileSystemError extends CalmhiveError {
  constructor(message, options = {}) {
    super(message, {
      category: 'FILESYSTEM',
      ...options
    });
  }
}

class FileNotFoundError extends FileSystemError {
  constructor(filePath, options = {}) {
    super(`File not found: ${filePath}`, {
      code: 'FILE_NOT_FOUND',
      context: { filePath },
      userMessage: 'Required file could not be found.',
      retryable: false,
      ...options
    });
  }
}

class FilePermissionError extends FileSystemError {
  constructor(filePath, operation, options = {}) {
    super(`Permission denied for ${operation} on ${filePath}`, {
      code: 'FILE_PERMISSION_DENIED',
      context: { filePath, operation },
      userMessage: 'Insufficient permissions to access the file.',
      retryable: false,
      ...options
    });
  }
}

class DiskSpaceError extends FileSystemError {
  constructor(path, requiredSpace, availableSpace, options = {}) {
    super(`Insufficient disk space: need ${requiredSpace}MB, have ${availableSpace}MB`, {
      code: 'DISK_SPACE_INSUFFICIENT',
      severity: 'high',
      context: { path, requiredSpace, availableSpace },
      userMessage: 'Not enough disk space available. Please free up some space.',
      retryable: false,
      ...options
    });
  }
}

/**
 * Configuration errors
 */
class ConfigurationError extends CalmhiveError {
  constructor(message, options = {}) {
    super(message, {
      category: 'CONFIGURATION',
      ...options
    });
  }
}

class ConfigValidationError extends ConfigurationError {
  constructor(field, value, expected, options = {}) {
    super(`Invalid configuration: ${field} = ${value}, expected ${expected}`, {
      code: 'CONFIG_VALIDATION_FAILED',
      context: { field, value, expected },
      userMessage: 'Configuration is invalid. Please check your settings.',
      retryable: false,
      ...options
    });
  }
}

class ConfigMissingError extends ConfigurationError {
  constructor(field, options = {}) {
    super(`Missing required configuration: ${field}`, {
      code: 'CONFIG_MISSING',
      context: { field },
      userMessage: 'Required configuration is missing. Please check your setup.',
      retryable: false,
      ...options
    });
  }
}

/**
 * User input errors
 */
class UserError extends CalmhiveError {
  constructor(message, options = {}) {
    super(message, {
      category: 'USER_INPUT',
      severity: 'low',
      retryable: false,
      ...options
    });
  }
}

class ValidationError extends UserError {
  constructor(field, value, constraint, options = {}) {
    super(`Validation failed for ${field}: ${constraint}`, {
      code: 'VALIDATION_FAILED',
      context: { field, value, constraint },
      userMessage: `Invalid ${field}: ${constraint}`,
      ...options
    });
  }
}

/**
 * System errors
 */
class SystemError extends CalmhiveError {
  constructor(message, options = {}) {
    super(message, {
      category: 'SYSTEM',
      severity: 'high',
      ...options
    });
  }
}

class MemoryError extends SystemError {
  constructor(operation, memoryUsed, memoryLimit, options = {}) {
    super(`Memory limit exceeded during ${operation}`, {
      code: 'MEMORY_LIMIT_EXCEEDED',
      severity: 'critical',
      context: { operation, memoryUsed, memoryLimit },
      userMessage: 'System is low on memory. Please close other applications.',
      retryable: true,
      ...options
    });
  }
}

/**
 * Error handling utilities
 */
class ErrorHandler {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.monitor = options.monitor || null;
    this.circuitBreaker = options.circuitBreaker || null;
  }

  /**
   * Handle error with appropriate logging and recovery
   */
  handle(error, context = {}) {
    const calmhiveError = this.normalizeError(error, context);
    
    // Log error
    this.logError(calmhiveError);
    
    // Report to monitoring
    if (this.monitor) {
      this.monitor.recordError(calmhiveError);
    }
    
    // Update circuit breaker
    if (this.circuitBreaker && calmhiveError.category === 'NETWORK') {
      this.circuitBreaker.recordFailure();
    }
    
    return calmhiveError;
  }

  /**
   * Normalize any error to CalmhiveError
   */
  normalizeError(error, context = {}) {
    if (error instanceof CalmhiveError) {
      // Add additional context if provided
      if (Object.keys(context).length > 0) {
        error.context = { ...error.context, ...context };
      }
      return error;
    }
    
    // Convert regular Error to CalmhiveError
    return new CalmhiveError(error.message || 'Unknown error', {
      cause: error,
      context,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }

  /**
   * Log error with appropriate level
   */
  logError(error) {
    const logData = {
      timestamp: new Date().toISOString(),
      ...error.toObject()
    };
    
    switch (error.severity) {
      case 'critical':
        this.logger.error('CRITICAL ERROR:', logData);
        break;
      case 'high':
        this.logger.error('ERROR:', logData);
        break;
      case 'medium':
        this.logger.warn('WARNING:', logData);
        break;
      case 'low':
        this.logger.info('INFO:', logData);
        break;
      default:
        this.logger.error('ERROR:', logData);
    }
  }

  /**
   * Execute function with error handling
   */
  async withErrorHandling(fn, context = {}) {
    try {
      return await fn();
    } catch (error) {
      throw this.handle(error, context);
    }
  }

  /**
   * Create error recovery wrapper
   */
  withRecovery(fn, recoveryFn, maxRetries = 3) {
    return async (...args) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = this.handle(error, { attempt, maxRetries });
          
          if (!lastError.isRetryable() || attempt === maxRetries) {
            throw lastError;
          }
          
          // Apply recovery strategy
          if (recoveryFn) {
            await recoveryFn(lastError, attempt);
          }
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      throw lastError;
    };
  }
}

/**
 * Create pre-configured error handler for different contexts
 */
function createErrorHandler(context) {
  const handlers = {
    session: new ErrorHandler({ context: 'session' }),
    process: new ErrorHandler({ context: 'process' }),
    database: new ErrorHandler({ context: 'database' }),
    network: new ErrorHandler({ context: 'network' }),
    filesystem: new ErrorHandler({ context: 'filesystem' })
  };
  
  return handlers[context] || new ErrorHandler();
}

/**
 * Utility function to wrap async functions with error handling
 */
function withErrorHandler(fn, context = {}) {
  const handler = new ErrorHandler();
  
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handler.handle(error, context);
    }
  };
}

module.exports = {
  // Base classes
  CalmhiveError,
  ErrorHandler,
  
  // Session errors
  SessionError,
  SessionNotFoundError,
  SessionStateError,
  SessionTimeoutError,
  
  // Process errors
  ProcessError,
  ProcessSpawnError,
  ProcessKillError,
  
  // Database errors
  DatabaseError,
  DatabaseConnectionError,
  DatabaseTransactionError,
  DatabaseLockError,
  
  // Network errors
  NetworkError,
  ClaudeAPIError,
  NetworkTimeoutError,
  
  // File system errors
  FileSystemError,
  FileNotFoundError,
  FilePermissionError,
  DiskSpaceError,
  
  // Configuration errors
  ConfigurationError,
  ConfigValidationError,
  ConfigMissingError,
  
  // User errors
  UserError,
  ValidationError,
  
  // System errors
  SystemError,
  MemoryError,
  
  // Utilities
  createErrorHandler,
  withErrorHandler
};