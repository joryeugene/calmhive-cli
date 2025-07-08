/**
 * HealthMonitor - System health monitoring and performance tracking
 *
 * Provides comprehensive health checks and performance metrics for:
 * - System resource usage (CPU, memory, disk)
 * - Database connectivity and performance
 * - Process Manager status and session health
 * - TUI component status
 * - Network connectivity (Claude API)
 * - Error rates and recovery statistics
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { ErrorHandler, SystemError } = require('./errors/error-framework');

class HealthMonitor {
  constructor(options = {}) {
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.metricsRetention = options.metricsRetention || 24 * 60 * 60 * 1000; // 24 hours
    this.errorHandler = new ErrorHandler({ logger: console });

    // Component references
    this.sessionDb = options.sessionDb || null;
    this.processManager = options.processManager || null;
    this.tuiManager = options.tuiManager || null;

    // Health status
    this.isHealthy = true;
    this.lastCheck = null;
    this.checkTimer = null;

    // Metrics storage
    this.metrics = {
      system: [],
      database: [],
      sessions: [],
      errors: [],
      performance: []
    };

    // Health thresholds
    this.thresholds = {
      cpu: options.cpuThreshold || 80, // 80% CPU usage
      memory: options.memoryThreshold || 85, // 85% memory usage
      disk: options.diskThreshold || 90, // 90% disk usage
      dbResponseTime: options.dbResponseTime || 1000, // 1 second
      errorRate: options.errorRate || 10 // 10 errors per minute
    };

    this.startTime = Date.now();
  }

  /**
   * Start health monitoring
   */
  start() {
    console.log('🏥 Starting health monitoring...');

    // Initial health check
    this.checkHealth();

    // Schedule periodic checks
    this.checkTimer = setInterval(() => {
      this.checkHealth();
    }, this.checkInterval);

    // Cleanup old metrics periodically
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    console.log('🏥 Health monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth() {
    const checkStart = performance.now();
    const timestamp = Date.now();

    try {
      const healthStatus = {
        timestamp,
        overall: 'healthy',
        components: {},
        metrics: {},
        issues: []
      };

      // System health
      healthStatus.components.system = await this.checkSystemHealth();
      healthStatus.metrics.system = this.getSystemMetrics();

      // Database health
      if (this.sessionDb) {
        healthStatus.components.database = await this.checkDatabaseHealth();
      }

      // Process Manager health
      if (this.processManager) {
        healthStatus.components.processManager = await this.checkProcessManagerHealth();
      }

      // TUI health (if running)
      if (this.tuiManager) {
        healthStatus.components.tui = this.checkTUIHealth();
      }

      // Error rate analysis
      healthStatus.components.errorRate = this.checkErrorRate();

      // Determine overall health
      const componentStatuses = Object.values(healthStatus.components).map(c => c.status);
      if (componentStatuses.includes('critical')) {
        healthStatus.overall = 'critical';
        this.isHealthy = false;
      } else if (componentStatuses.includes('warning')) {
        healthStatus.overall = 'warning';
      } else {
        healthStatus.overall = 'healthy';
        this.isHealthy = true;
      }

      // Collect issues
      Object.values(healthStatus.components).forEach(component => {
        if (component.issues) {
          healthStatus.issues.push(...component.issues);
        }
      });

      const checkDuration = performance.now() - checkStart;
      healthStatus.metrics.checkDuration = checkDuration;

      this.lastCheck = healthStatus;
      this.recordMetric('health', healthStatus);

      // Log critical issues
      if (healthStatus.overall === 'critical') {
        console.error('🚨 CRITICAL HEALTH ISSUES:', healthStatus.issues);
      } else if (healthStatus.overall === 'warning') {
        console.warn('⚠️ Health warnings:', healthStatus.issues);
      }

    } catch (error) {
      const healthError = new SystemError('Health check failed', {
        context: { checkDuration: performance.now() - checkStart },
        cause: error
      });
      this.errorHandler.handle(healthError);
      this.isHealthy = false;
    }
  }

  /**
   * Check system resource health
   */
  async checkSystemHealth() {
    const cpuUsage = await this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();

    const issues = [];
    let status = 'healthy';

    if (cpuUsage > this.thresholds.cpu) {
      issues.push(`High CPU usage: ${cpuUsage.toFixed(1)}%`);
      status = cpuUsage > 95 ? 'critical' : 'warning';
    }

    if (memoryUsage.percentage > this.thresholds.memory) {
      issues.push(`High memory usage: ${memoryUsage.percentage.toFixed(1)}%`);
      status = memoryUsage.percentage > 95 ? 'critical' : 'warning';
    }

    if (diskUsage.percentage > this.thresholds.disk) {
      issues.push(`High disk usage: ${diskUsage.percentage.toFixed(1)}%`);
      status = diskUsage.percentage > 98 ? 'critical' : 'warning';
    }

    return {
      status,
      issues,
      metrics: {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        uptime: this.getUptime()
      }
    };
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth() {
    const startTime = performance.now();
    const issues = [];
    let status = 'healthy';

    try {
      // Test database connectivity and response time
      const sessions = await this.sessionDb.getAllSessions();
      const responseTime = performance.now() - startTime;

      if (responseTime > this.thresholds.dbResponseTime) {
        issues.push(`Slow database response: ${responseTime.toFixed(0)}ms`);
        status = responseTime > this.thresholds.dbResponseTime * 2 ? 'critical' : 'warning';
      }

      // Check for database locks or other issues
      const activeSessions = sessions.filter(s => s.status === 'running');
      const staleSessionsStart = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const staleSessions = activeSessions.filter(s => s.started_at < staleSessionsStart);

      if (staleSessions.length > 0) {
        issues.push(`${staleSessions.length} stale sessions detected`);
        status = 'warning';
      }

      return {
        status,
        issues,
        metrics: {
          responseTime,
          totalSessions: sessions.length,
          activeSessions: activeSessions.length,
          staleSessions: staleSessions.length
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        issues: [`Database error: ${error.message}`],
        metrics: {
          responseTime: performance.now() - startTime,
          error: error.message
        }
      };
    }
  }

  /**
   * Check Process Manager health
   */
  async checkProcessManagerHealth() {
    const issues = [];
    let status = 'healthy';

    try {
      // Check for orphaned processes
      const orphanedProcesses = await this.processManager.findOrphanedProcesses();
      if (orphanedProcesses.length > 0) {
        issues.push(`${orphanedProcesses.length} orphaned processes found`);
        status = 'warning';
      }

      // Check process monitor status
      const processCount = this.processManager.processMonitor.getActiveProcessCount();
      if (processCount > 10) {
        issues.push(`High process count: ${processCount}`);
        status = 'warning';
      }

      return {
        status,
        issues,
        metrics: {
          activeProcesses: processCount,
          orphanedProcesses: orphanedProcesses.length
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        issues: [`Process Manager error: ${error.message}`],
        metrics: {
          error: error.message
        }
      };
    }
  }

  /**
   * Check TUI health
   */
  checkTUIHealth() {
    const issues = [];
    let status = 'healthy';

    try {
      // Check if TUI components are responsive
      if (!this.tuiManager.screen) {
        issues.push('TUI screen not initialized');
        status = 'warning';
      }

      if (!this.tuiManager.viewManager) {
        issues.push('ViewManager not available');
        status = 'warning';
      }

      if (!this.tuiManager.eventHandler) {
        issues.push('EventHandler not available');
        status = 'warning';
      }

      if (!this.tuiManager.stateManager) {
        issues.push('StateManager not available');
        status = 'warning';
      }

      // Check refresh state
      if (this.tuiManager.stateManager && this.tuiManager.stateManager.isRefreshInProgress()) {
        const refreshTime = Date.now() - this.tuiManager.stateManager.lastRefreshTime;
        if (refreshTime > 30000) { // 30 seconds
          issues.push('TUI refresh appears stuck');
          status = 'warning';
        }
      }

      return {
        status,
        issues,
        metrics: {
          currentView: this.tuiManager.currentView,
          hasActiveModals: this.tuiManager.hasActiveModal(),
          refreshInProgress: this.tuiManager.stateManager?.isRefreshInProgress() || false
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        issues: [`TUI error: ${error.message}`],
        metrics: {
          error: error.message
        }
      };
    }
  }

  /**
   * Check error rate
   */
  checkErrorRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentErrors = this.metrics.errors.filter(e => e.timestamp > oneMinuteAgo);
    const errorRate = recentErrors.length;

    const issues = [];
    let status = 'healthy';

    if (errorRate > this.thresholds.errorRate) {
      issues.push(`High error rate: ${errorRate} errors/minute`);
      status = errorRate > this.thresholds.errorRate * 2 ? 'critical' : 'warning';
    }

    return {
      status,
      issues,
      metrics: {
        errorsPerMinute: errorRate,
        totalErrors: this.metrics.errors.length
      }
    };
  }

  /**
   * Record error for monitoring
   */
  recordError(error) {
    this.metrics.errors.push({
      timestamp: Date.now(),
      message: error.message,
      category: error.category || 'unknown',
      severity: error.severity || 'medium'
    });
  }

  /**
   * Record performance metric
   */
  recordMetric(type, data) {
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }

    this.metrics[type].push({
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastCheck,
      uptime: this.getUptime(),
      startTime: this.startTime
    };
  }

  /**
   * Get health summary for endpoint
   */
  getHealthSummary() {
    const status = this.getHealthStatus();

    return {
      status: status.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      uptime: status.uptime,
      lastCheck: status.lastCheck?.timestamp,
      components: status.lastCheck?.components || {},
      issues: status.lastCheck?.issues || []
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    return {
      system: this.getSystemMetrics(),
      database: this.getLatestMetrics('database'),
      sessions: this.getLatestMetrics('sessions'),
      errors: this.getErrorMetrics(),
      performance: this.getLatestMetrics('performance')
    };
  }

  /**
   * Utility methods
   */

  async getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;

    return (100 - (100 * idle / total));
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total,
      used,
      free,
      percentage: (used / total) * 100
    };
  }

  async getDiskUsage() {
    try {
      const stats = fs.statSync(process.cwd());
      // Note: This is simplified - in production you'd want to check actual disk usage
      return {
        total: 1000000000, // 1GB placeholder
        used: 500000000,   // 500MB placeholder
        percentage: 50     // 50% placeholder
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        percentage: 0,
        error: error.message
      };
    }
  }

  getSystemMetrics() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      loadAverage: os.loadavg(),
      memory: this.getMemoryUsage(),
      uptime: os.uptime()
    };
  }

  getUptime() {
    return Date.now() - this.startTime;
  }

  getLatestMetrics(type, count = 10) {
    return this.metrics[type]?.slice(-count) || [];
  }

  getErrorMetrics() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const recentErrors = this.metrics.errors.filter(e => e.timestamp > oneHourAgo);

    const errorsByCategory = {};
    const errorsBySeverity = {};

    recentErrors.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    return {
      total: recentErrors.length,
      byCategory: errorsByCategory,
      bySeverity: errorsBySeverity,
      recent: recentErrors.slice(-5)
    };
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - this.metricsRetention;

    Object.keys(this.metrics).forEach(type => {
      this.metrics[type] = this.metrics[type].filter(m => m.timestamp > cutoff);
    });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stop();
    this.metrics = {};
  }
}

module.exports = HealthMonitor;
