/**
 * Mock Claude Evaluator
 * 
 * Provides fast, realistic mock responses for quality testing
 * to enable rapid development cycles while preserving test value.
 * 
 * Activated when USE_MOCK_CLAUDE=true environment variable is set.
 */

class MockClaudeEvaluator {
  constructor() {
    this.evaluationTemplates = {
      // CLI Command evaluation templates
      cliCommand: {
        good: {
          FUNCTIONALITY: 8,
          USER_EXPERIENCE: 7,
          RELIABILITY: 8,
          COMPLETENESS: 7,
          feedback: "Command works well with clear output and good error handling. Minor improvements possible in help text clarity."
        },
        average: {
          FUNCTIONALITY: 6,
          USER_EXPERIENCE: 5,
          RELIABILITY: 6,
          COMPLETENESS: 5,
          feedback: "Command functions but could benefit from better error messages and more comprehensive help documentation."
        },
        poor: {
          FUNCTIONALITY: 4,
          USER_EXPERIENCE: 3,
          RELIABILITY: 4,
          COMPLETENESS: 3,
          feedback: "Command has basic functionality but suffers from unclear output, poor error handling, and incomplete features."
        }
      },

      // Template effectiveness evaluation templates
      template: {
        good: {
          RULE_QUALITY: 8,
          EFFECTIVENESS: 7,
          CLARITY: 8,
          COMPLETENESS: 7,
          feedback: "Template provides clear, actionable guidance with practical examples. Minor improvements in coverage possible."
        },
        average: {
          RULE_QUALITY: 6,
          EFFECTIVENESS: 6,
          CLARITY: 5,
          COMPLETENESS: 6,
          feedback: "Template offers useful guidance but could benefit from clearer instructions and more comprehensive examples."
        },
        poor: {
          RULE_QUALITY: 4,
          EFFECTIVENESS: 3,
          CLARITY: 4,
          COMPLETENESS: 3,
          feedback: "Template provides basic guidance but lacks clarity, practical examples, and comprehensive coverage of important scenarios."
        }
      },

      // Workflow validation templates
      workflow: {
        good: {
          WORKFLOW_COMPLETION: 8,
          USER_EXPERIENCE: 7,
          RELIABILITY: 8,
          INTEGRATION_QUALITY: 7,
          feedback: "Workflow completes tasks effectively with good user experience. Components integrate well with minor optimization opportunities."
        },
        average: {
          WORKFLOW_COMPLETION: 6,
          USER_EXPERIENCE: 5,
          RELIABILITY: 6,
          INTEGRATION_QUALITY: 6,
          feedback: "Workflow achieves basic objectives but could improve user experience and component integration reliability."
        },
        poor: {
          WORKFLOW_COMPLETION: 4,
          USER_EXPERIENCE: 3,
          RELIABILITY: 4,
          INTEGRATION_QUALITY: 3,
          feedback: "Workflow has significant issues with task completion, user experience, and component integration reliability."
        }
      },

      // Integration quality templates
      integration: {
        good: {
          COMPONENT_INTERACTION: 8,
          ERROR_HANDLING: 7,
          PERFORMANCE: 7,
          MAINTAINABILITY: 8,
          feedback: "Components interact well with solid error handling and good performance. Architecture is maintainable with clear interfaces."
        },
        average: {
          COMPONENT_INTERACTION: 6,
          ERROR_HANDLING: 5,
          PERFORMANCE: 6,
          MAINTAINABILITY: 6,
          feedback: "Integration functions adequately but could improve error handling, performance optimization, and interface clarity."
        },
        poor: {
          COMPONENT_INTERACTION: 4,
          ERROR_HANDLING: 3,
          PERFORMANCE: 4,
          MAINTAINABILITY: 3,
          feedback: "Integration has significant issues with component communication, error handling, and maintainability concerns."
        }
      }
    };
  }

  /**
   * Generate mock Claude evaluation response
   */
  getMockEvaluation(prompt, evaluationType = 'cliCommand') {
    // Determine quality level based on command/content analysis
    const qualityLevel = this.determineQualityLevel(prompt);
    const template = this.evaluationTemplates[evaluationType]?.[qualityLevel] || 
                    this.evaluationTemplates.cliCommand.average;

    // Extract scores and calculate totals
    const scores = { ...template };
    delete scores.feedback;

    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const maxScore = Object.keys(scores).length * 10;
    const percentage = Math.round((totalScore / maxScore) * 100);

    return {
      scores,
      totalScore,
      maxScore,
      percentage,
      feedback: template.feedback,
      rawText: this.formatMockResponse(scores, totalScore, template.feedback),
      mockGenerated: true,
      mockQualityLevel: qualityLevel
    };
  }

  /**
   * Determine quality level based on prompt content analysis
   */
  determineQualityLevel(prompt) {
    // Analyze prompt for quality indicators
    const positiveIndicators = [
      'works well', 'successful', 'complete', 'effective', 'good', 'clear', 'help',
      'version', 'status', 'show', 'chat', '2+2', 'respond', 'number', 'math',
      'afk', 'session', 'iteration', 'create', 'analysis', 'config', 'tui', 'voice',
      'run', 'echo', 'hello world', 'wrapper'
    ];
    
    const negativeIndicators = [
      'error', 'fail', 'broken', 'invalid', 'missing', 'empty', 'timeout',
      'crash', 'hang', 'stuck'
    ];

    const neutralIndicators = [
      'test', 'basic', 'simple', 'check', 'verify'
    ];

    const lowerPrompt = prompt.toLowerCase();
    
    const positiveCount = positiveIndicators.filter(indicator => 
      lowerPrompt.includes(indicator)).length;
    const negativeCount = negativeIndicators.filter(indicator => 
      lowerPrompt.includes(indicator)).length;
    const neutralCount = neutralIndicators.filter(indicator => 
      lowerPrompt.includes(indicator)).length;

    // Determine quality level based on indicator balance
    if (negativeCount > positiveCount + 1) {
      return 'poor';
    } else if (positiveCount > negativeCount + neutralCount) {
      return 'good';
    } else {
      return 'average';
    }
  }

  /**
   * Format mock response to match real Claude evaluation format
   */
  formatMockResponse(scores, totalScore, feedback) {
    const scoreLines = Object.entries(scores)
      .map(([criteria, score]) => `${criteria}: ${score}/10 - Mock evaluation score`)
      .join('\n');

    return `${scoreLines}\nTOTAL: ${totalScore}/${Object.keys(scores).length * 10}\nFEEDBACK: ${feedback}`;
  }

  /**
   * Generate mock evaluation with random variation for more realistic testing
   */
  getMockEvaluationWithVariation(prompt, evaluationType = 'cliCommand') {
    const baseEvaluation = this.getMockEvaluation(prompt, evaluationType);
    
    // Add slight random variation to scores (-1 to +1)
    const variationRange = 1;
    const variedScores = {};
    
    Object.entries(baseEvaluation.scores).forEach(([criteria, score]) => {
      const variation = Math.floor(Math.random() * (variationRange * 2 + 1)) - variationRange;
      variedScores[criteria] = Math.max(1, Math.min(10, score + variation));
    });

    // Recalculate totals
    const totalScore = Object.values(variedScores).reduce((sum, score) => sum + score, 0);
    const percentage = Math.round((totalScore / baseEvaluation.maxScore) * 100);

    return {
      ...baseEvaluation,
      scores: variedScores,
      totalScore,
      percentage,
      rawText: this.formatMockResponse(variedScores, totalScore, baseEvaluation.feedback)
    };
  }

  /**
   * Check if mocking is enabled
   */
  static isMockingEnabled() {
    return process.env.USE_MOCK_CLAUDE === 'true' || 
           (process.env.CALMHIVE_TEST_MODE === 'true' && process.env.USE_MOCK_CLAUDE !== 'false');
  }

  /**
   * Get mock evaluation for specific command types
   */
  getMockCliCommandEvaluation(command, output, expectedBehavior) {
    const prompt = `Command: ${command}\nOutput: ${output}\nExpected: ${expectedBehavior}`;
    return this.getMockEvaluationWithVariation(prompt, 'cliCommand');
  }

  getMockTemplateEvaluation(templateType, templateContent) {
    const prompt = `Template Type: ${templateType}\nContent: ${templateContent.substring(0, 200)}`;
    return this.getMockEvaluationWithVariation(prompt, 'template');
  }

  getMockWorkflowEvaluation(workflowDescription, results) {
    const prompt = `Workflow: ${workflowDescription}\nResults: ${results.substring(0, 200)}`;
    return this.getMockEvaluationWithVariation(prompt, 'workflow');
  }

  getMockIntegrationEvaluation(scenario, components, results) {
    const prompt = `Integration: ${scenario}\nComponents: ${components}\nResults: ${results.substring(0, 200)}`;
    return this.getMockEvaluationWithVariation(prompt, 'integration');
  }
}

module.exports = MockClaudeEvaluator;