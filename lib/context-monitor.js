#!/usr/bin/env node

/**
 * ContextMonitor - Real-time monitoring and analysis of Claude context usage
 *
 * Provides comprehensive monitoring of context-related events during AFk sessions:
 * - Detects context limit hits and compact suggestions
 * - Tracks /compact command attempts and success rates
 * - Generates detailed reports for debugging context issues
 * - Analyzes patterns in context usage over time
 *
 * Each session gets its own context monitor that logs to:
 * ~/.claude/afk_registry/{sessionId}/context-monitor.log
 *
 * @example
 * const monitor = new ContextMonitor('afk-12345');
 * monitor.monitorOutput('Context limit reached. Run /compact to continue.');
 * const report = monitor.generateReport();
 */

const fs = require('fs');
const path = require('path');

class ContextMonitor {
  /**
   * Creates a new ContextMonitor for tracking context usage in a session
   *
   * @param {string} sessionId - Unique session identifier for log organization
   */
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logPath = path.join(process.env.HOME, '.claude', 'afk_registry', sessionId, 'context-monitor.log');
    this.contextHistory = [];
    this.compactAttempts = [];
    this.ensureLogDir();
  }

  /**
   * Ensures the AFk registry directory exists for this session
   *
   * Creates the session-specific directory structure if it doesn't exist.
   * This includes the context monitor log and report files.
   */
  ensureLogDir() {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Logs a context-related event with timestamp and session metadata
   *
   * Events are stored both in memory and appended to the log file for
   * persistence across process restarts and debugging.
   *
   * @param {string} type - Event type (e.g., 'iteration_start', 'context_contextLimit')
   * @param {Object} data - Event-specific data payload
   */
  logEvent(type, data) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      data,
      sessionId: this.sessionId
    };

    this.contextHistory.push(event);

    // Append to log file
    fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n');
  }

  /**
   * Monitors Claude process output for context-related patterns
   *
   * Uses regex patterns to detect:
   * - Context limit warnings
   * - Compact command suggestions
   * - Token/character usage information
   * - Context-related errors
   *
   * @param {string} output - Raw stdout/stderr output from Claude process
   */
  monitorOutput(output) {
    const indicators = {
      contextLimit: /context limit|prompt is too long|message too long/i,
      compactSuggestion: /\/compact|run compact|compact context/i,
      contextSize: /(\d+)\s*(tokens?|characters?)\s*(used|remaining)/i,
      error: /error.*context|context.*error/i
    };

    for (const [key, regex] of Object.entries(indicators)) {
      const match = output.match(regex);
      if (match) {
        this.logEvent(`context_${key}`, {
          match: match[0],
          fullOutput: output.substring(Math.max(0, match.index - 100), match.index + 200)
        });
      }
    }
  }

  /**
   * Records a /compact command attempt with its outcome
   *
   * Tracks different compact methods (standard, newline_prefix, etc.)
   * and their success rates to help optimize context management.
   *
   * @param {string} method - Compact method attempted (e.g., 'standard', 'newline_prefix')
   * @param {boolean} success - Whether the compact attempt succeeded
   * @param {Error} [error=null] - Error object if attempt failed
   */
  logCompactAttempt(method, success, error = null) {
    const attempt = {
      timestamp: new Date().toISOString(),
      method,
      success,
      error: error ? error.message : null
    };

    this.compactAttempts.push(attempt);
    this.logEvent('compact_attempt', attempt);
  }

  /**
   * Generates a comprehensive context usage report for the session
   *
   * Creates a detailed JSON report including:
   * - Event counts and timeline
   * - Compact attempt statistics
   * - Context limit hit frequency
   * - Event summaries for debugging
   *
   * Report is saved to context-report.json in the session directory.
   *
   * @returns {Object} Context usage report with statistics and timeline
   */
  generateReport() {
    const report = {
      sessionId: this.sessionId,
      totalEvents: this.contextHistory.length,
      compactAttempts: this.compactAttempts.length,
      successfulCompacts: this.compactAttempts.filter(a => a.success).length,
      contextLimitHits: this.contextHistory.filter(e => e.type === 'context_contextLimit').length,
      timeline: this.contextHistory.map(e => ({
        time: e.timestamp,
        type: e.type,
        summary: this.summarizeEvent(e)
      }))
    };

    const reportPath = path.join(path.dirname(this.logPath), 'context-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Creates a human-readable summary of a context event
   *
   * Converts raw event data into descriptive text for reports and debugging.
   *
   * @param {Object} event - Event object with type and data
   * @returns {string} Human-readable event summary
   */
  summarizeEvent(event) {
    switch (event.type) {
    case 'context_contextLimit':
      return `Context limit detected: ${event.data.match}`;
    case 'context_compactSuggestion':
      return `Compact suggested: ${event.data.match}`;
    case 'compact_attempt':
      return `Compact attempt (${event.data.method}): ${event.data.success ? 'Success' : 'Failed'}`;
    default:
      return event.type;
    }
  }

  /**
   * Analyzes patterns and trends in context usage across the session
   *
   * Calculates metrics such as:
   * - Average time between context limits
   * - Compact command success rates
   * - Context growth patterns
   * - Common error types
   *
   * Useful for optimizing AFk session parameters and identifying issues.
   *
   * @returns {Object} Pattern analysis with calculated metrics
   */
  analyzePatterns() {
    const patterns = {
      averageTimeBetweenLimits: 0,
      mostCommonError: null,
      compactSuccessRate: 0,
      contextGrowthRate: null
    };

    // Calculate average time between context limits
    const limitEvents = this.contextHistory.filter(e => e.type === 'context_contextLimit');
    if (limitEvents.length > 1) {
      const times = limitEvents.map(e => new Date(e.timestamp).getTime());
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i-1]);
      }
      patterns.averageTimeBetweenLimits = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    // Calculate compact success rate
    if (this.compactAttempts.length > 0) {
      patterns.compactSuccessRate = this.compactAttempts.filter(a => a.success).length / this.compactAttempts.length;
    }

    return patterns;
  }
}

module.exports = ContextMonitor;
