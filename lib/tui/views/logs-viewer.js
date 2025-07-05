/**
 * Logs Viewer
 *
 * Real-time log viewing for sessions
 */

const blessed = require('blessed');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
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
   * Load logs from log file with smart path resolution
   */
  async loadLogsFromFile(session) {
    try {
      const logData = await this.findSessionLogs(session.id);

      if (logData.found) {
        this.logContent = logData.content;
        this.currentLogPath = logData.path;
        this.logSource = logData.source;

        if (this.logContent.trim().length > 0) {
          this.displayLogs();
          // Show log source info
          this.title.setContent(`{center}Session Logs - ${this.logSource}{/center}`);
        } else {
          this.logBox.pushLine('{gray-fg}Waiting for logs...{/}');
        }
      } else {
        this.logBox.pushLine('{gray-fg}No logs found - checked multiple locations{/}');
        this.logBox.pushLine(`{gray-fg}Session: ${session.id}{/}`);
        this.logBox.pushLine(`{gray-fg}Status: ${session.status}{/}`);
      }
    } catch (error) {
      this.logBox.pushLine(`{red-fg}Error loading logs: ${error.message}{/}`);
    }
  }

  /**
   * Smart log path resolution - checks multiple locations
   */
  async findSessionLogs(sessionId) {
    const homeDir = os.homedir();

    // Define all possible log locations in priority order
    const logCandidates = [
      // 1. V3 main logs (highest priority - current system)
      {
        path: path.join(homeDir, '.claude/calmhive/v3/logs', `${sessionId}.log`),
        source: 'V3 Main Log',
        type: 'v3_main'
      },
      // 2. AFk worker logs (legacy but may have valuable info)
      {
        path: path.join(homeDir, '.claude/afk_registry', sessionId, 'worker.log'),
        source: 'AFk Worker Log',
        type: 'afk_worker'
      },
      // 3. AFk context monitor (debugging info)
      {
        path: path.join(homeDir, '.claude/afk_registry', sessionId, 'context-monitor.log'),
        source: 'AFk Context Log',
        type: 'afk_context'
      },
      // 4. General logs directory
      {
        path: path.join(homeDir, '.claude/logs', `${sessionId}.log`),
        source: 'General Log',
        type: 'general'
      },
      // 5. Calmhive logs directory
      {
        path: path.join(homeDir, '.claude/calmhive/logs', `${sessionId}.log`),
        source: 'Calmhive Log',
        type: 'calmhive'
      }
    ];

    // Try each location in order
    for (const candidate of logCandidates) {
      try {
        // Check if file exists and is readable
        await fs.access(candidate.path);
        const stats = await fs.stat(candidate.path);

        if (stats.size > 0) {
          const content = await fs.readFile(candidate.path, 'utf8');

          return {
            found: true,
            path: candidate.path,
            source: candidate.source,
            type: candidate.type,
            content,
            size: stats.size,
            mtime: stats.mtime
          };
        }
      } catch (error) {
        // File doesn't exist or isn't readable, continue to next candidate
        continue;
      }
    }

    // If no logs found, try to aggregate multiple sources
    const aggregatedLogs = await this.aggregateMultipleLogs(sessionId, logCandidates);
    if (aggregatedLogs.found) {
      return aggregatedLogs;
    }

    return {
      found: false,
      checkedPaths: logCandidates.map(c => c.path),
      sessionId
    };
  }

  /**
   * Aggregate logs from multiple sources for unified view
   */
  async aggregateMultipleLogs(sessionId, candidates) {
    const foundLogs = [];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate.path);
        const stats = await fs.stat(candidate.path);
        const content = await fs.readFile(candidate.path, 'utf8');

        if (content.trim().length > 0) {
          foundLogs.push({
            ...candidate,
            content,
            size: stats.size,
            mtime: stats.mtime
          });
        }
      } catch (error) {
        // Skip inaccessible files
      }
    }

    if (foundLogs.length === 0) {
      return { found: false };
    }

    // Sort by modification time to show chronological order
    foundLogs.sort((a, b) => a.mtime - b.mtime);

    // Create aggregated content with source markers
    let aggregatedContent = '';
    aggregatedContent += `=== Session ${sessionId} - Aggregated Logs ===\n`;
    aggregatedContent += `Found ${foundLogs.length} log sources\n\n`;

    for (const log of foundLogs) {
      aggregatedContent += `--- ${log.source} (${log.path}) ---\n`;
      aggregatedContent += `Modified: ${log.mtime.toLocaleString()}\n`;
      aggregatedContent += `Size: ${Math.round(log.size / 1024)}KB\n\n`;
      aggregatedContent += log.content;
      aggregatedContent += '\n\n';
    }

    return {
      found: true,
      path: foundLogs[0].path, // Primary path for tailing
      source: `Aggregated (${foundLogs.length} sources)`,
      type: 'aggregated',
      content: aggregatedContent,
      sources: foundLogs
    };
  }

  /**
   * Start tailing logs with smart path resolution
   */
  async startTailing() {
    // Use smart log path resolution for tailing
    this.tailInterval = setInterval(async () => {
      if (!this.visible) {return;}

      try {
        const session = await this.sessionDb.getSession(this.sessionId);
        if (!session) {return;}

        // Use smart path resolution to find current log location
        let currentContent = '';
        let logPath = this.currentLogPath;

        // If we have a current log path, try it first
        if (logPath) {
          try {
            currentContent = await fs.readFile(logPath, 'utf8');
          } catch (error) {
            // Primary path failed, try smart resolution
            const logData = await this.findSessionLogs(session.id);
            if (logData.found) {
              logPath = logData.path;
              currentContent = logData.content;
              this.currentLogPath = logPath;
              this.logSource = logData.source;
            }
          }
        } else {
          // No current path, use smart resolution
          const logData = await this.findSessionLogs(session.id);
          if (logData.found) {
            logPath = logData.path;
            currentContent = logData.content;
            this.currentLogPath = logPath;
            this.logSource = logData.source;
          }
        }

        // Force refresh if content has changed or if we have content but showing placeholder
        if (currentContent.length !== this.logContent.length ||
            (currentContent.trim().length > 0 && this.logBox.getContent().includes('Waiting for logs'))) {
          this.logContent = currentContent;
          this.displayLogs();

          // Update title with current log source
          if (this.logSource) {
            this.title.setContent(`{center}Session Logs - ${this.logSource}{/center}`);
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
      if (line.trim().length > 0) {
        this.logBox.pushLine(this.formatLogLine(line));
      }
    });

    // If no visible lines, show placeholder
    if (lines.filter(l => l.trim().length > 0).length === 0) {
      this.logBox.pushLine('{gray-fg}Log file is empty...{/}');
    }

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
    if (!str) {return '';}
    if (str.length <= length) {return str;}
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

  /**
   * Enhanced vim-style navigation methods
   */
  goToTop() {
    this.logBox.setScrollPerc(0);
  }

  goToBottom() {
    this.logBox.setScrollPerc(100);
  }

  goToMiddle() {
    // Go to middle of content (what M should do)
    this.logBox.setScrollPerc(50);
  }

  goToViewTop() {
    // Already at view top if no scrolling implemented differently
    // For log viewer, this is same as current position
  }

  goToViewMiddle() {
    this.logBox.setScrollPerc(50);
  }

  goToViewBottom() {
    this.logBox.setScrollPerc(100);
  }

  halfPageUp() {
    const halfPage = Math.floor((this.logBox.height - 2) / 2);
    this.logBox.scroll(-halfPage);
  }

  halfPageDown() {
    const halfPage = Math.floor((this.logBox.height - 2) / 2);
    this.logBox.scroll(halfPage);
  }

  /**
   * Search functionality for logs
   */
  search(searchTerm, direction = 'forward') {
    if (!searchTerm) {return;}

    this.currentSearchTerm = searchTerm.toLowerCase();
    this.searchDirection = direction;
    this.searchResults = [];

    const content = this.logContent || '';
    const lines = content.split('\n');

    // Find all matching line numbers
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(this.currentSearchTerm)) {
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

    const lineNumber = this.searchResults[this.currentSearchIndex];
    const totalLines = (this.logContent || '').split('\n').length;
    const scrollPerc = totalLines > 0 ? (lineNumber / totalLines) * 100 : 0;

    this.logBox.setScrollPerc(Math.min(100, Math.max(0, scrollPerc)));

    // Show search status
    const current = this.currentSearchIndex + 1;
    const total = this.searchResults.length;
    this.manager.showMessage(`Result ${current}/${total}: ${this.currentSearchTerm} (line ${lineNumber + 1})`, 'info');
  }
}

module.exports = LogsView;
