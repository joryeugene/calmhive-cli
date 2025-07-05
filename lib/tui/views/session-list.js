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
      content: '{center}Sessions (↑/↓ navigate, Enter attach, s stop, r resume){/center}',
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
            bg: 'white',
            fg: 'black',
            bold: true
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
   * Refresh session data
   */
  async refresh() {
    try {
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

        // Simple bounds checking
        if (this.sessions.length === 0) {
          this.selectedIndex = 0;
        } else {
          this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.sessions.length - 1));
        }

        // Update the table only if data changed
        this.updateTable();
      }
    } catch (error) {
      this.manager.showMessage(`Error loading sessions: ${error.message}`, 'error');
    }
  }


  /**
   * Update the table display
   */
  updateTable() {
    const headers = ['ID', 'Type', 'Task', 'Status', 'Progress', 'Started', 'Duration'];
    const rows = [headers];

    // Calculate row data
    const rowData = this.sessions.map(session => [
      this.truncate(session.id, 15),
      (session.type || 'unknown').toUpperCase(),
      this.truncate(session.task, 40),
      this.formatStatus(session.status),
      this.formatProgress(session),
      this.formatTime(session.started_at),
      this.formatDuration(session)
    ]);

    rows.push(...rowData);

    // Update table data
    this.listTable.setData(rows);

    // Restore selection
    if (this.selectedIndex >= 0 && this.selectedIndex < this.sessions.length) {
      const tableIndex = this.selectedIndex + 1; // Add 1 for header
      this.listTable.select(tableIndex);
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
    // Since all sessions are AFk type now, always show progress
    if (!session.metadata) {
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
    if (!timestamp) {return '-';}
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

    if (!start) {return '-';}

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
    if (!str) {return '-';}

    // Handle multi-line strings by taking only the first line
    const firstLine = str.split('\n')[0].trim();

    // If first line is empty or just ---, try to get something meaningful
    if (!firstLine || firstLine === '---') {
      // Try to extract YAML id or title
      const lines = str.split('\n');
      for (const line of lines) {
        if (line.includes('id:') || line.includes('title:') || line.includes('description:')) {
          const value = line.split(':')[1]?.trim();
          if (value) {
            str = value;
            break;
          }
        }
      }
      // If still nothing meaningful, just take first non-empty line
      if (str === firstLine) {
        for (const line of lines) {
          if (line.trim() && line.trim() !== '---') {
            str = line.trim();
            break;
          }
        }
      }
    } else {
      str = firstLine;
    }

    if (str.length <= length) {return str;}
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
   * Enhanced vim-style navigation methods
   */
  goToTop() {
    this.selectedIndex = 0;
    this.listTable.select(1); // Add 1 for header
    if (this.manager && this.manager.screen) {
      this.manager.screen.render();
    }
  }

  goToBottom() {
    this.selectedIndex = Math.max(0, this.sessions.length - 1);
    this.listTable.select(this.selectedIndex + 1); // Add 1 for header
    if (this.manager && this.manager.screen) {
      this.manager.screen.render();
    }
  }

  goToViewTop() {
    // Go to top of current visible area
    const visibleTop = this.listTable.childBase || 0;
    this.selectedIndex = Math.max(0, visibleTop);
    this.listTable.select(this.selectedIndex + 1);
  }

  goToMiddle() {
    // Go to middle item in the data (what M should actually do)
    if (!this.sessions || this.sessions.length === 0) {return;}
    const middle = Math.floor(this.sessions.length / 2);
    this.selectedIndex = middle;
    this.listTable.select(this.selectedIndex + 1);
  }

  goToViewMiddle() {
    // Go to middle of current visible area
    const height = this.listTable.height - 2; // Subtract for borders
    const visibleTop = this.listTable.childBase || 0;
    const middle = Math.min(this.sessions.length - 1, visibleTop + Math.floor(height / 2));
    this.selectedIndex = Math.max(0, middle);
    this.listTable.select(this.selectedIndex + 1);
  }

  goToViewBottom() {
    // Go to bottom of current visible area
    const height = this.listTable.height - 2; // Subtract for borders
    const visibleTop = this.listTable.childBase || 0;
    const bottom = Math.min(this.sessions.length - 1, visibleTop + height - 1);
    this.selectedIndex = Math.max(0, bottom);
    this.listTable.select(this.selectedIndex + 1);
  }

  halfPageUp() {
    const half = Math.floor((this.listTable.height - 2) / 2);
    this.selectedIndex = Math.max(0, this.selectedIndex - half);
    this.listTable.move(-half);
  }

  halfPageDown() {
    const half = Math.floor((this.listTable.height - 2) / 2);
    this.selectedIndex = Math.min(this.sessions.length - 1, this.selectedIndex + half);
    this.listTable.move(half);
  }

  /**
   * Search functionality for session list
   */
  search(searchTerm, direction = 'forward') {
    if (!searchTerm || this.sessions.length === 0) {return;}

    this.currentSearchTerm = searchTerm.toLowerCase();
    this.searchDirection = direction;
    this.searchResults = [];

    // Find all matches
    this.sessions.forEach((session, index) => {
      const searchText = `${session.id} ${session.task} ${session.type} ${session.status}`.toLowerCase();
      if (searchText.includes(this.currentSearchTerm)) {
        this.searchResults.push(index);
      }
    });

    if (this.searchResults.length === 0) {
      this.manager.showMessage(`No results for: ${searchTerm}`, 'warning');
      return;
    }

    // Jump to first result
    this.currentSearchIndex = 0;
    this.goToSearchResult();
    this.manager.showMessage(`Found ${this.searchResults.length} results for: ${searchTerm}`, 'info');
  }

  nextSearchResult() {
    if (!this.searchResults || this.searchResults.length === 0) {return;}

    this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
    this.goToSearchResult();
  }

  previousSearchResult() {
    if (!this.searchResults || this.searchResults.length === 0) {return;}

    this.currentSearchIndex = this.currentSearchIndex - 1;
    if (this.currentSearchIndex < 0) {
      this.currentSearchIndex = this.searchResults.length - 1;
    }
    this.goToSearchResult();
  }

  goToSearchResult() {
    if (!this.searchResults || this.searchResults.length === 0) {return;}

    const resultIndex = this.searchResults[this.currentSearchIndex];
    this.selectedIndex = resultIndex;
    this.listTable.select(this.selectedIndex + 1); // Add 1 for header

    // Show search status
    const current = this.currentSearchIndex + 1;
    const total = this.searchResults.length;
    this.manager.showMessage(`Result ${current}/${total}: ${this.currentSearchTerm}`, 'info');
  }

  /**
   * Get selected session
   */
  getSelectedSession() {
    if (!this.sessions || !Array.isArray(this.sessions) || this.sessions.length === 0) {
      return null;
    }

    // Simple bounds checking
    if (this.selectedIndex < 0 || this.selectedIndex >= this.sessions.length) {
      this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.sessions.length - 1));
    }

    return this.sessions[this.selectedIndex];
  }
}

module.exports = SessionListView;
