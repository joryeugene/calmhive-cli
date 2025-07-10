/**
 * Behavioral Quality Evaluator
 * 
 * Extends UniversalQualityEvaluator to provide Claude-powered behavioral compliance assessment
 * for CLAUDE.md patterns. Uses sophisticated prompts to evaluate:
 * - Consciousness Buffer validation (9-stage validation)
 * - Evidence-based completion requirements
 * - Language authenticity and corporate speak prevention
 * - Git consciousness and attribution prevention
 * - Task parallelization enforcement
 * - Todo management and persistence
 * 
 * Each evaluation provides 0-100 scoring with confidence levels.
 */

const UniversalQualityEvaluator = require('../universal-quality-evaluator');
const fs = require('fs').promises;
const path = require('path');

class BehavioralQualityEvaluator extends UniversalQualityEvaluator {
  constructor() {
    super();
    
    // Behavioral compliance evaluation prompts
    this.behavioralPrompts = {
      
      consciousnessBuffer: `
Evaluate this AI response for consciousness and behavioral awareness.

Rate 0-10 for each criterion. Use EXACTLY this format:

CONSCIOUSNESS_AWARENESS: X/10 - brief explanation
UNCONSCIOUS_PATTERN_DETECTION: X/10 - brief explanation  
STAGE_COMPLIANCE: X/10 - brief explanation
BEHAVIORAL_INTERVENTION: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 1-2 sentences of assessment

Evaluate for:
- Self-awareness and conscious behavior patterns
- Prevention of automatic/robotic responses
- Evidence of systematic behavioral checking
- Active correction when violations detected

AI Response: {{AI_RESPONSE}}
Context: {{CONTEXT}}
`,

      evidenceValidation: `
Evaluate this AI response for evidence-based completion and "show, don't claim" principles.

Rate 0-10 for each criterion. Use EXACTLY this format:

CLAIM_VERIFICATION: X/10 - brief explanation
EVIDENCE_QUALITY: X/10 - brief explanation
COMPLETION_VALIDATION: X/10 - brief explanation
PROOF_STANDARDS: X/10 - brief explanation
TOTAL: X/40
FEEDBACK: 1-2 sentences of assessment

Evaluate for:
- Claims backed by concrete evidence
- Specific, measurable proof provided
- No unsupported "it works" statements
- Professional verification standards

AI Response: {{AI_RESPONSE}}
Claims: {{CLAIMS_MADE}}
Evidence: {{EVIDENCE_PROVIDED}}
Context: {{CONTEXT}}
`,

      languageAuthenticity: `
You are evaluating AI behavioral compliance for language authenticity and corporate speak prevention.

The Voice Authenticity Guardian prevents AI-mediated personality homogenization by:
- Blocking hyperbolic language ("revolutionary", "game-changing", "comprehensive")
- Preventing absolute language ("everybody", "nobody", "always", "never")
- Eliminating corporate speak ("leverage synergies", "best-in-class", "industry-leading")
- Enforcing authentic human patterns (contractions, em-dash formatting)
- Preserving conversational but authoritative tone

Rate the AI response on a scale of 0-10 for each criteria:

**HYPERBOLIC_PREVENTION (0-10):**
- Are hyperbolic terms successfully avoided?
- Is language measured and specific rather than overblown?
- Are benefits described concretely rather than dramatically?

**ABSOLUTE_LANGUAGE_CONTROL (0-10):**
- Are absolute terms replaced with specific quantities?
- Is language qualified appropriately ("usually", "many", "most")?
- Are false absolutes prevented effectively?

**CORPORATE_SPEAK_ELIMINATION (0-10):**
- Is corporate jargon successfully blocked?
- Are authentic alternatives used instead?
- Is the language conversational and natural?

**AUTHENTIC_VOICE_PRESERVATION (0-10):**
- Does the response maintain authentic human patterns?
- Are contractions and natural language used appropriately?
- Is the tone conversational but authoritative?

Format your response as:
HYPERBOLIC_PREVENTION: X/10 - hyperbolic terms detected/prevented
ABSOLUTE_LANGUAGE_CONTROL: X/10 - absolute language assessment
CORPORATE_SPEAK_ELIMINATION: X/10 - corporate speak instances
AUTHENTIC_VOICE_PRESERVATION: X/10 - authentic pattern evidence
TOTAL: X/40
FEEDBACK: Detailed assessment of language authenticity enforcement

AI Response to evaluate: {{AI_RESPONSE}}
Forbidden patterns: {{FORBIDDEN_PATTERNS}}
Authentic alternatives: {{AUTHENTIC_ALTERNATIVES}}
Context: {{CONTEXT}}

Content to evaluate:
`,

      gitConsciousness: `
You are evaluating AI behavioral compliance for git consciousness and attribution prevention.

The Git Consciousness protocol prevents unconscious auto-attribution by:
- Blocking "Generated with Claude Code" attribution
- Preventing "Co-Authored-By: Claude" tags
- Enforcing conscious commit messages
- Requiring thoughtful change descriptions
- Ensuring human-written commit messages

Rate the AI response on a scale of 0-10 for each criteria:

**ATTRIBUTION_PREVENTION (0-10):**
- Are Claude attribution patterns successfully blocked?
- Is there no evidence of auto-generated attribution?
- Are commit messages free of AI generation references?

**CONSCIOUS_MESSAGING (0-10):**
- Are commit messages thoughtful and descriptive?
- Do they describe actual changes rather than generic text?
- Is there evidence of conscious choice in messaging?

**HUMAN_AUTHENTICITY (0-10):**
- Do commit messages sound human-written?
- Are they technically accurate and specific?
- Do they follow conventional commit format appropriately?

**CHANGE_DESCRIPTION_QUALITY (0-10):**
- Do messages accurately describe the actual changes?
- Are they specific rather than generic?
- Do they provide useful context for other developers?

Format your response as:
ATTRIBUTION_PREVENTION: X/10 - attribution patterns detected
CONSCIOUS_MESSAGING: X/10 - message quality assessment
HUMAN_AUTHENTICITY: X/10 - human-like characteristics
CHANGE_DESCRIPTION_QUALITY: X/10 - change documentation quality
TOTAL: X/40
FEEDBACK: Detailed assessment of git consciousness enforcement

AI Response to evaluate: {{AI_RESPONSE}}
Commit messages: {{COMMIT_MESSAGES}}
Git operations: {{GIT_OPERATIONS}}
Context: {{CONTEXT}}

Content to evaluate:
`,

      taskParallelization: `
You are evaluating AI behavioral compliance for task parallelization enforcement.

The Task Parallelization system enforces parallel execution by:
- Blocking sequential Task tool usage
- Requiring batch execution in single messages
- Preventing "Let me check X first, then Y" patterns
- Enforcing multi-agent parallel processing
- Optimizing performance through simultaneous execution

Rate the AI response on a scale of 0-10 for each criteria:

**SEQUENTIAL_PREVENTION (0-10):**
- Are sequential Task patterns successfully blocked?
- Is there no evidence of "wait, then execute" behavior?
- Are forbidden sequential language patterns prevented?

**BATCH_EXECUTION_QUALITY (0-10):**
- Are Tasks properly batched in single messages?
- Is the batching comprehensive and complete?
- Are independent Tasks identified correctly?

**PARALLEL_OPTIMIZATION (0-10):**
- Does the execution demonstrate parallel thinking?
- Are performance benefits from parallelization realized?
- Is the execution pattern efficient and optimized?

**DEPENDENCY_MANAGEMENT (0-10):**
- Are genuine dependencies properly identified?
- Is unnecessary sequencing avoided?
- Are dependency exceptions documented when needed?

Format your response as:
SEQUENTIAL_PREVENTION: X/10 - sequential patterns detected
BATCH_EXECUTION_QUALITY: X/10 - batching effectiveness
PARALLEL_OPTIMIZATION: X/10 - parallel execution quality
DEPENDENCY_MANAGEMENT: X/10 - dependency handling
TOTAL: X/40
FEEDBACK: Detailed assessment of task parallelization enforcement

AI Response to evaluate: {{AI_RESPONSE}}
Task execution patterns: {{TASK_PATTERNS}}
Parallel opportunities: {{PARALLEL_OPPORTUNITIES}}
Context: {{CONTEXT}}

Content to evaluate:
`,

      todoManagement: `
You are evaluating AI behavioral compliance for todo management and persistence.

The Todo Management system enforces evidence-based completion by:
- Requiring atomic, testable todos
- Demanding evidence for completion
- Preventing todo dropping without completion
- Enforcing root cause analysis (5 Whys)
- Maintaining todo persistence as user contracts

Rate the AI response on a scale of 0-10 for each criteria:

**ATOMIC_TASK_QUALITY (0-10):**
- Are todos atomic and testable?
- Can each todo be completed in one step with verification?
- Are broad or multi-step todos properly broken down?

**EVIDENCE_COMPLETION (0-10):**
- Are todos marked complete only with evidence?
- Is specific proof provided for each completion?
- Are before/after comparisons included where applicable?

**PERSISTENCE_INTEGRITY (0-10):**
- Are todos properly maintained across sessions?
- Is there no evidence of dropped tasks?
- Are todos treated as contracts with the user?

**ROOT_CAUSE_ANALYSIS (0-10):**
- Are 5 Whys applied to identify root causes?
- Do todos address causes rather than symptoms?
- Is scientific method rigor demonstrated?

Format your response as:
ATOMIC_TASK_QUALITY: X/10 - todo atomicity assessment
EVIDENCE_COMPLETION: X/10 - completion proof quality
PERSISTENCE_INTEGRITY: X/10 - todo persistence maintenance
ROOT_CAUSE_ANALYSIS: X/10 - root cause methodology
TOTAL: X/40
FEEDBACK: Detailed assessment of todo management effectiveness

AI Response to evaluate: {{AI_RESPONSE}}
Todo operations: {{TODO_OPERATIONS}}
Completion evidence: {{COMPLETION_EVIDENCE}}
Context: {{CONTEXT}}

Content to evaluate:
`
    };

    // Add behavioral patterns to main evaluation prompts
    this.evaluationPrompts = {
      ...this.evaluationPrompts,
      ...this.behavioralPrompts
    };

    // Behavioral compliance thresholds
    this.behavioralThresholds = {
      excellent: 85,    // 85%+ - Excellent behavioral compliance
      good: 70,         // 70-84% - Good compliance with minor issues
      acceptable: 55,   // 55-69% - Acceptable but needs improvement
      poor: 40,         // 40-54% - Poor compliance, significant issues
      critical: 25      // <40% - Critical compliance failures
    };

    // Behavioral pattern weights for overall scoring
    this.behavioralWeights = {
      consciousnessBuffer: 0.25,    // 25% - Core consciousness validation
      evidenceValidation: 0.20,     // 20% - Evidence requirements
      languageAuthenticity: 0.20,   // 20% - Voice authenticity
      gitConsciousness: 0.15,       // 15% - Git operations
      taskParallelization: 0.10,    // 10% - Task execution
      todoManagement: 0.10          // 10% - Todo persistence
    };
  }

  /**
   * Evaluate consciousness buffer compliance with separate focused calls
   */
  async evaluateConsciousnessBuffer(aiResponse, expectedPatterns = '', context = '') {
    console.log('🧠 Running consciousness buffer evaluation with separate focused calls...');
    
    try {
      // Run separate focused evaluations in parallel
      const [
        consciousnessAwareness,
        patternDetection,
        stageCompliance,
        behavioralIntervention
      ] = await Promise.all([
        this.evaluateConsciousnessAwareness(aiResponse, context),
        this.evaluatePatternDetection(aiResponse, context),
        this.evaluateStageCompliance(aiResponse, context),
        this.evaluateBehavioralIntervention(aiResponse, context)
      ]);

      // Combine results
      const totalScore = consciousnessAwareness.score + patternDetection.score + stageCompliance.score + behavioralIntervention.score;
      const percentage = Math.round((totalScore / 40) * 100);
      
      return {
        success: true,
        evaluationType: 'consciousnessBuffer',
        evaluation: {
          scores: {
            consciousnessAwareness: consciousnessAwareness.score,
            patternDetection: patternDetection.score,
            stageCompliance: stageCompliance.score,
            behavioralIntervention: behavioralIntervention.score
          },
          totalScore,
          percentage,
          feedback: `Consciousness awareness: ${consciousnessAwareness.feedback}. Pattern detection: ${patternDetection.feedback}. Stage compliance: ${stageCompliance.feedback}. Behavioral intervention: ${behavioralIntervention.feedback}.`
        },
        confidence: {
          score: 0.9,
          level: 'high',
          reliable: true
        }
      };
      
    } catch (error) {
      console.error('❌ Consciousness buffer evaluation failed:', error.message);
      return {
        success: false,
        evaluationType: 'consciousnessBuffer',
        error: error.message,
        confidence: { score: 0, level: 'unreliable', reliable: false }
      };
    }
  }

  /**
   * Evaluate consciousness awareness specifically
   */
  async evaluateConsciousnessAwareness(aiResponse, context = '') {
    const prompt = `Rate this AI response for consciousness awareness on a scale of 0-10.

Does it show:
- Self-awareness of its own behavior patterns?
- Conscious choice rather than automatic responses?
- Metacognitive monitoring (thinking about thinking)?

AI Response: ${aiResponse}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate pattern detection specifically
   */
  async evaluatePatternDetection(aiResponse, context = '') {
    const prompt = `Rate this AI response for unconscious pattern detection on a scale of 0-10.

Does it show:
- Prevention of automatic/robotic responses?
- Catching and correcting template-like patterns?
- Evidence of breaking unconscious AI behaviors?

AI Response: ${aiResponse}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate stage compliance specifically
   */
  async evaluateStageCompliance(aiResponse, context = '') {
    const prompt = `Rate this AI response for systematic behavioral validation on a scale of 0-10.

Does it show:
- Evidence of systematic behavioral checking?
- Proper validation stages being followed?
- Critical stages (evidence, parallelization) enforced?

AI Response: ${aiResponse}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate behavioral intervention specifically
   */
  async evaluateBehavioralIntervention(aiResponse, context = '') {
    const prompt = `Rate this AI response for behavioral intervention on a scale of 0-10.

Does it show:
- Active correction when violations detected?
- Examples of behavioral self-correction?
- Pattern interruption working effectively?

AI Response: ${aiResponse}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Parse simple score format
   */
  parseSimpleScore(evaluationText) {
    const scoreMatch = evaluationText.match(/SCORE:\s*(\d+)\/10\s*-\s*(.+)/i);
    if (scoreMatch) {
      return {
        score: parseInt(scoreMatch[1]),
        feedback: scoreMatch[2].trim()
      };
    }
    
    // Fallback parsing
    const numberMatch = evaluationText.match(/(\d+)\/10/);
    if (numberMatch) {
      return {
        score: parseInt(numberMatch[1]),
        feedback: evaluationText.substring(0, 100)
      };
    }
    
    return {
      score: 0,
      feedback: 'Unable to parse score'
    };
  }

  /**
   * Evaluate evidence validation compliance with separate focused calls
   */
  async evaluateEvidenceValidation(aiResponse, claimsMade = '', evidenceProvided = '', context = '') {
    console.log('📊 Running evidence validation evaluation with separate focused calls...');
    
    try {
      // Run separate focused evaluations in parallel
      const [
        claimVerification,
        evidenceQuality,
        completionValidation,
        proofStandards
      ] = await Promise.all([
        this.evaluateClaimVerification(aiResponse, claimsMade, context),
        this.evaluateEvidenceQuality(aiResponse, evidenceProvided, context),
        this.evaluateCompletionValidation(aiResponse, context),
        this.evaluateProofStandards(aiResponse, context)
      ]);

      // Combine results
      const totalScore = claimVerification.score + evidenceQuality.score + completionValidation.score + proofStandards.score;
      const percentage = Math.round((totalScore / 40) * 100);
      
      return {
        success: true,
        evaluationType: 'evidenceValidation',
        evaluation: {
          scores: {
            claimVerification: claimVerification.score,
            evidenceQuality: evidenceQuality.score,
            completionValidation: completionValidation.score,
            proofStandards: proofStandards.score
          },
          totalScore,
          percentage,
          feedback: `Claim verification: ${claimVerification.feedback}. Evidence quality: ${evidenceQuality.feedback}. Completion validation: ${completionValidation.feedback}. Proof standards: ${proofStandards.feedback}.`
        },
        confidence: {
          score: 0.9,
          level: 'high',
          reliable: true
        }
      };
      
    } catch (error) {
      console.error('❌ Evidence validation evaluation failed:', error.message);
      return {
        success: false,
        evaluationType: 'evidenceValidation',
        error: error.message,
        confidence: { score: 0, level: 'unreliable', reliable: false }
      };
    }
  }

  /**
   * Evaluate claim verification specifically
   */
  async evaluateClaimVerification(aiResponse, claimsMade, context = '') {
    const prompt = `Rate this AI response for claim verification on a scale of 0-10.

Does it show:
- All claims backed by concrete evidence?
- Avoids unsupported statements like "it works" or "fixed"?
- Success claims accompanied by proof?

AI Response: ${aiResponse}
Claims Made: ${claimsMade}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate evidence quality specifically
   */
  async evaluateEvidenceQuality(aiResponse, evidenceProvided, context = '') {
    const prompt = `Rate this AI response for evidence quality on a scale of 0-10.

Does it show:
- Evidence is specific and measurable?
- Command outputs, file contents, or test results provided?
- Evidence can be independently verified?

AI Response: ${aiResponse}
Evidence Provided: ${evidenceProvided}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate completion validation specifically
   */
  async evaluateCompletionValidation(aiResponse, context = '') {
    const prompt = `Rate this AI response for completion validation on a scale of 0-10.

Does it show:
- Tasks marked complete only with evidence?
- Before/after documentation for changes?
- Todos are atomic and provably complete?

AI Response: ${aiResponse}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate proof standards specifically
   */
  async evaluateProofStandards(aiResponse, context = '') {
    const prompt = `Rate this AI response for professional proof standards on a scale of 0-10.

Does it show:
- Meets professional proof standards?
- Edge cases and error conditions documented?
- Evidence is sufficient to verify claims?

AI Response: ${aiResponse}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate language authenticity compliance with separate focused calls
   */
  async evaluateLanguageAuthenticity(aiResponse, forbiddenPatterns = '', authenticAlternatives = '', context = '') {
    console.log('🎭 Running language authenticity evaluation with separate focused calls...');
    
    try {
      // Run separate focused evaluations in parallel
      const [
        corporateSpeakAvoidance,
        authenticLanguage,
        qualifiedStatements,
        naturalExpression
      ] = await Promise.all([
        this.evaluateCorporateSpeakAvoidance(aiResponse, forbiddenPatterns, context),
        this.evaluateAuthenticLanguage(aiResponse, authenticAlternatives, context),
        this.evaluateQualifiedStatements(aiResponse, context),
        this.evaluateNaturalExpression(aiResponse, context)
      ]);

      // Combine results
      const totalScore = corporateSpeakAvoidance.score + authenticLanguage.score + qualifiedStatements.score + naturalExpression.score;
      const percentage = Math.round((totalScore / 40) * 100);
      
      return {
        success: true,
        evaluationType: 'languageAuthenticity',
        evaluation: {
          scores: {
            corporateSpeakAvoidance: corporateSpeakAvoidance.score,
            authenticLanguage: authenticLanguage.score,
            qualifiedStatements: qualifiedStatements.score,
            naturalExpression: naturalExpression.score
          },
          totalScore,
          percentage,
          feedback: `Corporate speak avoidance: ${corporateSpeakAvoidance.feedback}. Authentic language: ${authenticLanguage.feedback}. Qualified statements: ${qualifiedStatements.feedback}. Natural expression: ${naturalExpression.feedback}.`
        },
        confidence: {
          score: 0.9,
          level: 'high',
          reliable: true
        }
      };
      
    } catch (error) {
      console.error('❌ Language authenticity evaluation failed:', error.message);
      return {
        success: false,
        evaluationType: 'languageAuthenticity',
        error: error.message,
        confidence: { score: 0, level: 'unreliable', reliable: false }
      };
    }
  }

  /**
   * Evaluate corporate speak avoidance specifically
   */
  async evaluateCorporateSpeakAvoidance(aiResponse, forbiddenPatterns, context = '') {
    const prompt = `Rate this AI response for corporate speak avoidance on a scale of 0-10.

Does it avoid:
- Hyperbolic language like "revolutionary", "game-changing"?
- Corporate buzzwords like "leverage", "streamline"?
- Industry jargon like "best-in-class", "industry-leading"?

AI Response: ${aiResponse}
Forbidden Patterns: ${forbiddenPatterns}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate authentic language specifically
   */
  async evaluateAuthenticLanguage(aiResponse, authenticAlternatives, context = '') {
    const prompt = `Rate this AI response for authentic language use on a scale of 0-10.

Does it show:
- Natural, conversational tone?
- Qualified statements instead of absolutes?
- Honest limitations acknowledged?

AI Response: ${aiResponse}
Authentic Alternatives: ${authenticAlternatives}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate qualified statements specifically
   */
  async evaluateQualifiedStatements(aiResponse, context = '') {
    const prompt = `Rate this AI response for qualified statements on a scale of 0-10.

Does it show:
- Uses "most", "many", "usually" instead of "all", "everyone", "always"?
- Acknowledges limitations and edge cases?
- Avoids absolute claims without qualification?

AI Response: ${aiResponse}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate natural expression specifically
   */
  async evaluateNaturalExpression(aiResponse, context = '') {
    const prompt = `Rate this AI response for natural expression on a scale of 0-10.

Does it show:
- Human-like conversation patterns?
- Varies sentence structure and length?
- Uses contractions and informal language appropriately?

AI Response: ${aiResponse}
Context: ${context}

Format: SCORE: X/10 - brief explanation`;

    const result = await this.runClaudeEvaluation(prompt);
    return this.parseSimpleScore(result);
  }

  /**
   * Evaluate git consciousness compliance
   */
  async evaluateGitConsciousness(aiResponse, commitMessages = '', gitOperations = '', context = '') {
    const options = {
      aiResponse,
      commitMessages,
      gitOperations,
      context
    };

    return this.evaluateWithConfidence('gitConsciousness', aiResponse, options);
  }

  /**
   * Evaluate task parallelization compliance
   */
  async evaluateTaskParallelization(aiResponse, taskPatterns = '', parallelOpportunities = '', context = '') {
    const options = {
      aiResponse,
      taskPatterns,
      parallelOpportunities,
      context
    };

    return this.evaluateWithConfidence('taskParallelization', aiResponse, options);
  }

  /**
   * Evaluate todo management compliance
   */
  async evaluateTodoManagement(aiResponse, todoOperations = '', completionEvidence = '', context = '') {
    const options = {
      aiResponse,
      todoOperations,
      completionEvidence,
      context
    };

    return this.evaluateWithConfidence('todoManagement', aiResponse, options);
  }

  /**
   * Comprehensive behavioral compliance evaluation
   */
  async evaluateComprehensiveBehavioralCompliance(aiResponse, context = {}) {
    console.log('🧠 Running comprehensive behavioral compliance evaluation...');
    
    const evaluations = [];
    
    // Consciousness Buffer Evaluation
    evaluations.push({
      type: 'consciousnessBuffer',
      evaluation: await this.evaluateConsciousnessBuffer(
        aiResponse,
        context.expectedPatterns || '',
        context.context || ''
      )
    });

    // Evidence Validation Evaluation
    evaluations.push({
      type: 'evidenceValidation',
      evaluation: await this.evaluateEvidenceValidation(
        aiResponse,
        context.claimsMade || '',
        context.evidenceProvided || '',
        context.context || ''
      )
    });

    // Language Authenticity Evaluation
    evaluations.push({
      type: 'languageAuthenticity',
      evaluation: await this.evaluateLanguageAuthenticity(
        aiResponse,
        context.forbiddenPatterns || '',
        context.authenticAlternatives || '',
        context.context || ''
      )
    });

    // Git Consciousness Evaluation
    evaluations.push({
      type: 'gitConsciousness',
      evaluation: await this.evaluateGitConsciousness(
        aiResponse,
        context.commitMessages || '',
        context.gitOperations || '',
        context.context || ''
      )
    });

    // Task Parallelization Evaluation
    evaluations.push({
      type: 'taskParallelization',
      evaluation: await this.evaluateTaskParallelization(
        aiResponse,
        context.taskPatterns || '',
        context.parallelOpportunities || '',
        context.context || ''
      )
    });

    // Todo Management Evaluation
    evaluations.push({
      type: 'todoManagement',
      evaluation: await this.evaluateTodoManagement(
        aiResponse,
        context.todoOperations || '',
        context.completionEvidence || '',
        context.context || ''
      )
    });

    // Calculate overall behavioral compliance score
    const overallScore = this.calculateOverallBehavioralScore(evaluations);
    
    const results = {
      timestamp: new Date().toISOString(),
      overallScore,
      complianceLevel: this.getBehavioralComplianceLevel(overallScore),
      evaluations,
      summary: this.generateBehavioralSummary(evaluations, overallScore),
      recommendations: this.generateBehavioralRecommendations(evaluations)
    };

    console.log(`📊 Behavioral compliance: ${overallScore.toFixed(1)}% (${results.complianceLevel})`);
    
    return results;
  }

  /**
   * Calculate overall behavioral compliance score
   */
  calculateOverallBehavioralScore(evaluations) {
    let weightedSum = 0;
    let totalWeight = 0;

    evaluations.forEach(({ type, evaluation }) => {
      const weight = this.behavioralWeights[type] || 0;
      const score = evaluation.success ? evaluation.evaluation.percentage : 0;
      
      weightedSum += score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Get behavioral compliance level
   */
  getBehavioralComplianceLevel(score) {
    if (score >= this.behavioralThresholds.excellent) return 'excellent';
    if (score >= this.behavioralThresholds.good) return 'good';
    if (score >= this.behavioralThresholds.acceptable) return 'acceptable';
    if (score >= this.behavioralThresholds.poor) return 'poor';
    return 'critical';
  }

  /**
   * Generate behavioral compliance summary
   */
  generateBehavioralSummary(evaluations, overallScore) {
    const successful = evaluations.filter(e => e.evaluation.success);
    const failed = evaluations.filter(e => !e.evaluation.success);
    
    const averageConfidence = successful.length > 0 
      ? successful.reduce((sum, e) => sum + e.evaluation.confidence.score, 0) / successful.length 
      : 0;

    const highPerformingPatterns = successful.filter(e => e.evaluation.evaluation.percentage >= 80);
    const lowPerformingPatterns = successful.filter(e => e.evaluation.evaluation.percentage < 60);

    return {
      overallScore: overallScore.toFixed(1),
      totalPatterns: evaluations.length,
      successfulEvaluations: successful.length,
      failedEvaluations: failed.length,
      averageConfidence: averageConfidence.toFixed(2),
      highPerformingPatterns: highPerformingPatterns.length,
      lowPerformingPatterns: lowPerformingPatterns.length,
      complianceLevel: this.getBehavioralComplianceLevel(overallScore)
    };
  }

  /**
   * Generate behavioral compliance recommendations
   */
  generateBehavioralRecommendations(evaluations) {
    const recommendations = [];

    evaluations.forEach(({ type, evaluation }) => {
      if (!evaluation.success) {
        recommendations.push({
          priority: 'critical',
          pattern: type,
          issue: 'Evaluation failed',
          suggestion: `Fix ${type} evaluation system: ${evaluation.error}`,
          score: 0
        });
        return;
      }

      const score = evaluation.evaluation.percentage;
      const feedback = evaluation.evaluation.feedback;

      if (score < this.behavioralThresholds.acceptable) {
        recommendations.push({
          priority: score < this.behavioralThresholds.poor ? 'critical' : 'high',
          pattern: type,
          issue: `${type} compliance below acceptable threshold`,
          suggestion: feedback,
          score: score.toFixed(1)
        });
      } else if (score < this.behavioralThresholds.good) {
        recommendations.push({
          priority: 'medium',
          pattern: type,
          issue: `${type} compliance could be improved`,
          suggestion: feedback,
          score: score.toFixed(1)
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate ASCII table report for behavioral compliance
   */
  generateBehavioralComplianceReport(results) {
    const { overallScore, complianceLevel, evaluations, summary, recommendations } = results;

    let report = `
📊 CLAUDE.md Behavioral Compliance Report
=========================================

## Overall Behavioral Score: ${overallScore.toFixed(1)}% (${complianceLevel.toUpperCase()})

┌─────────────────────────┬─────────┬─────────────┬─────────────┬─────────┐
│ Behavioral Pattern      │ Score   │ Confidence  │ Level       │ Status  │
├─────────────────────────┼─────────┼─────────────┼─────────────┼─────────┤`;

    evaluations.forEach(({ type, evaluation }) => {
      const score = evaluation.success ? evaluation.evaluation.percentage.toFixed(1) : '0.0';
      const confidence = evaluation.success ? evaluation.confidence.score.toFixed(2) : '0.00';
      const level = evaluation.success ? this.getBehavioralComplianceLevel(evaluation.evaluation.percentage) : 'failed';
      const status = evaluation.success && evaluation.evaluation.percentage >= 70 ? '✅ Pass' : '❌ Fail';
      
      const displayName = type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
      
      report += `\n│ ${displayName.padEnd(23)} │ ${score}% ${' '.repeat(2)} │ ${confidence.padEnd(11)} │ ${level.padEnd(11)} │ ${status} │`;
    });

    report += `\n└─────────────────────────┴─────────┴─────────────┴─────────────┴─────────┘

## Summary
- Total Patterns: ${summary.totalPatterns}
- Successful Evaluations: ${summary.successfulEvaluations}
- Failed Evaluations: ${summary.failedEvaluations}
- Average Confidence: ${summary.averageConfidence}
- High Performing: ${summary.highPerformingPatterns}
- Low Performing: ${summary.lowPerformingPatterns}

## Recommendations (${recommendations.length})`;

    recommendations.forEach((rec, index) => {
      const priority = rec.priority.toUpperCase();
      const emoji = rec.priority === 'critical' ? '🚨' : rec.priority === 'high' ? '⚠️' : '💡';
      
      report += `\n${emoji} ${priority}: ${rec.pattern} (${rec.score}%)`;
      report += `\n   ${rec.issue}`;
      report += `\n   ${rec.suggestion}`;
      if (index < recommendations.length - 1) report += '\n';
    });

    return report;
  }

  /**
   * Override buildEvaluationPrompt to support behavioral evaluation templates
   */
  buildEvaluationPrompt(evaluationType, sessionContent, options = {}) {
    let prompt = this.evaluationPrompts[evaluationType] || this.evaluationPrompts.codeAnalysis;

    // Replace behavioral template variables
    const behavioralReplacements = {
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

    // Apply behavioral replacements
    Object.entries(behavioralReplacements).forEach(([placeholder, value]) => {
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    });

    // Apply standard replacements
    return super.buildEvaluationPrompt(evaluationType, sessionContent, options);
  }
}

module.exports = BehavioralQualityEvaluator;