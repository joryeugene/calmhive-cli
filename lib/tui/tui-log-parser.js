const fs = require('fs').promises;
const path = require('path');

class TUILogParser {
  constructor() {
    this.iterationPattern = /🚀 Starting iteration (\d+) of (\d+)/;
    this.exitCodePattern = /⚠️ Iteration (\d+) exited with code (\d+)/;
    this.contextPattern = /🔄 Starting iteration (\d+) with fresh context/;
    this.limitPattern = /⏳ Usage limit likely hit\. Waiting (\d+) minutes/;
    this.stopPattern = /🛑 Session ([\w-]+) was stopped/;
    this.errorPatterns = [
      /Error:/,
      /Failed:/,
      /FATAL:/,
      /TypeError:/,
      /ReferenceError:/,
      /SyntaxError:/
    ];
  }

  /**
   * Parse log content into structured iterations with summaries
   */
  parseLogContent(logContent) {
    const lines = logContent.split('\n').map(line => line.trim()).filter(Boolean);
    const iterations = [];
    let currentIteration = null;
    let sessionMetadata = this.extractSessionMetadata(lines);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cleanLine = this.stripLogPrefix(line);

      // Detect iteration start
      const iterationMatch = cleanLine.match(this.iterationPattern);
      if (iterationMatch) {
        // Save previous iteration
        if (currentIteration) {
          currentIteration.summary = this.generateIterationSummary(currentIteration);
          iterations.push(currentIteration);
        }

        // Start new iteration
        currentIteration = {
          number: parseInt(iterationMatch[1]),
          total: parseInt(iterationMatch[2]),
          startTime: this.extractTimestamp(line),
          logs: [cleanLine],
          status: 'running',
          events: [],
          errors: [],
          warnings: []
        };
        continue;
      }

      // If we have a current iteration, add content to it
      if (currentIteration) {
        currentIteration.logs.push(cleanLine);

        // Track specific events
        this.categorizeLogLine(cleanLine, currentIteration);
      }
    }

    // Handle final iteration
    if (currentIteration) {
      currentIteration.summary = this.generateIterationSummary(currentIteration);
      iterations.push(currentIteration);
    }

    return {
      sessionMetadata,
      iterations,
      totalIterations: iterations.length,
      finalStatus: this.determineFinalStatus(iterations, lines)
    };
  }

  /**
   * Extract session metadata from initial log lines
   */
  extractSessionMetadata(lines) {
    const metadata = {};

    for (const line of lines.slice(0, 10)) {
      if (line.includes('AFk worker started for session')) {
        metadata.sessionId = line.match(/session ([\w-]+)/)?.[1];
      }
      if (line.includes('Task:')) {
        metadata.taskDescription = line.split('Task:')[1]?.trim();
      }
      if (line.includes('Working directory:')) {
        metadata.workingDirectory = line.split('Working directory:')[1]?.trim();
      }
    }

    return metadata;
  }

  /**
   * Categorize log lines into events, errors, warnings
   */
  categorizeLogLine(line, iteration) {
    // Exit codes
    const exitMatch = line.match(this.exitCodePattern);
    if (exitMatch) {
      const exitCode = parseInt(exitMatch[2]);
      iteration.events.push({
        type: 'exit_code',
        code: exitCode,
        message: line
      });
      if (exitCode !== 0) {
        iteration.status = 'failed';
        iteration.errors.push(`Exit code ${exitCode}`);
      }
      return;
    }

    // Context refresh
    if (line.match(this.contextPattern)) {
      iteration.events.push({
        type: 'context_refresh',
        message: line
      });
      return;
    }

    // Usage limits
    const limitMatch = line.match(this.limitPattern);
    if (limitMatch) {
      iteration.events.push({
        type: 'rate_limit',
        waitTime: parseInt(limitMatch[1]),
        message: line
      });
      iteration.warnings.push(`Rate limited - waiting ${limitMatch[1]} minutes`);
      return;
    }

    // Stop signal
    if (line.match(this.stopPattern)) {
      iteration.events.push({
        type: 'stopped',
        message: line
      });
      iteration.status = 'stopped';
      return;
    }

    // Errors
    for (const errorPattern of this.errorPatterns) {
      if (line.match(errorPattern)) {
        iteration.errors.push(line);
        iteration.status = 'error';
        return;
      }
    }
  }

  /**
   * Generate a beautiful summary for each iteration
   */
  generateIterationSummary(iteration) {
    const summary = {
      status: iteration.status,
      duration: this.calculateDuration(iteration),
      eventCount: iteration.events.length,
      errorCount: iteration.errors.length,
      warningCount: iteration.warnings.length,
      keyEvents: this.extractKeyEvents(iteration),
      statusEmoji: this.getStatusEmoji(iteration),
      progressBar: this.generateProgressBar(iteration.number, iteration.total)
    };

    return summary;
  }

  /**
   * Extract the most important events from an iteration
   */
  extractKeyEvents(iteration) {
    const keyEvents = [];

    // Add significant events
    for (const event of iteration.events) {
      if (event.type === 'exit_code' && event.code !== 0) {
        keyEvents.push(`Failed with exit code ${event.code}`);
      } else if (event.type === 'context_refresh') {
        keyEvents.push('Fresh context restart');
      } else if (event.type === 'rate_limit') {
        keyEvents.push(`Rate limited (${event.waitTime}m wait)`);
      } else if (event.type === 'stopped') {
        keyEvents.push('Manually stopped');
      }
    }

    // Add error summaries
    if (iteration.errors.length > 0) {
      keyEvents.push(`${iteration.errors.length} error(s)`);
    }

    return keyEvents.slice(0, 3); // Limit to most important
  }

  /**
   * Get emoji for iteration status
   */
  getStatusEmoji(iteration) {
    switch (iteration.status) {
    case 'running': return '🔄';
    case 'failed': return '❌';
    case 'error': return '💥';
    case 'stopped': return '🛑';
    case 'completed': return '✅';
    default: return '🚀';
    }
  }

  /**
   * Generate ASCII progress bar
   */
  generateProgressBar(current, total, width = 20) {
    const percentage = current / total;
    const filled = Math.floor(percentage * width);
    const empty = width - filled;

    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${total}`;
  }

  /**
   * Calculate iteration duration (placeholder - would need timestamps)
   */
  calculateDuration(iteration) {
    // In future, parse timestamps to calculate actual duration
    return 'unknown';
  }

  /**
   * Strip log prefixes to get clean content
   */
  stripLogPrefix(line) {
    // Remove timestamp and arrow prefix: "[2025-07-03T18:42:07.825Z]" or "     1→"
    return line.replace(/^\s*\d+→/, '').replace(/^\[[\d-T:.Z]+\]\s*/, '').trim();
  }

  /**
   * Extract timestamp from log line
   */
  extractTimestamp(line) {
    const match = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
    return match ? new Date(match[1]) : null;
  }

  /**
   * Determine final session status
   */
  determineFinalStatus(iterations, allLines) {
    if (iterations.length === 0) {return 'no_iterations';}

    const lastIteration = iterations[iterations.length - 1];

    // Check for completion signals
    const hasCompletionSignal = allLines.some(line =>
      line.includes('AFk worker completed successfully') ||
      line.includes('Session completed')
    );

    if (hasCompletionSignal) {return 'completed';}
    if (lastIteration.status === 'stopped') {return 'stopped';}
    if (lastIteration.status === 'error') {return 'error';}
    if (iterations.some(iter => iter.status === 'failed')) {return 'failed';}

    return 'running';
  }

  /**
   * Format parsed log for beautiful TUI display
   */
  formatForTUI(parsedLog) {
    const { sessionMetadata, iterations, finalStatus } = parsedLog;
    const output = [];

    // Session header
    output.push('');
    output.push(`{bold}📋 Session: {/bold}{cyan-fg}${sessionMetadata.sessionId || 'unknown'}{/cyan-fg}`);
    output.push(`{bold}📝 Task: {/bold}${this.truncateTask(sessionMetadata.taskDescription)}`);
    output.push(`{bold}📊 Status: {/bold}${this.formatStatus(finalStatus)}`);
    output.push('');

    // Iteration summaries
    for (const iteration of iterations) {
      output.push(this.formatIterationSummary(iteration));
      output.push('');
    }

    return output.join('\n');
  }

  /**
   * Format individual iteration summary
   */
  formatIterationSummary(iteration) {
    const { summary } = iteration;
    const lines = [];

    // Header with progress
    lines.push(`{bold}${summary.statusEmoji} Iteration ${iteration.number}{/bold} ${summary.progressBar}`);

    // Key events (if any)
    if (summary.keyEvents.length > 0) {
      lines.push(`  {gray-fg}${summary.keyEvents.join(' • ')}{/gray-fg}`);
    }

    // Error/warning summary
    if (summary.errorCount > 0 || summary.warningCount > 0) {
      const indicators = [];
      if (summary.errorCount > 0) {indicators.push(`{red-fg}${summary.errorCount} errors{/red-fg}`);}
      if (summary.warningCount > 0) {indicators.push(`{yellow-fg}${summary.warningCount} warnings{/yellow-fg}`);}
      lines.push(`  ${indicators.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Format status with color
   */
  formatStatus(status) {
    const statusMap = {
      'completed': '{green-fg}✅ Completed{/green-fg}',
      'stopped': '{yellow-fg}🛑 Stopped{/yellow-fg}',
      'error': '{red-fg}💥 Error{/red-fg}',
      'failed': '{red-fg}❌ Failed{/red-fg}',
      'running': '{blue-fg}🔄 Running{/blue-fg}',
      'no_iterations': '{gray-fg}📭 No iterations{/gray-fg}'
    };

    return statusMap[status] || status;
  }

  /**
   * Truncate long task descriptions
   */
  truncateTask(task) {
    if (!task) {return 'No description';}
    if (task.length <= 80) {return task;}
    return task.substring(0, 77) + '...';
  }
}

module.exports = TUILogParser;
