/**
 * SessionDatabase - SQLite-based session management for AFk background processing
 *
 * Provides reliable storage and retrieval of session metadata including:
 * - Session lifecycle tracking (running, completed, error, stopped)
 * - Progress monitoring with iteration counts
 * - Metadata storage and retrieval
 * - Cleanup operations for old sessions
 *
 * @example
 * const db = new SessionDatabase();
 * await db.init();
 * const session = await db.createSession({
 *   sessionId: 'afk-12345',
 *   type: 'afk',
 *   task: 'analyze codebase',
 *   iterations: 10,
 *   status: 'running'
 * });
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseTransactionError,
  SessionNotFoundError,
  ErrorHandler,
  withErrorHandler
} = require('./errors/error-framework');

class SessionDatabase {
  /**
   * Creates a new SessionDatabase instance
   *
   * @param {string|null} customPath - Custom database file path (optional)
   *   If null, uses default path: ~/.claude/calmhive/data/sessions.db
   */
  constructor(customPath = null) {
    this.dbPath = customPath || path.join(
      os.homedir(),
      '.claude/calmhive/data/sessions.db'
    );
    this.db = null;
    this.initialized = false;
    this.explicitlyClosed = false;
    this.errorHandler = new ErrorHandler({ logger: console });
  }

  /**
   * Throws an error if the database is not initialized or has been closed
   * @throws {Error} If database is not available
   */
  _ensureConnected() {
    if (!this.db || !this.initialized) {
      throw new DatabaseConnectionError(new Error('Database is not initialized or has been closed'));
    }
  }

  /**
   * Initializes the database connection and creates required tables
   *
   * Creates the sessions table if it doesn't exist and establishes
   * the SQLite connection. Safe to call multiple times.
   *
   * @returns {Promise<void>} Resolves when database is ready
   * @throws {Error} If database connection or table creation fails
   */
  async init() {
    if (this.initialized) {return;}

    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          const dbError = new DatabaseConnectionError(err);
          this.errorHandler.handle(dbError);
          reject(dbError);
        } else {
          // console.log('✅ Connected to SessionDatabase');
          this.createTables()
            .then(() => {
              this.initialized = true;
              resolve();
            })
            .catch(reject);
        }
      });
    });
  }

  // Alias for compatibility
  async initialize() {
    return this.init();
  }

  createTables() {
    const schema = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('afk', 'do', 'think', 'fix', 'voice', 'ask')),
        task TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('created', 'starting', 'running', 'completed', 'error', 'stopped', 'failed', 'cancelled', 'pending', 'queued', 'retrying')),
        pid INTEGER,
        started_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        ended_at INTEGER,
        exit_code INTEGER,
        error TEXT,
        iterations_planned INTEGER DEFAULT 1,
        iterations_completed INTEGER DEFAULT 0,
        current_iteration INTEGER DEFAULT 0,
        working_directory TEXT NOT NULL,
        model TEXT,
        metadata TEXT DEFAULT '{}',
        logs TEXT DEFAULT ''
      );
      
      CREATE INDEX IF NOT EXISTS idx_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_type ON sessions(type);
      CREATE INDEX IF NOT EXISTS idx_started ON sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_pid ON sessions(pid) WHERE pid IS NOT NULL;
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          console.error('❌ Failed to create tables:', err);
          reject(err);
        } else {
          // console.log('✅ Database tables ready');
          resolve();
        }
      });
    });
  }

  async createSession(config) {
    await this.init();

    const session = {
      id: config.id || this.generateId(config.type),
      type: config.type,
      task: config.task,
      status: config.status || 'running',
      pid: config.pid || null,
      started_at: config.started_at || Date.now(),
      updated_at: Date.now(),
      iterations_planned: config.iterations || 1,
      working_directory: config.workingDir || process.cwd(),
      model: config.model || null,
      metadata: JSON.stringify(config.metadata || {})
    };

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO sessions (
          id, type, task, status, pid, started_at, updated_at,
          iterations_planned, working_directory, model, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        session.id, session.type, session.task, session.status,
        session.pid, session.started_at, session.updated_at,
        session.iterations_planned, session.working_directory,
        session.model, session.metadata
      ], function(err) {
        if (err) {
          console.error('❌ Failed to create session:', err);
          reject(err);
        } else {
          // console.log(`✅ Session created: ${session.id}`);
          resolve(session);
        }
      });
    });
  }

  async updateSession(id, updates) {
    await this.init();

    updates.updated_at = Date.now();

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);

    return new Promise((resolve, reject) => {
      const sql = `UPDATE sessions SET ${fields} WHERE id = ?`;
      this.db.run(sql, values, function(err) {
        if (err) {
          console.error('❌ Failed to update session:', err);
          reject(err);
        } else if (this.changes === 0) {
          resolve(false); // No session found
        } else {
          resolve(true);
        }
      });
    });
  }

  async getSession(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions WHERE id = ?';
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          console.error('❌ Failed to get session:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  async findSessionByPartialId(partialId) {
    await this.init();

    return new Promise((resolve, reject) => {
      // First try exact match
      const exactSql = 'SELECT * FROM sessions WHERE id = ?';
      this.db.get(exactSql, [partialId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve(row);
          return;
        }

        // If no exact match, try partial match (LIKE)
        const partialSql = 'SELECT * FROM sessions WHERE id LIKE ? ORDER BY started_at DESC LIMIT 1';
        this.db.get(partialSql, [`%${partialId}%`], (err, row) => {
          if (err) {
            console.error('❌ Failed to find session:', err);
            reject(err);
          } else {
            resolve(row || null);
          }
        });
      });
    });
  }

  async getAllSessions() {
    // Don't auto-initialize if database was explicitly closed
    if (this.explicitlyClosed) {
      throw new DatabaseConnectionError(new Error('Database is not initialized or has been closed'));
    }

    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions ORDER BY started_at DESC';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          const dbError = new DatabaseTransactionError('getAllSessions', err);
          this.errorHandler.handle(dbError);
          reject(dbError);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async getActiveSessions() {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions WHERE status IN (\'running\', \'queued\', \'retrying\', \'starting\') ORDER BY started_at DESC';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('❌ Failed to get active sessions:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async getSessionsByStatus(status) {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions WHERE status = ? ORDER BY started_at DESC';
      this.db.all(sql, [status], (err, rows) => {
        if (err) {
          console.error('❌ Failed to get sessions by status:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async getRecentSessions(limit = 10) {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?';
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          console.error('❌ Failed to get recent sessions:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async searchSessions(query) {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions WHERE task LIKE ? ORDER BY started_at DESC';
      this.db.all(sql, [`%${query}%`], (err, rows) => {
        if (err) {
          console.error('❌ Failed to search sessions:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async deleteSession(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM sessions WHERE id = ?';
      this.db.run(sql, [id], function(err) {
        if (err) {
          console.error('❌ Failed to delete session:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  async getSessionsSince(timestamp) {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions WHERE updated_at > ? ORDER BY started_at DESC';
      this.db.all(sql, [timestamp], (err, rows) => {
        if (err) {
          console.error('❌ Failed to get sessions since timestamp:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async getSessionsWithChecksum() {
    await this.init();

    return new Promise((resolve, reject) => {
      // Get sessions and calculate a checksum of their state
      const sql = `
        SELECT 
          *,
          (SELECT COUNT(*) || ',' || MAX(updated_at) FROM sessions) as checksum
        FROM sessions 
        ORDER BY started_at DESC
      `;
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('❌ Failed to get sessions with checksum:', err);
          reject(err);
        } else {
          const checksum = rows[0]?.checksum || '0,0';
          resolve({ sessions: rows || [], checksum });
        }
      });
    });
  }

  async cleanupOldSessions(olderThanDays = 7) {
    await this.init();

    const HOURS_PER_DAY = 24;
    const MINUTES_PER_HOUR = 60;
    const SECONDS_PER_MINUTE = 60;
    const MILLISECONDS_PER_SECOND = 1000;

    const cutoff = Date.now() - (olderThanDays * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND);

    return new Promise((resolve, reject) => {
      const sql = `
        DELETE FROM sessions 
        WHERE status IN ('completed', 'error', 'stopped', 'failed') 
        AND (ended_at < ? OR (ended_at IS NULL AND completed_at < ?))
      `;

      this.db.run(sql, [cutoff, cutoff], function(err) {
        if (err) {
          console.error('❌ Failed to cleanup sessions:', err);
          reject(err);
        } else {
          if (this.changes > 0) {
            // console.log(`🧹 Cleaned up ${this.changes} old sessions`);
          }
          resolve(this.changes);
        }
      });
    });
  }

  generateId(type) {
    const TIMESTAMP_SLICE_LENGTH = 8; // Last 8 digits of timestamp for uniqueness
    const RANDOM_STRING_LENGTH = 8;   // 8 character random string

    const timestamp = Date.now().toString().slice(-TIMESTAMP_SLICE_LENGTH);
    const random = Math.random().toString(36).substr(2, RANDOM_STRING_LENGTH);
    return `${type}-${timestamp}-${random}`;
  }

  async getSessionStats() {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          status,
          COUNT(*) as count,
          type
        FROM sessions 
        GROUP BY status, type
        ORDER BY status, type
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('❌ Failed to get session stats:', err);
          reject(err);
        } else {
          const stats = {
            total: 0,
            running: 0,
            completed: 0,
            error: 0,
            stopped: 0,
            failed: 0,
            pending: 0
          };

          rows.forEach(row => {
            stats.total += row.count;
            if (stats.hasOwnProperty(row.status)) {
              stats[row.status] += row.count;
            }
          });

          resolve(stats);
        }
      });
    });
  }

  async close() {
    if (this.db && this.initialized) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          // Always mark as closed, regardless of error state
          this.initialized = false;
          this.explicitlyClosed = true;
          this.db = null;

          if (err) {
            console.error('❌ Error closing database:', err);
          } else {
            // console.log('✅ Database connection closed');
          }
          resolve();
        });
      });
    }
    // Mark as explicitly closed even if already closed
    this.explicitlyClosed = true;
    return Promise.resolve();
  }

  // Alias for compatibility with TUI manager
  async cleanup() {
    return this.close();
  }
}

module.exports = SessionDatabase;
