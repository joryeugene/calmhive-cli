/**
 * Base error class for Calmhive with enhanced context and metadata
 * Provides foundation for structured error handling throughout the application
 */
class CalmhiveError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  toString() {
    const contextStr = Object.keys(this.context).length > 0
      ? ` [Context: ${JSON.stringify(this.context)}]`
      : '';
    return `${this.name}: ${this.message}${contextStr}`;
  }
}

/**
 * Session-related errors
 */
class SessionError extends CalmhiveError {
  constructor(message, sessionId, details = {}) {
    super(message, 'SESSION_ERROR', { sessionId, ...details });
  }
}

class SessionNotFoundError extends SessionError {
  constructor(sessionId) {
    super(`Session ${sessionId} not found`, sessionId);
    this.code = 'SESSION_NOT_FOUND';
  }
}

class SessionTimeoutError extends SessionError {
  constructor(sessionId, timeout) {
    super(`Session ${sessionId} timed out after ${timeout}ms`, sessionId, { timeout });
    this.code = 'SESSION_TIMEOUT';
  }
}

class SessionConflictError extends SessionError {
  constructor(sessionId, conflictType) {
    super(`Session ${sessionId} conflict: ${conflictType}`, sessionId, { conflictType });
    this.code = 'SESSION_CONFLICT';
  }
}

/**
 * Process management errors
 */
class ProcessError extends CalmhiveError {
  constructor(message, pid, details = {}) {
    super(message, 'PROCESS_ERROR', { pid, ...details });
  }
}

class ProcessKillError extends ProcessError {
  constructor(pid, signal) {
    super(`Failed to kill process ${pid} with signal ${signal}`, pid, { signal });
    this.code = 'PROCESS_KILL_FAILED';
  }
}

class ProcessSpawnError extends ProcessError {
  constructor(command, args, cause) {
    super(`Failed to spawn process: ${command}`, null, { command, args, cause });
    this.code = 'PROCESS_SPAWN_FAILED';
  }
}

class ProcessTimeoutError extends ProcessError {
  constructor(pid, timeout) {
    super(`Process ${pid} exceeded timeout of ${timeout}ms`, pid, { timeout });
    this.code = 'PROCESS_TIMEOUT';
  }
}

/**
 * Database errors
 */
class DatabaseError extends CalmhiveError {
  constructor(message, operation, details = {}) {
    super(message, 'DATABASE_ERROR', { operation, ...details });
  }
}

class DatabaseConnectionError extends DatabaseError {
  constructor(dbPath, cause) {
    super(`Failed to connect to database at ${dbPath}`, 'connect', { dbPath, cause });
    this.code = 'DATABASE_CONNECTION_FAILED';
  }
}

class DatabaseTimeoutError extends DatabaseError {
  constructor(operation, timeout) {
    super(`Database operation '${operation}' timed out after ${timeout}ms`, operation, { timeout });
    this.code = 'DATABASE_TIMEOUT';
  }
}

class DatabaseIntegrityError extends DatabaseError {
  constructor(operation, details) {
    super(`Database integrity violation during ${operation}`, operation, details);
    this.code = 'DATABASE_INTEGRITY_ERROR';
  }
}

/**
 * Network/API errors
 */
class APIError extends CalmhiveError {
  constructor(message, endpoint, statusCode, details = {}) {
    super(message, 'API_ERROR', { endpoint, statusCode, ...details });
  }
}

class UsageLimitError extends APIError {
  constructor(resetTime, details = {}) {
    super('Claude usage limit reached', 'claude-api', 429, { resetTime, ...details });
    this.code = 'USAGE_LIMIT_EXCEEDED';
    this.resetTime = resetTime;
  }
}

class NetworkTimeoutError extends APIError {
  constructor(endpoint, timeout) {
    super(`Network request to ${endpoint} timed out after ${timeout}ms`, endpoint, 408, { timeout });
    this.code = 'NETWORK_TIMEOUT';
  }
}

/**
 * Resource errors
 */
class ResourceError extends CalmhiveError {
  constructor(message, resource, details = {}) {
    super(message, 'RESOURCE_ERROR', { resource, ...details });
  }
}

class DiskSpaceError extends ResourceError {
  constructor(path, availableSpace, requiredSpace) {
    super(`Insufficient disk space at ${path}`, 'disk', {
      path, availableSpace, requiredSpace
    });
    this.code = 'INSUFFICIENT_DISK_SPACE';
  }
}

class MemoryLimitError extends ResourceError {
  constructor(current, limit) {
    super(`Memory usage ${current}MB exceeds limit ${limit}MB`, 'memory', { current, limit });
    this.code = 'MEMORY_LIMIT_EXCEEDED';
  }
}

/**
 * Validation errors
 */
class ValidationError extends CalmhiveError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
  }
}

class RequiredFieldError extends ValidationError {
  constructor(field) {
    super(`Required field '${field}' is missing`, field);
    this.code = 'REQUIRED_FIELD_MISSING';
  }
}

class InvalidTypeError extends ValidationError {
  constructor(field, expected, actual) {
    super(`Field '${field}' expected ${expected} but got ${actual}`, field, { expected, actual });
    this.code = 'INVALID_TYPE';
  }
}

/**
 * Configuration errors
 */
class ConfigError extends CalmhiveError {
  constructor(message, configKey, details = {}) {
    super(message, 'CONFIG_ERROR', { configKey, ...details });
  }
}

class ConfigNotFoundError extends ConfigError {
  constructor(configKey, path) {
    super(`Configuration '${configKey}' not found at ${path}`, configKey, { path });
    this.code = 'CONFIG_NOT_FOUND';
  }
}

class ConfigValidationError extends ConfigError {
  constructor(configKey, reason) {
    super(`Invalid configuration for '${configKey}': ${reason}`, configKey, { reason });
    this.code = 'CONFIG_VALIDATION_FAILED';
  }
}

module.exports = {
  CalmhiveError,
  SessionError,
  SessionNotFoundError,
  SessionTimeoutError,
  SessionConflictError,
  ProcessError,
  ProcessKillError,
  ProcessSpawnError,
  ProcessTimeoutError,
  DatabaseError,
  DatabaseConnectionError,
  DatabaseTimeoutError,
  DatabaseIntegrityError,
  APIError,
  UsageLimitError,
  NetworkTimeoutError,
  ResourceError,
  DiskSpaceError,
  MemoryLimitError,
  ValidationError,
  RequiredFieldError,
  InvalidTypeError,
  ConfigError,
  ConfigNotFoundError,
  ConfigValidationError
};
