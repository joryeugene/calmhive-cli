#!/usr/bin/env node
/**
 * Claude Code-Based Natural Language Cron Parser
 * Uses claude -p to intelligently convert natural language to cron expressions
 */

const { execSync } = require('child_process');

class ClaudeCronParser {
  constructor(options = {}) {
    this.timeout = options.timeout || 120000; // 120 second timeout
    this.retries = options.retries || 1; // Reduce retries since we have longer timeout
  }

  /**
   * Parse natural language into cron expression using Claude Code
   * @param {string} input - Natural language time expression
   * @param {string} referenceTime - ISO timestamp for relative calculations (optional)
   * @returns {Promise<Object>} - { cron, type, original, explanation }
   */
  async parseNaturalLanguage(input, referenceTime = null) {
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    const currentTime = referenceTime || new Date().toISOString();
    const prompt = this.buildConversionPrompt(input, currentTime);

    let lastError;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const result = await this.executeClaudePrompt(prompt);
        return this.parseClaudeResponse(result, input);
      } catch (error) {
        lastError = error;
        console.warn(`Claude parsing attempt ${attempt} failed: ${error.message}`);
        if (attempt < this.retries) {
          await this.delay(1000 * attempt); // Progressive delay
        }
      }
    }

    throw new Error(`Failed to parse "${input}" after ${this.retries} attempts: ${lastError.message}`);
  }

  buildConversionPrompt(input, currentTime) {
    return `You are a cron expression generator. Convert natural language time expressions to cron format.

SYSTEM: You must always respond with valid JSON containing exactly these fields: cron, type, explanation

EXAMPLES:
Input: "daily at 2pm"
Output: {"cron": "0 14 * * *", "type": "recurring", "explanation": "daily at 2:00 PM"}

Input: "every Monday at 9am" 
Output: {"cron": "0 9 * * 1", "type": "recurring", "explanation": "every Monday at 9:00 AM"}

Input: "in 30 minutes" (when current time is 2:00 PM)
Output: {"cron": "30 14 5 7 *", "type": "once", "explanation": "once at 2:30 PM on July 5th"}

Input: "every Wednesday and Saturday at 10am"
Output: {"cron": "0 10 * * 3,6", "type": "recurring", "explanation": "every Wednesday and Saturday at 10:00 AM"}

RULES:
- Cron format: "minute hour day month weekday" (5 fields)
- Type: "recurring" for repeating schedules, "once" for one-time events
- Weekday: 0=Sunday, 1=Monday, ..., 6=Saturday
- Month: 1-12
- For relative times, calculate from CURRENT_TIME

TASK:
INPUT: "${input}"
CURRENT_TIME: ${currentTime}

Convert the INPUT to cron format. Return only valid JSON.`;
  }

  async executeClaudePrompt(prompt) {
    try {
      // Execute claude -p with JSON output format
      const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const command = `claude -p --output-format json "${escapedPrompt}"`;
      
      // console.log('DEBUG: Executing command:', command.length > 200 ? command.substring(0, 200) + '...' : command);

      const output = execSync(command, {
        encoding: 'utf8',
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe'] // Capture stderr separately
      });

      // Parse the JSON response from Claude CLI
      const response = JSON.parse(output.trim());
      
      // Check for errors
      if (response.is_error || response.subtype !== 'success') {
        throw new Error(`Claude execution failed: ${response.subtype || 'unknown error'}`);
      }
      
      return response.result;
    } catch (error) {
      // console.log('DEBUG: Command failed with error:', error.message);
      // console.log('DEBUG: Error code:', error.code);
      // console.log('DEBUG: Error signal:', error.signal);
      
      if (error.code === 'ENOENT') {
        throw new Error('Claude Code CLI not found. Please install: npm install -g @anthropic/claude-code');
      }
      if (error.signal === 'SIGTERM') {
        throw new Error(`Claude parsing timed out after ${this.timeout}ms`);
      }
      if (error.message.includes('Unexpected token')) {
        throw new Error(`Claude CLI returned invalid JSON: ${error.message}`);
      }
      throw new Error(`Claude execution failed: ${error.message}`);
    }
  }

  parseClaudeResponse(response, originalInput) {
    try {
      // Clean response - Claude might return extra text
      let jsonText = response;

      // Extract JSON if wrapped in markdown or extra text
      const jsonMatch = response.match(/\{[^}]*\}/s);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText);

      // Validate required fields
      if (!parsed.cron || !parsed.type || !parsed.explanation) {
        throw new Error('Missing required fields: cron, type, explanation');
      }

      // Validate cron format
      this.validateCronExpression(parsed.cron);

      return {
        cron: parsed.cron,
        type: parsed.type,
        explanation: parsed.explanation,
        original: originalInput,
        timestamp: Date.now()
      };

    } catch (error) {
      throw new Error(`Failed to parse Claude response: ${error.message}\nResponse: ${response}`);
    }
  }

  validateCronExpression(cron) {
    if (typeof cron !== 'string') {
      throw new Error('Cron expression must be a string');
    }

    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(`Invalid cron format. Expected 5 fields, got ${parts.length}: "${cron}"`);
    }

    const [minute, hour, day, month, weekday] = parts;

    // Validate ranges
    this.validateCronField(minute, 0, 59, 'minute');
    this.validateCronField(hour, 0, 23, 'hour');
    this.validateCronField(day, 1, 31, 'day', true); // Allow * for day
    this.validateCronField(month, 1, 12, 'month', true); // Allow * for month
    this.validateCronField(weekday, 0, 7, 'weekday', true); // Allow * for weekday (0 and 7 = Sunday)

    return true;
  }

  validateCronField(field, min, max, name, allowWildcard = true) {
    if (allowWildcard && field === '*') {
      return true;
    }

    const num = parseInt(field, 10);
    if (isNaN(num) || num < min || num > max) {
      throw new Error(`Invalid ${name} value: "${field}". Must be ${min}-${max}${allowWildcard ? ' or *' : ''}`);
    }

    return true;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch process multiple natural language expressions
   * @param {string[]} inputs - Array of natural language expressions
   * @returns {Promise<Object[]>} - Array of parsed results
   */
  async batchParse(inputs) {
    const results = [];
    const errors = [];

    for (let i = 0; i < inputs.length; i++) {
      try {
        const result = await this.parseNaturalLanguage(inputs[i]);
        results.push({ index: i, input: inputs[i], ...result });
      } catch (error) {
        errors.push({ index: i, input: inputs[i], error: error.message });
      }
    }

    return { results, errors };
  }

  /**
   * Test if Claude Code CLI is available
   * @returns {Promise<boolean>}
   */
  async isClaudeAvailable() {
    try {
      execSync('claude --version', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ClaudeCronParser;
