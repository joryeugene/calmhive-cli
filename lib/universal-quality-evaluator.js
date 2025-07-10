/**
 * Universal Quality Evaluator
 *
 * Extends AFkEvaluator to provide Claude-powered quality assessment
 * for all Calmhive components: CLI commands, templates, workflows, integrations
 *
 * Replaces superficial validation (exit codes, string matching, file length)
 * with meaningful quality evaluation that catches real bugs and UX issues.
 */

const AFkEvaluator = require('./afk-evaluator');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class UniversalQualityEvaluator extends AFkEvaluator {
  constructor() {
    super();

    // Extended evaluation prompts for different component types
    this.evaluationPrompts = {
      ...this.evaluationPrompts,

      cliCommand: `
You are evaluating the quality of a CLI command execution and its output.

Rate the output on a scale of 0-10 for each criteria:

**FUNCTIONALITY (0-10):**
- Does the command actually work as intended?
- Are the core features functioning correctly?
- Does it handle inputs appropriately?

**USER EXPERIENCE (0-10):**
- Is the output clear and helpful to users?
- Are error messages actionable and informative?
- Is the interface intuitive and responsive?

**RELIABILITY (0-10):**
- Does it handle edge cases gracefully?
- Are error conditions managed properly?
- Is the behavior consistent and predictable?

**COMPLETENESS (0-10):**
- Are all expected features working?
- Is the help documentation adequate?
- Does it integrate well with other components?

Format your response as:
FUNCTIONALITY: X/10 - brief explanation
USER_EXPERIENCE: X/10 - brief explanation
RELIABILITY: X/10 - brief explanation
COMPLETENESS: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Command executed: {{COMMAND}}
Expected behavior: {{EXPECTED_BEHAVIOR}}
Actual output: {{OUTPUT}}
Error output: {{ERROR_OUTPUT}}

Content to evaluate:
`,

      templateEffectiveness: `
You are evaluating the effectiveness of a configuration template or rule set.

Rate the template on a scale of 0-10 for each criteria:

**RULE_QUALITY (0-10):**
- Are the rules technically sound and practical?
- Do they follow established best practices?
- Are they specific enough to be actionable?

**EFFECTIVENESS (0-10):**
- Do the rules actually improve task completion?
- Would they help prevent common mistakes?
- Are they appropriate for the intended use case?

**CLARITY (0-10):**
- Are the instructions clear and unambiguous?
- Is the language appropriate for the target audience?
- Are examples helpful and relevant?

**COMPLETENESS (0-10):**
- Does the template cover the essential aspects?
- Are important edge cases addressed?
- Is the coverage appropriate for the scope?

Format your response as:
RULE_QUALITY: X/10 - brief explanation
EFFECTIVENESS: X/10 - brief explanation
CLARITY: X/10 - brief explanation
COMPLETENESS: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Template type: {{TEMPLATE_TYPE}}
Intended use: {{INTENDED_USE}}
Template content: {{TEMPLATE_CONTENT}}

Content to evaluate:
`,

      workflowValidation: `
You are evaluating the quality of a complete user workflow or integration scenario.

Rate the workflow on a scale of 0-10 for each criteria:

**WORKFLOW_COMPLETION (0-10):**
- Does the workflow complete the intended task successfully?
- Are all steps properly connected and functional?
- Does it achieve the user's actual goal?

**USER_EXPERIENCE (0-10):**
- Is the workflow intuitive and easy to follow?
- Are error messages helpful during failures?
- Does it provide appropriate feedback at each step?

**RELIABILITY (0-10):**
- Does it handle unexpected inputs gracefully?
- Are error recovery mechanisms effective?
- Is the behavior consistent across different scenarios?

**INTEGRATION_QUALITY (0-10):**
- Do different components work together seamlessly?
- Is data passed correctly between components?
- Are there any integration bottlenecks or failures?

Format your response as:
WORKFLOW_COMPLETION: X/10 - brief explanation
USER_EXPERIENCE: X/10 - brief explanation
RELIABILITY: X/10 - brief explanation
INTEGRATION_QUALITY: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Workflow description: {{WORKFLOW_DESCRIPTION}}
Expected outcome: {{EXPECTED_OUTCOME}}
Actual results: {{ACTUAL_RESULTS}}

Content to evaluate:
`,

      systemIntegration: `
You are evaluating the quality of system integration between multiple components.

Rate the integration on a scale of 0-10 for each criteria:

**COMPONENT_INTERACTION (0-10):**
- Do components communicate effectively with each other?
- Is data passed correctly between systems?
- Are interfaces well-defined and stable?

**ERROR_HANDLING (0-10):**
- Are failures in one component handled gracefully by others?
- Is error propagation appropriate and informative?
- Do recovery mechanisms work across component boundaries?

**PERFORMANCE (0-10):**
- Does the integration maintain acceptable performance?
- Are there unnecessary bottlenecks or delays?
- Is resource usage optimized across components?

**MAINTAINABILITY (0-10):**
- Is the integration architecture clean and understandable?
- Are dependencies managed appropriately?
- Would changes be easy to implement and test?

Format your response as:
COMPONENT_INTERACTION: X/10 - brief explanation
ERROR_HANDLING: X/10 - brief explanation
PERFORMANCE: X/10 - brief explanation
MAINTAINABILITY: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Integration scenario: {{INTEGRATION_SCENARIO}}
Components involved: {{COMPONENTS}}
Test results: {{TEST_RESULTS}}

Content to evaluate:
`
    };

    // Confidence scoring thresholds
    this.confidenceThresholds = {
      high: 0.85,      // 85%+ - Very reliable evaluation
      medium: 0.65,    // 65-84% - Moderately reliable
      low: 0.45,       // 45-64% - Low confidence
      unreliable: 0.45 // <45% - Evaluation may be unreliable
    };
  }


  /**
   * Evaluate template effectiveness
   */
  async evaluateTemplate(templateType, templateContent, intendedUse, testResults = '') {
    const options = {
      templateType,
      templateContent,
      intendedUse,
      testResults
    };

    return this.evaluateWithConfidence('templateEffectiveness', testResults, options);
  }

  /**
   * Evaluate complete workflow quality
   */
  async evaluateWorkflow(workflowDescription, expectedOutcome, actualResults) {
    const options = {
      workflowDescription,
      expectedOutcome,
      actualResults
    };

    return this.evaluateWithConfidence('workflowValidation', actualResults, options);
  }

  /**
   * Evaluate system integration quality
   */
  async evaluateIntegration(integrationScenario, components, testResults) {
    const options = {
      integrationScenario,
      components: Array.isArray(components) ? components.join(', ') : components,
      testResults
    };

    return this.evaluateWithConfidence('systemIntegration', testResults, options);
  }

  /**
   * Enhanced evaluation with confidence scoring
   */
  async evaluateWithConfidence(evaluationType, content, options = {}) {
    try {
      console.log(`🧮 Universal quality evaluation: ${evaluationType}`);

      // Build evaluation prompt with template replacement
      const prompt = this.buildEvaluationPrompt(evaluationType, { output: content }, options);

      // Run Claude evaluation
      const evaluation = await this.runClaudeEvaluation(prompt);

      // Parse results with confidence scoring
      const results = this.parseEvaluationResults(evaluation);

      // Calculate confidence score based on evaluation quality
      const confidence = this.calculateConfidenceScore(results, evaluation);

      console.log(`📊 ${evaluationType} evaluation: ${results.totalScore}/40 (confidence: ${confidence.toFixed(2)})`);

      return {
        success: true,
        evaluationType,
        evaluation: results,
        confidence: {
          score: confidence,
          level: this.getConfidenceLevel(confidence),
          reliable: confidence >= this.confidenceThresholds.medium
        },
        rawOutput: evaluation
      };

    } catch (error) {
      console.error(`❌ Universal evaluation error (${evaluationType}):`, error.message);
      return {
        success: false,
        evaluationType,
        error: error.message,
        confidence: {
          score: 0,
          level: 'unreliable',
          reliable: false
        }
      };
    }
  }

  /**
   * Build evaluation prompt with template variable replacement
   */
  buildEvaluationPrompt(evaluationType, sessionContent, options = {}) {
    let prompt = this.evaluationPrompts[evaluationType] || this.evaluationPrompts.codeAnalysis;

    // Replace template variables
    const replacements = {
      '{{COMMAND}}': options.command || 'N/A',
      '{{EXPECTED_BEHAVIOR}}': options.expectedBehavior || 'N/A',
      '{{OUTPUT}}': options.output || sessionContent.output || 'N/A',
      '{{ERROR_OUTPUT}}': options.errorOutput || 'N/A',
      '{{TEMPLATE_TYPE}}': options.templateType || 'N/A',
      '{{TEMPLATE_CONTENT}}': options.templateContent || 'N/A',
      '{{INTENDED_USE}}': options.intendedUse || 'N/A',
      '{{WORKFLOW_DESCRIPTION}}': options.workflowDescription || 'N/A',
      '{{EXPECTED_OUTCOME}}': options.expectedOutcome || 'N/A',
      '{{ACTUAL_RESULTS}}': options.actualResults || 'N/A',
      '{{INTEGRATION_SCENARIO}}': options.integrationScenario || 'N/A',
      '{{COMPONENTS}}': options.components || 'N/A',
      '{{TEST_RESULTS}}': options.testResults || 'N/A',
      // Behavioral evaluation placeholders
      '{{AI_RESPONSE}}': options.aiResponse || sessionContent.output || 'N/A',
      '{{EXPECTED_PATTERNS}}': options.expectedPatterns || 'N/A',
      '{{CONTEXT}}': options.context || 'N/A',
      '{{CLAIMS_MADE}}': options.claimsMade || 'N/A',
      '{{EVIDENCE_PROVIDED}}': options.evidenceProvided || 'N/A',
      '{{FORBIDDEN_PATTERNS}}': options.forbiddenPatterns || 'N/A',
      '{{AUTHENTIC_ALTERNATIVES}}': options.authenticAlternatives || 'N/A',
      '{{COMMIT_MESSAGES}}': options.commitMessages || 'N/A',
      '{{GIT_OPERATIONS}}': options.gitOperations || 'N/A',
      '{{TASK_PATTERNS}}': options.taskPatterns || 'N/A',
      '{{PARALLEL_OPPORTUNITIES}}': options.parallelOpportunities || 'N/A',
      '{{TODO_OPERATIONS}}': options.todoOperations || 'N/A',
      '{{COMPLETION_EVIDENCE}}': options.completionEvidence || 'N/A'
    };

    // Apply all replacements
    Object.entries(replacements).forEach(([placeholder, value]) => {
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    });

    // Add content for evaluation
    const contentToEvaluate = this.prepareContentForEvaluation(sessionContent);

    return prompt + contentToEvaluate;
  }

  /**
   * Prepare content for evaluation (override parent method)
   */
  prepareContentForEvaluation(sessionContent) {
    // Handle simple string content
    if (typeof sessionContent === 'string') {
      return sessionContent;
    }
    
    // Handle structured content
    if (sessionContent && sessionContent.output) {
      return sessionContent.output;
    }
    
    // Default to empty string
    return '';
  }

  /**
   * Calculate confidence score based on evaluation quality
   */
  calculateConfidenceScore(results, evaluationText) {
    let confidence = 0.5; // Base confidence

    // Boost confidence for well-structured responses
    if (results.totalScore > 0) {confidence += 0.2;}
    if (results.feedback && results.feedback.length > 20) {confidence += 0.15;}

    // Check for specific quality indicators
    const qualityIndicators = [
      /specific|detailed|concrete/i,
      /example|instance|case/i,
      /improve|enhance|optimize/i,
      /because|since|due to/i
    ];

    qualityIndicators.forEach(indicator => {
      if (indicator.test(evaluationText)) {confidence += 0.05;}
    });

    // Boost confidence for consistent scoring patterns
    if (Object.keys(results.scores).length >= 3) {confidence += 0.1;}

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Get confidence level description
   */
  getConfidenceLevel(score) {
    if (score >= this.confidenceThresholds.high) {return 'high';}
    if (score >= this.confidenceThresholds.medium) {return 'medium';}
    if (score >= this.confidenceThresholds.low) {return 'low';}
    return 'unreliable';
  }

  /**
   * Batch evaluation for multiple items
   */
  async evaluateBatch(evaluations) {
    const results = [];

    for (const evaluation of evaluations) {
      const { type, ...params } = evaluation;

      let result;
      switch (type) {
      case 'cliCommand':
        result = await this.evaluateCliCommand(...Object.values(params));
        break;
      case 'template':
        result = await this.evaluateTemplate(...Object.values(params));
        break;
      case 'workflow':
        result = await this.evaluateWorkflow(...Object.values(params));
        break;
      case 'integration':
        result = await this.evaluateIntegration(...Object.values(params));
        break;
      default:
        result = { success: false, error: `Unknown evaluation type: ${type}` };
      }

      results.push({ ...result, originalParams: params });
    }

    return results;
  }

  /**
   * Generate quality report with recommendations
   */
  generateQualityReport(evaluationResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: evaluationResults.length,
        passed: evaluationResults.filter(r => r.success && r.evaluation?.percentage >= 60).length,
        failed: evaluationResults.filter(r => !r.success || r.evaluation?.percentage < 60).length,
        averageScore: 0,
        averageConfidence: 0
      },
      recommendations: [],
      details: evaluationResults
    };

    // Calculate averages
    const successfulEvaluations = evaluationResults.filter(r => r.success);
    if (successfulEvaluations.length > 0) {
      report.summary.averageScore = successfulEvaluations
        .reduce((sum, r) => sum + (r.evaluation?.percentage || 0), 0) / successfulEvaluations.length;

      report.summary.averageConfidence = successfulEvaluations
        .reduce((sum, r) => sum + (r.confidence?.score || 0), 0) / successfulEvaluations.length;
    }

    // Generate recommendations
    const lowScoreEvaluations = evaluationResults.filter(r => r.success && r.evaluation?.percentage < 70);
    lowScoreEvaluations.forEach(evaluation => {
      report.recommendations.push({
        type: evaluation.evaluationType,
        score: evaluation.evaluation.percentage,
        feedback: evaluation.evaluation.feedback,
        priority: evaluation.evaluation.percentage < 50 ? 'high' : 'medium'
      });
    });

    return report;
  }

  /**
   * Override runClaudeEvaluation to support mocking for fast testing
   */
  async runClaudeEvaluation(prompt) {
    if (this.isMockingEnabled) {
      console.log('🎭 Using mock Claude evaluation for fast testing');

      // Determine evaluation type from prompt content
      let evaluationType = 'cliCommand';
      if (prompt.includes('template') || prompt.includes('Template')) {
        evaluationType = 'template';
      } else if (prompt.includes('workflow') || prompt.includes('Workflow')) {
        evaluationType = 'workflow';
      } else if (prompt.includes('integration') || prompt.includes('Integration')) {
        evaluationType = 'integration';
      }

      // Generate mock evaluation
      const mockResult = this.mockEvaluator.getMockEvaluationWithVariation(prompt, evaluationType);

      // Add slight delay to simulate processing (50-200ms)
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));

      return mockResult.rawText;
    }

    // Use real Claude evaluation for production/reality checks
    console.log('🤖 Using real Claude evaluation');
    return super.runClaudeEvaluation(prompt);
  }

  /**
   * Enhanced CLI command evaluation with mocking support
   */
  async evaluateCliCommand(command, output, errorOutput = '', expectedBehavior = '') {
    if (this.isMockingEnabled) {
      console.log(`🎭 Mock evaluating CLI command: ${command.substring(0, 50)}...`);

      const mockResult = this.mockEvaluator.getMockCliCommandEvaluation(command, output, expectedBehavior);

      // Add slight delay for realism
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      return {
        success: true,
        evaluationType: 'cliCommand',
        evaluation: mockResult,
        confidence: {
          score: 0.85 + Math.random() * 0.1, // 0.85-0.95 for mocks
          level: 'high',
          reliable: true
        },
        rawOutput: mockResult.rawText,
        mockGenerated: true
      };
    }

    // Use real evaluation
    return super.evaluateCliCommand ?
      super.evaluateCliCommand(command, output, errorOutput, expectedBehavior) :
      this.evaluateWithConfidence('cliCommand', output, { command, expectedBehavior, output, errorOutput });
  }
}

module.exports = UniversalQualityEvaluator;
