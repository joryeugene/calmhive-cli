/**
 * SessionQualityAnalyzer - Evaluates session robustness and reliability
 *
 * Monitors and analyzes AFk session quality including:
 * - Lifecycle integrity (clean startup/shutdown, state transitions)
 * - Data consistency (database sync, metadata accuracy, progress tracking)
 * - Recovery capability (resume functionality, error state handling)
 * - Resource management (process cleanup, file handle management)
 * - Concurrency safety (multiple session handling, race conditions)
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class SessionQualityAnalyzer extends EventEmitter {
  constructor(sessionDatabase, processMonitor) {
    super();
    this.sessionDb = sessionDatabase;
    this.processMonitor = processMonitor;

    this.metrics = {
      lifecycleEvents: [],
      dataConsistencyChecks: [],
      recoveryTests: [],
      resourceUsage: [],
      concurrencyEvents: []
    };

    this.isMonitoring = false;
    this.monitoringStartTime = null;
    this.qualityThresholds = {
      maxStateTransitionTime: 5000, // 5 seconds
      maxRecoveryTime: 30000, // 30 seconds
      minDataConsistencyRate: 95, // percentage
      maxOrphanProcesses: 0,
      maxMemoryLeakRate: 10 // MB per hour
    };

    this.setupLifecycleTracking();
  }

  /**
   * Start comprehensive session quality monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Session quality monitoring already active');
      return;
    }

    console.log('🔍 Starting session quality monitoring...');
    this.isMonitoring = true;
    this.monitoringStartTime = Date.now();

    // Start different monitoring aspects
    this.startLifecycleMonitoring();
    this.startDataConsistencyMonitoring();
    this.startResourceMonitoring();
    this.startConcurrencyMonitoring();

    console.log('✅ Session quality monitoring active');
    this.emit('monitoringStarted');
  }

  /**
   * Stop session quality monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('⚠️ Session quality monitoring not active');
      return;
    }

    console.log('🛑 Stopping session quality monitoring...');
    this.isMonitoring = false;

    this.stopLifecycleMonitoring();
    this.stopDataConsistencyMonitoring();
    this.stopResourceMonitoring();
    this.stopConcurrencyMonitoring();

    console.log('✅ Session quality monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Set up lifecycle event tracking
   */
  setupLifecycleTracking() {
    this.lifecycleStates = new Map(); // sessionId -> state info
    this.stateTransitions = new Map(); // sessionId -> transition history
  }

  /**
   * Start monitoring session lifecycle integrity
   */
  startLifecycleMonitoring() {
    this.lifecycleTimer = setInterval(async () => {
      if (!this.isMonitoring) {return;}

      try {
        await this.checkLifecycleIntegrity();
      } catch (error) {
        this.recordQualityIssue('lifecycle', 'monitoring_error', error);
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Stop lifecycle monitoring
   */
  stopLifecycleMonitoring() {
    if (this.lifecycleTimer) {
      clearInterval(this.lifecycleTimer);
      this.lifecycleTimer = null;
    }
  }

  /**
   * Check lifecycle integrity for all sessions
   */
  async checkLifecycleIntegrity() {
    const sessions = await this.sessionDb.getAllSessions();
    const currentTime = Date.now();

    for (const session of sessions) {
      const previousState = this.lifecycleStates.get(session.id);
      const currentState = this.analyzeSessionState(session);

      // Record state transition if changed
      if (!previousState || previousState.status !== currentState.status) {
        await this.recordStateTransition(session.id, previousState, currentState, currentTime);
      }

      // Update current state
      this.lifecycleStates.set(session.id, currentState);

      // Check for lifecycle anomalies
      await this.checkLifecycleAnomalies(session, currentState, currentTime);
    }
  }

  /**
   * Analyze current session state
   */
  analyzeSessionState(session) {
    return {
      status: session.status,
      pid: session.pid,
      progress: session.progress,
      lastUpdated: session.last_updated || session.created_at,
      hasProcess: this.processMonitor ? this.processMonitor.isProcessActive(session.id) : false,
      timestamp: Date.now()
    };
  }

  /**
   * Record state transition
   */
  async recordStateTransition(sessionId, previousState, currentState, timestamp) {
    if (!this.stateTransitions.has(sessionId)) {
      this.stateTransitions.set(sessionId, []);
    }

    const transitions = this.stateTransitions.get(sessionId);
    const transition = {
      timestamp,
      from: previousState?.status || 'unknown',
      to: currentState.status,
      duration: previousState ? timestamp - previousState.timestamp : 0,
      healthy: this.isHealthyTransition(previousState?.status, currentState.status)
    };

    transitions.push(transition);

    // Keep only last 50 transitions per session
    if (transitions.length > 50) {
      transitions.shift();
    }

    // Record metric
    this.metrics.lifecycleEvents.push({
      sessionId,
      type: 'state_transition',
      ...transition
    });

    // Check transition health
    if (!transition.healthy) {
      this.recordQualityIssue('lifecycle', 'invalid_transition', {
        sessionId,
        transition
      });
    }

    // Check transition duration
    if (transition.duration > this.qualityThresholds.maxStateTransitionTime) {
      this.recordQualityIssue('lifecycle', 'slow_transition', {
        sessionId,
        duration: transition.duration,
        threshold: this.qualityThresholds.maxStateTransitionTime
      });
    }
  }

  /**
   * Check if state transition is healthy
   */
  isHealthyTransition(fromStatus, toStatus) {
    const validTransitions = {
      'unknown': ['created', 'running', 'failed'],
      'created': ['starting', 'running', 'failed', 'cancelled'],
      'starting': ['running', 'failed', 'cancelled'],
      'running': ['completed', 'failed', 'cancelled'],
      'completed': [], // Terminal state
      'failed': [], // Terminal state
      'cancelled': [] // Terminal state
    };

    const allowedTransitions = validTransitions[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  /**
   * Check for lifecycle anomalies
   */
  async checkLifecycleAnomalies(session, currentState, timestamp) {
    // Check for stale running sessions
    if (session.status === 'running') {
      const lastUpdate = session.last_updated || session.started_at || session.created_at;
      const staleDuration = timestamp - lastUpdate;

      if (staleDuration > 15 * 60 * 1000) { // 15 minutes
        this.recordQualityIssue('lifecycle', 'stale_session', {
          sessionId: session.id,
          staleDuration,
          lastUpdate: new Date(lastUpdate).toISOString()
        });
      }
    }

    // Check for orphaned database entries
    if (session.status === 'running' && session.pid && !currentState.hasProcess) {
      this.recordQualityIssue('lifecycle', 'orphaned_db_entry', {
        sessionId: session.id,
        pid: session.pid
      });
    }

    // Check for progress inconsistencies
    if (session.status === 'running' && session.progress > session.currentIteration * (100 / session.iterations) + 10) {
      this.recordQualityIssue('lifecycle', 'progress_inconsistency', {
        sessionId: session.id,
        progress: session.progress,
        expectedProgress: session.currentIteration * (100 / session.iterations)
      });
    }
  }

  /**
   * Start data consistency monitoring
   */
  startDataConsistencyMonitoring() {
    this.dataConsistencyTimer = setInterval(async () => {
      if (!this.isMonitoring) {return;}

      try {
        await this.checkDataConsistency();
      } catch (error) {
        this.recordQualityIssue('data_consistency', 'monitoring_error', error);
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop data consistency monitoring
   */
  stopDataConsistencyMonitoring() {
    if (this.dataConsistencyTimer) {
      clearInterval(this.dataConsistencyTimer);
      this.dataConsistencyTimer = null;
    }
  }

  /**
   * Check data consistency across system components
   */
  async checkDataConsistency() {
    const timestamp = Date.now();
    const checks = [];

    // Check database vs process monitor consistency
    const dbSessions = await this.sessionDb.getSessionsByStatus(['running']);
    const activePIDs = this.processMonitor ? this.processMonitor.getAllActiveProcesses() : [];

    for (const session of dbSessions) {
      const hasActiveProcess = activePIDs.some(p => p.sessionId === session.id);
      const consistencyCheck = {
        sessionId: session.id,
        dbStatus: session.status,
        hasActiveProcess,
        consistent: (session.status === 'running') === hasActiveProcess,
        timestamp
      };

      checks.push(consistencyCheck);

      if (!consistencyCheck.consistent) {
        this.recordQualityIssue('data_consistency', 'db_process_mismatch', consistencyCheck);
      }
    }

    // Check AFk registry consistency
    for (const session of dbSessions) {
      const registryConsistent = await this.checkAFkRegistryConsistency(session);
      checks.push({
        sessionId: session.id,
        type: 'afk_registry',
        consistent: registryConsistent,
        timestamp
      });

      if (!registryConsistent) {
        this.recordQualityIssue('data_consistency', 'afk_registry_mismatch', {
          sessionId: session.id
        });
      }
    }

    this.metrics.dataConsistencyChecks.push(...checks);

    // Keep only last 1000 checks
    if (this.metrics.dataConsistencyChecks.length > 1000) {
      this.metrics.dataConsistencyChecks = this.metrics.dataConsistencyChecks.slice(-1000);
    }

    // Calculate consistency rate
    const recentChecks = this.metrics.dataConsistencyChecks.slice(-100);
    const consistentChecks = recentChecks.filter(c => c.consistent).length;
    const consistencyRate = recentChecks.length > 0 ? (consistentChecks / recentChecks.length) * 100 : 100;

    if (consistencyRate < this.qualityThresholds.minDataConsistencyRate) {
      this.recordQualityIssue('data_consistency', 'low_consistency_rate', {
        rate: consistencyRate,
        threshold: this.qualityThresholds.minDataConsistencyRate
      });
    }
  }

  /**
   * Check AFk registry consistency
   */
  async checkAFkRegistryConsistency(session) {
    try {
      const registryPath = path.join(process.env.HOME, '.claude', 'afk_registry', session.id);
      await fs.access(registryPath);

      // Check for recent activity in context monitor
      const contextLogPath = path.join(registryPath, 'context-monitor.log');
      try {
        const stats = await fs.stat(contextLogPath);
        const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
        return ageMinutes < 20; // Consider consistent if updated within 20 minutes
      } catch {
        return false; // No context log
      }
    } catch {
      return false; // No registry directory
    }
  }

  /**
   * Start resource monitoring
   */
  startResourceMonitoring() {
    this.resourceTimer = setInterval(async () => {
      if (!this.isMonitoring) {return;}

      try {
        await this.checkResourceManagement();
      } catch (error) {
        this.recordQualityIssue('resource_management', 'monitoring_error', error);
      }
    }, 15000); // Every 15 seconds
  }

  /**
   * Stop resource monitoring
   */
  stopResourceMonitoring() {
    if (this.resourceTimer) {
      clearInterval(this.resourceTimer);
      this.resourceTimer = null;
    }
  }

  /**
   * Check resource management quality
   */
  async checkResourceManagement() {
    const timestamp = Date.now();

    // Check for orphaned processes
    const orphanProcesses = this.processMonitor ? await this.processMonitor.findOrphanProcesses() : [];

    if (orphanProcesses.length > this.qualityThresholds.maxOrphanProcesses) {
      this.recordQualityIssue('resource_management', 'orphaned_processes', {
        count: orphanProcesses.length,
        threshold: this.qualityThresholds.maxOrphanProcesses,
        processes: orphanProcesses
      });
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    this.metrics.resourceUsage.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      orphanProcessCount: orphanProcesses.length
    });

    // Keep only last 100 measurements
    if (this.metrics.resourceUsage.length > 100) {
      this.metrics.resourceUsage.shift();
    }

    // Check for memory leaks
    this.checkMemoryLeaks();
  }

  /**
   * Check for memory leaks
   */
  checkMemoryLeaks() {
    if (this.metrics.resourceUsage.length < 10) {return;}

    const recent = this.metrics.resourceUsage.slice(-10);
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    const memoryGrowth = recent[recent.length - 1].heapUsed - recent[0].heapUsed;

    if (timeSpan > 0) {
      const hourlyGrowthMB = (memoryGrowth / timeSpan) * 3600000 / (1024 * 1024);

      if (hourlyGrowthMB > this.qualityThresholds.maxMemoryLeakRate) {
        this.recordQualityIssue('resource_management', 'memory_leak', {
          hourlyGrowthMB,
          threshold: this.qualityThresholds.maxMemoryLeakRate
        });
      }
    }
  }

  /**
   * Start concurrency monitoring
   */
  startConcurrencyMonitoring() {
    this.concurrencyTimer = setInterval(async () => {
      if (!this.isMonitoring) {return;}

      try {
        await this.checkConcurrencySafety();
      } catch (error) {
        this.recordQualityIssue('concurrency', 'monitoring_error', error);
      }
    }, 8000); // Every 8 seconds
  }

  /**
   * Stop concurrency monitoring
   */
  stopConcurrencyMonitoring() {
    if (this.concurrencyTimer) {
      clearInterval(this.concurrencyTimer);
      this.concurrencyTimer = null;
    }
  }

  /**
   * Check concurrency safety
   */
  async checkConcurrencySafety() {
    const timestamp = Date.now();
    const activeSessions = await this.sessionDb.getSessionsByStatus(['running', 'starting']);

    // Check for race conditions in session creation
    const recentSessions = activeSessions.filter(s =>
      timestamp - s.created_at < 60000 // Created within last minute
    );

    const concurrentCreations = recentSessions.length;

    this.metrics.concurrencyEvents.push({
      timestamp,
      activeSessions: activeSessions.length,
      concurrentCreations,
      type: 'concurrent_check'
    });

    // Keep only last 100 events
    if (this.metrics.concurrencyEvents.length > 100) {
      this.metrics.concurrencyEvents.shift();
    }

    // Check for potential race conditions
    if (concurrentCreations > 3) {
      this.recordQualityIssue('concurrency', 'high_concurrent_creation', {
        count: concurrentCreations,
        activeSessions: activeSessions.length
      });
    }

    // Check for database contention indicators
    await this.checkDatabaseContention(activeSessions);
  }

  /**
   * Check for database contention issues
   */
  async checkDatabaseContention(activeSessions) {
    // This is a simplified check - in practice you'd look for database locks,
    // transaction timeouts, etc.

    const startTime = Date.now();
    try {
      // Perform a quick database operation
      await this.sessionDb.getAllSessions();
      const duration = Date.now() - startTime;

      if (duration > 1000) { // Slower than 1 second
        this.recordQualityIssue('concurrency', 'database_contention', {
          queryDuration: duration,
          activeSessions: activeSessions.length
        });
      }
    } catch (error) {
      this.recordQualityIssue('concurrency', 'database_error', {
        error: error.message,
        activeSessions: activeSessions.length
      });
    }
  }

  /**
   * Test session recovery capability
   */
  async testRecoveryCapability(sessionId) {
    const startTime = Date.now();
    const recoveryTest = {
      sessionId,
      startTime,
      endTime: null,
      success: false,
      error: null,
      steps: []
    };

    try {
      // Step 1: Get session info
      recoveryTest.steps.push('get_session_info');
      const session = await this.sessionDb.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Step 2: Check process status
      recoveryTest.steps.push('check_process_status');
      const processActive = this.processMonitor ?
        this.processMonitor.isProcessActive(sessionId) : false;

      // Step 3: Validate log accessibility
      recoveryTest.steps.push('validate_log_access');
      const logPath = path.join(process.env.HOME, '.claude', 'calmhive', 'v3', 'logs', `${sessionId}.log`);
      try {
        await fs.access(logPath);
      } catch {
        // Log doesn't exist, which might be ok for new sessions
      }

      // Step 4: Check AFk registry
      recoveryTest.steps.push('check_afk_registry');
      const registryPath = path.join(process.env.HOME, '.claude', 'afk_registry', sessionId);
      try {
        await fs.access(registryPath);
      } catch {
        // Registry doesn't exist for this session
      }

      recoveryTest.success = true;
      recoveryTest.endTime = Date.now();

    } catch (error) {
      recoveryTest.error = error.message;
      recoveryTest.endTime = Date.now();
    }

    const duration = recoveryTest.endTime - recoveryTest.startTime;
    recoveryTest.duration = duration;

    this.metrics.recoveryTests.push(recoveryTest);

    // Keep only last 50 tests
    if (this.metrics.recoveryTests.length > 50) {
      this.metrics.recoveryTests.shift();
    }

    // Check recovery performance
    if (duration > this.qualityThresholds.maxRecoveryTime) {
      this.recordQualityIssue('recovery', 'slow_recovery', {
        sessionId,
        duration,
        threshold: this.qualityThresholds.maxRecoveryTime
      });
    }

    if (!recoveryTest.success) {
      this.recordQualityIssue('recovery', 'recovery_failure', {
        sessionId,
        error: recoveryTest.error,
        steps: recoveryTest.steps
      });
    }

    return recoveryTest;
  }

  /**
   * Record a quality issue
   */
  recordQualityIssue(category, type, details) {
    const issue = {
      timestamp: Date.now(),
      category,
      type,
      details,
      severity: this.calculateSeverity(category, type)
    };

    this.emit('qualityIssue', issue);

    // Store in metrics
    if (!this.metrics[`${category}_issues`]) {
      this.metrics[`${category}_issues`] = [];
    }

    this.metrics[`${category}_issues`].push(issue);
  }

  /**
   * Calculate issue severity
   */
  calculateSeverity(category, type) {
    const severityMap = {
      lifecycle: {
        invalid_transition: 'high',
        slow_transition: 'medium',
        stale_session: 'high',
        orphaned_db_entry: 'high',
        progress_inconsistency: 'medium'
      },
      data_consistency: {
        db_process_mismatch: 'high',
        afk_registry_mismatch: 'medium',
        low_consistency_rate: 'high'
      },
      resource_management: {
        orphaned_processes: 'medium',
        memory_leak: 'high'
      },
      concurrency: {
        high_concurrent_creation: 'medium',
        database_contention: 'high',
        database_error: 'high'
      },
      recovery: {
        slow_recovery: 'medium',
        recovery_failure: 'high'
      }
    };

    return severityMap[category]?.[type] || 'low';
  }

  /**
   * Generate comprehensive session quality report
   */
  generateQualityReport() {
    const now = Date.now();
    const monitoringDuration = this.monitoringStartTime ?
      (now - this.monitoringStartTime) / 1000 : 0;

    const report = {
      timestamp: now,
      monitoringDuration,
      lifecycleIntegrity: this.analyzeLifecycleIntegrity(),
      dataConsistency: this.analyzeDataConsistency(),
      recoveryCapability: this.analyzeRecoveryCapability(),
      resourceManagement: this.analyzeResourceManagement(),
      concurrencySafety: this.analyzeConcurrencySafety(),
      overallScore: 0,
      issues: this.getRecentIssues(),
      recommendations: []
    };

    // Calculate overall score
    const scores = [
      report.lifecycleIntegrity.score,
      report.dataConsistency.score,
      report.recoveryCapability.score,
      report.resourceManagement.score,
      report.concurrencySafety.score
    ];

    report.overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Generate recommendations
    report.recommendations = this.generateQualityRecommendations(report);

    return report;
  }

  /**
   * Analyze lifecycle integrity
   */
  analyzeLifecycleIntegrity() {
    const transitions = this.metrics.lifecycleEvents;
    const healthyTransitions = transitions.filter(t => t.healthy).length;
    const totalTransitions = transitions.length;

    let score = totalTransitions > 0 ? (healthyTransitions / totalTransitions) * 100 : 100;

    return {
      score: Math.max(0, score),
      totalTransitions,
      healthyTransitions,
      invalidTransitions: totalTransitions - healthyTransitions
    };
  }

  /**
   * Analyze data consistency
   */
  analyzeDataConsistency() {
    const checks = this.metrics.dataConsistencyChecks;
    const consistentChecks = checks.filter(c => c.consistent).length;
    const totalChecks = checks.length;

    let score = totalChecks > 0 ? (consistentChecks / totalChecks) * 100 : 100;

    return {
      score: Math.max(0, score),
      totalChecks,
      consistentChecks,
      inconsistentChecks: totalChecks - consistentChecks
    };
  }

  /**
   * Analyze recovery capability
   */
  analyzeRecoveryCapability() {
    const tests = this.metrics.recoveryTests;
    const successfulTests = tests.filter(t => t.success).length;
    const totalTests = tests.length;

    let score = totalTests > 0 ? (successfulTests / totalTests) * 100 : 100;

    const avgRecoveryTime = tests.length > 0 ?
      tests.reduce((sum, t) => sum + t.duration, 0) / tests.length : 0;

    return {
      score: Math.max(0, score),
      totalTests,
      successfulTests,
      failedTests: totalTests - successfulTests,
      avgRecoveryTime
    };
  }

  /**
   * Analyze resource management
   */
  analyzeResourceManagement() {
    const usage = this.metrics.resourceUsage;
    const recentUsage = usage.slice(-10);

    let score = 100;

    // Check for orphaned processes
    const hasOrphans = recentUsage.some(u => u.orphanProcessCount > 0);
    if (hasOrphans) {score -= 30;}

    // Check memory growth
    if (recentUsage.length > 1) {
      const memGrowth = recentUsage[recentUsage.length - 1].heapUsed - recentUsage[0].heapUsed;
      if (memGrowth > 50 * 1024 * 1024) {score -= 20;} // 50MB growth
    }

    return {
      score: Math.max(0, score),
      memoryMeasurements: usage.length,
      currentMemoryMB: usage.length > 0 ? (usage[usage.length - 1].heapUsed / 1024 / 1024).toFixed(2) : 0
    };
  }

  /**
   * Analyze concurrency safety
   */
  analyzeConcurrencySafety() {
    const events = this.metrics.concurrencyEvents;

    let score = 100;

    // Check for high concurrency issues
    const highConcurrencyEvents = events.filter(e => e.concurrentCreations > 3).length;
    if (highConcurrencyEvents > 0) {score -= 40;}

    return {
      score: Math.max(0, score),
      totalEvents: events.length,
      highConcurrencyEvents
    };
  }

  /**
   * Get recent quality issues
   */
  getRecentIssues(hours = 1) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const allIssues = [];

    // Collect issues from all categories
    Object.keys(this.metrics).forEach(key => {
      if (key.endsWith('_issues')) {
        const issues = this.metrics[key] || [];
        allIssues.push(...issues.filter(issue => issue.timestamp > cutoff));
      }
    });

    return allIssues.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate quality improvement recommendations
   */
  generateQualityRecommendations(report) {
    const recommendations = [];

    if (report.lifecycleIntegrity.score < 90) {
      recommendations.push({
        priority: 'high',
        category: 'lifecycle',
        issue: 'Lifecycle integrity issues detected',
        suggestion: 'Review state transition logic and add validation'
      });
    }

    if (report.dataConsistency.score < 95) {
      recommendations.push({
        priority: 'high',
        category: 'data_consistency',
        issue: 'Data consistency problems found',
        suggestion: 'Implement database transaction safety and sync validation'
      });
    }

    if (report.recoveryCapability.score < 85) {
      recommendations.push({
        priority: 'medium',
        category: 'recovery',
        issue: 'Session recovery failures detected',
        suggestion: 'Improve error handling and recovery mechanisms'
      });
    }

    return recommendations;
  }

  /**
   * Get current metrics snapshot
   */
  getMetricsSnapshot() {
    return {
      timestamp: Date.now(),
      isMonitoring: this.isMonitoring,
      monitoringDuration: this.monitoringStartTime ?
        Date.now() - this.monitoringStartTime : 0,
      metrics: {
        lifecycleEvents: [...this.metrics.lifecycleEvents],
        dataConsistencyChecks: [...this.metrics.dataConsistencyChecks],
        recoveryTests: [...this.metrics.recoveryTests],
        resourceUsage: [...this.metrics.resourceUsage],
        concurrencyEvents: [...this.metrics.concurrencyEvents]
      },
      currentStates: Object.fromEntries(this.lifecycleStates),
      stateTransitions: Object.fromEntries(this.stateTransitions)
    };
  }
}

module.exports = SessionQualityAnalyzer;
