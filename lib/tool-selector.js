// lib/tool-selector.js
// V3 ToolSelector - Intelligent mode selection (Claude Code handles models automatically)

class ToolSelector {
  constructor() {
    this.modeHistory = [];
    this.successMetrics = new Map();
  }

  // REMOVED selectModel - Claude Code handles this automatically!

  selectMode(task) {
    const taskLower = task.toLowerCase();

    // Check for multi-step keywords
    if (/\b(then|after|first|second|finally|and then)\b/i.test(task)) {
      const steps = this.extractSteps(task);
      return {
        mode: 'chain',
        steps: steps,
        confidence: 0.85,
        reason: 'Multi-step task detected'
      };
    }

    // Check for long-running tasks first (higher priority)
    if (/\b(entire|whole|complete|full|migrate|refactor all|process \d{3,})\b/i.test(task)) {
      return {
        mode: 'afk',
        estimatedIterations: 15,
        confidence: 0.75,
        reason: 'Long-running task detected'
      };
    }

    // Check for batch operations
    if (/\b(all|every|each|batch|multiple)\b.*\b(files?|components?|endpoints?|tests?|modules?)\b/i.test(task)) {
      return {
        mode: 'parallel',
        confidence: 0.8,
        reason: 'Batch operation detected'
      };
    }

    // Default to simple mode
    return {
      mode: 'simple',
      confidence: 0.9,
      reason: 'Direct query or simple task'
    };
  }

  calculateComplexity(task) {
    let score = 1;

    // Length factor
    score += Math.floor(task.length / 50);

    // Technical keywords
    const technicalKeywords = /\b(implement|architect|design|optimize|refactor|migrate|integrate|analyze)\b/gi;
    const matches = task.match(technicalKeywords);
    score += matches ? matches.length * 2 : 0;

    // Complexity indicators
    if (/\b(distributed|microservice|blockchain|machine learning|real-time)\b/i.test(task)) {
      score += 3;
    }

    return Math.min(score, 10);
  }

  extractSteps(task) {
    const steps = [];
    const stepIndicators = /(first|then|after that|finally|next|also)/gi;
    const parts = task.split(stepIndicators);

    parts.forEach((part, i) => {
      if (i % 2 === 1 && part.trim()) { // Skip indicators
        steps.push(part.trim());
      }
    });

    // Common patterns
    if (steps.length === 0) {
      if (/analyz.*fix/i.test(task)) {steps.push('analyze', 'fix', 'test');}
      else if (/find.*create/i.test(task)) {steps.push('find', 'create');}
      else {steps.push('execute');}
    }

    return steps;
  }

  analyzeContext(context) {
    const files = context.files || [];
    const analysis = {
      primaryLanguage: 'javascript',
      framework: null,
      projectType: null,
      hasTests: false,
      patterns: []
    };

    // Detect React
    if (files.some(f => /\.(jsx|tsx)$/.test(f))) {
      analysis.framework = 'react';
      analysis.projectType = 'frontend';
    }

    // Detect backend
    if (files.some(f => /(routes|controllers|models|middleware)/i.test(f))) {
      analysis.projectType = 'backend';
      analysis.patterns.push('mvc');
    }

    // Detect tests
    if (files.some(f => /(test|spec)\.(js|ts)$/.test(f) || /__tests__/.test(f))) {
      analysis.hasTests = true;
      analysis.testFramework = files.some(f => /jest/.test(f)) ? 'jest' : 'mocha';
    }

    return analysis;
  }

  detectPatterns(operation) {
    const patterns = [];

    if (/\b(read|write|create|delete|update).*\b(files?|config|json)\b/i.test(operation)) {
      patterns.push('file-operation');
    }

    if (/\b(fetch|post|get|put|delete|api|endpoint|request)\b/i.test(operation)) {
      patterns.push('api-operation');
    }

    if (/\b(query|database|sql|record|table|schema)\b/i.test(operation)) {
      patterns.push('database-operation');
    }

    return patterns;
  }

  recordSuccess(task, metrics) {
    const key = metrics.mode;
    this.successMetrics.set(key, (this.successMetrics.get(key) || 0) + 1);
    this.modeHistory.push(metrics.mode);
  }

  recordFailure(task, metrics) {
    // Just track mode failures
    this.modeHistory.push(`failed:${metrics.mode}`);
  }

  getPerformanceMetrics() {
    return {
      modeDistribution: this.modeHistory.reduce((acc, mode) => {
        acc[mode] = (acc[mode] || 0) + 1;
        return acc;
      }, {}),
      averageComplexity: 5.5 // Placeholder
    };
  }
}

module.exports = ToolSelector;
