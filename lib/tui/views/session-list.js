/**
 * Session List View
 * 
 * Main view showing all Calmhive sessions with their status
 */

const blessed = require('blessed');
const SessionDatabase = require('../../session-database');

class SessionListView {
  constructor(parent, manager) {
    this.parent = parent;
    this.manager = manager;
    this.sessionDb = new SessionDatabase();
    this.sessions = [];
    this.selectedIndex = 0;
    this.visible = false;
    this.lastSessionData = null;
    this.sessionCache = new Map();
    this.lastRefreshTime = 0;
    this.lastChecksum = null;

    this.createComponents();
  }

  /**
   * Create view components
   */
  createComponents() {
    // Main container
    this.container = blessed.box({
      parent: this.parent,
      width: '100%',
      height: '100%',
      hidden: true
    });

    // Title
    this.title = blessed.text({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}Sessions (↑/↓ navigate, Enter attach, s stop, r restart){/center}',
      tags: true,
      style: {
        fg: 'white',
        bold: true
      }
    });

    // Session list table
    this.listTable = blessed.listtable({
      parent: this.container,
      top: 2,
      left: 0,
      width: '100%',
      height: '100%-2',
      align: 'left',
      tags: true,
      keys: true,
      mouse: true,
      border: 'line',
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
      },
      style: {
        header: {
          fg: 'yellow',
          bold: true
        },
        cell: {
          fg: 'white',
          selected: {
            bg: 'blue'
          }
        },
        border: {
          fg: 'cyan'
        }
      }
    });

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    this.listTable.on('select', (item, index) => {
      this.selectedIndex = index - 1; // Subtract 1 for header
    });
  }

  /**
   * Show the view
   */
  async show() {
    this.visible = true;
    this.container.show();
    await this.refresh();
    this.listTable.focus();
  }

  /**
   * Hide the view
   */
  hide() {
    this.visible = false;
    this.container.hide();
  }

  /**
   * Refresh session data with caching and differential updates
   */
  async refresh() {
    try {
      const startTime = Date.now();
      
      // Get sessions with checksum for efficient change detection
      const result = await this.sessionDb.getSessionsWithChecksum();
      
      // Check if data actually changed using checksum
      if (this.lastChecksum !== result.checksum) {
        this.lastChecksum = result.checksum;
        this.sessions = result.sessions;
        
        // Remove the checksum field from sessions
        this.sessions.forEach(session => delete session.checksum);
        
        // Sort by updated_at descending (newest first)
        this.sessions.sort((a, b) => b.updated_at - a.updated_at);

        // Update the table only if data changed
        this.updateTable();
        
        // Update cache
        this.updateSessionCache();
      }
      
      this.lastRefreshTime = Date.now();
      const refreshTime = this.lastRefreshTime - startTime;
      
      // Log slow refreshes for debugging
      if (refreshTime > 100) {
        // console.log(`Slow TUI refresh: ${refreshTime}ms`);
      }
    } catch (error) {
      this.manager.showMessage(`Error loading sessions: ${error.message}`, 'error');
    }
  }

  /**
   * Check if sessions have changed
   */
  hasSessionsChanged(newSessions) {
    if (!this.lastSessionData || this.sessions.length !== newSessions.length) {
      this.lastSessionData = JSON.stringify(newSessions);
      return true;
    }
    
    const newData = JSON.stringify(newSessions);
    if (this.lastSessionData !== newData) {
      this.lastSessionData = newData;
      return true;
    }
    
    return false;
  }

  /**
   * Update session cache for quick lookups
   */
  updateSessionCache() {
    this.sessionCache.clear();
    this.sessions.forEach(session => {
      this.sessionCache.set(session.id, session);
    });
  }

  /**
   * Update the table display with batching
   */
  updateTable() {
    // Batch updates for better performance
    const startTime = Date.now();
    
    const headers = ['ID', 'Type', 'Task', 'Status', 'Progress', 'Started', 'Duration'];
    const rows = [headers];

    // Pre-calculate all row data to minimize render calls
    const rowData = this.sessions.map(session => [
      this.truncate(session.id, 15),
      session.type.toUpperCase(),
      this.truncate(session.task, 40),
      this.formatStatus(session.status),
      this.formatProgress(session),
      this.formatTime(session.started_at),
      this.formatDuration(session)
    ]);
    
    rows.push(...rowData);

    // Update table data in one operation
    this.listTable.setData(rows);

    // Restore selection without triggering extra renders
    if (this.selectedIndex >= 0 && this.selectedIndex < this.sessions.length) {
      this.listTable.select(this.selectedIndex + 1); // Add 1 for header
    }
    
    const updateTime = Date.now() - startTime;
    if (updateTime > 50) {
      // console.log(`Slow table update: ${updateTime}ms for ${this.sessions.length} sessions`);
    }
  }

  /**
   * Format status with color
   */
  formatStatus(status) {
    const statusColors = {
      'running': '{green-fg}▶ Running{/}',
      'completed': '{cyan-fg}✓ Completed{/}',
      'error': '{red-fg}✗ Error{/}',
      'stopped': '{yellow-fg}■ Stopped{/}'
    };
    return statusColors[status] || status;
  }

  /**
   * Format progress for AFk sessions
   */
  formatProgress(session) {
    if (session.type !== 'afk' || !session.metadata) {
      return '-';
    }

    const planned = session.iterations_planned || 1;
    const completed = session.iterations_completed || 0;
    const percentage = Math.round((completed / planned) * 100);

    if (session.status === 'running') {
      const bar = this.createProgressBar(percentage, 10);
      return `${bar} ${completed}/${planned}`;
    } else {
      return `${completed}/${planned}`;
    }
  }

  /**
   * Create a simple progress bar with caching
   */
  createProgressBar(percentage, width) {
    // Cache progress bars to avoid recreating identical strings
    const key = `${percentage}-${width}`;
    if (!this._progressBarCache) {
      this._progressBarCache = new Map();
    }
    
    if (this._progressBarCache.has(key)) {
      return this._progressBarCache.get(key);
    }
    
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const bar = '{green-fg}' + '█'.repeat(filled) + '{/}' + '░'.repeat(empty);
    
    // Limit cache size
    if (this._progressBarCache.size > 100) {
      this._progressBarCache.clear();
    }
    
    this._progressBarCache.set(key, bar);
    return bar;
  }

  /**
   * Format timestamp
   */
  formatTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    
    // If today, show time only
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // Otherwise show date
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format duration
   */
  formatDuration(session) {
    const start = session.started_at;
    const end = session.completed_at || Date.now();
    
    if (!start) return '-';
    
    const duration = end - start;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Truncate string to length
   */
  truncate(str, length) {
    if (!str) return '-';
    if (str.length <= length) return str;
    return str.substring(0, length - 3) + '...';
  }

  /**
   * Navigation methods
   */
  navigateUp() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.listTable.up();
    }
  }

  navigateDown() {
    if (this.selectedIndex < this.sessions.length - 1) {
      this.selectedIndex++;
      this.listTable.down();
    }
  }

  pageUp() {
    this.listTable.move(-10);
    this.selectedIndex = Math.max(0, this.selectedIndex - 10);
  }

  pageDown() {
    this.listTable.move(10);
    this.selectedIndex = Math.min(this.sessions.length - 1, this.selectedIndex + 10);
  }

  /**
   * Get selected session
   */
  getSelectedSession() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.sessions.length) {
      return this.sessions[this.selectedIndex];
    }
    return null;
  }
}

module.exports = SessionListView;