#!/usr/bin/env node
/**
 * Calmhive TUI Manager
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

    // Vim navigation state
    this.pendingGCommand = false;
    this.lastGPress = 0;

    // Modal state tracking
    this.activeModals = new Set();
  }

  /**
   * Check if any modal/dialog is active
   */
  hasActiveModal() {
    return this.activeModals.size > 0;
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
      title: 'Calmhive Process Manager',
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

    // Note: Key handling is done in setupKeyHandlers(), not here
    // to avoid conflicts with component-specific handlers
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
      content: 'Commands: n:New  s:Stop  r:Resume  l:Logs  c:Cleanup  q:Quit',
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
    this.screen.key(['q'], () => {
      if (this.currentView === 'sessionList') {
        // Quit from main view
        this.cleanup();
        process.exit(0);
      } else {
        // Go back to session list from other views
        this.switchView('sessionList');
      }
    });

    this.screen.key(['C-c'], () => {
      this.cleanup();
      process.exit(0);
    });

    // Remove the double-escape handler that was causing conflicts

    // Store the main escape handler for restoration after forms
    this.originalEscapeHandler = () => {
      // If modal is active, don't handle escape here - let modal handle it
      if (this.hasActiveModal()) {
        return;
      }

      // Always try to go back to session list from any view
      if (this.currentView !== 'sessionList') {
        this.switchView('sessionList');
      }
      // Note: Don't quit on escape from sessionList - that's what 'q' is for
    };

    this.screen.key(['escape'], this.originalEscapeHandler);

    // View-specific keys
    this.screen.key(['n'], () => {
      // Don't handle if modal is active
      if (this.hasActiveModal()) {
        return;
      }

      if (this.currentView === 'sessionList') {
        this.createNewSession();
      } else {
        // For other views, 'n' is next search result
        if (this.views[this.currentView] && this.views[this.currentView].nextSearchResult) {
          this.views[this.currentView].nextSearchResult();
          this.render();
        }
      }
    });

    this.screen.key(['s'], () => {
      // Don't handle if modal is active
      if (this.hasActiveModal()) {
        return;
      }

      if (this.currentView === 'sessionList') {
        this.stopSelectedSession();
      } else if (this.currentView === 'sessionDetail') {
        // Stop the session from detail view
        const session = this.views.sessionDetail.session;
        if (session && session.status === 'running') {
          this.stopSession(session);
        }
      }
    });

    this.screen.key(['r'], () => {
      // Don't handle if modal is active
      if (this.hasActiveModal()) {
        return;
      }

      if (this.currentView === 'sessionList') {
        this.resumeSelectedSession();
      }
    });

    this.screen.key(['l'], () => {
      // Don't handle if modal is active
      if (this.hasActiveModal()) {
        return;
      }

      if (this.currentView === 'sessionList') {
        this.showSessionLogs();
      } else if (this.currentView === 'sessionDetail') {
        // Get the session from the detail view
        const session = this.views.sessionDetail.session;
        if (session) {
          this.switchView('logs', { sessionId: session.id });
        }
      }
    });

    this.backgroundEnterHandler = () => {
      // Only trigger sessionList actions if no modal/dialog is active
      if (this.currentView === 'sessionList' && !this.hasActiveModal()) {
        this.showSessionDetail();
      }
    };
    this.screen.key(['enter'], this.backgroundEnterHandler);

    this.screen.key(['c'], () => {
      // Don't handle if modal is active
      if (this.hasActiveModal()) {
        return;
      }

      if (this.currentView === 'sessionList') {
        this.cleanupCompletedSessions();
      }
    });

    this.screen.key(['o'], () => {
      // Don't handle if modal is active
      if (this.hasActiveModal()) {
        return;
      }

      if (this.currentView === 'sessionList') {
        this.killOrphanProcesses();
      }
    });

    // Navigation keys
    this.screen.key(['up', 'k'], () => {
      if (this.hasActiveModal()) {return;}
      if (this.views[this.currentView] && this.views[this.currentView].navigateUp) {
        this.views[this.currentView].navigateUp();
        this.render();
      }
    });

    this.screen.key(['down', 'j'], () => {
      if (this.hasActiveModal()) {return;}
      if (this.views[this.currentView] && this.views[this.currentView].navigateDown) {
        this.views[this.currentView].navigateDown();
        this.render();
      }
    });

    this.screen.key(['pageup'], () => {
      if (this.hasActiveModal()) {return;}
      if (this.views[this.currentView] && this.views[this.currentView].pageUp) {
        this.views[this.currentView].pageUp();
        this.render();
      }
    });

    this.screen.key(['pagedown'], () => {
      if (this.hasActiveModal()) {return;}
      if (this.views[this.currentView] && this.views[this.currentView].pageDown) {
        this.views[this.currentView].pageDown();
        this.render();
      }
    });

    // Enhanced vim-style navigation - gg for go to top
    this.screen.key(['g'], () => {
      if (this.hasActiveModal()) {return;}
      if (this.pendingGCommand && Date.now() - this.lastGPress < 1000) {
        // Second 'g' press - go to top
        if (this.views[this.currentView] && this.views[this.currentView].goToTop) {
          this.views[this.currentView].goToTop();
          this.render();
        }
        this.pendingGCommand = false;
      } else {
        // First 'g' press - set up double-g detection
        this.lastGPress = Date.now();
        this.pendingGCommand = true;
        setTimeout(() => {
          this.pendingGCommand = false;
        }, 1000);
      }
    });

    // Manual uppercase key handling (blessed.js doesn't support uppercase letters in .key())
    this.screen.on('keypress', (ch, key) => {
      if (this.hasActiveModal()) {return;}

      // Handle uppercase letters that blessed.js can't bind directly
      if (key.name === 'g' && key.shift) {
        // Shift+G = go to bottom
        if (this.views[this.currentView] && this.views[this.currentView].goToBottom) {
          this.views[this.currentView].goToBottom();
          this.render();
        }
      } else if (key.name === 'h' && key.shift) {
        // Shift+H = go to view top
        if (this.views[this.currentView] && this.views[this.currentView].goToViewTop) {
          this.views[this.currentView].goToViewTop();
          this.render();
        }
      } else if (key.name === 'm' && key.shift) {
        // Shift+M = go to middle item (not view middle)
        if (this.views[this.currentView] && this.views[this.currentView].goToMiddle) {
          this.views[this.currentView].goToMiddle();
          this.render();
        }
      }
    });

    // L - go to low (bottom of current view) - CONFLICT: L also used for logs!
    // Use different key for this to avoid conflict
    this.screen.key(['S-l'], () => {
      if (this.hasActiveModal()) {return;}
      if (this.views[this.currentView] && this.views[this.currentView].goToViewBottom) {
        this.views[this.currentView].goToViewBottom();
        this.render();
      }
    });

    // Half-page navigation
    this.screen.key(['C-u'], () => {
      if (this.hasActiveModal()) {return;}
      if (this.views[this.currentView] && this.views[this.currentView].halfPageUp) {
        this.views[this.currentView].halfPageUp();
        this.render();
      }
    });

    this.screen.key(['C-d'], () => {
      if (this.hasActiveModal()) {return;}
      if (this.views[this.currentView] && this.views[this.currentView].halfPageDown) {
        this.views[this.currentView].halfPageDown();
        this.render();
      }
    });

    // Search functionality - / for forward search
    this.screen.key(['/'], () => {
      this.startSearch('forward');
    });

    // ? for backward search
    this.screen.key(['?'], () => {
      this.startSearch('backward');
    });


    // N - previous search result
    this.screen.key(['N'], () => {
      if (this.currentView !== 'sessionList') {
        this.views[this.currentView].previousSearchResult();
        this.render();
      }
    });

    // Let individual forms and elements handle Tab navigation
    // No screen-level Tab handler to avoid conflicts
  }

  /**
   * Start search functionality
   */
  startSearch(direction = 'forward') {
    const searchForm = blessed.form({
      parent: this.screen,
      keys: true,
      left: 'center',
      top: 'center',
      width: 60,
      height: 5,
      bg: 'black',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'yellow'
        }
      }
    });

    const searchInput = blessed.textbox({
      parent: searchForm,
      name: 'searchTerm',
      top: 1,
      left: 2,
      width: '100%-4',
      height: 1,
      inputOnFocus: true,
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    const prompt = direction === 'forward' ? '/' : '?';
    searchInput.setValue(prompt);

    searchInput.key(['enter'], () => {
      const searchTerm = searchInput.getValue().substring(1); // Remove prompt character
      if (searchTerm.trim()) {
        this.views[this.currentView].search(searchTerm, direction);
      }
      searchForm.destroy();
      this.render();
    });

    searchInput.key(['escape'], () => {
      searchForm.destroy();
      this.render();
    });

    searchInput.focus();
    this.render();
  }

  /**
   * Switch between views
   */
  switchView(viewName, data = null) {
    try {
      // Debug logging
      console.error(`[TUI DEBUG] Switching from ${this.currentView} to ${viewName}`);
      
      // Validate view exists
      if (!this.views[viewName]) {
        console.error(`[TUI ERROR] View '${viewName}' does not exist!`);
        this.showMessage(`Error: View '${viewName}' not found`, 'error');
        return;
      }
      
      // Hide current view
      if (this.views[this.currentView] && this.views[this.currentView].hide) {
        this.views[this.currentView].hide();
      }

      // Show new view
      this.currentView = viewName;
      
      // Call show with error handling
      if (this.views[this.currentView] && this.views[this.currentView].show) {
        const showResult = this.views[this.currentView].show(data);
        
        // Handle promise if returned
        if (showResult && showResult.then) {
          showResult.catch(error => {
            console.error(`[TUI ERROR] Error showing view ${viewName}:`, error);
            this.showMessage(`Error: ${error.message}`, 'error');
          });
        }
      } else {
        console.error(`[TUI ERROR] View '${viewName}' has no show method!`);
      }

      // Update footer based on view
      this.updateFooter();

      // Ensure proper focus on the new view with immediate render
      setTimeout(() => {
        try {
          if (this.views[this.currentView] && this.views[this.currentView].listTable) {
            this.views[this.currentView].listTable.focus();
          } else if (this.views[this.currentView] && this.views[this.currentView].logBox) {
            // For log viewer, focus on logBox
            this.views[this.currentView].logBox.focus();
          }
          this.render(true); // Immediate render for view switches
        } catch (error) {
          console.error(`[TUI ERROR] Error during focus:`, error);
        }
      }, 10);
    } catch (error) {
      console.error(`[TUI ERROR] Fatal error in switchView:`, error);
      this.showMessage(`Fatal error: ${error.message}`, 'error');
    }
  }

  /**
   * Update footer content based on current view
   */
  updateFooter() {
    const footerContent = {
      sessionList: 'Nav: ↑↓jk gg/G H/M Ctrl+u/d /? n/N | Commands: n:New s:Stop l:Logs c:Cleanup o:Orphans q:Quit',
      sessionDetail: 'Nav: ↑↓jk gg/G H/M Ctrl+u/d /? | Commands: ESC:Back s:Stop l:Logs q:Quit',
      logs: 'Nav: ↑↓jk gg/G H/M Ctrl+u/d /? n/N | Commands: ESC:Back q:Quit'
    };

    this.footer.setContent(footerContent[this.currentView] || 'Press ESC to go back, q to quit');
  }

  /**
   * Create a new session
   */
  async createNewSession() {
    // Track that form is active
    this.activeModals.add('newSessionForm');

    // Create input form with iterations field
    const form = blessed.form({
      parent: this.screen,
      keys: true,
      focusable: true,
      left: 'center',
      top: 'center',
      width: '80%',
      height: 15,
      bg: 'black',
      content: 'Create New AFk Session',
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

    const iterationsLabel = blessed.text({
      parent: form,
      top: 6,
      left: 2,
      content: 'Iterations (default: 10):'
    });

    const iterationsInput = blessed.textbox({
      parent: form,
      name: 'iterations',
      top: 7,
      left: 2,
      width: 20,
      height: 3,
      inputOnFocus: true,
      value: '10',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          fg: 'black',
          bg: 'white'
        },
        border: {
          fg: 'cyan'
        }
      }
    });

    const iterationsHelp = blessed.text({
      parent: form,
      top: 10,
      left: 2,
      width: '100%-4',
      height: 1,
      content: 'Range: 1-69 (recommended: 5-15 for most tasks)',
      style: {
        fg: 'yellow'
      }
    });

    const submit = blessed.button({
      parent: form,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 2,
        right: 2
      },
      left: '25%',
      top: 12,
      content: 'Start AFk Session',
      style: {
        focus: {
          bg: 'green',
          fg: 'white'
        },
        bg: 'black',
        fg: 'white'
      }
    });

    const cancel = blessed.button({
      parent: form,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 2,
        right: 2
      },
      right: '25%',
      top: 12,
      content: 'Cancel',
      style: {
        focus: {
          bg: 'red',
          fg: 'white'
        },
        bg: 'black',
        fg: 'white'
      }
    });

    const formHelp = blessed.text({
      parent: form,
      top: 14,
      left: 2,
      width: '100%-4',
      height: 1,
      content: '{center}Tab/Shift+Tab to navigate, Enter to submit, Escape to cancel{/center}',
      tags: true,
      style: {
        fg: 'green'
      }
    });

    let submitting = false;

    submit.on('press', async () => {
      if (submitting) {return;} // Prevent double submission
      submitting = true;

      const task = taskInput.getValue().trim();
      const iterations = parseInt(iterationsInput.getValue().trim()) || 10;

      if (task) {
        // Validate iterations
        if (iterations < 1 || iterations > 69) {
          this.showMessage('Iterations must be between 1 and 69', 'error');
          submitting = false;
          return;
        }

        try {
          // Start AFk session using correct path
          const { spawn } = require('child_process');
          const afkPath = require('path').join(__dirname, '../../cmd/afk');

          spawn('node', [afkPath, task, '--iterations', iterations.toString()], {
            detached: true,
            stdio: 'ignore'
          });

          this.showMessage(`AFk session started with ${iterations} iterations!`, 'success');

          // Close form immediately after starting session
          submitting = false;
          cleanupHandlers();
          form.destroy();
          this.render();

          // Refresh after a short delay to allow session to start
          setTimeout(async () => {
            await this.refreshSessions();
            // Ensure we're back to session list and properly focused
            if (this.currentView === 'sessionList' && this.views.sessionList && this.views.sessionList.listTable) {
              this.views.sessionList.listTable.focus();
              this.render();
            }
          }, 1000);

        } catch (error) {
          this.showMessage(`Failed to start session: ${error.message}`, 'error');
          submitting = false;
        }
      } else {
        this.showMessage('Please enter a task description', 'error');
        submitting = false;
      }
    });

    cancel.on('press', () => {
      cleanupHandlers();
      form.destroy();
      this.render();
    });

    // Individual element Enter key handling
    taskInput.key(['enter'], () => {
      iterationsInput.focus();
      this.render();
    });

    iterationsInput.key(['enter'], () => {
      if (!submitting) {
        submit.emit('press');
      }
    });

    // Store original handlers
    this.originalNHandler = () => {
      if (this.currentView === 'sessionList') {
        this.createNewSession();
      } else {
        if (this.views[this.currentView] && this.views[this.currentView].nextSearchResult) {
          this.views[this.currentView].nextSearchResult();
          this.render();
        }
      }
    };

    // Store the ACTUAL original quit handler (conditional behavior)
    this.originalQuitHandler = () => {
      if (this.currentView === 'sessionList') {
        // Quit from main view
        this.cleanup();
        process.exit(0);
      } else {
        // Go back to session list from other views
        this.switchView('sessionList');
      }
    };

    // Remove original handlers that might conflict
    this.screen.unkey(['n'], this.originalNHandler);
    this.screen.unkey(['q', 'C-c'], this.originalQuitHandler);

    // Clean up screen handlers when form is closed
    const cleanupHandlers = () => {
      this.screen.unkey(['tab']);
      this.screen.unkey(['S-tab']);
      this.screen.unkey(['escape']);
      // Restore ALL original handlers including escape
      this.screen.key(['n'], this.originalNHandler);
      this.screen.key(['escape'], this.originalEscapeHandler);
      this.screen.key(['q', 'C-c'], this.originalQuitHandler);
      this.activeModals.delete('newSessionForm');

      // console.log('[TUI] Form cleanup complete - all handlers restored');

      // Explicitly restore main navigation focus and ensure proper state
      setTimeout(() => {
        if (this.currentView === 'sessionList' && this.views.sessionList && this.views.sessionList.listTable) {
          this.views.sessionList.listTable.focus();
          this.forceRefresh(); // Force complete redraw after form cleanup
        }
      }, 10);
    };

    // Screen-level handlers while form is active
    this.screen.key(['escape'], (ch, key) => {
      cancel.emit('press');
    });

    this.screen.key(['tab'], (ch, key) => {
      if (taskInput.focused) {
        iterationsInput.focus();
      } else if (iterationsInput.focused) {
        submit.focus();
      } else if (submit.focused) {
        cancel.focus();
      } else {
        taskInput.focus();
      }
      this.screen.render();
    });

    this.screen.key(['S-tab'], (ch, key) => {
      if (taskInput.focused) {
        cancel.focus();
      } else if (iterationsInput.focused) {
        taskInput.focus();
      } else if (submit.focused) {
        iterationsInput.focus();
      } else {
        submit.focus();
      }
      this.screen.render();
    });

    // Focus the form and task input
    form.focus();
    taskInput.focus();
    this.render();
  }

  /**
   * Stop selected session with confirmation
   */
  async stopSelectedSession() {
    try {
      const selectedSession = this.views.sessionList.getSelectedSession();
      if (!selectedSession || !selectedSession.id) {
        this.showMessage('No valid session selected to stop', 'warning');
        return;
      }

      if (selectedSession.status !== 'running') {
        this.showMessage(`Session ${selectedSession.id} is not running (status: ${selectedSession.status})`, 'info');
        return;
      }

      // Show confirmation dialog before stopping
      const task = selectedSession.task || 'No task description';
      const taskDisplay = task.length > 60 ? task.substring(0, 60) + '...' : task;

      const sessionInfo = `Task: ${taskDisplay}
Duration: ${this.formatDuration(selectedSession)}
Progress: ${this.formatProgress(selectedSession)}`;

      this.createConfirmDialog(
        `⚠️  Stop Running Session: ${selectedSession.id.substring(0, 12)}`,
        sessionInfo,
        async () => {
          await this.stopSession(selectedSession);
        }
      );
    } catch (error) {
      console.error('Stop session error:', error);
      this.showMessage(`Error stopping session: ${error.message}`, 'error');
    }
  }

  /**
   * Resume selected session with confirmation
   */
  async resumeSelectedSession() {
    try {
      const selectedSession = this.views.sessionList.getSelectedSession();
      if (!selectedSession || !selectedSession.id) {
        this.showMessage('No valid session selected to resume', 'warning');
        return;
      }

      if (selectedSession.status === 'running') {
        this.showMessage(`Session ${selectedSession.id} is already running`, 'info');
        return;
      }

      if (!['failed', 'error', 'stopped', 'completed'].includes(selectedSession.status)) {
        this.showMessage(`Session ${selectedSession.id} cannot be resumed (status: ${selectedSession.status})`, 'warning');
        return;
      }

      // Check if session is too old (> 24 hours)
      const ageHours = (Date.now() - selectedSession.updated_at) / (1000 * 60 * 60);
      if (ageHours > 24) {
        this.showMessage(`Session is too old to resume (${Math.round(ageHours)} hours old)`, 'warning');
        return;
      }

      // Show confirmation dialog before resuming
      const task = selectedSession.task || 'No task description';
      const taskDisplay = task.length > 60 ? task.substring(0, 60) + '...' : task;

      const sessionInfo = `Task: ${taskDisplay}
Status: ${selectedSession.status}
Age: ${Math.round(ageHours * 10) / 10} hours
Progress: ${this.formatProgress(selectedSession)}`;

      this.createConfirmDialog(
        `🔄 Resume Session: ${selectedSession.id.substring(0, 12)}`,
        sessionInfo,
        async () => {
          await this.resumeSession(selectedSession);
        }
      );
    } catch (error) {
      console.error('Resume session error:', error);
      this.showMessage(`Error resuming session: ${error.message}`, 'error');
    }
  }

  /**
   * Resume a specific session
   */
  async resumeSession(session) {
    try {
      this.showMessage(`🔄 Starting resume for session ${session.id.substring(0, 12)}...`, 'info');

      // Create resume task description
      const resumeTask = `[RESUME from iteration ${session.iterations_completed || 0}] ${session.task}`;
      const resumeIterations = Math.max(1, (session.iterations_planned || 5) - (session.iterations_completed || 0));

      // Start new session with resume context
      const metadata = {
        resumed_from: session.id,
        original_task: session.task,
        resume_iteration: (session.iterations_completed || 0) + 1
      };

      const newSession = await this.processManager.startAfkSession(
        resumeTask,
        {
          iterations: resumeIterations,
          background: true,
          metadata
        }
      );

      const newSessionId = newSession.id;

      this.showMessage(`✅ Resume session started: ${newSessionId.substring(0, 12)}`, 'success');

      // Refresh the session list to show the new session
      await this.refreshSessions();

    } catch (error) {
      console.error('Resume error:', error);
      this.showMessage(`❌ Resume failed: ${error.message}`, 'error');
    }
  }

  /**
   * Stop a specific session
   */
  async stopSession(session) {
    if (!session || session.status !== 'running') {return;}

    try {
      await this.processManager.stopSession(session.id);
      await this.refreshSessions();
      // Refresh detail view if visible
      if (this.currentView === 'sessionDetail') {
        await this.views.sessionDetail.updateDetails();
      }
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
    if (!selectedSession || !selectedSession.id) {
      this.showMessage('No valid session selected for log viewing', 'warning');
      return;
    }

    this.switchView('logs', { sessionId: selectedSession.id });
  }

  /**
   * Show session detail
   */
  showSessionDetail() {
    const selectedSession = this.views.sessionList.getSelectedSession();
    if (!selectedSession || !selectedSession.id) {
      this.showMessage('No valid session selected for detail view', 'warning');
      return;
    }

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
      const running = sessions.filter(s => s.status === 'running');

      if (completed.length === 0) {
        this.showMessage('No completed sessions to clean up', 'info');
        return;
      }

      // Safety check - confirm what we're about to delete
      const message = `Delete ${completed.length} completed sessions? (${running.length} running sessions will be preserved)`;

      // Create confirmation dialog
      const confirmDialog = this.createConfirmDialog(
        'Confirm Cleanup',
        message,
        async () => {
          // Properly stop and delete each session
          let deleted = 0;
          let errors = [];

          this.showMessage(`Starting cleanup of ${completed.length} sessions...`, 'info');

          for (const session of completed) {
            try {
              // If session has running status, stop it first
              if (session.status === 'running') {
                await this.processManager.stopSession(session.id);
              }
              // Then delete from database
              const result = await this.sessionDb.deleteSession(session.id);
              if (result) {
                deleted++;
              } else {
                errors.push(`Session ${session.id} not found in database`);
              }
            } catch (err) {
              errors.push(`Session ${session.id}: ${err.message}`);
            }
          }

          // Show any errors
          if (errors.length > 0) {
            this.showMessage(`Cleanup errors: ${errors.join(', ')}`, 'error');
          }

          await this.refreshSessions();
          this.showMessage(`Cleaned up ${deleted} of ${completed.length} sessions (${running.length} running sessions preserved)`, 'success');

          // Ensure we're back to session list view and restore focus properly
          if (this.currentView === 'sessionList') {
            // Give a small delay to ensure view is fully refreshed
            setTimeout(() => {
              if (this.views.sessionList && this.views.sessionList.listTable) {
                this.views.sessionList.listTable.focus();
                this.render();
              }
            }, 50);
          }
        }
      );

    } catch (error) {
      console.error('Cleanup error:', error);
      this.showMessage(`Cleanup failed: ${error.message}`, 'error');
    }
  }

  /**
   * Create a confirmation dialog
   */
  createConfirmDialog(title, message, onConfirm) {
    // Track that dialog is active
    this.activeModals.add('confirmDialog');

    // Store current handlers with defensive array handling
    const keypressEvents = this.screen._events.keypress;
    const currentEscapeHandler = [];
    if (keypressEvents) {
      if (Array.isArray(keypressEvents)) {
        currentEscapeHandler.push(...keypressEvents.filter(h => h.toString().includes('escape')));
      } else if (typeof keypressEvents === 'function' && keypressEvents.toString().includes('escape')) {
        currentEscapeHandler.push(keypressEvents);
      }
    }

    const dialog = blessed.box({
      parent: this.screen,
      keys: true,
      left: 'center',
      top: 'center',
      width: '60%',
      height: 9,
      bg: 'black',
      content: title,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'red'
        }
      }
    });

    const messageText = blessed.text({
      parent: dialog,
      top: 1,
      left: 2,
      width: '100%-4',
      height: 3,
      content: message,
      style: {
        fg: 'white'
      }
    });

    const instructionText = blessed.text({
      parent: dialog,
      top: 4,
      left: 2,
      width: '100%-4',
      height: 1,
      content: '{center}Tab/Shift+Tab to navigate, Enter to select, Escape to cancel{/center}',
      tags: true,
      style: {
        fg: 'yellow'
      }
    });

    const yesBtn = blessed.button({
      parent: dialog,
      mouse: true,
      keys: true,
      shrink: true,
      padding: { left: 1, right: 1 },
      left: '25%',
      bottom: 1,
      content: 'Yes',
      style: {
        focus: { bg: 'red', fg: 'white' },
        bg: 'black',
        fg: 'white'
      }
    });

    const noBtn = blessed.button({
      parent: dialog,
      mouse: true,
      keys: true,
      shrink: true,
      padding: { left: 1, right: 1 },
      right: '25%',
      bottom: 1,
      content: 'No',
      style: {
        focus: { bg: 'green', fg: 'white' },
        bg: 'black',
        fg: 'white'
      }
    });

    const confirmAction = async () => {
      this.activeModals.delete('confirmDialog');
      dialog.destroy();
      this.render();

      // Restore original escape handler
      this.screen.unkey(['escape']);
      this.screen.key(['escape'], this.originalEscapeHandler);

      // Execute the confirm action first
      try {
        await onConfirm();

        // After action completes, ensure proper focus restoration
        setTimeout(() => {
          if (this.views[this.currentView] && this.views[this.currentView].listTable) {
            this.views[this.currentView].listTable.focus();
            this.render();
          }
        }, 100);
      } catch (error) {
        this.showMessage(`Action failed: ${error.message}`, 'error');
        // Restore focus even on error
        setTimeout(() => {
          if (this.views[this.currentView] && this.views[this.currentView].listTable) {
            this.views[this.currentView].listTable.focus();
            this.render();
          }
        }, 100);
      }
    };

    const cancelAction = () => {
      this.activeModals.delete('confirmDialog');
      dialog.destroy();

      // Restore original escape handler
      this.screen.unkey(['escape']);
      this.screen.key(['escape'], this.originalEscapeHandler);

      // Restore focus to current view
      if (this.views[this.currentView] && this.views[this.currentView].listTable) {
        this.views[this.currentView].listTable.focus();
      }
      this.render();
    };

    // Button press handlers
    yesBtn.on('press', () => {
      confirmAction();
    });

    noBtn.on('press', () => {
      cancelAction();
    });

    // Mouse click handlers as backup
    yesBtn.on('click', () => {
      confirmAction();
    });

    noBtn.on('click', () => {
      cancelAction();
    });

    // Simple key handlers on dialog
    dialog.key(['enter'], () => {
      if (yesBtn.focused) {
        confirmAction();
      } else {
        cancelAction();
      }
    });

    dialog.key(['tab'], () => {
      if (yesBtn.focused) {
        noBtn.focus();
      } else {
        yesBtn.focus();
      }
      this.screen.render();
    });

    dialog.key(['escape', 'q'], () => {
      cancelAction();
    });

    dialog.key(['y', 'Y'], () => {
      confirmAction();
    });

    dialog.key(['n', 'N'], () => {
      cancelAction();
    });

    // Setup screen-level escape handler for dialog
    this.screen.unkey(['escape'], this.originalEscapeHandler);
    this.screen.key(['escape'], () => {
      cancelAction();
    });

    // Focus yes button by default for cleanup confirmation
    yesBtn.focus();
    this.render();

    return dialog;
  }

  /**
   * Kill orphan Claude processes
   */
  async killOrphanProcesses() {
    try {
      this.showMessage('🔍 Scanning for orphan Claude processes...', 'info');
      const result = await this.processManager.killOrphanProcesses();

      if (result.killed > 0) {
        this.showMessage(`🧹 Killed ${result.killed} orphan processes: ${result.pids.join(', ')}`, 'success');
      } else {
        this.showMessage('✨ No orphan Claude processes found', 'info');
      }

      // Refresh the view
      await this.refreshSessions();
    } catch (error) {
      console.error('Orphan cleanup error:', error);
      this.showMessage(`❌ Orphan cleanup failed: ${error.message}`, 'error');
    }
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

      if (isNaN(duration) || duration < 0) {return 'Invalid';}
      if (duration < 60) {return `${duration}s`;}
      if (duration < 3600) {return `${Math.floor(duration / 60)}m ${duration % 60}s`;}
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
    if (this.refreshInProgress) {return;}

    // Throttle refreshes to prevent overwhelming the system
    const now = Date.now();
    if (now - this.lastRefreshTime < 500) {return;} // Min 500ms between refreshes

    if (this.currentView === 'sessionList') {
      this.refreshInProgress = true;
      try {
        await this.views.sessionList.refresh();
        this.render(true); // Immediate render for data updates
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
   * Render the screen with optional immediate mode
   */
  render(immediate = false) {
    if (immediate) {
      // Immediate render for critical updates with full redraw
      this.screen.clearRegion(0, this.screen.width, 0, this.screen.height);
      this.screen.render();
      return;
    }

    // Debounce renders for non-critical updates
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
    }

    this._renderTimeout = setTimeout(() => {
      this.screen.render();
      this._renderTimeout = null;
    }, 16); // ~60fps max
  }

  /**
   * Force complete screen refresh
   */
  forceRefresh() {
    this.screen.clearRegion(0, this.screen.width, 0, this.screen.height);
    this.screen.render();
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
