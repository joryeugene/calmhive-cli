/**
 * TUIQualityAnalyzer - Evaluates TUI performance and user experience
 *
 * Monitors and analyzes the Terminal User Interface for:
 * - Responsiveness (render times, input lag)
 * - Usability (navigation smoothness, modal state management)
 * - Data integrity (session sync accuracy, refresh throttling)
 * - Error handling (graceful failure modes, recovery)
 * - Performance (memory usage, screen update efficiency)
 */

const EventEmitter = require('events');

class TUIQualityAnalyzer extends EventEmitter {
  constructor(tuiManager) {
    super();
    this.tuiManager = tuiManager;
    this.metrics = new Map();
    this.performanceData = {
      renderTimes: [],
      inputLagTimes: [],
      memoryUsage: [],
      refreshCycles: [],
      errorCount: 0,
      navigationEvents: []
    };

    this.isMonitoring = false;
    this.monitoringStartTime = null;
    this.lastMetricsTime = Date.now();

    // Quality thresholds
    this.thresholds = {
      maxRenderTime: 100, // milliseconds
      maxInputLag: 50, // milliseconds
      maxMemoryGrowth: 50, // MB per hour
      maxRefreshTime: 200, // milliseconds
      minSuccessRate: 95 // percentage
    };
  }

  /**
   * Start monitoring TUI quality metrics
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ TUI quality monitoring already active');
      return;
    }

    console.log('🔍 Starting TUI quality monitoring...');
    this.isMonitoring = true;
    this.monitoringStartTime = Date.now();

    this.attachTUIHooks();
    this.startPerformanceTracking();
    this.startMemoryMonitoring();

    console.log('✅ TUI quality monitoring active');
    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring TUI quality metrics
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('⚠️ TUI quality monitoring not active');
      return;
    }

    console.log('🛑 Stopping TUI quality monitoring...');
    this.isMonitoring = false;

    this.detachTUIHooks();
    this.stopPerformanceTracking();
    this.stopMemoryMonitoring();

    console.log('✅ TUI quality monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Attach hooks to TUI manager for monitoring
   */
  attachTUIHooks() {
    if (!this.tuiManager) {
      console.warn('⚠️ No TUI manager available for monitoring');
      return;
    }

    // Monitor render performance
    this.originalRender = this.tuiManager.render?.bind(this.tuiManager);
    if (this.originalRender) {
      this.tuiManager.render = (...args) => {
        return this.measureRenderTime(() => this.originalRender(...args));
      };
    }

    // Monitor view switches
    this.originalSwitchView = this.tuiManager.switchView?.bind(this.tuiManager);
    if (this.originalSwitchView) {
      this.tuiManager.switchView = (...args) => {
        return this.measureNavigationTime(() => this.originalSwitchView(...args), 'viewSwitch');
      };
    }

    // Monitor refresh cycles
    this.originalRefreshData = this.tuiManager.refreshData?.bind(this.tuiManager);
    if (this.originalRefreshData) {
      this.tuiManager.refreshData = (...args) => {
        return this.measureRefreshTime(() => this.originalRefreshData(...args));
      };
    }

    // Monitor modal operations
    if (this.tuiManager.activeModals) {
      this.monitorModalState();
    }

    // Monitor key handling
    if (this.tuiManager.screen) {
      this.monitorKeyHandling();
    }
  }

  /**
   * Detach hooks from TUI manager
   */
  detachTUIHooks() {
    if (!this.tuiManager) {return;}

    // Restore original methods
    if (this.originalRender) {
      this.tuiManager.render = this.originalRender;
    }
    if (this.originalSwitchView) {
      this.tuiManager.switchView = this.originalSwitchView;
    }
    if (this.originalRefreshData) {
      this.tuiManager.refreshData = this.originalRefreshData;
    }
  }

  /**
   * Measure render time performance
   */
  measureRenderTime(renderFunction) {
    const startTime = process.hrtime.bigint();

    try {
      const result = renderFunction();

      const endTime = process.hrtime.bigint();
      const renderTimeMs = Number(endTime - startTime) / 1000000;

      this.recordRenderTime(renderTimeMs);

      return result;
    } catch (error) {
      this.recordError('render', error);
      throw error;
    }
  }

  /**
   * Measure navigation time performance
   */
  measureNavigationTime(navigationFunction, type) {
    const startTime = process.hrtime.bigint();

    try {
      const result = navigationFunction();

      const endTime = process.hrtime.bigint();
      const navTimeMs = Number(endTime - startTime) / 1000000;

      this.recordNavigationTime(navTimeMs, type);

      return result;
    } catch (error) {
      this.recordError('navigation', error);
      throw error;
    }
  }

  /**
   * Measure refresh cycle performance
   */
  measureRefreshTime(refreshFunction) {
    const startTime = process.hrtime.bigint();

    try {
      const result = refreshFunction();

      const endTime = process.hrtime.bigint();
      const refreshTimeMs = Number(endTime - startTime) / 1000000;

      this.recordRefreshTime(refreshTimeMs);

      return result;
    } catch (error) {
      this.recordError('refresh', error);
      throw error;
    }
  }

  /**
   * Monitor modal state consistency
   */
  monitorModalState() {
    if (!this.tuiManager.activeModals) {return;}

    setInterval(() => {
      if (!this.isMonitoring) {return;}

      const modalCount = this.tuiManager.activeModals.size;
      const hasActiveModal = this.tuiManager.hasActiveModal?.() || false;

      // Check for state inconsistency
      if ((modalCount > 0) !== hasActiveModal) {
        this.recordError('modal_state', new Error('Modal state inconsistency detected'));
      }

      this.recordMetric('modalCount', modalCount);
    }, 1000);
  }

  /**
   * Monitor key handling responsiveness
   */
  monitorKeyHandling() {
    if (!this.tuiManager.screen) {return;}

    this.tuiManager.screen.on('keypress', (ch, key) => {
      if (!this.isMonitoring) {return;}

      const timestamp = Date.now();

      // Measure input lag (time since last screen update)
      const inputLag = timestamp - (this.lastScreenUpdate || timestamp);
      this.recordInputLag(inputLag);

      // Track navigation patterns
      if (key && key.name) {
        this.recordNavigationEvent(key.name, timestamp);
      }
    });

    // Track screen updates
    const originalRender = this.tuiManager.screen.render?.bind(this.tuiManager.screen);
    if (originalRender) {
      this.tuiManager.screen.render = (...args) => {
        this.lastScreenUpdate = Date.now();
        return originalRender(...args);
      };
    }
  }

  /**
   * Start performance tracking
   */
  startPerformanceTracking() {
    this.performanceTimer = setInterval(() => {
      if (!this.isMonitoring) {return;}

      const memUsage = process.memoryUsage();
      this.recordMetric('memoryHeapUsed', memUsage.heapUsed);
      this.recordMetric('memoryRSS', memUsage.rss);

      // Check for memory leaks
      this.checkMemoryGrowth();

    }, 5000); // Every 5 seconds
  }

  /**
   * Stop performance tracking
   */
  stopPerformanceTracking() {
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = null;
    }
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    this.memoryBaseline = process.memoryUsage().heapUsed;
    this.memoryCheckInterval = setInterval(() => {
      if (!this.isMonitoring) {return;}

      const currentMemory = process.memoryUsage().heapUsed;
      const growth = currentMemory - this.memoryBaseline;

      this.performanceData.memoryUsage.push({
        timestamp: Date.now(),
        heapUsed: currentMemory,
        growth
      });

      // Keep only last 100 measurements
      if (this.performanceData.memoryUsage.length > 100) {
        this.performanceData.memoryUsage.shift();
      }

    }, 10000); // Every 10 seconds
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Record render time metric
   */
  recordRenderTime(timeMs) {
    this.performanceData.renderTimes.push({
      timestamp: Date.now(),
      duration: timeMs
    });

    // Keep only last 100 measurements
    if (this.performanceData.renderTimes.length > 100) {
      this.performanceData.renderTimes.shift();
    }

    // Check threshold
    if (timeMs > this.thresholds.maxRenderTime) {
      this.emit('performanceIssue', {
        type: 'slowRender',
        value: timeMs,
        threshold: this.thresholds.maxRenderTime
      });
    }
  }

  /**
   * Record input lag metric
   */
  recordInputLag(lagMs) {
    this.performanceData.inputLagTimes.push({
      timestamp: Date.now(),
      lag: lagMs
    });

    // Keep only last 50 measurements
    if (this.performanceData.inputLagTimes.length > 50) {
      this.performanceData.inputLagTimes.shift();
    }

    // Check threshold
    if (lagMs > this.thresholds.maxInputLag) {
      this.emit('performanceIssue', {
        type: 'inputLag',
        value: lagMs,
        threshold: this.thresholds.maxInputLag
      });
    }
  }

  /**
   * Record refresh cycle time
   */
  recordRefreshTime(timeMs) {
    this.performanceData.refreshCycles.push({
      timestamp: Date.now(),
      duration: timeMs
    });

    // Keep only last 50 measurements
    if (this.performanceData.refreshCycles.length > 50) {
      this.performanceData.refreshCycles.shift();
    }

    // Check threshold
    if (timeMs > this.thresholds.maxRefreshTime) {
      this.emit('performanceIssue', {
        type: 'slowRefresh',
        value: timeMs,
        threshold: this.thresholds.maxRefreshTime
      });
    }
  }

  /**
   * Record navigation event
   */
  recordNavigationEvent(keyName, timestamp) {
    this.performanceData.navigationEvents.push({
      key: keyName,
      timestamp
    });

    // Keep only last 100 events
    if (this.performanceData.navigationEvents.length > 100) {
      this.performanceData.navigationEvents.shift();
    }
  }

  /**
   * Record navigation time
   */
  recordNavigationTime(timeMs, type) {
    this.recordMetric(`navigation_${type}`, timeMs);

    if (timeMs > this.thresholds.maxRenderTime) {
      this.emit('performanceIssue', {
        type: 'slowNavigation',
        navigationMode: type,
        value: timeMs,
        threshold: this.thresholds.maxRenderTime
      });
    }
  }

  /**
   * Record error
   */
  recordError(context, error) {
    this.performanceData.errorCount++;

    this.emit('error', {
      context,
      error: error.message,
      timestamp: Date.now()
    });
  }

  /**
   * Record generic metric
   */
  recordMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name);
    metricArray.push({
      timestamp: Date.now(),
      value
    });

    // Keep only last 100 measurements per metric
    if (metricArray.length > 100) {
      metricArray.shift();
    }
  }

  /**
   * Check for memory growth issues
   */
  checkMemoryGrowth() {
    if (this.performanceData.memoryUsage.length < 10) {return;}

    const recent = this.performanceData.memoryUsage.slice(-10);
    const growthRate = (recent[recent.length - 1].heapUsed - recent[0].heapUsed) /
                      (recent.length * 10); // Growth per 10 seconds

    const hourlyGrowthMB = (growthRate * 360) / (1024 * 1024); // Extrapolate to hourly

    if (hourlyGrowthMB > this.thresholds.maxMemoryGrowth) {
      this.emit('performanceIssue', {
        type: 'memoryLeak',
        value: hourlyGrowthMB,
        threshold: this.thresholds.maxMemoryGrowth
      });
    }
  }

  /**
   * Generate comprehensive quality report
   */
  generateQualityReport() {
    const now = Date.now();
    const monitoringDuration = this.monitoringStartTime ?
      (now - this.monitoringStartTime) / 1000 : 0;

    const report = {
      timestamp: now,
      monitoringDuration,
      responsiveness: this.analyzeResponsiveness(),
      usability: this.analyzeUsability(),
      dataIntegrity: this.analyzeDataIntegrity(),
      errorHandling: this.analyzeErrorHandling(),
      performance: this.analyzePerformance(),
      overallScore: 0,
      recommendations: []
    };

    // Calculate overall score (weighted average)
    const weights = {
      responsiveness: 0.3,
      usability: 0.25,
      dataIntegrity: 0.2,
      errorHandling: 0.15,
      performance: 0.1
    };

    report.overallScore = Object.keys(weights).reduce((score, metric) => {
      return score + (report[metric].score * weights[metric]);
    }, 0);

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  /**
   * Analyze responsiveness metrics
   */
  analyzeResponsiveness() {
    const renderTimes = this.performanceData.renderTimes.map(r => r.duration);
    const inputLags = this.performanceData.inputLagTimes.map(i => i.lag);

    const avgRenderTime = renderTimes.length > 0 ?
      renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length : 0;

    const avgInputLag = inputLags.length > 0 ?
      inputLags.reduce((a, b) => a + b, 0) / inputLags.length : 0;

    const maxRenderTime = Math.max(...renderTimes, 0);
    const slowRenders = renderTimes.filter(t => t > this.thresholds.maxRenderTime).length;

    // Score based on performance vs thresholds
    let score = 100;
    if (avgRenderTime > this.thresholds.maxRenderTime * 0.5) {score -= 20;}
    if (avgInputLag > this.thresholds.maxInputLag * 0.5) {score -= 20;}
    if (maxRenderTime > this.thresholds.maxRenderTime * 2) {score -= 30;}
    if (slowRenders > renderTimes.length * 0.1) {score -= 30;}

    return {
      score: Math.max(0, score),
      avgRenderTime,
      avgInputLag,
      maxRenderTime,
      slowRenderCount: slowRenders,
      totalRenders: renderTimes.length
    };
  }

  /**
   * Analyze usability metrics
   */
  analyzeUsability() {
    const navEvents = this.performanceData.navigationEvents;
    const refreshCycles = this.performanceData.refreshCycles;

    // Check navigation patterns for usability issues
    const recentNavs = navEvents.slice(-20);
    const backtrackCount = this.countBacktrackPatterns(recentNavs);

    const avgRefreshTime = refreshCycles.length > 0 ?
      refreshCycles.reduce((a, b) => a + b.duration, 0) / refreshCycles.length : 0;

    let score = 100;
    if (backtrackCount > recentNavs.length * 0.3) {score -= 40;} // Too much backtracking
    if (avgRefreshTime > this.thresholds.maxRefreshTime) {score -= 30;}

    return {
      score: Math.max(0, score),
      navigationEvents: navEvents.length,
      backtrackRate: recentNavs.length > 0 ? backtrackCount / recentNavs.length : 0,
      avgRefreshTime
    };
  }

  /**
   * Analyze data integrity
   */
  analyzeDataIntegrity() {
    const modalMetrics = this.metrics.get('modalCount') || [];

    // Check for data consistency issues
    let score = 100;

    // Modal state consistency
    const modalStateErrors = this.performanceData.errorCount; // Simplified
    if (modalStateErrors > 0) {score -= 50;}

    return {
      score: Math.max(0, score),
      modalStateConsistency: modalStateErrors === 0,
      totalDataChecks: modalMetrics.length
    };
  }

  /**
   * Analyze error handling
   */
  analyzeErrorHandling() {
    const totalErrors = this.performanceData.errorCount;
    const totalOperations = this.performanceData.renderTimes.length +
                           this.performanceData.refreshCycles.length +
                           this.performanceData.navigationEvents.length;

    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
    const successRate = 100 - errorRate;

    let score = successRate;
    if (successRate < this.thresholds.minSuccessRate) {
      score = Math.max(0, score - 20);
    }

    return {
      score: Math.max(0, score),
      totalErrors,
      errorRate,
      successRate
    };
  }

  /**
   * Analyze performance metrics
   */
  analyzePerformance() {
    const memData = this.performanceData.memoryUsage;

    let score = 100;

    // Memory usage analysis
    if (memData.length > 5) {
      const recent = memData.slice(-5);
      const growth = recent[recent.length - 1].growth;
      const growthMB = growth / (1024 * 1024);

      if (growthMB > this.thresholds.maxMemoryGrowth / 10) {score -= 30;} // Per measurement
    }

    return {
      score: Math.max(0, score),
      memoryGrowth: memData.length > 0 ? memData[memData.length - 1].growth : 0,
      memoryMeasurements: memData.length
    };
  }

  /**
   * Count backtrack navigation patterns
   */
  countBacktrackPatterns(navEvents) {
    if (navEvents.length < 3) {return 0;}

    let backtrackCount = 0;

    for (let i = 2; i < navEvents.length; i++) {
      const current = navEvents[i].key;
      const prev = navEvents[i - 1].key;
      const prevPrev = navEvents[i - 2].key;

      // Pattern: A -> B -> A (backtrack)
      if (current === prevPrev && current !== prev) {
        backtrackCount++;
      }
    }

    return backtrackCount;
  }

  /**
   * Generate improvement recommendations
   */
  generateRecommendations(report) {
    const recommendations = [];

    if (report.responsiveness.score < 80) {
      recommendations.push({
        priority: 'high',
        category: 'responsiveness',
        issue: 'Slow render times detected',
        suggestion: 'Optimize screen updates and reduce DOM complexity'
      });
    }

    if (report.usability.backtrackRate > 0.2) {
      recommendations.push({
        priority: 'medium',
        category: 'usability',
        issue: 'High backtrack rate in navigation',
        suggestion: 'Improve navigation flow and add breadcrumbs'
      });
    }

    if (report.errorHandling.successRate < 95) {
      recommendations.push({
        priority: 'high',
        category: 'reliability',
        issue: 'Low success rate detected',
        suggestion: 'Add better error handling and recovery mechanisms'
      });
    }

    if (report.performance.memoryGrowth > 1024 * 1024 * 10) { // 10MB
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        issue: 'Memory usage growing',
        suggestion: 'Check for memory leaks in event handlers'
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
      renderTimes: [...this.performanceData.renderTimes],
      inputLagTimes: [...this.performanceData.inputLagTimes],
      refreshCycles: [...this.performanceData.refreshCycles],
      navigationEvents: [...this.performanceData.navigationEvents],
      memoryUsage: [...this.performanceData.memoryUsage],
      errorCount: this.performanceData.errorCount,
      customMetrics: Object.fromEntries(this.metrics)
    };
  }
}

module.exports = TUIQualityAnalyzer;
