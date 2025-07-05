#!/usr/bin/env node

/**
 * Context Monitor for Claude Code Sessions
 * Monitors and logs context usage to help debug /compact issues
 */

const fs = require('fs');
const path = require('path');

class ContextMonitor {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logPath = path.join(process.env.HOME, '.claude', 'afk_registry', sessionId, 'context-monitor.log');
    this.contextHistory = [];
    this.compactAttempts = [];
    this.ensureLogDir();
  }

  ensureLogDir() {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Log context-related events
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
   * Monitor stdout for context indicators
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
   * Log compact attempt
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
   * Generate context report
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
   * Summarize an event for the report
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
   * Analyze patterns in context usage
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
