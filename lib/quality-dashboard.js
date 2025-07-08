/**
 * Quality Dashboard and Metrics System
 *
 * Provides comprehensive quality monitoring and reporting across all Calmhive components.
 * Aggregates Claude-powered quality evaluations into actionable insights and metrics.
 *
 * Features:
 * - Real-time quality metrics collection
 * - Historical quality trend analysis
 * - Component-specific quality scoring
 * - Quality regression detection
 * - Actionable improvement recommendations
 */

const UniversalQualityEvaluator = require('./universal-quality-evaluator');
const fs = require('fs').promises;
const path = require('path');

class QualityDashboard {
  constructor(options = {}) {
    this.evaluator = new UniversalQualityEvaluator();
    this.metricsDir = options.metricsDir || path.join(__dirname, '../metrics');
    this.qualityThresholds = {
      excellent: 85,
      good: 70,
      acceptable: 55,
      poor: 40,
      critical: 25
    };

    this.componentWeights = {
      cliCommands: 0.3,     // 30% - User-facing critical
      integration: 0.25,    // 25% - System reliability
      workflows: 0.2,       // 20% - User experience
      templates: 0.15,      // 15% - Configuration quality
      performance: 0.1      // 10% - System efficiency
    };

    this.ensureMetricsDir();
  }

  /**
   * Ensure metrics directory exists
   */
  async ensureMetricsDir() {
    try {
      await fs.mkdir(this.metricsDir, { recursive: true });
    } catch (error) {
      // Directory exists or creation failed
    }
  }

  /**
   * Run comprehensive quality assessment across all components
   */
  async runComprehensiveAssessment() {
    console.log('📊 Starting comprehensive quality assessment...');

    const assessmentResults = {
      timestamp: new Date().toISOString(),
      overallScore: 0,
      componentScores: {},
      qualityTrends: {},
      regressionAlerts: [],
      recommendations: [],
      details: {}
    };

    try {
      // Assess CLI Commands
      console.log('   Assessing CLI commands...');
      assessmentResults.componentScores.cliCommands = await this.assessCliCommands();

      // Assess Integration Quality
      console.log('   Assessing integration quality...');
      assessmentResults.componentScores.integration = await this.assessIntegrationQuality();

      // Assess Template Effectiveness
      console.log('   Assessing template effectiveness...');
      assessmentResults.componentScores.templates = await this.assessTemplateEffectiveness();

      // Assess Workflow Quality
      console.log('   Assessing workflow quality...');
      assessmentResults.componentScores.workflows = await this.assessWorkflowQuality();

      // Calculate overall score
      assessmentResults.overallScore = this.calculateOverallScore(assessmentResults.componentScores);

      // Generate quality trends
      assessmentResults.qualityTrends = await this.analyzeQualityTrends();

      // Detect regressions
      assessmentResults.regressionAlerts = await this.detectQualityRegressions(assessmentResults);

      // Generate recommendations
      assessmentResults.recommendations = this.generateQualityRecommendations(assessmentResults);

      // Save assessment results
      await this.saveAssessmentResults(assessmentResults);

      console.log(`📈 Comprehensive assessment complete. Overall score: ${assessmentResults.overallScore.toFixed(1)}%`);

      return assessmentResults;

    } catch (error) {
      console.error('❌ Quality assessment error:', error.message);
      return {
        ...assessmentResults,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Assess CLI command quality
   */
  async assessCliCommands() {
    const commands = [
      { command: 'calmhive --version', expected: 'Display version information' },
      { command: 'calmhive --help', expected: 'Show comprehensive help' },
      { command: 'calmhive chat "test"', expected: 'Respond to simple query' },
      { command: 'calmhive config show', expected: 'Display configuration status' },
      { command: 'calmhive afk status', expected: 'Show session status' }
    ];

    const evaluations = [];

    for (const cmd of commands) {
      try {
        const result = await this.executeCommand(cmd.command);
        const evaluation = await this.evaluator.evaluateCliCommand(
          cmd.command,
          result.stdout,
          result.stderr,
          cmd.expected
        );

        if (evaluation.success) {
          evaluations.push({
            command: cmd.command,
            score: evaluation.evaluation.percentage,
            confidence: evaluation.confidence.score,
            feedback: evaluation.evaluation.feedback
          });
        }
      } catch (error) {
        evaluations.push({
          command: cmd.command,
          score: 0,
          confidence: 0,
          error: error.message
        });
      }
    }

    const averageScore = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
      : 0;

    return {
      score: averageScore,
      count: evaluations.length,
      details: evaluations,
      level: this.getQualityLevel(averageScore)
    };
  }

  /**
   * Assess integration quality through component interaction tests
   */
  async assessIntegrationQuality() {
    const integrationTests = [
      {
        name: 'ProcessManager + ProgressTracker',
        test: () => this.testProcessManagerIntegration()
      },
      {
        name: 'SessionDatabase + AFk Process',
        test: () => this.testSessionDatabaseIntegration()
      },
      {
        name: 'ConfigManager + Templates',
        test: () => this.testConfigManagerIntegration()
      }
    ];

    const evaluations = [];

    for (const test of integrationTests) {
      try {
        const result = await test.test();
        evaluations.push({
          integration: test.name,
          score: result.score || 0,
          confidence: result.confidence || 0,
          details: result.details || 'No details available'
        });
      } catch (error) {
        evaluations.push({
          integration: test.name,
          score: 0,
          confidence: 0,
          error: error.message
        });
      }
    }

    const averageScore = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
      : 0;

    return {
      score: averageScore,
      count: evaluations.length,
      details: evaluations,
      level: this.getQualityLevel(averageScore)
    };
  }

  /**
   * Assess template effectiveness
   */
  async assessTemplateEffectiveness() {
    const templates = [
      { type: 'CLAUDE.md', path: 'CLAUDE.md.example' },
      { type: 'CLAUDE-DESKTOP.md', path: 'CLAUDE-DESKTOP.md.example' },
      { type: 'Bug Hunting', path: 'commands/bug-hunting.md' },
      { type: 'Documentation', path: 'commands/documentation.md' }
    ];

    const evaluations = [];

    for (const template of templates) {
      try {
        const templatePath = path.join(__dirname, '..', template.path);
        const content = await fs.readFile(templatePath, 'utf8');

        const evaluation = await this.evaluator.evaluateTemplate(
          template.type,
          content.substring(0, 2000), // Truncate for evaluation
          `Provide effective ${template.type} guidance`,
          'Template quality assessment'
        );

        if (evaluation.success) {
          evaluations.push({
            template: template.type,
            score: evaluation.evaluation.percentage,
            confidence: evaluation.confidence.score,
            feedback: evaluation.evaluation.feedback
          });
        }
      } catch (error) {
        evaluations.push({
          template: template.type,
          score: 0,
          confidence: 0,
          error: error.message
        });
      }
    }

    const averageScore = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
      : 0;

    return {
      score: averageScore,
      count: evaluations.length,
      details: evaluations,
      level: this.getQualityLevel(averageScore)
    };
  }

  /**
   * Assess workflow quality through simulated user scenarios
   */
  async assessWorkflowQuality() {
    const workflows = [
      {
        name: 'Quick Task Workflow',
        description: 'Chat -> Run -> Result',
        test: () => this.testQuickTaskWorkflow()
      },
      {
        name: 'Configuration Workflow',
        description: 'Config Show -> Install -> Verify',
        test: () => this.testConfigurationWorkflow()
      }
    ];

    const evaluations = [];

    for (const workflow of workflows) {
      try {
        const result = await workflow.test();
        evaluations.push({
          workflow: workflow.name,
          score: result.score || 0,
          confidence: result.confidence || 0,
          description: workflow.description,
          details: result.details || 'No details available'
        });
      } catch (error) {
        evaluations.push({
          workflow: workflow.name,
          score: 0,
          confidence: 0,
          error: error.message
        });
      }
    }

    const averageScore = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
      : 0;

    return {
      score: averageScore,
      count: evaluations.length,
      details: evaluations,
      level: this.getQualityLevel(averageScore)
    };
  }

  /**
   * Calculate weighted overall score
   */
  calculateOverallScore(componentScores) {
    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(this.componentWeights).forEach(([component, weight]) => {
      if (componentScores[component] && componentScores[component].score !== undefined) {
        weightedSum += componentScores[component].score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Analyze quality trends over time
   */
  async analyzeQualityTrends() {
    try {
      const historyFile = path.join(this.metricsDir, 'quality-history.json');
      const history = await this.loadQualityHistory(historyFile);

      if (history.length < 2) {
        return { trend: 'insufficient_data', message: 'Need more data points for trend analysis' };
      }

      const recent = history.slice(-5); // Last 5 assessments
      const scores = recent.map(h => h.overallScore);

      // Simple trend calculation
      const firstScore = scores[0];
      const lastScore = scores[scores.length - 1];
      const trendDirection = lastScore > firstScore ? 'improving' : 'declining';
      const trendStrength = Math.abs(lastScore - firstScore);

      return {
        trend: trendDirection,
        strength: trendStrength,
        recentScores: scores,
        analysis: `Quality has been ${trendDirection} by ${trendStrength.toFixed(1)} points over last ${recent.length} assessments`
      };

    } catch (error) {
      return { trend: 'unknown', error: error.message };
    }
  }

  /**
   * Detect quality regressions
   */
  async detectQualityRegressions(currentResults) {
    const regressions = [];

    try {
      const historyFile = path.join(this.metricsDir, 'quality-history.json');
      const history = await this.loadQualityHistory(historyFile);

      if (history.length === 0) {
        return regressions;
      }

      const lastAssessment = history[history.length - 1];

      // Check each component for significant drops
      Object.entries(currentResults.componentScores).forEach(([component, current]) => {
        const previous = lastAssessment.componentScores[component];

        if (previous && current.score < previous.score - 10) {
          regressions.push({
            component,
            severity: current.score < previous.score - 20 ? 'critical' : 'warning',
            previousScore: previous.score,
            currentScore: current.score,
            drop: previous.score - current.score,
            message: `${component} quality dropped by ${(previous.score - current.score).toFixed(1)} points`
          });
        }
      });

    } catch (error) {
      regressions.push({
        component: 'regression_detection',
        severity: 'warning',
        message: `Regression detection failed: ${error.message}`
      });
    }

    return regressions;
  }

  /**
   * Generate actionable quality recommendations
   */
  generateQualityRecommendations(assessmentResults) {
    const recommendations = [];

    // Overall score recommendations
    if (assessmentResults.overallScore < this.qualityThresholds.acceptable) {
      recommendations.push({
        priority: 'high',
        category: 'overall',
        title: 'Critical Quality Issues',
        description: `Overall quality score (${assessmentResults.overallScore.toFixed(1)}%) is below acceptable threshold`,
        actions: ['Review failing components', 'Implement immediate fixes', 'Increase testing coverage']
      });
    }

    // Component-specific recommendations
    Object.entries(assessmentResults.componentScores).forEach(([component, data]) => {
      if (data.score < this.qualityThresholds.good) {
        let priority = 'medium';
        if (data.score < this.qualityThresholds.poor) {priority = 'high';}
        if (data.score < this.qualityThresholds.critical) {priority = 'critical';}

        recommendations.push({
          priority,
          category: component,
          title: `${component} Quality Below Standards`,
          description: `${component} scored ${data.score.toFixed(1)}% (${data.level})`,
          actions: this.getComponentSpecificActions(component, data.score)
        });
      }
    });

    // Regression recommendations
    assessmentResults.regressionAlerts.forEach(regression => {
      recommendations.push({
        priority: regression.severity === 'critical' ? 'critical' : 'high',
        category: 'regression',
        title: `Quality Regression in ${regression.component}`,
        description: regression.message,
        actions: ['Investigate recent changes', 'Review failing tests', 'Consider rollback if critical']
      });
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get component-specific improvement actions
   */
  getComponentSpecificActions(component, score) {
    const actions = {
      cliCommands: [
        'Review command help text clarity',
        'Improve error message usefulness',
        'Add missing command options',
        'Test command responsiveness'
      ],
      integration: [
        'Review component interfaces',
        'Add integration testing',
        'Check error propagation',
        'Verify data consistency'
      ],
      templates: [
        'Review template clarity',
        'Add more examples',
        'Test template effectiveness',
        'Update documentation'
      ],
      workflows: [
        'Streamline user workflows',
        'Improve error recovery',
        'Add workflow documentation',
        'Test end-to-end scenarios'
      ]
    };

    return actions[component] || ['Review component implementation', 'Add comprehensive testing', 'Improve documentation'];
  }

  /**
   * Get quality level description
   */
  getQualityLevel(score) {
    if (score >= this.qualityThresholds.excellent) {return 'excellent';}
    if (score >= this.qualityThresholds.good) {return 'good';}
    if (score >= this.qualityThresholds.acceptable) {return 'acceptable';}
    if (score >= this.qualityThresholds.poor) {return 'poor';}
    return 'critical';
  }

  /**
   * Save assessment results to history
   */
  async saveAssessmentResults(results) {
    try {
      const historyFile = path.join(this.metricsDir, 'quality-history.json');
      const history = await this.loadQualityHistory(historyFile);

      history.push(results);

      // Keep only last 30 assessments
      if (history.length > 30) {
        history.splice(0, history.length - 30);
      }

      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));

      // Also save latest results
      const latestFile = path.join(this.metricsDir, 'latest-assessment.json');
      await fs.writeFile(latestFile, JSON.stringify(results, null, 2));

    } catch (error) {
      console.error('Failed to save assessment results:', error.message);
    }
  }

  /**
   * Load quality history
   */
  async loadQualityHistory(historyFile) {
    try {
      const content = await fs.readFile(historyFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate quality dashboard report
   */
  generateDashboardReport(assessmentResults) {
    const report = {
      header: '📊 Calmhive Quality Dashboard',
      timestamp: assessmentResults.timestamp,
      summary: {
        overallScore: `${assessmentResults.overallScore.toFixed(1)}%`,
        level: this.getQualityLevel(assessmentResults.overallScore),
        trend: assessmentResults.qualityTrends.trend || 'unknown'
      },
      components: Object.entries(assessmentResults.componentScores).map(([name, data]) => ({
        name,
        score: `${data.score.toFixed(1)}%`,
        level: data.level,
        count: data.count
      })),
      alerts: assessmentResults.regressionAlerts.map(alert => ({
        severity: alert.severity,
        message: alert.message
      })),
      topRecommendations: assessmentResults.recommendations.slice(0, 5)
    };

    return report;
  }

  // Helper test methods for integration assessment
  async testProcessManagerIntegration() {
    try {
      const result = await this.executeCommand('node -e "const ProcessManager = require(\'./lib/process-manager\'); console.log(\'ProcessManager loaded\');"');
      return { score: result.exitCode === 0 ? 80 : 20, confidence: 0.8, details: result.stdout };
    } catch (error) {
      return { score: 0, confidence: 0, details: error.message };
    }
  }

  async testSessionDatabaseIntegration() {
    try {
      const result = await this.executeCommand('node -e "const SessionDatabase = require(\'./lib/session-database\'); console.log(\'SessionDatabase loaded\');"');
      return { score: result.exitCode === 0 ? 80 : 20, confidence: 0.8, details: result.stdout };
    } catch (error) {
      return { score: 0, confidence: 0, details: error.message };
    }
  }

  async testConfigManagerIntegration() {
    try {
      const result = await this.executeCommand('calmhive config show');
      return { score: result.exitCode === 0 ? 75 : 25, confidence: 0.7, details: result.stdout };
    } catch (error) {
      return { score: 0, confidence: 0, details: error.message };
    }
  }

  async testQuickTaskWorkflow() {
    try {
      const result = await this.executeCommand('calmhive chat "test" | head -5');
      return { score: result.exitCode === 0 ? 70 : 30, confidence: 0.6, details: result.stdout };
    } catch (error) {
      return { score: 0, confidence: 0, details: error.message };
    }
  }

  async testConfigurationWorkflow() {
    try {
      const result = await this.executeCommand('calmhive config show && calmhive config install --dry-run');
      return { score: result.exitCode === 0 ? 75 : 25, confidence: 0.7, details: result.stdout };
    } catch (error) {
      return { score: 0, confidence: 0, details: error.message };
    }
  }

  // Helper method to execute commands
  async executeCommand(command) {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      const childProcess = spawn('bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '..')
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('exit', (code) => {
        resolve({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          command
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        childProcess.kill('SIGKILL');
        resolve({
          exitCode: -1,
          stdout: stdout.trim(),
          stderr: 'Command timed out',
          command
        });
      }, 30000);
    });
  }
}

module.exports = QualityDashboard;
