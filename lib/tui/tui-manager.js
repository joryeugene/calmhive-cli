#!/usr/bin/env node
/**
 * Calmhive V3 TUI Manager
 * 
 * Central controller for the Terminal User Interface
 * Manages screens, views, and user interactions
 */

const blessed = require('blessed');
const SessionDatabase = require('../session-database');
const ProcessManager = require('../process-manager');

class TUIManager {
  constructor() {
    this.sessionDb = new SessionDatabase();
    this.processManager = new ProcessManager();
    this.screen = null;
    this.views = {};
    this.currentView = 'sessionList';
    this.refreshInterval = 1000; // 1 second
    this.refreshTimer = null;
    this.lastRefreshTime = 0;
    this.refreshInProgress = false;
  }

  /**
   * Initialize the TUI
   */
  async init() {
    // Clean up stale sessions on startup
    await this.processManager.cleanupStaleSessions();
    
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      title: 'Calmhive V3 Process Manager',
      // Remove cursor configuration to avoid graphics artifacts
      cursor: {
        artificial: false,
        blink: false
      }
    });

    // Set up base layout
    this.setupLayout();

    // Load views
    await this.loadViews();

    // Set up keyboard handlers
    this.setupKeyHandlers();

    // Start refresh cycle
    this.startRefresh();

    // Render initial view
    this.render();

    // Ensure proper key handling
    this.screen.key(['tab'], () => {
      // Tab through focusable elements
      this.screen.focusNext();
      this.render();
    });
  }

  /**
   * Set up the base layout structure
   */
  setupLayout() {
    // Header
    this.header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '🐝 Calmhive V3 Process Manager',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'yellow',
        border: {
          fg: 'yellow'
        }
      }
    });

    // Main content area
    this.contentArea = blessed.box({
      parent: this.screen,
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-6',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });

    // Footer/status bar
    this.footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: 'Commands: n:New  s:Stop  r:Restart  l:Logs  c:Cleanup  q:Quit',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'green',
        border: {
          fg: 'green'
        }
      }
    });
  }

  /**
   * Load all views
   */
  async loadViews() {
    // Import view modules
    const SessionListView = require('./views/session-list');
    const SessionDetailView = require('./views/session-detail');
    const LogsView = require('./views/logs-viewer');

    // Initialize views
    this.views.sessionList = new SessionListView(this.contentArea, this);
    this.views.sessionDetail = new SessionDetailView(this.contentArea, this);
    this.views.logs = new LogsView(this.contentArea, this);

    // Hide all views initially
    Object.values(this.views).forEach(view => view.hide());

    // Show default view
    this.views[this.currentView].show();
  }

  /**
   * Set up keyboard handlers
   */
  setupKeyHandlers() {
    // Global keys
    this.screen.key(['q', 'C-c'], () => {
      this.cleanup();
      process.exit(0);
    });

    this.screen.key(['escape'], () => {
      // Return to session list
      this.switchView('sessionList');
    });

    // View-specific keys
    this.screen.key(['n'], () => {
      if (this.currentView === 'sessionList') {
        this.createNewSession();
      }
    });

    this.screen.key(['s'], () => {
      if (this.currentView === 'sessionList') {
        this.stopSelectedSession();
      }
    });

    this.screen.key(['r'], () => {
      if (this.currentView === 'sessionList') {
        this.restartSelectedSession();
      }
    });

    this.screen.key(['l'], () => {
      if (this.currentView === 'sessionList') {
        this.showSessionLogs();
      }
    });

    this.screen.key(['enter'], () => {
      if (this.currentView === 'sessionList') {
        this.showSessionDetail();
      }
    });

    this.screen.key(['c'], () => {
      // console.log('C key pressed, currentView:', this.currentView);
      if (this.currentView === 'sessionList') {
        // console.log('Calling cleanupCompletedSessions...');
        this.cleanupCompletedSessions();
      }
    });

    // Navigation keys
    this.screen.key(['up', 'k'], () => {
      this.views[this.currentView].navigateUp();
      this.render();
    });

    this.screen.key(['down', 'j'], () => {
      this.views[this.currentView].navigateDown();
      this.render();
    });

    this.screen.key(['pageup'], () => {
      this.views[this.currentView].pageUp();
      this.render();
    });

    this.screen.key(['pagedown'], () => {
      this.views[this.currentView].pageDown();
      this.render();
    });
  }

  /**
   * Switch between views
   */
  switchView(viewName, data = null) {
    // Hide current view
    this.views[this.currentView].hide();

    // Show new view
    this.currentView = viewName;
    this.views[this.currentView].show(data);

    // Update footer based on view
    this.updateFooter();

    this.render();
  }

  /**
   * Update footer content based on current view
   */
  updateFooter() {
    const footerContent = {
      sessionList: 'Commands: n:New  s:Stop  r:Restart  l:Logs  c:Cleanup  q:Quit',
      sessionDetail: 'Commands: ESC:Back  s:Stop  r:Restart  l:Logs  q:Quit',
      logs: 'Commands: ESC:Back  /:Search  g:Top  G:Bottom  q:Quit'
    };

    this.footer.setContent(footerContent[this.currentView] || 'Press ESC to go back, q to quit');
  }

  /**
   * Create a new session
   */
  async createNewSession() {
    // Create input form
    const form = blessed.form({
      parent: this.screen,
      keys: true,
      left: 'center',
      top: 'center',
      width: '80%',
      height: 12,
      bg: 'black',
      content: 'Create New Session',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'yellow'
        }
      }
    });

    const taskLabel = blessed.text({
      parent: form,
      top: 1,
      left: 2,
      content: 'Task Description:'
    });

    const taskInput = blessed.textbox({
      parent: form,
      name: 'task',
      top: 2,
      left: 2,
      width: '100%-4',
      height: 3,
      inputOnFocus: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    const typeLabel = blessed.text({
      parent: form,
      top: 6,
      left: 2,
      content: 'Type (afk/do/fix):'
    });

    const typeInput = blessed.textbox({
      parent: form,
      name: 'type',
      top: 7,
      left: 2,
      width: 20,
      height: 3,
      inputOnFocus: true,
      content: 'afk',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    const submit = blessed.button({
      parent: form,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 1,
        right: 1
      },
      left: '30%',
      bottom: 1,
      content: 'Create',
      style: {
        focus: {
          bg: 'green'
        }
      }
    });

    const cancel = blessed.button({
      parent: form,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 1,
        right: 1
      },
      right: '30%',
      bottom: 1,
      content: 'Cancel',
      style: {
        focus: {
          bg: 'red'
        }
      }
    });

    submit.on('press', async () => {
      const task = taskInput.getValue();
      const type = typeInput.getValue() || 'afk';

      if (task) {
        // Start the session based on type
        const { spawn } = require('child_process');
        const args = ['start', task];
        
        const commandPath = require('path').join(__dirname, '../../commands', type);
        const process = spawn('node', [commandPath, ...args], {
          cwd: process.cwd()
        });

        process.on('exit', () => {
          this.refreshSessions();
        });
      }

      form.destroy();
      this.render();
    });

    cancel.on('press', () => {
      form.destroy();
      this.render();
    });

    // Focus on task input
    taskInput.focus();
    this.render();
  }

  /**
   * Stop selected session
   */
  async stopSelectedSession() {
    const selectedSession = this.views.sessionList.getSelectedSession();
    if (!selectedSession || selectedSession.status !== 'running') return;

    try {
      await this.processManager.stopSession(selectedSession.id);
      await this.refreshSessions();
      this.showMessage('Session stopped successfully', 'success');
    } catch (error) {
      this.showMessage(`Failed to stop session: ${error.message}`, 'error');
    }
  }

  /**
   * Show session logs
   */
  showSessionLogs() {
    const selectedSession = this.views.sessionList.getSelectedSession();
    if (!selectedSession) return;

    this.switchView('logs', { sessionId: selectedSession.id });
  }

  /**
   * Show session detail
   */
  showSessionDetail() {
    const selectedSession = this.views.sessionList.getSelectedSession();
    if (!selectedSession) return;

    this.switchView('sessionDetail', { session: selectedSession });
  }

  /**
   * Clean up completed sessions
   */
  async cleanupCompletedSessions() {
    try {
      const sessions = await this.sessionDb.getAllSessions();
      const completed = sessions.filter(s => 
        s.status === 'completed' || s.status === 'error' || s.status === 'stopped' || s.status === 'failed'
      );

      if (completed.length === 0) {
        this.showMessage('No completed sessions to clean up', 'info');
        return;
      }

      // Delete each session
      let deleted = 0;
      for (const session of completed) {
        try {
          await this.sessionDb.deleteSession(session.id);
          deleted++;
        } catch (err) {
          console.error(`Failed to delete session ${session.id}:`, err);
        }
      }

      await this.refreshSessions();
      this.showMessage(`Cleaned up ${deleted} sessions`, 'success');
    } catch (error) {
      console.error('Cleanup error:', error);
      this.showMessage(`Cleanup failed: ${error.message}`, 'error');
    }
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
      parent: this.screen,
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

    this.render();

    setTimeout(() => {
      message.destroy();
      this.render();
    }, 2000);
  }

  /**
   * Refresh session data with throttling
   */
  async refreshSessions() {
    // Skip if already refreshing
    if (this.refreshInProgress) return;
    
    // Throttle refreshes to prevent overwhelming the system
    const now = Date.now();
    if (now - this.lastRefreshTime < 500) return; // Min 500ms between refreshes
    
    if (this.currentView === 'sessionList') {
      this.refreshInProgress = true;
      try {
        await this.views.sessionList.refresh();
        this.render();
        this.lastRefreshTime = now;
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
      if (this.screen.focused === this.views[this.currentView]?.container) {
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
   * Render the screen with debouncing
   */
  render() {
    // Debounce renders to prevent excessive updates
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
    }
    
    this._renderTimeout = setTimeout(() => {
      this.screen.render();
      this._renderTimeout = null;
    }, 16); // ~60fps max
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopRefresh();
    if (this.sessionDb) {
      this.sessionDb.cleanup();
    }
  }
}

// Export the class
module.exports = TUIManager;