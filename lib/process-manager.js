/**
 * ProcessManager - Production implementation for AFk background sessions
 *
 * STATUS: PRIMARY PRODUCTION IMPLEMENTATION (V2 MIGRATION COMPLETED)
 * MIGRATED FROM: Monolithic 1,641-line implementation to modular 367-line architecture
 *
 * Now uses focused modular components:
 * - ProcessLifecycleManager: Session creation, status, completion
 * - ProcessMonitor: PID tracking, health checks, orphan detection
 * - AFkExecutor: AFk iteration execution and retry logic
 * - LogManager: Log file management and output handling
 *
 * USED BY: cmd/afk, lib/afk-worker.js, lib/tui/tui-manager.js, most tests
 *
 * @example
 * const pm = new ProcessManager();
 * await pm.startAfkSession('analyze codebase', { iterations: 10 });
 * const status = await pm.getSessionStatus('afk-12345');
 */

const ProcessManagerV2 = require('./process-manager-v2');

/**
 * ProcessManager - Compatibility wrapper for V2 modular architecture
 *
 * This maintains the same interface as the original monolithic ProcessManager
 * while using the new modular V2 implementation under the hood.
 */
class ProcessManager extends ProcessManagerV2 {
  /**
   * Creates a new ProcessManager instance with V1 compatibility
   *
   * Delegates to V2 implementation with default configuration for backward compatibility
   */
  constructor(options = {}) {
    // Maintain V1 default paths and behavior
    const v1CompatibleOptions = {
      logDir: options.logDir || require('path').join(__dirname, '..', 'logs'),
      databasePath: options.databasePath,
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024,
      logRetentionDays: options.logRetentionDays || 30,
      ...options
    };

    super(v1CompatibleOptions);

    // V1 compatibility properties - these maintain backward compatibility
    // for any code that directly accesses these properties
    this.db = this.lifecycleManager.db; // Expose database for V1 compatibility
    this.activeProcesses = new Map(); // V1 expected this property (now delegated to processMonitor)
    this.logDir = this.logManager.logDir; // V1 expected this property
  }

  /**
   * V1 compatibility method - ensures log directory exists
   * Delegates to LogManager in V2 architecture
   */
  ensureLogDir() {
    return this.logManager.ensureLogDir();
  }

  /**
   * V1 compatibility method - sets up cleanup handlers
   * This is now handled automatically by V2 modules
   */
  setupCleanup() {
    // V2 modules handle cleanup automatically
    // This method is kept for V1 compatibility but does nothing
    return;
  }

  /**
   * V1 compatibility - expose active processes through processMonitor
   * Updates the V1 activeProcesses Map to match current processMonitor state
   */
  getActiveProcesses() {
    // Sync V1 activeProcesses with V2 processMonitor
    this.activeProcesses.clear();
    const activeProcesses = this.processMonitor.getAllActiveProcesses();
    for (const [sessionId, processInfo] of activeProcesses) {
      this.activeProcesses.set(sessionId, processInfo);
    }
    return this.activeProcesses;
  }
}

module.exports = ProcessManager;
