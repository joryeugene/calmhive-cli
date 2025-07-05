// lib/session-database.js
// SessionDatabase - Unified SQLite-based session management
// Reliable Background Processing

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

class SessionDatabase {
  constructor(customPath = null) {
    this.dbPath = customPath || path.join(
      os.homedir(),
      '.claude/calmhive/data/sessions.db'
    );
    this.db = null;
    this.initialized = false;
  }

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
          console.error('❌ Failed to connect to database:', err);
          reject(err);
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
        type TEXT NOT NULL CHECK (type IN ('afk')),
        task TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'error', 'stopped', 'failed')),
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
      id: this.generateId(config.type),
      type: config.type,
      task: config.task,
      status: 'running',
      pid: null,
      started_at: Date.now(),
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
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions ORDER BY started_at DESC';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('❌ Failed to get sessions:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async getActiveSessions() {
    await this.init();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sessions WHERE status = \'running\' ORDER BY started_at DESC';
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

    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

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
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const random = Math.random().toString(36).substr(2, 8);
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
          if (err) {
            console.error('❌ Error closing database:', err);
          } else {
            // console.log('✅ Database connection closed');
          }
          resolve();
        });
      });
    }
  }

  // Alias for compatibility with TUI manager
  async cleanup() {
    return this.close();
  }
}

module.exports = SessionDatabase;
