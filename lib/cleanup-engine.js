/**
 * CleanupEngine - Comprehensive cleanup system for AFk sessions and logs
 *
 * Handles cleanup of:
 * - Database sessions based on retention policies
 * - Orphaned log files from failed sessions
 * - Legacy registry files from older versions
 * - Audit logging of cleanup operations
 *
 * @example
 * const cleanup = new CleanupEngine({
 *   dryRun: true,
 *   completedDays: 7,
 *   preserveRecent: 10
 * });
 * const stats = await cleanup.cleanup(sessionDb, processManager);
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class CleanupEngine {
  /**
   * Creates a new CleanupEngine instance with configurable retention policies
   *
   * @param {Object} options - Configuration options
   * @param {boolean} options.dryRun - If true, only simulate cleanup without deleting (default: false)
   * @param {boolean} options.verbose - Enable detailed logging (default: false)
   * @param {boolean} options.force - Force cleanup of protected items (default: false)
   * @param {number} options.completedDays - Days to keep completed sessions (default: 7)
   * @param {number} options.failedDays - Days to keep failed sessions (default: 30)
   * @param {number} options.errorDays - Days to keep error sessions (default: 30)
   * @param {number} options.stoppedDays - Days to keep stopped sessions (default: 14)
   * @param {number} options.preserveRecent - Number of recent sessions to always preserve (default: 10)
   * @param {boolean} options.preserveStarred - Preserve starred/important sessions (default: true)
   */
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.force = options.force || false;

    // Default retention policies
    this.policies = {
      maxAge: {
        completed: options.completedDays || 7,
        failed: options.failedDays || 30,
        error: options.errorDays || 30,
        stopped: options.stoppedDays || 14,
        running: 0  // Never auto-delete running
      },
      preserve: {
        recent: options.preserveRecent !== undefined ? options.preserveRecent : 10,
        starred: options.preserveStarred !== false
      }
    };

    // Paths
    this.legacyRegistryPath = path.join(os.homedir(), '.claude/afk_registry');
    this.v3LogPath = path.join(os.homedir(), '.claude/calmhive/v3/logs');
    this.auditLogPath = path.join(os.homedir(), '.claude/calmhive/logs/cleanup-audit.log');

    // Stats tracking
    this.stats = {
      scanned: 0,
      deleted: 0,
      preserved: 0,
      errors: 0,
      spaceSaved: 0
    };
    this.deletions = [];
    this.errors = [];
  }

  async cleanup(sessionDb, _processManager) {
    console.log('🧹 Starting comprehensive AFk cleanup...\n');

    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No files will be deleted\n');
    }

    try {
      // 1. Clean database sessions
      await this.cleanDatabase(sessionDb);

      // 2. Clean orphaned log files
      await this.cleanOrphanedLogs(sessionDb);

      // 3. Clean legacy registry
      await this.cleanLegacyRegistry();

      // 4. Generate audit log
      await this.writeAuditLog();

      // 5. Show summary
      this.showSummary();

      return this.stats;
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      this.errors.push({ type: 'fatal', error: error.message });
      throw error;
    }
  }

  async cleanDatabase(sessionDb) {
    if (this.verbose) {console.log('📊 Cleaning database sessions...');}

    const sessions = await sessionDb.getAllSessions();
    this.stats.scanned += sessions.length;

    // Group sessions by status
    const sessionsByStatus = {};
    for (const session of sessions) {
      if (!sessionsByStatus[session.status]) {
        sessionsByStatus[session.status] = [];
      }
      sessionsByStatus[session.status].push(session);
    }

    // Apply retention policies by status
    for (const [status, statusSessions] of Object.entries(sessionsByStatus)) {
      const maxAgeDays = this.policies.maxAge[status];
      if (maxAgeDays === 0) {continue;} // Skip if no retention policy

      const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

      // Sort by date to preserve recent
      statusSessions.sort((a, b) => {
        const aDate = a.completed_at || a.ended_at || a.started_at;
        const bDate = b.completed_at || b.ended_at || b.started_at;
        return bDate - aDate;
      });

      for (let i = 0; i < statusSessions.length; i++) {
        const session = statusSessions[i];

        // Preserve recent sessions
        if (i < this.policies.preserve.recent) {
          this.stats.preserved++;
          continue;
        }

        // Check age - delete if older than cutoff
        const sessionDate = session.completed_at || session.ended_at || session.started_at;
        if (sessionDate > cutoff) {
          this.stats.preserved++;
          continue;
        }

        // Delete session
        if (!this.dryRun) {
          try {
            await sessionDb.deleteSession(session.id);

            // Delete associated log file
            const logPath = path.join(this.v3LogPath, `${session.id}.log`);
            const logSize = await this.deleteFile(logPath);

            this.stats.deleted++;
            this.stats.spaceSaved += logSize;

            this.deletions.push({
              id: session.id,
              type: 'database',
              status: session.status,
              reason: 'age_exceeded',
              age_days: Math.floor((Date.now() - sessionDate) / (24 * 60 * 60 * 1000)),
              size: logSize
            });
          } catch (error) {
            this.errors.push({
              id: session.id,
              error: error.message
            });
            this.stats.errors++;
          }
        } else {
          // Dry run - just count
          this.stats.deleted++;
          if (this.verbose) {
            console.log(`  Would delete: ${session.id} (${status}, ${Math.floor((Date.now() - sessionDate) / (24 * 60 * 60 * 1000))} days old)`);
          }
        }
      }
    }
  }

  async cleanOrphanedLogs(sessionDb) {
    if (this.verbose) {console.log('📝 Cleaning orphaned log files...');}

    try {
      const logFiles = await fs.readdir(this.v3LogPath);
      const sessions = await sessionDb.getAllSessions();
      const sessionIds = new Set(sessions.map(s => s.id));

      for (const file of logFiles) {
        if (!file.endsWith('.log')) {continue;}

        const sessionId = file.replace('.log', '');
        if (!sessionIds.has(sessionId)) {
          // Orphaned log file
          const logPath = path.join(this.v3LogPath, file);
          const size = await this.deleteFile(logPath);

          if (!this.dryRun) {
            this.stats.deleted++;
            this.stats.spaceSaved += size;
            this.deletions.push({
              id: sessionId,
              type: 'orphaned_log',
              reason: 'no_database_record',
              size: size
            });
          } else {
            if (this.verbose) {
              console.log(`  Would delete orphaned log: ${file}`);
            }
          }
        }
      }
    } catch (error) {
      // Log directory might not exist
      if (error.code !== 'ENOENT') {
        this.errors.push({
          type: 'orphaned_logs',
          error: error.message
        });
      }
    }
  }

  async cleanLegacyRegistry() {
    if (this.verbose) {console.log('🗂️  Cleaning legacy AFk registry...');}

    try {
      const items = await fs.readdir(this.legacyRegistryPath);

      for (const item of items) {
        // Skip non-AFk files
        if (!item.startsWith('afk-')) {continue;}

        const itemPath = path.join(this.legacyRegistryPath, item);
        const stats = await fs.stat(itemPath);

        // Check age (all legacy items are candidates for deletion)
        const ageDays = Math.floor((Date.now() - stats.mtime.getTime()) / (24 * 60 * 60 * 1000));

        if (ageDays > 7) { // Keep legacy items for 7 days minimum
          let size = 0;

          if (stats.isDirectory()) {
            size = await this.getDirectorySize(itemPath);
            if (!this.dryRun) {
              await this.deleteDirectory(itemPath);
            }
          } else {
            size = stats.size;
            if (!this.dryRun) {
              await fs.unlink(itemPath);
            }
          }

          if (!this.dryRun) {
            this.stats.deleted++;
            this.stats.spaceSaved += size;
            this.deletions.push({
              id: item,
              type: 'legacy_registry',
              reason: 'legacy_cleanup',
              age_days: ageDays,
              size: size
            });
          } else {
            if (this.verbose) {
              console.log(`  Would delete legacy item: ${item} (${ageDays} days old)`);
            }
          }
        }
      }
    } catch (error) {
      // Legacy registry might not exist
      if (error.code !== 'ENOENT') {
        this.errors.push({
          type: 'legacy_registry',
          error: error.message
        });
      }
    }
  }

  async deleteFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      if (!this.dryRun) {
        await fs.unlink(filePath);
      }
      return stats.size;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      return 0;
    }
  }

  async deleteDirectory(dirPath) {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await this.deleteDirectory(filePath);
      } else {
        await fs.unlink(filePath);
      }
    }
    await fs.rmdir(dirPath);
  }

  async getDirectorySize(dirPath) {
    let size = 0;
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          size += await this.getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return size;
  }

  async writeAuditLog() {
    const audit = {
      timestamp: new Date().toISOString(),
      operation: 'cleanup',
      mode: this.dryRun ? 'dry-run' : 'execute',
      stats: this.stats,
      deletions: this.deletions,
      errors: this.errors
    };

    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.auditLogPath);
      await fs.mkdir(logDir, { recursive: true });

      // Append to audit log
      await fs.appendFile(
        this.auditLogPath,
        JSON.stringify(audit) + '\n'
      );
    } catch (error) {
      console.error('⚠️  Failed to write audit log:', error.message);
    }
  }

  showSummary() {
    console.log('\n📊 Cleanup Summary');
    console.log('━'.repeat(50));
    console.log(`Scanned: ${this.stats.scanned} items`);
    console.log(`Deleted: ${this.stats.deleted} items`);
    console.log(`Preserved: ${this.stats.preserved} items`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Space saved: ${this.formatBytes(this.stats.spaceSaved)}`);

    if (this.errors.length > 0 && this.verbose) {
      console.log('\n⚠️  Errors encountered:');
      this.errors.forEach(e => console.log(`  - ${e.id || e.type}: ${e.error}`));
    }

    if (this.dryRun) {
      console.log('\n🔍 This was a dry run. Use --force to execute cleanup.');
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) {return '0 B';}
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = CleanupEngine;
