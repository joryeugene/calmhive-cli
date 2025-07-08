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
const TUILogParser = require('../tui-log-parser');

class LogsView {
  constructor(parent, manager) {
    this.parent = parent;
    this.manager = manager;
    this.sessionDb = new SessionDatabase();
    this.logParser = new TUILogParser();
    this.sessionId = null;
    this.visible = false;
    this.tailProcess = null;
    this.logContent = '';
    this.parsedLogData = null;
    this.viewMode = 'summary'; // 'summary' or 'raw'
    this.pathCache = new Map(); // Cache successful log paths
    this.lastModifiedTime = null; // Track file modification time for optimization

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

    // View mode toggle bar
    this.modeBar = blessed.text({
      parent: this.container,
      top: 2,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}[S]ummary | [R]aw | [T]oggle{/center}',
      tags: true,
      style: {
        fg: 'gray'
      }
    });

    // Log viewer with safer tag handling
    this.logBox = blessed.log({
      parent: this.container,
      top: 4,
      left: 0,
      width: '100%',
      height: '100%-4',
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
      tags: true,
      parseTags: true  // Enable for rich formatting
    });

    // Key bindings for view mode toggle
    this.setupKeyBindings();
  }

  /**
   * Setup key bindings for view mode toggling
   */
  setupKeyBindings() {
    this.logBox.key(['s'], () => {
      this.viewMode = 'summary';
      this.refreshDisplay();
    });

    this.logBox.key(['r'], () => {
      this.viewMode = 'raw';
      this.refreshDisplay();
    });

    this.logBox.key(['t'], () => {
      this.viewMode = this.viewMode === 'summary' ? 'raw' : 'summary';
      this.refreshDisplay();
    });
  }

  /**
   * Show the view with session logs
   */
  async show(data) {
    try {
      // Validate components exist
      if (!this.container) {
        throw new Error('LogsView container not initialized');
      }

      if (!this.logBox) {
        throw new Error('LogsView logBox not initialized');
      }

      this.visible = true;
      this.container.show();

      if (data && data.sessionId) {
        this.sessionId = data.sessionId;
        await this.loadSession();
        this.startTailing();
      }

      // Focus with error handling
      if (this.logBox && typeof this.logBox.focus === 'function') {
        this.logBox.focus();
      } else {
        console.error('[LogsView] Warning: logBox.focus not available');
      }
    } catch (error) {
      console.error('[LogsView] Error in show():', error);
      // Try to show error in UI if possible
      if (this.manager && this.manager.showMessage) {
        this.manager.showMessage(`Error loading logs: ${error.message}`, 'error');
      }
      throw error; // Re-throw so TUI manager can handle it
    }
  }

  /**
   * Hide the view
   */
  hide() {
    this.visible = false;
    this.container.hide();
    this.stopTailing();
    // Reset modification time tracking when hiding
    this.lastModifiedTime = null;
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
          // Parse logs for beautiful summaries
          this.parsedLogData = this.logParser.parseLogContent(this.logContent);
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

    // Check if we have a cached path for this session
    if (this.pathCache.has(sessionId)) {
      const cachedPath = this.pathCache.get(sessionId);
      try {
        await fs.access(cachedPath.path);
        const stats = await fs.stat(cachedPath.path);
        if (stats.size > 0) {
          const content = await fs.readFile(cachedPath.path, 'utf8');
          return {
            ...cachedPath,
            content,
            size: stats.size,
            mtime: stats.mtime,
            fromCache: true
          };
        }
      } catch (error) {
        // Cached path no longer valid, remove from cache
        this.pathCache.delete(sessionId);
      }
    }

    // Define all possible log locations in priority order
    const logCandidates = [
      // 1. V3 main logs with AFk prefix (highest priority - current system)
      {
        path: path.join(homeDir, '.claude/calmhive/v3/logs', `afk-${sessionId}.log`),
        source: 'V3 Main Log (AFk)',
        type: 'v3_main_afk'
      },
      // 2. V3 main logs without prefix (fallback for non-AFk sessions)
      {
        path: path.join(homeDir, '.claude/calmhive/v3/logs', `${sessionId}.log`),
        source: 'V3 Main Log',
        type: 'v3_main'
      },
      // 3. AFk worker logs (legacy but may have valuable info)
      {
        path: path.join(homeDir, '.claude/afk_registry', sessionId, 'worker.log'),
        source: 'AFk Worker Log',
        type: 'afk_worker'
      },
      // 4. AFk context monitor (debugging info)
      {
        path: path.join(homeDir, '.claude/afk_registry', sessionId, 'context-monitor.log'),
        source: 'AFk Context Log',
        type: 'afk_context'
      },
      // 5. General logs directory
      {
        path: path.join(homeDir, '.claude/logs', `${sessionId}.log`),
        source: 'General Log',
        type: 'general'
      },
      // 6. Calmhive logs directory
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

          const result = {
            found: true,
            path: candidate.path,
            source: candidate.source,
            type: candidate.type,
            content,
            size: stats.size,
            mtime: stats.mtime
          };

          // Cache the successful path for future lookups
          this.pathCache.set(sessionId, {
            path: candidate.path,
            source: candidate.source,
            type: candidate.type
          });

          return result;
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
        let shouldReadFile = false;

        // If we have a current log path, check if it's been modified
        if (logPath) {
          try {
            const stats = await fs.stat(logPath);

            // Only read file if it has been modified since last check
            if (!this.lastModifiedTime || stats.mtime > this.lastModifiedTime) {
              shouldReadFile = true;
              this.lastModifiedTime = stats.mtime;
            }

            if (shouldReadFile) {
              currentContent = await fs.readFile(logPath, 'utf8');
            }
          } catch (error) {
            // Primary path failed, try smart resolution
            const logData = await this.findSessionLogs(session.id);
            if (logData.found) {
              logPath = logData.path;
              currentContent = logData.content;
              this.currentLogPath = logPath;
              this.logSource = logData.source;
              this.lastModifiedTime = logData.mtime;
              shouldReadFile = true;
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
            this.lastModifiedTime = logData.mtime;
            shouldReadFile = true;
          }
        }

        // Only update display if we read new content
        if (shouldReadFile && (currentContent.length !== this.logContent.length ||
            (currentContent.trim().length > 0 && this.logBox.getContent().includes('Waiting for logs')))) {
          this.logContent = currentContent;

          // Re-parse logs when content changes
          if (this.logContent.trim().length > 0) {
            this.parsedLogData = this.logParser.parseLogContent(this.logContent);
          }

          this.displayLogs();

          // Update title with current log source
          if (this.logSource) {
            this.title.setContent(`{center}Session Logs - ${this.logSource}{/center}`);
          }
        }
      } catch (error) {
        // Log errors during tailing for debugging
        if (process.env.DEBUG) {
          console.error('Tailing error:', error.message);
        }
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
   * Display all logs (summary or raw based on view mode)
   */
  displayLogs() {
    try {
      // Ensure logBox exists and is ready
      if (!this.logBox || typeof this.logBox.setContent !== 'function') {
        console.error('[LogsView] LogBox not ready for content display');
        return;
      }

      // Clear content safely with error handling
      try {
        this.logBox.setContent('');
      } catch (clearError) {
        console.error('[LogsView] Error clearing content:', clearError);
        return;
      }

      if (!this.logContent || typeof this.logContent !== 'string') {
        this.logBox.pushLine('No log content available');
        this.safeRender();
        return;
      }

      // Update mode bar
      const modeText = this.viewMode === 'summary' ?
        '{bold}{green-fg}[S]ummary{/green-fg}{/bold} | [R]aw | [T]oggle' :
        '[S]ummary | {bold}{green-fg}[R]aw{/green-fg}{/bold} | [T]oggle';
      this.modeBar.setContent(`{center}${modeText}{/center}`);

      if (this.viewMode === 'summary' && this.parsedLogData) {
        this.displaySummaryView();
      } else {
        this.displayRawView();
      }

      // Defer scrolling and rendering to avoid blessed widget issues
      this.safeRender();

    } catch (error) {
      console.error('[LogsView] Error in displayLogs:', error);
      // Try to show error in log viewer
      try {
        if (this.logBox && typeof this.logBox.pushLine === 'function') {
          this.logBox.pushLine(`Error loading logs: ${error.message}`);
          this.safeRender();
        }
      } catch (fallbackError) {
        console.error('[LogsView] Fallback error display failed:', fallbackError);
      }
    }
  }

  /**
   * Display beautiful summary view
   */
  displaySummaryView() {
    if (!this.parsedLogData) {
      this.logBox.pushLine('{yellow-fg}Parsing logs...{/yellow-fg}');
      return;
    }

    const formattedSummary = this.logParser.formatForTUI(this.parsedLogData);
    const lines = formattedSummary.split('\n');

    lines.forEach(line => {
      if (line.trim()) {
        this.logBox.pushLine(line);
      }
    });

    // Add detailed iteration views if available
    if (this.parsedLogData.iterations && this.parsedLogData.iterations.length > 0) {
      this.logBox.pushLine('');
      this.logBox.pushLine('{bold}📋 Iteration Details:{/bold}');
      this.logBox.pushLine('');

      this.parsedLogData.iterations.forEach((iteration, index) => {
        this.displayIterationDetails(iteration, index);
      });
    }
  }

  /**
   * Display detailed iteration view
   */
  displayIterationDetails(iteration, index) {
    const { summary } = iteration;

    // Collapsible iteration header
    this.logBox.pushLine(`{bold}${summary.statusEmoji} Iteration ${iteration.number}{/bold} ${summary.progressBar}`);

    // Status and timing info
    if (summary.keyEvents.length > 0) {
      this.logBox.pushLine(`  {gray-fg}Events: ${summary.keyEvents.join(' • ')}{/gray-fg}`);
    }

    // Error details (if any)
    if (iteration.errors.length > 0) {
      this.logBox.pushLine('  {red-fg}Errors:{/red-fg}');
      iteration.errors.forEach(error => {
        this.logBox.pushLine(`    {red-fg}• ${error}{/red-fg}`);
      });
    }

    // Warning details (if any)
    if (iteration.warnings.length > 0) {
      this.logBox.pushLine('  {yellow-fg}Warnings:{/yellow-fg}');
      iteration.warnings.forEach(warning => {
        this.logBox.pushLine(`    {yellow-fg}• ${warning}{/yellow-fg}`);
      });
    }

    // Sample log lines (first 3, last 3)
    if (iteration.logs.length > 6) {
      this.logBox.pushLine('  {gray-fg}First 3 lines:{/gray-fg}');
      iteration.logs.slice(0, 3).forEach(line => {
        this.logBox.pushLine(`    {gray-fg}${this.truncate(line, 100)}{/gray-fg}`);
      });
      this.logBox.pushLine(`    {gray-fg}... (${iteration.logs.length - 6} lines hidden) ...{/gray-fg}`);
      this.logBox.pushLine('  {gray-fg}Last 3 lines:{/gray-fg}');
      iteration.logs.slice(-3).forEach(line => {
        this.logBox.pushLine(`    {gray-fg}${this.truncate(line, 100)}{/gray-fg}`);
      });
    } else {
      iteration.logs.forEach(line => {
        this.logBox.pushLine(`    {gray-fg}${this.truncate(line, 100)}{/gray-fg}`);
      });
    }

    this.logBox.pushLine('');
  }

  /**
   * Display raw log view (original behavior)
   */
  displayRawView() {
    const lines = this.logContent.split('\n');
    let hasContent = false;
    let processedLines = [];

    // Process all lines first to avoid timing issues
    lines.forEach(line => {
      if (line && line.trim().length > 0) {
        try {
          const formattedLine = this.formatLogLine(line);
          if (formattedLine !== null && formattedLine !== undefined) {
            processedLines.push(formattedLine);
            hasContent = true;
          }
        } catch (lineError) {
          // If formatting fails, escape and push raw line
          console.error('[LogsView] Error formatting line:', lineError);
          const safeLine = this.escapeBlessedTags(String(line));
          processedLines.push(safeLine);
          hasContent = true;
        }
      }
    });

    // Add all lines at once to avoid blessed.js timing issues
    if (hasContent) {
      processedLines.forEach(line => {
        try {
          this.logBox.pushLine(line);
        } catch (pushError) {
          console.error('[LogsView] Error pushing line:', pushError);
          // Try with escaped version
          try {
            this.logBox.pushLine(this.escapeBlessedTags(String(line)));
          } catch (escapeError) {
            console.error('[LogsView] Error with escaped line:', escapeError);
          }
        }
      });
    } else {
      this.logBox.pushLine('Log file is empty...');
    }
  }

  /**
   * Refresh display when view mode changes
   */
  refreshDisplay() {
    this.displayLogs();
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
    // Ensure line is a string
    if (line === null || line === undefined) {
      return '';
    }

    line = String(line);

    // For raw view, escape blessed tags for safety
    if (this.viewMode === 'raw') {
      line = this.escapeBlessedTags(line);
    }

    // Add timestamp if not present
    if (!line.match(/^\[\d{4}-\d{2}-\d{2}/)) {
      const timestamp = new Date().toLocaleTimeString();
      line = `[${timestamp}] ${line}`;
    }

    // Use blessed tags for rich formatting in summary mode
    if (this.viewMode === 'summary') {
      if (line.includes('ERROR') || line.includes('FAILED')) {
        return `{red-fg}${line}{/red-fg}`;
      } else if (line.includes('WARNING') || line.includes('WARN')) {
        return `{yellow-fg}${line}{/yellow-fg}`;
      } else if (line.includes('SUCCESS') || line.includes('COMPLETE')) {
        return `{green-fg}${line}{/green-fg}`;
      } else if (line.includes('INFO')) {
        return `{cyan-fg}${line}{/cyan-fg}`;
      } else if (line.includes('DEBUG')) {
        return `{gray-fg}${line}{/gray-fg}`;
      }
    } else {
      // Use ANSI escape codes for raw mode
      if (line.includes('ERROR') || line.includes('FAILED')) {
        return `\u001b[31m${line}\u001b[0m`;  // Red
      } else if (line.includes('WARNING') || line.includes('WARN')) {
        return `\u001b[33m${line}\u001b[0m`;  // Yellow
      } else if (line.includes('SUCCESS') || line.includes('COMPLETE')) {
        return `\u001b[32m${line}\u001b[0m`;  // Green
      } else if (line.includes('INFO')) {
        return `\u001b[36m${line}\u001b[0m`;  // Cyan
      } else if (line.includes('DEBUG')) {
        return `\u001b[90m${line}\u001b[0m`;  // Gray
      }
    }

    return line;
  }

  /**
   * Safely escape blessed tags to prevent parser crashes
   */
  escapeBlessedTags(text) {
    if (typeof text !== 'string') {
      return String(text || '');
    }

    // Only escape when in raw mode or when explicitly needed
    if (this.viewMode === 'raw') {
      return text
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}');
    }

    return text;
  }

  /**
   * Safe rendering with error handling
   */
  safeRender() {
    // Use double setTimeout to ensure blessed.js is ready
    setTimeout(() => {
      try {
        if (this.logBox && typeof this.logBox.setScrollPerc === 'function') {
          this.logBox.setScrollPerc(100);
        }
      } catch (scrollError) {
        console.error('[LogsView] Error during scroll:', scrollError);
      }

      setTimeout(() => {
        try {
          if (this.manager && typeof this.manager.render === 'function') {
            this.manager.render();
          }
        } catch (renderError) {
          console.error('[LogsView] Error during render:', renderError);
        }
      }, 10);
    }, 10);
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
