/**
 * Logs Viewer
 * 
 * Real-time log viewing for sessions
 */

const blessed = require('blessed');
const fs = require('fs').promises;
const path = require('path');
const SessionDatabase = require('../../session-database');

class LogsView {
  constructor(parent, manager) {
    this.parent = parent;
    this.manager = manager;
    this.sessionDb = new SessionDatabase();
    this.sessionId = null;
    this.visible = false;
    this.tailProcess = null;
    this.logContent = '';

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
      content: '{center}Session Logs{/center}',
      tags: true,
      style: {
        fg: 'yellow',
        bold: true
      }
    });

    // Session info bar
    this.infoBar = blessed.text({
      parent: this.container,
      top: 1,
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      tags: true,
      style: {
        fg: 'cyan'
      }
    });

    // Log viewer
    this.logBox = blessed.log({
      parent: this.container,
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-3',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'green'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
      },
      tags: true
    });
  }

  /**
   * Show the view with session logs
   */
  async show(data) {
    this.visible = true;
    this.container.show();
    
    if (data && data.sessionId) {
      this.sessionId = data.sessionId;
      await this.loadSession();
      this.startTailing();
    }
    
    this.logBox.focus();
  }

  /**
   * Hide the view
   */
  hide() {
    this.visible = false;
    this.container.hide();
    this.stopTailing();
  }

  /**
   * Load session information
   */
  async loadSession() {
    try {
      const session = await this.sessionDb.getSession(this.sessionId);
      if (session) {
        this.infoBar.setContent(
          `Session: ${session.id} | Task: ${this.truncate(session.task, 50)} | Status: ${session.status}`
        );
        
        // Load logs from file
        await this.loadLogsFromFile(session);
      }
    } catch (error) {
      this.manager.showMessage(`Error loading session: ${error.message}`, 'error');
    }
  }

  /**
   * Load logs from log file
   */
  async loadLogsFromFile(session) {
    try {
      const logPath = path.join(__dirname, '../../../logs', `${session.id}.log`);
      this.logContent = await fs.readFile(logPath, 'utf8');
      this.displayLogs();
    } catch (error) {
      // If no log file exists yet, show placeholder
      this.logBox.pushLine('{gray-fg}Waiting for logs...{/}');
    }
  }

  /**
   * Start tailing logs
   */
  async startTailing() {
    // Tail the actual log file
    this.tailInterval = setInterval(async () => {
      if (!this.visible) return;
      
      try {
        const session = await this.sessionDb.getSession(this.sessionId);
        if (!session) return;
        
        const logPath = path.join(__dirname, '../../../logs', `${session.id}.log`);
        const currentContent = await fs.readFile(logPath, 'utf8');
        
        if (currentContent.length > this.logContent.length) {
          // New log content detected
          const newContent = currentContent.substring(this.logContent.length);
          if (newContent) {
            this.appendLogs(newContent);
            this.logContent = currentContent;
          }
        }
      } catch (error) {
        // Silently ignore errors during tailing
      }
    }, 1000); // Check every second
  }

  /**
   * Stop tailing logs
   */
  stopTailing() {
    if (this.tailInterval) {
      clearInterval(this.tailInterval);
      this.tailInterval = null;
    }
  }

  /**
   * Display all logs
   */
  displayLogs() {
    this.logBox.setContent('');
    
    const lines = this.logContent.split('\n');
    lines.forEach(line => {
      this.logBox.pushLine(this.formatLogLine(line));
    });
    
    // Scroll to bottom
    this.logBox.setScrollPerc(100);
    this.manager.render();
  }

  /**
   * Append new log content
   */
  appendLogs(newContent) {
    const lines = newContent.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        this.logBox.pushLine(this.formatLogLine(line));
      }
    });
    
    // Auto-scroll to bottom if already at bottom
    if (this.logBox.getScrollPerc() > 90) {
      this.logBox.setScrollPerc(100);
    }
    
    this.manager.render();
  }

  /**
   * Format a log line with colors
   */
  formatLogLine(line) {
    // Add timestamp if not present
    if (!line.match(/^\[\d{4}-\d{2}-\d{2}/)) {
      const timestamp = new Date().toLocaleTimeString();
      line = `{gray-fg}[${timestamp}]{/} ${line}`;
    }
    
    // Color based on content
    if (line.includes('ERROR') || line.includes('FAILED')) {
      return `{red-fg}${line}{/}`;
    } else if (line.includes('WARNING') || line.includes('WARN')) {
      return `{yellow-fg}${line}{/}`;
    } else if (line.includes('SUCCESS') || line.includes('COMPLETE')) {
      return `{green-fg}${line}{/}`;
    } else if (line.includes('INFO')) {
      return `{cyan-fg}${line}{/}`;
    } else if (line.includes('DEBUG')) {
      return `{gray-fg}${line}{/}`;
    }
    
    return line;
  }

  /**
   * Truncate string
   */
  truncate(str, length) {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length - 3) + '...';
  }

  /**
   * Navigation methods
   */
  navigateUp() {
    this.logBox.scroll(-1);
  }

  navigateDown() {
    this.logBox.scroll(1);
  }

  pageUp() {
    this.logBox.scroll(-10);
  }

  pageDown() {
    this.logBox.scroll(10);
  }
}

module.exports = LogsView;