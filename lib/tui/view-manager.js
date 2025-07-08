/**
 * ViewManager - Handles TUI layout, view management and rendering
 *
 * Extracted from TUIManager to provide focused responsibility for:
 * - Screen layout creation (header, content area, footer)
 * - View loading and initialization
 * - View switching and coordination
 * - Screen rendering and updates
 * - Footer status updates
 */

const blessed = require('blessed');

class ViewManager {
  constructor(tuiManager) {
    this.tuiManager = tuiManager;
    this.screen = null;
    this.header = null;
    this.contentArea = null;
    this.footer = null;
    this.views = {};
    this.currentView = 'sessionList';
    this._renderTimeout = null;
  }

  /**
   * Initialize the screen and set up the base layout structure
   */
  initializeScreen() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      title: 'Calmhive Process Manager'
    });

    this.setupLayout();
    return this.screen;
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
    this.views.sessionList = new SessionListView(this.contentArea, this.tuiManager);
    this.views.sessionDetail = new SessionDetailView(this.contentArea, this.tuiManager);
    this.views.logs = new LogsView(this.contentArea, this.tuiManager);

    // Hide all views initially
    Object.values(this.views).forEach(view => view.hide());

    // Show default view
    this.views[this.currentView].show();
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
        this.tuiManager.showMessage(`Error: View '${viewName}' not found`, 'error');
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
            this.tuiManager.showMessage(`Error: ${error.message}`, 'error');
          });
        }
      }

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
          console.error('[TUI ERROR] Error during focus:', error);
        }
      }, 10);

    } catch (error) {
      console.error(`[TUI ERROR] Error in switchView to ${viewName}:`, error);
      this.tuiManager.showMessage(`Error: ${error.message}`, 'error');
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
   * Render the screen with optional immediate rendering
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
   * Get the current view
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * Get a specific view by name
   */
  getView(viewName) {
    return this.views[viewName];
  }

  /**
   * Get all views
   */
  getAllViews() {
    return this.views;
  }

  /**
   * Get the content area for views to attach to
   */
  getContentArea() {
    return this.contentArea;
  }

  /**
   * Get the screen object
   */
  getScreen() {
    return this.screen;
  }

  /**
   * Clean up ViewManager resources
   */
  cleanup() {
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
      this._renderTimeout = null;
    }

    // Clean up views
    Object.values(this.views).forEach(view => {
      if (view.cleanup && typeof view.cleanup === 'function') {
        view.cleanup();
      }
    });

    this.views = {};
  }
}

module.exports = ViewManager;
