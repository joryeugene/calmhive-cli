#!/usr/bin/env node
/**
 * Work Complexity Analyzer - Uses Claude as LLM Judge for Task Complexity
 * 
 * Replaces regex pattern matching with intelligent LLM-based analysis
 * Following the ClaudeCronParser pattern for JSON-based Claude CLI usage
 */

const { execSync } = require('child_process');

class WorkComplexityAnalyzer {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000; // 30 second timeout
    this.retries = options.retries || 2;
    this.fallbackEnabled = options.fallbackEnabled !== false; // Default true
    this.cache = new Map(); // Simple in-memory cache
    this.cacheEnabled = options.cacheEnabled !== false; // Default true
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes default TTL
    this.confidenceThreshold = options.confidenceThreshold || 0.7; // 70% minimum confidence
  }

  /**
   * Analyze task complexity using Claude as LLM judge
   * @param {string} taskDescription - The task to analyze
   * @returns {Promise<Object>} - { complexity, model, iterations, confidence, reasoning }
   */
  async analyzeComplexity(taskDescription) {
    if (!taskDescription || typeof taskDescription !== 'string') {
      throw new Error('Task description must be a non-empty string');
    }

    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.getCachedResult(taskDescription);
      if (cached) {
        console.log('Using cached complexity analysis');
        return { ...cached, source: 'cache' };
      }
    }

    // Try LLM analysis first
    if (await this.isClaudeAvailable()) {
      try {
        const result = await this.analyzeLLM(taskDescription);
        
        // Check confidence threshold
        if (result.confidence < this.confidenceThreshold) {
          console.warn(`LLM confidence ${(result.confidence * 100).toFixed(0)}% below threshold ${(this.confidenceThreshold * 100).toFixed(0)}%`);
          console.log('🔄 Using enhanced fallback analysis...');
          
          // Use enhanced fallback that considers LLM input
          const fallbackResult = this.analyzeFallback(taskDescription);
          return {
            ...fallbackResult,
            reasoning: `Low LLM confidence (${(result.confidence * 100).toFixed(0)}%). ${fallbackResult.reasoning}`,
            llmSuggestion: result,
            source: 'fallback_low_confidence'
          };
        }
        
        // Cache successful high-confidence LLM results
        if (this.cacheEnabled && result.source === 'llm') {
          this.cacheResult(taskDescription, result);
        }
        
        return result;
      } catch (error) {
        console.warn(`LLM analysis failed: ${error.message}`);
        if (!this.fallbackEnabled) {
          throw error;
        }
      }
    }

    // Fallback to simple heuristics if Claude unavailable or fails
    console.log('Falling back to heuristic analysis');
    return this.analyzeFallback(taskDescription);
  }

  /**
   * Analyze complexity using Claude LLM judge
   */
  async analyzeLLM(taskDescription) {
    const prompt = this.buildAnalysisPrompt(taskDescription);

    let lastError;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const result = await this.executeClaudePrompt(prompt);
        return this.parseClaudeResponse(result, taskDescription);
      } catch (error) {
        lastError = error;
        console.warn(`Claude analysis attempt ${attempt} failed: ${error.message}`);
        if (attempt < this.retries) {
          await this.delay(1000 * attempt);
        }
      }
    }

    throw new Error(`Failed to analyze "${taskDescription}" after ${this.retries} attempts: ${lastError.message}`);
  }

  buildAnalysisPrompt(taskDescription) {
    return `You are a software development task complexity analyzer. Analyze the given task and determine its complexity level, appropriate model, and iteration count.

SYSTEM: You must always respond with valid JSON containing exactly these fields: complexity, model, iterations, confidence, reasoning

COMPLEXITY LEVELS:
- "simple": Quick fixes, typos, small updates, basic changes (1-3 iterations)
- "moderate": New features, components, API endpoints, testing (4-6 iterations)  
- "complex": Architecture changes, migrations, system refactors (8-15 iterations)

AVAILABLE MODELS:
- "sonnet": Default model for most tasks
- "opus": Use for complex architecture, migrations, or difficult problems

EXAMPLES:
Input: "fix login bug"
Output: {"complexity": "simple", "model": "sonnet", "iterations": 2, "confidence": 0.9, "reasoning": "Bug fix is typically straightforward with clear scope"}

Input: "implement user dashboard with charts"
Output: {"complexity": "moderate", "model": "sonnet", "iterations": 5, "confidence": 0.8, "reasoning": "Moderate feature requiring UI, data integration, and multiple components"}

Input: "migrate entire codebase from React 16 to 18"
Output: {"complexity": "complex", "model": "opus", "iterations": 12, "confidence": 0.9, "reasoning": "Major migration affecting entire application architecture and dependencies"}

Input: "refactor authentication system for microservices"
Output: {"complexity": "complex", "model": "opus", "iterations": 10, "confidence": 0.8, "reasoning": "System-wide architectural change requiring security considerations and service coordination"}

ANALYSIS FACTORS:
- Scope: Single file vs multiple files vs system-wide
- Risk: Low-risk styling vs high-risk data/security changes
- Dependencies: Self-contained vs affecting multiple systems
- Expertise: Common patterns vs specialized knowledge required
- Testing: Simple unit tests vs integration/e2e testing needed

TASK TO ANALYZE:
"${taskDescription}"

Analyze this task and return only valid JSON with your assessment.`;
  }

  async executeClaudePrompt(prompt) {
    try {
      // Use the same pattern as ClaudeCronParser
      const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const command = `claude -p --output-format json "${escapedPrompt}"`;

      const output = execSync(command, {
        encoding: 'utf8',
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const response = JSON.parse(output.trim());

      if (response.is_error || response.subtype !== 'success') {
        throw new Error(`Claude execution failed: ${response.subtype || 'unknown error'}`);
      }

      return response.result;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Claude Code CLI not found. Please install: npm install -g @anthropic-ai/claude-code');
      }
      if (error.signal === 'SIGTERM') {
        throw new Error(`Claude analysis timed out after ${this.timeout}ms`);
      }
      if (error.message.includes('Unexpected token')) {
        throw new Error(`Claude CLI returned invalid JSON: ${error.message}`);
      }
      throw new Error(`Claude execution failed: ${error.message}`);
    }
  }

  parseClaudeResponse(response, originalTask) {
    try {
      // Clean response - extract JSON if wrapped in markdown
      let jsonText = response;
      const jsonMatch = response.match(/\{[^}]*\}/s);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText);

      // Validate required fields
      if (!parsed.complexity || !parsed.model || !parsed.iterations || parsed.confidence === undefined) {
        throw new Error('Missing required fields: complexity, model, iterations, confidence');
      }

      // Validate values
      this.validateAnalysisResult(parsed);

      return {
        complexity: parsed.complexity,
        model: parsed.model,
        iterations: Math.round(parsed.iterations),
        confidence: parsed.confidence,
        reasoning: parsed.reasoning || 'No reasoning provided',
        source: 'llm',
        timestamp: Date.now(),
        originalTask
      };

    } catch (error) {
      throw new Error(`Failed to parse Claude response: ${error.message}\nResponse: ${response}`);
    }
  }

  validateAnalysisResult(result) {
    // Validate complexity
    const validComplexities = ['simple', 'moderate', 'complex'];
    if (!validComplexities.includes(result.complexity)) {
      throw new Error(`Invalid complexity: ${result.complexity}. Must be one of: ${validComplexities.join(', ')}`);
    }

    // Validate model
    const validModels = ['sonnet', 'opus'];
    if (!validModels.includes(result.model)) {
      throw new Error(`Invalid model: ${result.model}. Must be one of: ${validModels.join(', ')}`);
    }

    // Validate iterations
    if (!Number.isInteger(result.iterations) || result.iterations < 1 || result.iterations > 20) {
      throw new Error(`Invalid iterations: ${result.iterations}. Must be integer between 1-20`);
    }

    // Validate confidence
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      throw new Error(`Invalid confidence: ${result.confidence}. Must be number between 0-1`);
    }

    return true;
  }

  /**
   * Fallback analysis using simple heuristics when Claude unavailable
   */
  analyzeFallback(taskDescription) {
    const taskLower = taskDescription.toLowerCase();
    const wordCount = taskDescription.split(/\s+/).length;

    // Simple keyword-based analysis
    let complexity = 'moderate';
    let model = 'sonnet';
    let iterations = 5;
    let confidence = 0.6; // Lower confidence for heuristic analysis

    // Simple patterns
    if (taskLower.match(/^(fix|update|change|rename|move|delete|add simple|create basic)/)) {
      complexity = 'simple';
      iterations = 2;
      confidence = 0.7;
    }

    // Complex patterns
    if (taskLower.match(/(refactor|migrate|architecture|system|framework|rewrite|entire|complete)/)) {
      complexity = 'complex';
      model = 'opus';
      iterations = 10;
      confidence = 0.7;
    }

    // Word count adjustments
    if (wordCount < 5) {
      complexity = 'simple';
      iterations = Math.max(2, iterations - 2);
    } else if (wordCount > 15) {
      complexity = 'complex';
      model = 'opus';
      iterations = Math.min(15, iterations + 3);
    }

    return {
      complexity,
      model,
      iterations,
      confidence,
      reasoning: 'Heuristic analysis based on keywords and task length',
      source: 'fallback',
      timestamp: Date.now(),
      originalTask: taskDescription
    };
  }

  /**
   * Test if Claude Code CLI is available
   */
  async isClaudeAvailable() {
    try {
      execSync('claude --version', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cached result if available and not expired
   */
  getCachedResult(taskDescription) {
    if (!this.cacheEnabled) return null;
    
    const cacheKey = this.getCacheKey(taskDescription);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached.result;
  }

  /**
   * Cache analysis result
   */
  cacheResult(taskDescription, result) {
    if (!this.cacheEnabled) return;
    
    const cacheKey = this.getCacheKey(taskDescription);
    this.cache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now()
    });
    
    // Clean up expired entries periodically
    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  /**
   * Generate cache key from task description
   */
  getCacheKey(taskDescription) {
    // Simple normalization for caching
    return taskDescription.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear cache manually
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Batch analyze multiple tasks
   */
  async batchAnalyze(tasks) {
    const results = [];
    const errors = [];

    for (let i = 0; i < tasks.length; i++) {
      try {
        const result = await this.analyzeComplexity(tasks[i]);
        results.push({ index: i, task: tasks[i], ...result });
      } catch (error) {
        errors.push({ index: i, task: tasks[i], error: error.message });
      }
    }

    return { results, errors };
  }

  /**
   * Get recommended iterations based on complexity and confidence
   */
  static getRecommendedIterations(complexity, confidence) {
    const baseIterations = {
      simple: 2,
      moderate: 5,
      complex: 10
    };

    let iterations = baseIterations[complexity] || 5;

    // Adjust based on confidence
    if (confidence < 0.7) {
      iterations += 2; // Add buffer for uncertain tasks
    } else if (confidence > 0.9) {
      iterations = Math.max(1, iterations - 1); // Reduce for very confident assessments
    }

    return Math.min(20, iterations); // Cap at 20
  }
}

module.exports = WorkComplexityAnalyzer;