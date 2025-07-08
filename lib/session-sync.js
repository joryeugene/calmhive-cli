/**
 * Session Synchronization - Fix AFk registry/database desync
 * 
 * Syncs filesystem AFk sessions in ~/.claude/afk_registry/ with 
 * the TUI session database to fix log viewing integration.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const SessionDatabase = require('./session-database');

class SessionSync {
  constructor() {
    this.afkRegistryPath = path.join(os.homedir(), '.claude/afk_registry');
    this.sessionDb = new SessionDatabase();
  }

  /**
   * Scan AFk registry and sync missing sessions to database
   */
  async syncAFkSessions() {
    console.log('🔄 Syncing AFk sessions from filesystem to database...');
    
    await this.sessionDb.init();
    
    try {
      // Get all AFk session directories
      const entries = await fs.readdir(this.afkRegistryPath);
      const afkDirs = entries.filter(entry => entry.startsWith('afk-'));
      
      console.log(`📁 Found ${afkDirs.length} AFk sessions in filesystem`);
      
      let synced = 0;
      let skipped = 0;
      
      for (const sessionDir of afkDirs) {
        const sessionId = sessionDir; // e.g., 'afk-29947044-redgtt3m'
        const sessionPath = path.join(this.afkRegistryPath, sessionDir);
        
        try {
          // Check if session already exists in database
          const existingSession = await this.sessionDb.getSession(sessionId);
          if (existingSession) {
            skipped++;
            continue;
          }
          
          // Read session metadata from filesystem
          const sessionData = await this.readSessionMetadata(sessionPath, sessionId);
          if (!sessionData) {
            skipped++;
            continue;
          }
          
          // Create session in database with direct SQL insert
          await this.insertSessionDirectly(sessionData);
          synced++;
          
          console.log(`✅ Synced: ${sessionId}`);
          
        } catch (error) {
          console.warn(`⚠️  Failed to sync ${sessionId}:`, error.message);
          skipped++;
        }
      }
      
      console.log(`🎯 Sync complete: ${synced} synced, ${skipped} skipped`);
      return { synced, skipped, total: afkDirs.length };
      
    } catch (error) {
      console.error('❌ Failed to sync AFk sessions:', error);
      throw error;
    }
  }

  /**
   * Insert session directly into database (bypass createSession ID generation)
   */
  async insertSessionDirectly(sessionData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO sessions (
          id, type, task, status, pid, started_at, updated_at,
          completed_at, ended_at, exit_code, error,
          iterations_planned, iterations_completed, current_iteration,
          working_directory, model, metadata, logs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        sessionData.id,
        sessionData.type,
        sessionData.task,
        sessionData.status,
        sessionData.pid,
        sessionData.started_at,
        sessionData.updated_at,
        sessionData.completed_at,
        sessionData.ended_at,
        sessionData.exit_code,
        sessionData.error,
        sessionData.iterations_planned,
        sessionData.iterations_completed,
        sessionData.current_iteration,
        sessionData.working_directory,
        sessionData.model,
        sessionData.metadata,
        sessionData.logs
      ];
      
      this.sessionDb.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(sessionData);
        }
      });
    });
  }

  /**
   * Read session metadata from AFk registry files
   */
  async readSessionMetadata(sessionPath, sessionId) {
    try {
      // Check if this is a real session (has worker.log) vs test session (only context-monitor.log)
      const files = await fs.readdir(sessionPath);
      const hasWorkerLog = files.includes('worker.log');
      const hasContextReport = files.includes('context-report.json');
      
      if (!hasWorkerLog) {
        // Test session - skip
        return null;
      }
      
      // Read context report for metadata
      let task = 'Unknown task';
      let iterations = 5; // default
      let status = 'completed'; // assume completed if in registry
      
      if (hasContextReport) {
        try {
          const reportPath = path.join(sessionPath, 'context-report.json');
          const reportContent = await fs.readFile(reportPath, 'utf8');
          const report = JSON.parse(reportContent);
          
          // Extract task info if available
          if (report.task) {
            task = report.task;
          }
          if (report.iterations) {
            iterations = report.iterations;
          }
        } catch (reportError) {
          // Continue with defaults if report is unreadable
        }
      }
      
      // Check worker.log for actual task if not in report
      if (task === 'Unknown task') {
        try {
          const workerLogPath = path.join(sessionPath, 'worker.log');
          const workerLogContent = await fs.readFile(workerLogPath, 'utf8');
          
          // Look for task description in first few lines
          const lines = workerLogContent.split('\n').slice(0, 10);
          for (const line of lines) {
            if (line.includes('Task:') || line.includes('task:')) {
              const taskMatch = line.match(/[Tt]ask:\s*(.+)/);
              if (taskMatch) {
                task = taskMatch[1].trim();
                break;
              }
            }
          }
        } catch (logError) {
          // Continue with default task
        }
      }
      
      const now = Date.now();
      
      return {
        id: sessionId,
        type: 'afk',
        task: task.substring(0, 200), // Truncate long tasks
        status,
        pid: null,
        started_at: now,
        updated_at: now,
        completed_at: status === 'completed' ? now : null,
        ended_at: status === 'completed' ? now : null,
        exit_code: status === 'completed' ? 0 : null,
        error: null,
        iterations_planned: iterations,
        iterations_completed: status === 'completed' ? iterations : 0,
        current_iteration: status === 'completed' ? iterations : 0,
        working_directory: '/Users/jory/.claude/calmhive/v3',
        model: 'claude-3-sonnet-20240229',
        metadata: JSON.stringify({
          syncedFromFilesystem: true,
          originalPath: sessionPath
        }),
        logs: ''
      };
      
    } catch (error) {
      console.warn(`⚠️  Could not read metadata for ${sessionId}:`, error.message);
      return null;
    }
  }

  /**
   * Clean up orphaned sessions (in database but not in filesystem)
   */
  async cleanupOrphanedSessions() {
    console.log('🧹 Cleaning up orphaned sessions...');
    
    await this.sessionDb.init();
    
    try {
      const allSessions = await this.sessionDb.getAllSessions();
      let cleaned = 0;
      
      for (const session of allSessions) {
        const sessionPath = path.join(this.afkRegistryPath, session.id);
        
        try {
          await fs.access(sessionPath);
          // Session exists in filesystem, keep it
        } catch (error) {
          // Session doesn't exist in filesystem, remove from database
          await this.sessionDb.deleteSession(session.id);
          cleaned++;
          console.log(`🗑️  Removed orphaned session: ${session.id}`);
        }
      }
      
      console.log(`🎯 Cleanup complete: ${cleaned} orphaned sessions removed`);
      return cleaned;
      
    } catch (error) {
      console.error('❌ Failed to cleanup orphaned sessions:', error);
      throw error;
    }
  }

  /**
   * Full sync: sync new sessions and cleanup orphaned ones
   */
  async fullSync() {
    const syncResult = await this.syncAFkSessions();
    const cleanupResult = await this.cleanupOrphanedSessions();
    
    return {
      synced: syncResult.synced,
      skipped: syncResult.skipped,
      cleaned: cleanupResult,
      total: syncResult.total
    };
  }
}

module.exports = SessionSync;