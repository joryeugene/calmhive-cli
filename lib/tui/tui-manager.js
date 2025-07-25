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
const ViewManager = require('./view-manager');
const EventHandler = require('./event-handler');
const StateManager = require('./state-manager');

class TUIManager {
  constructor() {
    this.sessionDb = new SessionDatabase();
    this.processManager = new ProcessManager();
    this.viewManager = new ViewManager(this);
    this.eventHandler = new EventHandler(this);
    this.stateManager = new StateManager(this);

    // Modal state tracking
    this.activeModals = new Set();

    // Delegate view-related properties to ViewManager for backward compatibility
    this.screen = null; // Will be set after ViewManager initializes
    this.views = {}; // Will be delegated to ViewManager
  }

  /**
   * Backward compatibility getters for ViewManager properties
   */
  get contentArea() {
    return this.viewManager ? this.viewManager.getContentArea() : null;
  }

  get header() {
    return this.viewManager ? this.viewManager.header : null;
  }

  get footer() {
    return this.viewManager ? this.viewManager.footer : null;
  }

  get currentView() {
    return this.viewManager ? this.viewManager.getCurrentView() : 'sessionList';
  }

  set currentView(value) {
    // For backward compatibility, but ViewManager should handle this
    if (this.viewManager) {
      this.viewManager.currentView = value;
    }
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

    // Initialize ViewManager and get screen
    this.screen = this.viewManager.initializeScreen();

    // Load views through ViewManager
    await this.viewManager.loadViews();

    // Set up backward compatibility delegates
    this.views = this.viewManager.getAllViews();
    this.currentView = this.viewManager.getCurrentView();

    // Set up keyboard handlers through EventHandler
    this.eventHandler.initialize(this.screen);

    // Initialize StateManager (starts refresh cycle)
    this.stateManager.initialize();

    // Render initial view
    this.viewManager.render();

    // Note: Key handling is done in setupKeyHandlers(), not here
    // to avoid conflicts with component-specific handlers
  }





  /**
   * Delegate view switching to ViewManager
   */
  switchView(viewName, data = null) {
    this.viewManager.switchView(viewName, data);
    // Update backward compatibility properties
    this.currentView = this.viewManager.getCurrentView();
  }

  /**
   * Delegate footer updates to ViewManager
   */
  updateFooter() {
    this.viewManager.updateFooter();
  }

  /**
   * Create a new session
   */
  async createNewSession() {
    // Track that form is active
    this.eventHandler.addActiveModal('newSessionForm');

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
          this.viewManager.render();

          // Refresh after a short delay to allow session to start
          setTimeout(async () => {
            await this.refreshSessions();
            // Ensure we're back to session list and properly focused
            if (this.currentView === 'sessionList' && this.views.sessionList && this.views.sessionList.listTable) {
              this.views.sessionList.listTable.focus();
              this.viewManager.render();
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
      this.viewManager.render();
    });

    // Individual element Enter key handling
    taskInput.key(['enter'], () => {
      iterationsInput.focus();
      this.viewManager.render();
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
          this.viewManager.render();
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
        this.viewManager.switchView('sessionList');
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
      this.screen.key(['escape'], this.eventHandler.getOriginalEscapeHandler());
      this.screen.key(['q', 'C-c'], this.originalQuitHandler);
      this.eventHandler.removeActiveModal('newSessionForm');

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
    this.viewManager.render();
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

    this.viewManager.switchView('logs', { sessionId: selectedSession.id });
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

    this.viewManager.switchView('sessionDetail', { session: selectedSession });
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
                this.viewManager.render();
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
    this.eventHandler.addActiveModal('confirmDialog');

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
      this.eventHandler.removeActiveModal('confirmDialog');
      dialog.destroy();
      this.viewManager.render();

      // Restore original escape handler
      this.screen.unkey(['escape']);
      this.screen.key(['escape'], this.eventHandler.getOriginalEscapeHandler());

      // Execute the confirm action first
      try {
        await onConfirm();

        // After action completes, ensure proper focus restoration
        setTimeout(() => {
          if (this.views[this.currentView] && this.views[this.currentView].listTable) {
            this.views[this.currentView].listTable.focus();
            this.viewManager.render();
          }
        }, 100);
      } catch (error) {
        this.showMessage(`Action failed: ${error.message}`, 'error');
        // Restore focus even on error
        setTimeout(() => {
          if (this.views[this.currentView] && this.views[this.currentView].listTable) {
            this.views[this.currentView].listTable.focus();
            this.viewManager.render();
          }
        }, 100);
      }
    };

    const cancelAction = () => {
      this.eventHandler.removeActiveModal('confirmDialog');
      dialog.destroy();

      // Restore original escape handler
      this.screen.unkey(['escape']);
      this.screen.key(['escape'], this.eventHandler.getOriginalEscapeHandler());

      // Restore focus to current view
      if (this.views[this.currentView] && this.views[this.currentView].listTable) {
        this.views[this.currentView].listTable.focus();
      }
      this.viewManager.render();
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
    this.screen.unkey(['escape'], this.eventHandler.getOriginalEscapeHandler());
    this.screen.key(['escape'], () => {
      cancelAction();
    });

    // Focus yes button by default for cleanup confirmation
    yesBtn.focus();
    this.viewManager.render();

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
   * Delegate duration formatting to StateManager
   */
  formatDuration(session) {
    return this.stateManager.formatDuration(session);
  }

  /**
   * Delegate progress formatting to StateManager
   */
  formatProgress(session) {
    return this.stateManager.formatProgress(session);
  }

  /**
   * Delegate message display to StateManager
   */
  showMessage(text, type = 'info') {
    return this.stateManager.showMessage(text, type);
  }

  /**
   * Delegate session refresh to StateManager
   */
  async refreshSessions() {
    return this.stateManager.refreshSessions();
  }

  /**
   * Delegate refresh start to StateManager
   */
  startRefresh() {
    return this.stateManager.startRefresh();
  }

  /**
   * Delegate refresh stop to StateManager
   */
  stopRefresh() {
    return this.stateManager.stopRefresh();
  }

  /**
   * Delegate rendering to ViewManager
   */
  render(immediate = false) {
    this.viewManager.render(immediate);
  }

  /**
   * Delegate force refresh to ViewManager
   */
  forceRefresh() {
    this.viewManager.forceRefresh();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.stateManager) {
      this.stateManager.cleanup();
    }
    if (this.eventHandler) {
      this.eventHandler.cleanup();
    }
    if (this.viewManager) {
      this.viewManager.cleanup();
    }
    if (this.sessionDb) {
      this.sessionDb.cleanup();
    }
  }
}

// Export the class
module.exports = TUIManager;
