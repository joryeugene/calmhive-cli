/**
 * AFk Session Output Evaluator
 *
 * Uses claude -p to evaluate the quality of AFk session outputs
 * and provide scores/feedback on task completion
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class AFkEvaluator {
  constructor() {
    this.evaluationPrompts = {
      codeAnalysis: `
You are evaluating the output of an AFk session that was asked to analyze code and create a report.

Rate the output on a scale of 0-10 for each criteria:

**COMPLETENESS (0-10):**
- Did it identify actual code issues?
- Were specific files and functions mentioned?
- Does it include actionable recommendations?

**QUALITY (0-10):**
- Are the suggestions technically sound?
- Is the analysis detailed and specific?
- Are code examples provided where helpful?

**ACCURACY (0-10):**
- Are the identified issues real problems?
- Are the suggested solutions appropriate?
- Is the technical information correct?

**USEFULNESS (0-10):**
- Would a developer find this helpful?
- Are priorities clearly indicated?
- Can the recommendations be acted upon?

Format your response as:
COMPLETENESS: X/10 - brief explanation
QUALITY: X/10 - brief explanation  
ACCURACY: X/10 - brief explanation
USEFULNESS: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Content to evaluate:
`,

      fileCreation: `
You are evaluating whether an AFk session successfully completed a file creation task.

Rate the output on a scale of 0-10 for each criteria:

**TASK COMPLETION (0-10):**
- Were the requested files actually created?
- Do the files contain meaningful content?
- Was the task completed as specified?

**CONTENT QUALITY (0-10):**
- Is the content well-structured and clear?
- Does it serve the intended purpose?
- Is the writing/code quality good?

**ACCURACY (0-10):**
- Is the information factually correct?
- Are any code examples syntactically valid?
- Is the content relevant to the request?

**USEFULNESS (0-10):**
- Would this output be helpful to a developer?
- Does it provide actionable information?
- Is it appropriately detailed for the task?

Format your response as:
TASK_COMPLETION: X/10 - brief explanation
CONTENT_QUALITY: X/10 - brief explanation
ACCURACY: X/10 - brief explanation
USEFULNESS: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Task requested: {{TASK}}
Files expected: {{EXPECTED_FILES}}
Files actually created: {{ACTUAL_FILES}}

Content to evaluate:
`,

      bugFix: `
You are evaluating an AFk session that was asked to identify and fix bugs.

Rate the output on a scale of 0-10 for each criteria:

**BUG IDENTIFICATION (0-10):**
- Were actual bugs correctly identified?
- Are the problem descriptions accurate?
- Were root causes analyzed properly?

**SOLUTION QUALITY (0-10):**
- Are the proposed fixes technically sound?
- Do solutions address root causes?
- Are fixes minimal and focused?

**IMPLEMENTATION (0-10):**
- Were actual code changes made?
- Are the changes syntactically correct?
- Do changes follow best practices?

**TESTING (0-10):**
- Were test cases considered or added?
- Is there evidence of verification?
- Are edge cases addressed?

Format your response as:
BUG_IDENTIFICATION: X/10 - brief explanation
SOLUTION_QUALITY: X/10 - brief explanation
IMPLEMENTATION: X/10 - brief explanation
TESTING: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Content to evaluate:
`,

      performance: `
You are evaluating an AFk session focused on performance optimization.

Rate the output on a scale of 0-10 for each criteria:

**ANALYSIS DEPTH (0-10):**
- Were performance bottlenecks correctly identified?
- Are metrics and benchmarks provided?
- Is the analysis data-driven?

**OPTIMIZATION QUALITY (0-10):**
- Are the optimizations technically sound?
- Do they address the actual bottlenecks?
- Are trade-offs clearly explained?

**IMPLEMENTATION (0-10):**
- Were optimizations actually implemented?
- Is the code clean and maintainable?
- Are changes well-documented?

**VERIFICATION (0-10):**
- Are performance improvements measured?
- Is there before/after comparison?
- Are results reproducible?

Format your response as:
ANALYSIS_DEPTH: X/10 - brief explanation
OPTIMIZATION_QUALITY: X/10 - brief explanation
IMPLEMENTATION: X/10 - brief explanation
VERIFICATION: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Content to evaluate:
`,

      security: `
You are evaluating an AFk session focused on security analysis.

Rate the output on a scale of 0-10 for each criteria:

**VULNERABILITY IDENTIFICATION (0-10):**
- Were real security issues found?
- Are OWASP/CWE classifications used?
- Is severity properly assessed?

**RISK ASSESSMENT (0-10):**
- Are attack vectors clearly explained?
- Is business impact considered?
- Are priorities well-established?

**REMEDIATION (0-10):**
- Are fixes comprehensive and correct?
- Do they follow security best practices?
- Are defense-in-depth principles applied?

**VERIFICATION (0-10):**
- Are fixes tested for effectiveness?
- Is there evidence of security testing?
- Are regression tests included?

Format your response as:
VULNERABILITY_IDENTIFICATION: X/10 - brief explanation
RISK_ASSESSMENT: X/10 - brief explanation
REMEDIATION: X/10 - brief explanation
VERIFICATION: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Content to evaluate:
`,

      documentation: `
You are evaluating an AFk session focused on documentation creation.

Rate the output on a scale of 0-10 for each criteria:

**COMPLETENESS (0-10):**
- Are all requested topics covered?
- Is necessary context provided?
- Are examples included where helpful?

**CLARITY (0-10):**
- Is the writing clear and concise?
- Is technical jargon explained?
- Is the structure logical?

**ACCURACY (0-10):**
- Is information technically correct?
- Are code examples valid?
- Are references accurate?

**USEFULNESS (0-10):**
- Does it serve the intended audience?
- Is it actionable and practical?
- Will it improve understanding?

Format your response as:
COMPLETENESS: X/10 - brief explanation
CLARITY: X/10 - brief explanation
ACCURACY: X/10 - brief explanation
USEFULNESS: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Content to evaluate:
`,

      refactoring: `
You are evaluating an AFk session focused on code refactoring.

Rate the output on a scale of 0-10 for each criteria:

**CODE QUALITY (0-10):**
- Is the refactored code cleaner?
- Are design patterns properly applied?
- Is coupling reduced?

**MAINTAINABILITY (0-10):**
- Is the code more readable?
- Are abstractions appropriate?
- Is complexity reduced?

**SAFETY (0-10):**
- Are behavior changes avoided?
- Are tests maintained/updated?
- Is backward compatibility preserved?

**COMPLETENESS (0-10):**
- Was the entire scope addressed?
- Are all code smells resolved?
- Is technical debt reduced?

Format your response as:
CODE_QUALITY: X/10 - brief explanation
MAINTAINABILITY: X/10 - brief explanation
SAFETY: X/10 - brief explanation
COMPLETENESS: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 2-3 sentences of constructive feedback

Content to evaluate:
`
    };
  }

  /**
   * Evaluate AFk session output using claude -p
   */
  async evaluateSessionOutput(sessionId, taskType = 'codeAnalysis', options = {}) {
    try {
      console.log(`🧮 Evaluating AFk session: ${sessionId}`);

      // Gather session output content
      const sessionContent = await this.gatherSessionContent(sessionId, options);

      if (!sessionContent) {
        return {
          success: false,
          error: 'No session content found to evaluate'
        };
      }

      // Select appropriate evaluation prompt
      const prompt = this.buildEvaluationPrompt(taskType, sessionContent, options);

      // Use claude -p to evaluate
      const evaluation = await this.runClaudeEvaluation(prompt);

      // Parse evaluation results
      const results = this.parseEvaluationResults(evaluation);

      console.log(`📊 Session evaluation complete: ${results.totalScore}/40`);
      return {
        success: true,
        sessionId,
        taskType,
        evaluation: results,
        rawOutput: evaluation
      };

    } catch (error) {
      console.error(`❌ Evaluation error for ${sessionId}:`, error.message);
      return {
        success: false,
        sessionId,
        error: error.message
      };
    }
  }

  /**
   * Gather all relevant content from an AFk session
   */
  async gatherSessionContent(sessionId, options = {}) {
    const content = {
      logs: '',
      createdFiles: [],
      output: '',
      metadata: {}
    };

    try {
      // Try multiple log locations
      const logPaths = [
        path.join(process.env.HOME, '.claude', 'calmhive', 'v3', 'logs', `${sessionId}.log`),
        path.join(process.env.HOME, '.claude', 'afk_registry', sessionId, 'worker.log'),
        path.join(process.env.HOME, '.claude', 'afk_registry', sessionId, 'context-monitor.log')
      ];

      for (const logPath of logPaths) {
        try {
          const logContent = await fs.readFile(logPath, 'utf8');
          content.logs += logContent + '\\n\\n';
        } catch (error) {
          // Log file doesn't exist at this path
        }
      }

      // Check for created files if specified
      if (options.expectedFiles) {
        for (const filePath of options.expectedFiles) {
          try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            content.createdFiles.push({
              path: filePath,
              content: fileContent,
              size: fileContent.length
            });
          } catch (error) {
            content.createdFiles.push({
              path: filePath,
              error: error.message,
              size: 0
            });
          }
        }
      }

      // Get session database info if available
      try {
        const SessionDatabase = require('./session-database');
        const sessionDb = new SessionDatabase();
        const session = await sessionDb.getSession(sessionId);
        if (session) {
          content.metadata = {
            task: session.task,
            status: session.status,
            iterations: session.iterations,
            currentIteration: session.currentIteration,
            progress: session.progress,
            output: session.output || '',
            error: session.error
          };
          content.output = session.output || '';
        }
      } catch (error) {
        // Session database not available
      }

      return content;

    } catch (error) {
      console.error('Error gathering session content:', error);
      return null;
    }
  }

  /**
   * Build evaluation prompt based on task type and content
   */
  buildEvaluationPrompt(taskType, sessionContent, options = {}) {
    let prompt = this.evaluationPrompts[taskType] || this.evaluationPrompts.codeAnalysis;

    // Replace template variables
    if (options.task) {
      prompt = prompt.replace('{{TASK}}', options.task);
    }

    if (options.expectedFiles) {
      prompt = prompt.replace('{{EXPECTED_FILES}}', options.expectedFiles.join(', '));
    }

    if (sessionContent.createdFiles) {
      const actualFiles = sessionContent.createdFiles
        .filter(f => !f.error)
        .map(f => `${f.path} (${f.size} bytes)`)
        .join(', ');
      prompt = prompt.replace('{{ACTUAL_FILES}}', actualFiles || 'None');
    }

    // Prepare content for evaluation
    const contentToEvaluate = this.prepareContentForEvaluation(sessionContent);

    return prompt + contentToEvaluate;
  }

  /**
   * Prepare session content for evaluation
   */
  prepareContentForEvaluation(sessionContent) {
    let evaluation = '';

    // Add session metadata
    if (sessionContent.metadata.task) {
      evaluation += `ORIGINAL TASK: ${sessionContent.metadata.task}\\n\\n`;
    }

    // Add session output
    if (sessionContent.output) {
      evaluation += `SESSION OUTPUT:\\n${sessionContent.output}\\n\\n`;
    }

    // Add created files content
    if (sessionContent.createdFiles.length > 0) {
      evaluation += 'CREATED FILES:\\n';
      sessionContent.createdFiles.forEach(file => {
        if (file.error) {
          evaluation += `❌ ${file.path}: ${file.error}\\n`;
        } else {
          evaluation += `✅ ${file.path} (${file.size} bytes):\\n${file.content.substring(0, 2000)}${file.content.length > 2000 ? '...\\n[truncated]' : ''}\\n\\n`;
        }
      });
    }

    // Add relevant log excerpts (last 1000 chars)
    if (sessionContent.logs) {
      const logExcerpt = sessionContent.logs.slice(-1000);
      evaluation += `LOG EXCERPT (last 1000 chars):\\n${logExcerpt}\\n`;
    }

    return evaluation;
  }

  /**
   * Run claude -p evaluation
   */
  async runClaudeEvaluation(prompt) {
    return new Promise((resolve, reject) => {
      console.log('🤖 Running claude evaluation...');

      const claudeProcess = spawn('claude', ['-p', prompt], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      claudeProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claudeProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claudeProcess.on('exit', (code) => {
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Claude evaluation failed: ${stderr || 'No output'}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        claudeProcess.kill('SIGKILL');
        reject(new Error('Claude evaluation timed out'));
      }, 30000);
    });
  }

  /**
   * Parse evaluation results from claude output
   */
  parseEvaluationResults(evaluationText) {
    const results = {
      scores: {},
      totalScore: 0,
      maxScore: 40,
      feedback: '',
      rawText: evaluationText
    };

    try {
      // Extract scores using regex patterns
      const scorePatterns = [
        /(?:COMPLETENESS|TASK_COMPLETION|BUG_IDENTIFICATION):\s*(\d+)\/10/i,
        /(?:QUALITY|CONTENT_QUALITY|SOLUTION_QUALITY):\s*(\d+)\/10/i,
        /(?:ACCURACY):\s*(\d+)\/10/i,
        /(?:USEFULNESS|IMPLEMENTATION|TESTING):\s*(\d+)\/10/i
      ];

      scorePatterns.forEach((pattern, index) => {
        const match = evaluationText.match(pattern);
        if (match) {
          const score = parseInt(match[1]);
          results.scores[`criteria${index + 1}`] = score;
          results.totalScore += score;
        }
      });

      // Extract total score if explicitly mentioned
      const totalMatch = evaluationText.match(/TOTAL:\s*(\d+)\/40/i);
      if (totalMatch) {
        results.totalScore = parseInt(totalMatch[1]);
      }

      // Extract feedback
      const feedbackMatch = evaluationText.match(/FEEDBACK:\s*(.+?)(?:\n\n|$)/s);
      if (feedbackMatch) {
        results.feedback = feedbackMatch[1].trim();
      }

      // Calculate percentage
      results.percentage = Math.round((results.totalScore / results.maxScore) * 100);

    } catch (error) {
      console.error('Error parsing evaluation results:', error);
      results.feedback = 'Failed to parse evaluation results';
    }

    return results;
  }

  /**
   * Quick evaluation for specific file creation tasks
   */
  async evaluateFileCreationTask(sessionId, expectedFiles, task) {
    return this.evaluateSessionOutput(sessionId, 'fileCreation', {
      expectedFiles,
      task
    });
  }

  /**
   * Quick evaluation for code analysis tasks
   */
  async evaluateCodeAnalysisTask(sessionId) {
    return this.evaluateSessionOutput(sessionId, 'codeAnalysis');
  }

  /**
   * Quick evaluation for bug fix tasks
   */
  async evaluateBugFixTask(sessionId) {
    return this.evaluateSessionOutput(sessionId, 'bugFix');
  }

  /**
   * Quick evaluation for performance optimization tasks
   */
  async evaluatePerformanceTask(sessionId) {
    return this.evaluateSessionOutput(sessionId, 'performance');
  }

  /**
   * Quick evaluation for security analysis tasks
   */
  async evaluateSecurityTask(sessionId) {
    return this.evaluateSessionOutput(sessionId, 'security');
  }

  /**
   * Quick evaluation for documentation tasks
   */
  async evaluateDocumentationTask(sessionId, options = {}) {
    return this.evaluateSessionOutput(sessionId, 'documentation', options);
  }

  /**
   * Quick evaluation for refactoring tasks
   */
  async evaluateRefactoringTask(sessionId) {
    return this.evaluateSessionOutput(sessionId, 'refactoring');
  }

  /**
   * Batch evaluate multiple sessions
   */
  async batchEvaluate(sessionIds, taskType = 'codeAnalysis') {
    console.log(`🔄 Batch evaluating ${sessionIds.length} sessions...`);

    const results = [];
    for (const sessionId of sessionIds) {
      try {
        const result = await this.evaluateSessionOutput(sessionId, taskType);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          sessionId,
          error: error.message
        });
      }
    }

    // Compute aggregate statistics
    const stats = this.computeAggregateStats(results);

    return {
      results,
      stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Compute aggregate statistics from evaluation results
   */
  computeAggregateStats(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length === 0) {
      return {
        totalSessions: results.length,
        successfulEvaluations: 0,
        failedEvaluations: failed.length,
        averageScore: 0,
        averagePercentage: 0
      };
    }

    const scores = successful.map(r => r.evaluation.totalScore);
    const percentages = successful.map(r => r.evaluation.percentage);

    return {
      totalSessions: results.length,
      successfulEvaluations: successful.length,
      failedEvaluations: failed.length,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      averagePercentage: percentages.reduce((a, b) => a + b, 0) / percentages.length,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      distribution: this.getScoreDistribution(scores)
    };
  }

  /**
   * Get score distribution for analytics
   */
  getScoreDistribution(scores) {
    const distribution = {
      excellent: 0,  // 36-40
      good: 0,       // 28-35
      fair: 0,       // 20-27
      poor: 0        // 0-19
    };

    scores.forEach(score => {
      if (score >= 36) {distribution.excellent++;}
      else if (score >= 28) {distribution.good++;}
      else if (score >= 20) {distribution.fair++;}
      else {distribution.poor++;}
    });

    return distribution;
  }

  /**
   * Generate evaluation report
   */
  generateEvaluationReport(evaluationResult) {
    if (!evaluationResult.success) {
      return `# Evaluation Failed\n\nSession ID: ${evaluationResult.sessionId}\nError: ${evaluationResult.error}`;
    }

    const { evaluation } = evaluationResult;
    const report = [];

    report.push('# AFk Session Evaluation Report');
    report.push(`\nSession ID: ${evaluationResult.sessionId}`);
    report.push(`Task Type: ${evaluationResult.taskType}`);
    report.push(`Timestamp: ${new Date().toISOString()}`);
    report.push(`\n## Overall Score: ${evaluation.totalScore}/${evaluation.maxScore} (${evaluation.percentage}%)`);

    report.push('\n## Detailed Scores');
    Object.entries(evaluation.scores).forEach(([criteria, score]) => {
      report.push(`- ${criteria}: ${score}/10`);
    });

    if (evaluation.feedback) {
      report.push('\n## Feedback');
      report.push(evaluation.feedback);
    }

    report.push('\n## Score Interpretation');
    if (evaluation.percentage >= 90) {
      report.push('✅ Excellent: The AFk session performed exceptionally well.');
    } else if (evaluation.percentage >= 70) {
      report.push('👍 Good: The AFk session completed the task satisfactorily.');
    } else if (evaluation.percentage >= 50) {
      report.push('⚠️ Fair: The AFk session partially completed the task but needs improvement.');
    } else {
      report.push('❌ Poor: The AFk session did not adequately complete the task.');
    }

    return report.join('\n');
  }

  /**
   * Compare two AFk sessions
   */
  async compareSessionPerformance(sessionId1, sessionId2, taskType = 'codeAnalysis') {
    console.log(`⚖️ Comparing sessions: ${sessionId1} vs ${sessionId2}`);

    const [result1, result2] = await Promise.all([
      this.evaluateSessionOutput(sessionId1, taskType),
      this.evaluateSessionOutput(sessionId2, taskType)
    ]);

    if (!result1.success || !result2.success) {
      return {
        success: false,
        error: 'One or both evaluations failed'
      };
    }

    const comparison = {
      session1: {
        id: sessionId1,
        totalScore: result1.evaluation.totalScore,
        percentage: result1.evaluation.percentage
      },
      session2: {
        id: sessionId2,
        totalScore: result2.evaluation.totalScore,
        percentage: result2.evaluation.percentage
      },
      winner: null,
      scoreDifference: 0,
      percentageDifference: 0
    };

    comparison.scoreDifference = Math.abs(result1.evaluation.totalScore - result2.evaluation.totalScore);
    comparison.percentageDifference = Math.abs(result1.evaluation.percentage - result2.evaluation.percentage);

    if (result1.evaluation.totalScore > result2.evaluation.totalScore) {
      comparison.winner = sessionId1;
    } else if (result2.evaluation.totalScore > result1.evaluation.totalScore) {
      comparison.winner = sessionId2;
    } else {
      comparison.winner = 'tie';
    }

    return {
      success: true,
      comparison,
      details: {
        session1: result1,
        session2: result2
      }
    };
  }
}

module.exports = AFkEvaluator;
