/**
 * ProcessManager v2 - Experimental Modular Refactor
 *
 * STATUS: EXPERIMENTAL - Used only by integration tests
 * PRIMARY: lib/process-manager.js is the production implementation
 *
 * This is a modular refactor that composes focused modules:
 * - ProcessLifecycleManager: Session creation, status, completion
 * - ProcessMonitor: PID tracking, health checks, orphan detection
 * - AFkExecutor: AFk iteration execution and retry logic
 * - LogManager: Log file management and output handling
 *
 * GOAL: Eventually replace the monolithic ProcessManager with this modular approach
 * CURRENT USAGE: Integration tests only (session-lifecycle-tests.js, concurrent-session-stress-test.js)
 */

const ProcessLifecycleManager = require('./process/process-lifecycle-manager');
const ProcessMonitor = require('./process/process-monitor');
const AFkExecutor = require('./process/afk-executor');
const LogManager = require('./process/log-manager');
const path = require('path');

class ProcessManager {
  constructor(options = {}) {
    // Initialize focused modules
    this.logManager = new LogManager({
      logDir: options.logDir || path.join(__dirname, '..', 'logs'),
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      logRetentionDays: options.logRetentionDays || 30
    });

    this.lifecycleManager = new ProcessLifecycleManager({
      databasePath: options.databasePath,
      logDir: this.logManager.logDir
    });

    this.processMonitor = new ProcessMonitor();

    this.afkExecutor = new AFkExecutor(
      this.lifecycleManager,
      this.processMonitor,
      this.logManager
    );

    console.log('🚀 ProcessManager v2 initialized with modular architecture');
  }

  // === Session Creation & Management ===

  /**
   * Start an AFk session in background mode
   */
  async startAfkSession(task, options = {}) {
    const session = await this.lifecycleManager.createSession(task, options);
    return await this.afkExecutor.executeBackground(session, options);
  }

  /**
   * Start an AFk session in background mode (alias for compatibility)
   */
  async startAfkSessionBackground(task, options = {}) {
    return await this.startAfkSession(task, options);
  }

  /**
   * Start an AFk session in foreground mode
   */
  async startAfkSessionForeground(task, options = {}) {
    const session = await this.lifecycleManager.createSession(task, options);
    return await this.afkExecutor.executeForeground(session, options);
  }

  /**
   * Run AFk iterations (used by executor)
   */
  async runAfkIterations(session, options = {}) {
    return await this.afkExecutor.runAfkIterations(session, options);
  }

  // === Session Status & Information ===

  /**
   * Get session status and progress
   */
  async getSessionStatus(sessionId) {
    return await this.lifecycleManager.getSessionStatus(sessionId);
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions() {
    return await this.lifecycleManager.getActiveSessions();
  }

  /**
   * Get comprehensive session statistics
   */
  async getSessionStats() {
    return await this.lifecycleManager.getSessionStats();
  }

  /**
   * Get overall system status
   */
  async getStatus() {
    const sessionStats = await this.lifecycleManager.getSessionStats();
    const monitoringStats = this.processMonitor.getMonitoringStats();
    const activeSessions = await this.lifecycleManager.getActiveSessions();

    return {
      system: {
        activeProcesses: monitoringStats.activeProcessCount,
        memoryUsage: monitoringStats.processMemoryUsage,
        uptime: process.uptime()
      },
      sessions: {
        total: sessionStats.total,
        active: activeSessions.length,
        byStatus: sessionStats.byStatus,
        successRate: sessionStats.successRate,
        avgDuration: sessionStats.avgDuration
      },
      logDir: this.logManager.logDir
    };
  }

  // === Process Control ===

  /**
   * Stop a running session
   */
  async stopSession(sessionId) {
    const stopped = await this.processMonitor.stopSession(sessionId);

    if (stopped) {
      await this.lifecycleManager.updateSessionStatus(sessionId, 'cancelled');
      await this.logManager.appendToLog(sessionId, '🛑 Session stopped by user request');
    }

    return stopped;
  }

  /**
   * Clean up stale sessions
   */
  async cleanupStaleSessions() {
    console.log('🧹 Starting stale session cleanup...');

    const activeSessions = await this.lifecycleManager.getActiveSessions();
    let cleanedCount = 0;

    for (const session of activeSessions) {
      const activity = await this.processMonitor.validateSessionActivity(session.id, session.pid);

      if (!activity.isActive) {
        console.log(`🧹 Cleaning up stale session: ${session.id}`);

        await this.lifecycleManager.updateSessionStatus(session.id, 'failed', {
          error: 'Session became stale (no activity detected)',
          completed_at: Date.now()
        });

        // Remove from process monitor if tracked
        this.processMonitor.unregisterProcess(session.id);

        await this.logManager.appendToLog(session.id, '🧹 Session marked as stale and cleaned up');
        cleanedCount++;
      }
    }

    console.log(`✅ Cleaned up ${cleanedCount} stale sessions`);
    return cleanedCount;
  }

  /**
   * Restore running sessions on startup
   */
  async restoreRunningSessions() {
    const activeSessions = await this.lifecycleManager.getActiveSessions();
    console.log(`🔄 Checking ${activeSessions.length} active sessions for restoration...`);

    let restoredCount = 0;

    for (const session of activeSessions) {
      const activity = await this.processMonitor.validateSessionActivity(session.id, session.pid);

      if (activity.isActive) {
        // Re-register the process if we have PID info
        if (session.pid) {
          this.processMonitor.registerProcess(session.id, {
            pid: session.pid,
            sessionId: session.id,
            task: session.task,
            restored: true
          });
        }

        console.log(`✅ Restored active session: ${session.id}`);
        await this.logManager.appendToLog(session.id, '🔄 Session restored after ProcessManager restart');
        restoredCount++;
      }
    }

    console.log(`✅ Restored ${restoredCount} active sessions`);
    return restoredCount;
  }

  // === System Integrity ===

  /**
   * Validate system integrity
   */
  async validateSystemIntegrity() {
    console.log('🔍 Validating system integrity...');

    const results = {
      orphanProcesses: [],
      staleSessions: [],
      diskUsage: null,
      databaseHealth: true,
      recommendations: []
    };

    // Check for orphaned processes
    results.orphanProcesses = await this.processMonitor.findOrphanProcesses();
    if (results.orphanProcesses.length > 0) {
      results.recommendations.push(`Found ${results.orphanProcesses.length} orphaned processes - consider running killOrphanProcesses()`);
    }

    // Check for stale sessions
    const activeSessions = await this.lifecycleManager.getActiveSessions();
    for (const session of activeSessions) {
      const activity = await this.processMonitor.validateSessionActivity(session.id, session.pid);
      if (!activity.isActive) {
        results.staleSessions.push(session.id);
      }
    }

    if (results.staleSessions.length > 0) {
      results.recommendations.push(`Found ${results.staleSessions.length} stale sessions - consider running cleanupStaleSessions()`);
    }

    // Check log directory disk usage
    try {
      const logs = await this.logManager.getAllLogs();
      const totalSize = logs.reduce((sum, log) => sum + (log.size || 0), 0);
      results.diskUsage = {
        logCount: logs.length,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
      };

      if (totalSize > 100 * 1024 * 1024) { // 100MB
        results.recommendations.push('Log directory using significant disk space - consider cleanup');
      }
    } catch (error) {
      results.recommendations.push('Could not check log directory disk usage');
    }

    const issueCount = results.orphanProcesses.length + results.staleSessions.length;
    console.log(`🔍 System integrity check complete - found ${issueCount} issues`);

    return results;
  }

  /**
   * Find orphaned processes
   */
  async findOrphanProcesses() {
    return await this.processMonitor.findOrphanProcesses();
  }

  /**
   * Kill orphaned processes
   */
  async killOrphanProcesses() {
    return await this.processMonitor.killOrphanProcesses();
  }

  // === Log Management ===

  /**
   * Tail logs for a session
   */
  async tailLogs(sessionId, options = {}) {
    return await this.logManager.tailLogs(sessionId, options);
  }

  /**
   * Search session logs
   */
  async searchLogs(sessionId, pattern, options = {}) {
    return await this.logManager.searchLogs(sessionId, pattern, options);
  }

  /**
   * Get log statistics for a session
   */
  async getLogStats(sessionId) {
    return await this.logManager.getLogStats(sessionId);
  }

  // === Cleanup Operations ===

  /**
   * Clean up completed sessions older than specified days
   */
  async cleanupCompleted(days = 7) {
    const sessionCleanup = await this.lifecycleManager.cleanupCompletedSessions(days);
    const logCleanup = await this.logManager.cleanupOldLogs();

    return {
      sessionsRemoved: sessionCleanup,
      logsRemoved: logCleanup.removedCount,
      diskSpaceFreed: logCleanup.totalSize
    };
  }

  /**
   * Clean up specific session
   */
  async cleanup(sessionId) {
    console.log(`🧹 Cleaning up session: ${sessionId}`);

    // Stop process if running
    await this.processMonitor.stopSession(sessionId);

    // Update session status
    await this.lifecycleManager.updateSessionStatus(sessionId, 'cancelled');

    // Log cleanup action
    await this.logManager.appendToLog(sessionId, '🧹 Session cleanup completed');

    console.log(`✅ Session cleanup complete: ${sessionId}`);
  }

  // === Direct module access for advanced usage ===

  /**
   * Get the lifecycle manager for direct access
   */
  getLifecycleManager() {
    return this.lifecycleManager;
  }

  /**
   * Get the process monitor for direct access
   */
  getProcessMonitor() {
    return this.processMonitor;
  }

  /**
   * Get the AFk executor for direct access
   */
  getAFkExecutor() {
    return this.afkExecutor;
  }

  /**
   * Get the log manager for direct access
   */
  getLogManager() {
    return this.logManager;
  }
}

module.exports = ProcessManager;
