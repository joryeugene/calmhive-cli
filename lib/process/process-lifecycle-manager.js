/**
 * ProcessLifecycleManager - Manages AFk session lifecycle
 * 
 * Handles session creation, termination, status management and basic process
 * coordination. Extracted from ProcessManager to provide focused responsibility
 * for session lifecycle operations.
 */

const SessionDatabase = require('../session-database');
const path = require('path');
const fs = require('fs');
const {
  SessionError,
  SessionNotFoundError,
  FileSystemError,
  ErrorHandler,
  withErrorHandler
} = require('../errors/error-framework');

class ProcessLifecycleManager {
  constructor(options = {}) {
    this.db = new SessionDatabase(options.databasePath);
    this.logDir = options.logDir || path.join(__dirname, '..', '..', 'logs');
    this.errorHandler = new ErrorHandler({ logger: console });
    this.ensureLogDir();
  }

  /**
   * Ensures the log directory exists for session output
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Create a new AFk session
   */
  async createSession(task, options = {}) {
    const sessionId = `afk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionData = {
      id: sessionId,
      type: 'afk',
      task: task,
      status: 'created',
      iterations: options.iterations || 5,
      current_iteration: 0,
      working_directory: process.cwd(),
      model: options.model || 'claude-3-5-sonnet-20240620',
      metadata: JSON.stringify({
        chainType: options.chainType || 'simple'
      })
    };

    await this.db.createSession(sessionData);
    console.log(`📝 Created AFk session: ${sessionId}`);
    
    return sessionData;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId, status, additionalData = {}) {
    const updateData = {
      status,
      ...additionalData
    };

    if (status === 'running' && !additionalData.started_at) {
      updateData.started_at = Date.now();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = Date.now();
    }

    // Remove any invalid columns that don't exist in schema
    delete updateData.progress;
    delete updateData.output;
    delete updateData.last_updated;

    await this.db.updateSession(sessionId, updateData);
    console.log(`📊 Session ${sessionId} status: ${status}`);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    return await this.db.getSession(sessionId);
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions() {
    return await this.db.getSessionsByStatus(['running', 'created', 'starting']);
  }

  /**
   * Get session status and progress information
   */
  async getSessionStatus(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }

    const status = {
      id: session.id,
      task: session.task,
      status: session.status,
      progress: session.progress,
      currentIteration: session.current_iteration,
      totalIterations: session.iterations,
      model: session.model,
      chainType: session.chainType,
      created: new Date(session.created_at).toISOString(),
      duration: null,
      output: session.output?.slice(-1000) || '' // Last 1000 chars
    };

    // Calculate duration
    if (session.started_at) {
      const endTime = session.completed_at || Date.now();
      status.duration = Math.round((endTime - session.started_at) / 1000);
    }

    return status;
  }

  /**
   * Get comprehensive session statistics
   */
  async getSessionStats() {
    const sessions = await this.db.getAllSessions();
    
    const stats = {
      total: sessions.length,
      byStatus: {},
      avgDuration: 0,
      successRate: 0,
      totalDuration: 0
    };

    const durations = [];
    let completedCount = 0;

    sessions.forEach(session => {
      // Count by status
      stats.byStatus[session.status] = (stats.byStatus[session.status] || 0) + 1;
      
      // Calculate durations for completed sessions
      if (session.started_at && session.completed_at) {
        const duration = (session.completed_at - session.started_at) / 1000;
        durations.push(duration);
        stats.totalDuration += duration;
        
        if (session.status === 'completed') {
          completedCount++;
        }
      }
    });

    // Calculate averages
    if (durations.length > 0) {
      stats.avgDuration = Math.round(stats.totalDuration / durations.length);
      stats.successRate = Math.round((completedCount / durations.length) * 100);
    }

    return stats;
  }

  /**
   * Mark session as failed with error message
   */
  async failSession(sessionId, error) {
    await this.updateSessionStatus(sessionId, 'failed', {
      error: error.message || error,
      completed_at: Date.now()
    });
  }

  /**
   * Mark session as completed with final output
   */
  async completeSession(sessionId, output = '') {
    await this.updateSessionStatus(sessionId, 'completed', {
      output,
      progress: 100,
      completed_at: Date.now()
    });
  }

  /**
   * Clean up completed sessions older than specified days
   */
  async cleanupCompletedSessions(days = 7) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const sessions = await this.db.getAllSessions();
    
    const toCleanup = sessions.filter(session => 
      ['completed', 'failed', 'cancelled'].includes(session.status) &&
      session.completed_at && 
      session.completed_at < cutoffTime
    );

    console.log(`🧹 Cleaning up ${toCleanup.length} old sessions (older than ${days} days)`);
    
    for (const session of toCleanup) {
      // Remove log files
      const logFile = path.join(this.logDir, `${session.id}.log`);
      try {
        if (fs.existsSync(logFile)) {
          fs.unlinkSync(logFile);
          console.log(`📄 Removed log file: ${session.id}.log`);
        }
      } catch (error) {
        console.error(`⚠️ Failed to remove log file for ${session.id}:`, error.message);
      }
      
      // Remove from database
      await this.db.deleteSession(session.id);
      console.log(`🗑️ Removed session: ${session.id}`);
    }

    return toCleanup.length;
  }

  /**
   * Update session progress
   */
  async updateProgress(sessionId, currentIteration, progress, output = '') {
    await this.db.updateSession(sessionId, {
      current_iteration: currentIteration,
      iterations_completed: currentIteration,
      logs: output
    });
  }
}

module.exports = ProcessLifecycleManager;