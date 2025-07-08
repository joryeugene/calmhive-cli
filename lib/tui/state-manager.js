/**
 * StateManager - Handles data management, refresh cycles, and UI state
 * 
 * Extracted from TUIManager to provide focused responsibility for:
 * - Session data refresh logic with throttling
 * - Refresh cycle management (start/stop timers)
 * - Data formatting utilities (duration, progress)
 * - UI message display
 * - State tracking and updates
 */

const blessed = require('blessed');
const { ErrorHandler, SystemError } = require('../errors/error-framework');

class StateManager {
  constructor(tuiManager) {
    this.tuiManager = tuiManager;
    this.refreshInterval = 1000; // 1 second
    this.refreshTimer = null;
    this.lastRefreshTime = 0;
    this.refreshInProgress = false;
    this.errorHandler = new ErrorHandler({ logger: console });
  }

  /**
   * Initialize StateManager
   */
  initialize() {
    // Start the refresh cycle
    this.startRefresh();
  }

  /**
   * Refresh session data with throttling
   */
  async refreshSessions() {
    // Skip if already refreshing
    if (this.refreshInProgress) { return; }

    // Throttle refreshes to prevent overwhelming the system
    const now = Date.now();
    if (now - this.lastRefreshTime < 500) { return; } // Min 500ms between refreshes

    if (this.tuiManager.currentView === 'sessionList') {
      this.refreshInProgress = true;
      try {
        await this.tuiManager.views.sessionList.refresh();
        this.tuiManager.viewManager.render(true); // Immediate render for data updates
        this.lastRefreshTime = now;
      } catch (error) {
        const stateError = new SystemError('Session refresh failed', {
          context: { currentView: this.tuiManager.currentView },
          cause: error
        });
        this.errorHandler.handle(stateError);
        // Don't rethrow - refresh errors shouldn't crash the UI
      } finally {
        this.refreshInProgress = false;
      }
    }
  }

  /**
   * Start refresh cycle with smart updates
   */
  startRefresh() {
    this.refreshTimer = setInterval(async () => {
      // Only refresh if view is visible and not in a modal
      if (this.tuiManager.screen && 
          this.tuiManager.screen.focused === this.tuiManager.views[this.tuiManager.currentView]?.container) {
        await this.refreshSessions();
      }
    }, this.refreshInterval);
  }

  /**
   * Stop refresh cycle
   */
  stopRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Set refresh interval
   */
  setRefreshInterval(interval) {
    this.refreshInterval = interval;
    
    // Restart refresh cycle with new interval if currently running
    if (this.refreshTimer) {
      this.stopRefresh();
      this.startRefresh();
    }
  }

  /**
   * Force an immediate refresh (bypassing throttling)
   */
  async forceRefresh() {
    this.lastRefreshTime = 0; // Reset throttling
    await this.refreshSessions();
  }

  /**
   * Check if refresh is currently in progress
   */
  isRefreshInProgress() {
    return this.refreshInProgress;
  }

  /**
   * Format session duration for display
   */
  formatDuration(session) {
    if (!session || !session.started_at) {
      return 'Unknown';
    }

    try {
      const start = session.started_at;
      const end = session.completed_at || Date.now();
      const duration = Math.floor((end - start) / 1000);

      if (isNaN(duration) || duration < 0) { return 'Invalid'; }
      if (duration < 60) { return `${duration}s`; }
      if (duration < 3600) { return `${Math.floor(duration / 60)}m ${duration % 60}s`; }
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      return `${hours}h ${minutes}m`;
    } catch (error) {
      return 'Error';
    }
  }

  /**
   * Format session progress for display
   */
  formatProgress(session) {
    // Since all sessions are AFk type now, always show progress
    if (!session || !session.metadata) {
      return 'N/A';
    }

    try {
      const planned = session.iterations_planned || 1;
      const completed = session.iterations_completed || 0;
      return `${completed}/${planned} iterations`;
    } catch (error) {
      return 'N/A';
    }
  }

  /**
   * Format session status with color coding
   */
  formatStatus(session) {
    if (!session || !session.status) {
      return { text: 'Unknown', color: 'gray' };
    }

    const statusMap = {
      'running': { text: '🔄 Running', color: 'green' },
      'completed': { text: '✅ Completed', color: 'blue' },
      'failed': { text: '❌ Failed', color: 'red' },
      'stopped': { text: '⏹️ Stopped', color: 'yellow' },
      'error': { text: '💥 Error', color: 'red' },
      'pending': { text: '⏳ Pending', color: 'cyan' }
    };

    return statusMap[session.status] || { text: session.status, color: 'white' };
  }

  /**
   * Show a temporary message
   */
  showMessage(text, type = 'info') {
    const colors = {
      info: 'cyan',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };

    const message = blessed.box({
      parent: this.tuiManager.screen,
      top: 'center',
      left: 'center',
      width: 'shrink',
      height: 'shrink',
      padding: 1,
      content: text,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: colors[type] || 'blue',
        border: {
          fg: colors[type] || 'blue'
        }
      }
    });

    this.tuiManager.viewManager.render();

    setTimeout(() => {
      message.destroy();
      this.tuiManager.viewManager.render();
    }, 2000);
  }

  /**
   * Show a persistent notification that requires user acknowledgment
   */
  showNotification(title, message, callback = null) {
    const notification = blessed.box({
      parent: this.tuiManager.screen,
      keys: true,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 'shrink',
      padding: 1,
      content: `${title}\n\n${message}\n\nPress ENTER to continue`,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: 'yellow'
        }
      }
    });

    notification.key(['enter', 'escape'], () => {
      notification.destroy();
      this.tuiManager.viewManager.render();
      if (callback) {
        callback();
      }
    });

    notification.focus();
    this.tuiManager.viewManager.render();
  }

  /**
   * Calculate session age in hours
   */
  getSessionAge(session) {
    if (!session || !session.started_at) {
      return 0;
    }

    try {
      const now = Date.now();
      const ageMs = now - session.started_at;
      return ageMs / (1000 * 60 * 60); // Convert to hours
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessions) {
    if (!Array.isArray(sessions)) {
      return {
        total: 0,
        running: 0,
        completed: 0,
        failed: 0,
        stopped: 0
      };
    }

    return sessions.reduce((stats, session) => {
      stats.total++;
      const status = session.status || 'unknown';
      if (stats[status] !== undefined) {
        stats[status]++;
      }
      return stats;
    }, {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0,
      stopped: 0,
      error: 0
    });
  }

  /**
   * Filter sessions by status
   */
  filterSessionsByStatus(sessions, status) {
    if (!Array.isArray(sessions)) {
      return [];
    }

    if (status === 'all') {
      return sessions;
    }

    return sessions.filter(session => session.status === status);
  }

  /**
   * Sort sessions by criteria
   */
  sortSessions(sessions, criteria = 'started_at', direction = 'desc') {
    if (!Array.isArray(sessions)) {
      return [];
    }

    return [...sessions].sort((a, b) => {
      let aVal = a[criteria];
      let bVal = b[criteria];

      // Handle different data types
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (direction === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });
  }

  /**
   * Clean up StateManager resources
   */
  cleanup() {
    this.stopRefresh();
    this.refreshInProgress = false;
    this.lastRefreshTime = 0;
  }
}

module.exports = StateManager;