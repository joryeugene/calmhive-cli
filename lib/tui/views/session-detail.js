/**
 * Session Detail View
 *
 * Detailed view of a specific session with metadata and actions
 */

const blessed = require('blessed');
const SessionDatabase = require('../../session-database');

class SessionDetailView {
  constructor(parent, manager) {
    this.parent = parent;
    this.manager = manager;
    this.sessionDb = new SessionDatabase();
    this.session = null;
    this.visible = false;

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
      content: '{center}Session Details{/center}',
      tags: true,
      style: {
        fg: 'yellow',
        bold: true
      }
    });

    // Details box
    this.detailsBox = blessed.box({
      parent: this.container,
      top: 2,
      left: 0,
      width: '100%',
      height: '70%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      tags: true
    });

    // Actions box
    this.actionsBox = blessed.box({
      parent: this.container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '25%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'green'
        }
      },
      content: '{center}Actions{/center}\n\n' +
               '  [s] Stop Session\n' +
               '  [l] View Logs\n' +
               '  [ESC] Back to List',
      tags: true
    });
  }

  /**
   * Show the view with session data
   */
  async show(data) {
    this.visible = true;
    this.container.show();

    if (data && data.session) {
      this.session = data.session;
      await this.updateDetails();
    }
  }

  /**
   * Hide the view
   */
  hide() {
    this.visible = false;
    this.container.hide();
  }

  /**
   * Update session details
   */
  async updateDetails() {
    if (!this.session) {return;}

    let content = '';

    // Basic information
    content += `{bold}Session ID:{/bold} ${this.session.id}\n`;
    content += `{bold}Type:{/bold} ${(this.session.type || 'unknown').toUpperCase()}\n`;
    content += `{bold}Status:{/bold} ${this.formatStatus(this.session.status)}\n`;
    content += `{bold}Task:{/bold} ${this.session.task}\n`;
    content += '\n';

    // Timing information
    content += `{bold}Started:{/bold} ${new Date(this.session.started_at).toLocaleString()}\n`;
    content += `{bold}Updated:{/bold} ${new Date(this.session.updated_at).toLocaleString()}\n`;
    if (this.session.completed_at) {
      content += `{bold}Completed:{/bold} ${new Date(this.session.completed_at).toLocaleString()}\n`;
    }
    content += `{bold}Duration:{/bold} ${this.formatDuration(this.session)}\n`;
    content += '\n';

    // Process information
    if (this.session.pid) {
      content += `{bold}Process ID:{/bold} ${this.session.pid}\n`;
    }
    content += `{bold}Working Directory:{/bold} ${this.session.working_directory}\n`;
    content += '\n';

    // AFk-specific information
    if (this.session.type === 'afk') {
      content += `{bold}Iterations:{/bold} ${this.session.iterations_completed || 0} / ${this.session.iterations_planned || 1}\n`;
      const percentage = Math.round(((this.session.iterations_completed || 0) / (this.session.iterations_planned || 1)) * 100);
      content += `{bold}Progress:{/bold} ${this.createProgressBar(percentage, 30)} ${percentage}%\n`;
    }

    // Metadata
    if (this.session.metadata) {
      content += '\n{bold}Metadata:{/bold}\n';
      try {
        const metadata = typeof this.session.metadata === 'string'
          ? JSON.parse(this.session.metadata)
          : this.session.metadata;

        for (const [key, value] of Object.entries(metadata)) {
          content += `  {cyan-fg}${key}:{/} ${JSON.stringify(value)}\n`;
        }
      } catch (e) {
        content += `  ${this.session.metadata}\n`;
      }
    }

    // Recent logs preview
    if (this.session.logs) {
      content += '\n{bold}Recent Logs:{/bold}\n';
      const logLines = this.session.logs.split('\n').slice(-10);
      logLines.forEach(line => {
        content += `  {gray-fg}${this.truncate(line, 70)}{/}\n`;
      });
    }

    this.detailsBox.setContent(content);
    this.manager.render();
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
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Create a progress bar
   */
  createProgressBar(percentage, width) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '{green-fg}' + '█'.repeat(filled) + '{/}' + '░'.repeat(empty);
  }

  /**
   * Truncate string
   */
  truncate(str, length) {
    if (!str) {return '';}
    if (str.length <= length) {return str;}
    return str.substring(0, length - 3) + '...';
  }

  /**
   * Navigation methods for detail view
   */
  navigateUp() {
    this.detailsBox.scroll(-1);
  }

  navigateDown() {
    this.detailsBox.scroll(1);
  }

  pageUp() {
    this.detailsBox.scroll(-10);
  }

  pageDown() {
    this.detailsBox.scroll(10);
  }

  /**
   * Enhanced vim-style navigation methods
   */
  goToTop() {
    this.detailsBox.setScrollPerc(0);
  }

  goToBottom() {
    this.detailsBox.setScrollPerc(100);
  }

  goToMiddle() {
    // Go to middle of content (what M should do)
    this.detailsBox.setScrollPerc(50);
  }

  goToViewTop() {
    // Already at view top for detail view
  }

  goToViewMiddle() {
    this.detailsBox.setScrollPerc(50);
  }

  goToViewBottom() {
    this.detailsBox.setScrollPerc(100);
  }

  halfPageUp() {
    const halfPage = Math.floor((this.detailsBox.height - 2) / 2);
    this.detailsBox.scroll(-halfPage);
  }

  halfPageDown() {
    const halfPage = Math.floor((this.detailsBox.height - 2) / 2);
    this.detailsBox.scroll(halfPage);
  }

  /**
   * Search functionality for session detail
   */
  search(searchTerm, direction = 'forward') {
    if (!searchTerm || !this.session) {return;}

    this.currentSearchTerm = searchTerm.toLowerCase();
    const content = this.detailsBox.getContent().toLowerCase();

    if (content.includes(this.currentSearchTerm)) {
      this.manager.showMessage(`Found: ${searchTerm}`, 'info');
    } else {
      this.manager.showMessage(`Not found: ${searchTerm}`, 'warning');
    }
  }

  nextSearchResult() {
    // Simple implementation for detail view
    this.manager.showMessage('Use / to search in detail view', 'info');
  }

  previousSearchResult() {
    // Simple implementation for detail view
    this.manager.showMessage('Use / to search in detail view', 'info');
  }
}

module.exports = SessionDetailView;
