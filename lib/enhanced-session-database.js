/**
 * Enhanced SessionDatabase with timeout protection and improved error handling
 * 
 * Addresses critical issues:
 * - Missing timeout protection for database operations
 * - Generic error messages without context
 * - No validation of database connection state
 * - Missing retry logic for transient failures
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import custom error classes
const {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseTimeoutError,
  DatabaseIntegrityError,
  ValidationError,
  RequiredFieldError,
  SessionError,
  SessionNotFoundError,
  SessionConflictError
} = require('./errors/base-error');

class EnhancedSessionDatabase {
  constructor(customPath = null, options = {}) {
    this.dbPath = customPath || path.join(
      os.homedir(),
      '.claude/calmhive/data/sessions.db'
    );
    this.db = null;
    this.initialized = false;
    
    // Configuration options
    this.defaultTimeout = options.timeout || 30000; // 30 seconds
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.maxConnections = options.maxConnections || 1;
    
    // Connection state tracking
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
    this.lastConnectionError = null;
    this.operationQueue = [];
    this.activeOperations = new Set();
  }

  /**
   * Enhanced initialization with timeout and retry logic
   */
  async init() {
    if (this.initialized && this.isConnected()) {
      return;
    }

    this.connectionState = 'connecting';

    try {
      await this.ensureDataDirectory();
      await this.establishConnection();
      await this.createTables();
      await this.validateSchema();
      
      this.initialized = true;
      this.connectionState = 'connected';
      console.log('✅ SessionDatabase initialized successfully');
      
    } catch (error) {
      this.connectionState = 'error';
      this.lastConnectionError = error;
      throw new DatabaseConnectionError(this.dbPath, error.message);
    }
  }

  /**
   * Ensure data directory exists with proper error handling
   */
  async ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`✅ Created database directory: ${dataDir}`);
      }
    } catch (error) {
      throw new DatabaseError(
        `Failed to create database directory: ${error.message}`,
        'directory_creation',
        { path: dataDir, cause: error.message }
      );
    }
  }

  /**
   * Establish database connection with timeout
   */
  async establishConnection() {
    return this.withTimeout(
      new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
          if (err) {
            reject(new DatabaseConnectionError(this.dbPath, err.message));
          } else {
            // Configure database for better performance and reliability
            this.db.configure('busyTimeout', 30000);
            this.db.run('PRAGMA foreign_keys = ON');
            this.db.run('PRAGMA journal_mode = WAL');
            resolve();
          }
        });
      }),
      this.defaultTimeout,
      'database_connection'
    );
  }

  /**
   * Create required tables with proper error handling
   */
  async createTables() {
    const sql = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        pid INTEGER,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        updated_at INTEGER NOT NULL,
        iterations_planned INTEGER DEFAULT 1,
        iterations_completed INTEGER DEFAULT 0,
        model TEXT,
        working_directory TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        error TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        
        CHECK (status IN ('running', 'completed', 'error', 'stopped')),
        CHECK (iterations_planned > 0),
        CHECK (iterations_completed >= 0),
        CHECK (started_at > 0),
        CHECK (updated_at > 0)
      )
    `;

    return this.executeQuery(sql, [], 'create_tables');
  }

  /**
   * Validate database schema integrity
   */
  async validateSchema() {
    try {
      const result = await this.executeQuery(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions'",
        [],
        'schema_validation'
      );

      if (result.length === 0) {
        throw new DatabaseIntegrityError('schema_validation', {
          issue: 'sessions table not found',
          dbPath: this.dbPath
        });
      }

      console.log('✅ Database schema validated');
    } catch (error) {
      throw new DatabaseIntegrityError('schema_validation', {
        cause: error.message,
        dbPath: this.dbPath
      });
    }
  }

  /**
   * Enhanced session creation with validation and conflict detection
   */
  async createSession(config) {
    this.validateSessionConfig(config);
    await this.ensureConnected();

    const session = {
      id: this.generateId(config.type),
      type: config.type,
      task: config.task.trim(),
      status: 'running',
      pid: null,
      started_at: Date.now(),
      updated_at: Date.now(),
      iterations_planned: config.iterations || 1,
      working_directory: config.workingDir || process.cwd(),
      model: config.model || null,
      metadata: JSON.stringify(config.metadata || {})
    };

    // Check for potential conflicts
    await this.checkSessionConflicts(session);

    const sql = `
      INSERT INTO sessions (
        id, type, task, status, pid, started_at, updated_at,
        iterations_planned, working_directory, model, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      session.id, session.type, session.task, session.status,
      session.pid, session.started_at, session.updated_at,
      session.iterations_planned, session.working_directory,
      session.model, session.metadata
    ];

    try {
      await this.executeQuery(sql, values, 'create_session');
      console.log(`✅ Session created: ${session.id}`);
      return session;
    } catch (error) {
      throw new SessionError(
        `Failed to create session: ${error.message}`,
        session.id,
        { config, cause: error.message }
      );
    }
  }

  /**
   * Enhanced session update with validation
   */
  async updateSession(id, updates) {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Session ID must be a non-empty string', 'id', id);
    }

    await this.ensureConnected();

    // Validate session exists
    const existingSession = await this.getSession(id);
    if (!existingSession) {
      throw new SessionNotFoundError(id);
    }

    // Validate updates
    this.validateSessionUpdates(updates);

    updates.updated_at = Date.now();

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    const sql = `UPDATE sessions SET ${fields} WHERE id = ?`;

    try {
      const result = await this.executeQuery(sql, values, 'update_session');
      
      if (result.changes === 0) {
        throw new SessionNotFoundError(id);
      }

      console.log(`✅ Session updated: ${id}`);
      return await this.getSession(id);
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        throw error;
      }
      throw new SessionError(
        `Failed to update session: ${error.message}`,
        id,
        { updates, cause: error.message }
      );
    }
  }

  /**
   * Enhanced session retrieval with caching consideration
   */
  async getSession(id) {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Session ID must be a non-empty string', 'id', id);
    }

    await this.ensureConnected();

    const sql = 'SELECT * FROM sessions WHERE id = ?';
    
    try {
      const result = await this.executeQuery(sql, [id], 'get_session');
      
      if (result.length === 0) {
        return null;
      }

      return this.deserializeSession(result[0]);
    } catch (error) {
      throw new SessionError(
        `Failed to retrieve session: ${error.message}`,
        id,
        { cause: error.message }
      );
    }
  }

  /**
   * Execute query with timeout and retry logic
   */
  async executeQuery(sql, params = [], operation = 'unknown') {
    await this.ensureConnected();

    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeOperations.add(operationId);

    try {
      return await this.withRetry(async () => {
        return await this.withTimeout(
          new Promise((resolve, reject) => {
            // Determine query type
            const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
            
            if (isSelect) {
              this.db.all(sql, params, (err, rows) => {
                if (err) {
                  reject(new DatabaseError(
                    `Query failed: ${err.message}`,
                    operation,
                    { sql: sql.substring(0, 100), params, sqliteError: err.message }
                  ));
                } else {
                  resolve(rows || []);
                }
              });
            } else {
              this.db.run(sql, params, function(err) {
                if (err) {
                  reject(new DatabaseError(
                    `Query failed: ${err.message}`,
                    operation,
                    { sql: sql.substring(0, 100), params, sqliteError: err.message }
                  ));
                } else {
                  resolve({
                    lastID: this.lastID,
                    changes: this.changes
                  });
                }
              });
            }
          }),
          this.defaultTimeout,
          operation
        );
      });
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Execute operation with timeout protection
   */
  async withTimeout(promise, timeout, operation) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new DatabaseTimeoutError(operation, timeout));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry(operation, attempts = this.retryAttempts) {
    let lastError;

    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry validation errors or timeouts
        if (error instanceof ValidationError || 
            error instanceof DatabaseTimeoutError ||
            error instanceof SessionNotFoundError) {
          throw error;
        }

        if (i < attempts - 1) {
          console.warn(`⚠️ Database operation failed (attempt ${i + 1}/${attempts}): ${error.message}`);
          await this.delay(this.retryDelay * (i + 1)); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Check database connection state
   */
  isConnected() {
    return this.connectionState === 'connected' && this.db && this.db.open;
  }

  /**
   * Ensure database is connected
   */
  async ensureConnected() {
    if (!this.isConnected()) {
      await this.init();
    }
  }

  /**
   * Validate session configuration
   */
  validateSessionConfig(config) {
    if (!config) {
      throw new RequiredFieldError('config');
    }

    if (!config.type || typeof config.type !== 'string') {
      throw new RequiredFieldError('type');
    }

    if (!config.task || typeof config.task !== 'string') {
      throw new RequiredFieldError('task');
    }

    if (config.task.trim().length === 0) {
      throw new ValidationError('Task cannot be empty', 'task', config.task);
    }

    if (config.iterations && (typeof config.iterations !== 'number' || config.iterations < 1)) {
      throw new ValidationError('Iterations must be a positive number', 'iterations', config.iterations);
    }
  }

  /**
   * Validate session updates
   */
  validateSessionUpdates(updates) {
    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates must be an object', 'updates', updates);
    }

    const allowedFields = [
      'status', 'pid', 'completed_at', 'iterations_completed', 
      'error', 'metadata', 'updated_at'
    ];

    for (const field of Object.keys(updates)) {
      if (!allowedFields.includes(field)) {
        throw new ValidationError(`Field '${field}' is not updatable`, field, updates[field]);
      }
    }

    if (updates.status && !['running', 'completed', 'error', 'stopped'].includes(updates.status)) {
      throw new ValidationError('Invalid status value', 'status', updates.status);
    }
  }

  /**
   * Check for session conflicts
   */
  async checkSessionConflicts(session) {
    // Check for running sessions with same task
    const conflictingSessions = await this.executeQuery(
      'SELECT id FROM sessions WHERE task = ? AND status = ? AND type = ?',
      [session.task, 'running', session.type],
      'conflict_check'
    );

    if (conflictingSessions.length > 0) {
      throw new SessionConflictError(
        session.id,
        'Duplicate running session with same task'
      );
    }
  }

  /**
   * Deserialize session data from database
   */
  deserializeSession(row) {
    try {
      return {
        ...row,
        metadata: JSON.parse(row.metadata || '{}')
      };
    } catch (error) {
      console.warn(`⚠️ Failed to parse metadata for session ${row.id}: ${error.message}`);
      return {
        ...row,
        metadata: {}
      };
    }
  }

  /**
   * Generate unique session ID
   */
  generateId(type) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 8);
    return `${type}-${timestamp}-${random}`;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close database connection gracefully
   */
  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Error closing database:', err.message);
          } else {
            console.log('✅ Database connection closed');
          }
          this.connectionState = 'disconnected';
          this.initialized = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get database health status
   */
  getHealthStatus() {
    return {
      connected: this.isConnected(),
      connectionState: this.connectionState,
      lastError: this.lastConnectionError,
      activeOperations: this.activeOperations.size,
      dbPath: this.dbPath,
      initialized: this.initialized
    };
  }
}

module.exports = EnhancedSessionDatabase;