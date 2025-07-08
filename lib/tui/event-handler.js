/**
 * EventHandler - Handles all keyboard input and user interactions
 * 
 * Extracted from TUIManager to provide focused responsibility for:
 * - Global keyboard bindings (quit, escape, navigation)
 * - View-specific key handlers (new session, stop, logs, etc.)
 * - Modal state management and interaction
 * - Search functionality setup
 * - Vim-style navigation patterns
 */

const blessed = require('blessed');

class EventHandler {
  constructor(tuiManager) {
    this.tuiManager = tuiManager;
    this.screen = null;
    this.pendingGCommand = false;
    this.lastGPress = 0;
    this.originalEscapeHandler = null;
    this.backgroundEnterHandler = null;
  }

  /**
   * Initialize event handling with the screen
   */
  initialize(screen) {
    this.screen = screen;
    this.setupKeyHandlers();
  }

  /**
   * Set up all keyboard handlers
   */
  setupKeyHandlers() {
    this.setupGlobalKeys();
    this.setupViewSpecificKeys();
    this.setupNavigationKeys();
    this.setupSearchKeys();
    this.setupSpecialKeys();
  }

  /**
   * Global application keys (quit, escape)
   */
  setupGlobalKeys() {
    // Quit application
    this.screen.key(['q'], () => {
      if (this.tuiManager.currentView === 'sessionList') {
        // Quit from main view
        this.tuiManager.cleanup();
        process.exit(0);
      } else {
        // Go back to session list from other views
        this.tuiManager.viewManager.switchView('sessionList');
      }
    });

    // Force quit
    this.screen.key(['C-c'], () => {
      this.tuiManager.cleanup();
      process.exit(0);
    });

    // Escape handler for navigation
    this.originalEscapeHandler = () => {
      // If modal is active, don't handle escape here - let modal handle it
      if (this.tuiManager.hasActiveModal()) {
        return;
      }

      // Always try to go back to session list from any view
      if (this.tuiManager.currentView !== 'sessionList') {
        this.tuiManager.viewManager.switchView('sessionList');
      }
      // Note: Don't quit on escape from sessionList - that's what 'q' is for
    };

    this.screen.key(['escape'], this.originalEscapeHandler);
  }

  /**
   * View-specific action keys
   */
  setupViewSpecificKeys() {
    // New session / Next search result
    this.screen.key(['n'], () => {
      if (this.tuiManager.hasActiveModal()) {
        return;
      }

      if (this.tuiManager.currentView === 'sessionList') {
        this.tuiManager.createNewSession();
      } else {
        // For other views, 'n' is next search result
        if (this.tuiManager.views[this.tuiManager.currentView] && 
            this.tuiManager.views[this.tuiManager.currentView].nextSearchResult) {
          this.tuiManager.views[this.tuiManager.currentView].nextSearchResult();
          this.tuiManager.viewManager.render();
        }
      }
    });

    // Stop session
    this.screen.key(['s'], () => {
      if (this.tuiManager.hasActiveModal()) {
        return;
      }

      if (this.tuiManager.currentView === 'sessionList') {
        this.tuiManager.stopSelectedSession();
      } else if (this.tuiManager.currentView === 'sessionDetail') {
        // Stop the session from detail view
        const session = this.tuiManager.views.sessionDetail.session;
        if (session && session.status === 'running') {
          this.tuiManager.stopSession(session);
        }
      }
    });

    // Resume session
    this.screen.key(['r'], () => {
      if (this.tuiManager.hasActiveModal()) {
        return;
      }

      if (this.tuiManager.currentView === 'sessionList') {
        this.tuiManager.resumeSelectedSession();
      }
    });

    // Show logs
    this.screen.key(['l'], () => {
      if (this.tuiManager.hasActiveModal()) {
        return;
      }

      if (this.tuiManager.currentView === 'sessionList') {
        this.tuiManager.showSessionLogs();
      } else if (this.tuiManager.currentView === 'sessionDetail') {
        // Get the session from the detail view
        const session = this.tuiManager.views.sessionDetail.session;
        if (session) {
          this.tuiManager.viewManager.switchView('logs', { sessionId: session.id });
        }
      }
    });

    // Enter for session detail
    this.backgroundEnterHandler = () => {
      // Only trigger sessionList actions if no modal/dialog is active
      if (this.tuiManager.currentView === 'sessionList' && !this.tuiManager.hasActiveModal()) {
        this.tuiManager.showSessionDetail();
      }
    };
    this.screen.key(['enter'], this.backgroundEnterHandler);

    // Cleanup completed sessions
    this.screen.key(['c'], () => {
      if (this.tuiManager.hasActiveModal()) {
        return;
      }

      if (this.tuiManager.currentView === 'sessionList') {
        this.tuiManager.cleanupCompletedSessions();
      }
    });

    // Kill orphan processes
    this.screen.key(['o'], () => {
      if (this.tuiManager.hasActiveModal()) {
        return;
      }

      if (this.tuiManager.currentView === 'sessionList') {
        this.tuiManager.killOrphanProcesses();
      }
    });
  }

  /**
   * Navigation keys (arrows, vim, page up/down)
   */
  setupNavigationKeys() {
    // Basic navigation
    this.screen.key(['up', 'k'], () => {
      if (this.tuiManager.hasActiveModal()) { return; }
      if (this.tuiManager.views[this.tuiManager.currentView] && 
          this.tuiManager.views[this.tuiManager.currentView].navigateUp) {
        this.tuiManager.views[this.tuiManager.currentView].navigateUp();
        this.tuiManager.viewManager.render();
      }
    });

    this.screen.key(['down', 'j'], () => {
      if (this.tuiManager.hasActiveModal()) { return; }
      if (this.tuiManager.views[this.tuiManager.currentView] && 
          this.tuiManager.views[this.tuiManager.currentView].navigateDown) {
        this.tuiManager.views[this.tuiManager.currentView].navigateDown();
        this.tuiManager.viewManager.render();
      }
    });

    // Page navigation
    this.screen.key(['pageup'], () => {
      if (this.tuiManager.hasActiveModal()) { return; }
      if (this.tuiManager.views[this.tuiManager.currentView] && 
          this.tuiManager.views[this.tuiManager.currentView].pageUp) {
        this.tuiManager.views[this.tuiManager.currentView].pageUp();
        this.tuiManager.viewManager.render();
      }
    });

    this.screen.key(['pagedown'], () => {
      if (this.tuiManager.hasActiveModal()) { return; }
      if (this.tuiManager.views[this.tuiManager.currentView] && 
          this.tuiManager.views[this.tuiManager.currentView].pageDown) {
        this.tuiManager.views[this.tuiManager.currentView].pageDown();
        this.tuiManager.viewManager.render();
      }
    });

    // Vim-style navigation - gg for go to top
    this.screen.key(['g'], () => {
      if (this.tuiManager.hasActiveModal()) { return; }
      if (this.pendingGCommand && Date.now() - this.lastGPress < 1000) {
        // Second 'g' press - go to top
        if (this.tuiManager.views[this.tuiManager.currentView] && 
            this.tuiManager.views[this.tuiManager.currentView].goToTop) {
          this.tuiManager.views[this.tuiManager.currentView].goToTop();
          this.tuiManager.viewManager.render();
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

    // Half-page navigation
    this.screen.key(['C-u'], () => {
      if (this.tuiManager.hasActiveModal()) { return; }
      if (this.tuiManager.views[this.tuiManager.currentView] && 
          this.tuiManager.views[this.tuiManager.currentView].halfPageUp) {
        this.tuiManager.views[this.tuiManager.currentView].halfPageUp();
        this.tuiManager.viewManager.render();
      }
    });

    this.screen.key(['C-d'], () => {
      if (this.tuiManager.hasActiveModal()) { return; }
      if (this.tuiManager.views[this.tuiManager.currentView] && 
          this.tuiManager.views[this.tuiManager.currentView].halfPageDown) {
        this.tuiManager.views[this.tuiManager.currentView].halfPageDown();
        this.tuiManager.viewManager.render();
      }
    });
  }

  /**
   * Search functionality keys
   */
  setupSearchKeys() {
    // Forward search
    this.screen.key(['/'], () => {
      this.startSearch('forward');
    });

    // Backward search
    this.screen.key(['?'], () => {
      this.startSearch('backward');
    });

    // Previous search result
    this.screen.key(['N'], () => {
      if (this.tuiManager.currentView !== 'sessionList') {
        this.tuiManager.views[this.tuiManager.currentView].previousSearchResult();
        this.tuiManager.viewManager.render();
      }
    });
  }

  /**
   * Special keys that require keypress event handling
   */
  setupSpecialKeys() {
    // Manual uppercase key handling (blessed.js doesn't support uppercase letters in .key())
    this.screen.on('keypress', (ch, key) => {
      if (this.tuiManager.hasActiveModal()) { return; }

      // Handle uppercase letters that blessed.js can't bind directly
      if (key.name === 'g' && key.shift) {
        // Shift+G = go to bottom
        if (this.tuiManager.views[this.tuiManager.currentView] && 
            this.tuiManager.views[this.tuiManager.currentView].goToBottom) {
          this.tuiManager.views[this.tuiManager.currentView].goToBottom();
          this.tuiManager.viewManager.render();
        }
      } else if (key.name === 'h' && key.shift) {
        // Shift+H = go to view top
        if (this.tuiManager.views[this.tuiManager.currentView] && 
            this.tuiManager.views[this.tuiManager.currentView].goToViewTop) {
          this.tuiManager.views[this.tuiManager.currentView].goToViewTop();
          this.tuiManager.viewManager.render();
        }
      } else if (key.name === 'm' && key.shift) {
        // Shift+M = go to middle item (not view middle)
        if (this.tuiManager.views[this.tuiManager.currentView] && 
            this.tuiManager.views[this.tuiManager.currentView].goToMiddle) {
          this.tuiManager.views[this.tuiManager.currentView].goToMiddle();
          this.tuiManager.viewManager.render();
        }
      }
    });

    // Shift+L for go to view bottom (avoiding conflict with 'l' for logs)
    this.screen.key(['S-l'], () => {
      if (this.tuiManager.hasActiveModal()) { return; }
      if (this.tuiManager.views[this.tuiManager.currentView] && 
          this.tuiManager.views[this.tuiManager.currentView].goToViewBottom) {
        this.tuiManager.views[this.tuiManager.currentView].goToViewBottom();
        this.tuiManager.viewManager.render();
      }
    });
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
        this.tuiManager.views[this.tuiManager.currentView].search(searchTerm, direction);
      }
      searchForm.destroy();
      this.tuiManager.viewManager.render();
    });

    searchInput.key(['escape'], () => {
      searchForm.destroy();
      this.tuiManager.viewManager.render();
    });

    searchInput.focus();
    this.tuiManager.viewManager.render();
  }

  /**
   * Check if any modal/dialog is active
   */
  hasActiveModal() {
    return this.tuiManager.hasActiveModal();
  }

  /**
   * Add a modal to the active set
   */
  addActiveModal(modalId) {
    this.tuiManager.activeModals.add(modalId);
  }

  /**
   * Remove a modal from the active set
   */
  removeActiveModal(modalId) {
    this.tuiManager.activeModals.delete(modalId);
  }

  /**
   * Get the original escape handler for restoration
   */
  getOriginalEscapeHandler() {
    return this.originalEscapeHandler;
  }

  /**
   * Clean up EventHandler resources
   */
  cleanup() {
    // Clear any pending timeouts
    this.pendingGCommand = false;
    this.lastGPress = 0;
    
    // Clear handlers
    this.originalEscapeHandler = null;
    this.backgroundEnterHandler = null;
  }
}

module.exports = EventHandler;