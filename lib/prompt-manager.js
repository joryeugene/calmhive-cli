/**
 * PromptManager - Template management system for dynamic prompt generation
 *
 * Handles loading, processing, and caching of prompt templates for different
 * command types. Supports conditional logic, variable substitution, and
 * intelligent prompt optimization based on context.
 *
 * @example
 * const manager = new PromptManager();
 * const prompt = manager.renderTemplate('afk', {
 *   task: 'Analyze codebase',
 *   iterations: 10,
 *   sessionId: 'afk-12345'
 * });
 */

const fs = require('fs-extra');
const path = require('path');

class PromptManager {
  /**
   * Creates a new PromptManager instance and loads default templates
   *
   * Initializes template cache and loads built-in templates for
   * AFk sessions, task execution, and debugging workflows.
   */
  constructor() {
    this.templates = new Map();
    this.cache = new Map();
    this.promptsDir = path.join(__dirname, '../prompts');
    this.loadTemplatesSync();
  }

  loadTemplatesSync() {
    // Load templates synchronously for tests
    const defaultTemplates = {
      'afk': `task: {{task}}
iterations: {{iterations}}
{{#includeDebug}}DEBUG MODE{{/includeDebug}}`,
      'do': `task: {{task}}
PERFORM THIS TASK`,
      'fix': `FIX THIS ISSUE
description: {{description}}`
    };

    for (const [name, content] of Object.entries(defaultTemplates)) {
      this.templates.set(name, content);
    }
  }

  async loadTemplates() {
    // Load default templates if prompts directory doesn't exist
    const defaultTemplates = {
      'afk': `# AFk Background Task
{{task}}

CRITICAL REQUIREMENTS:
1. Complete ALL iterations ({{iterations}} total)
2. Save progress after each iteration
3. Continue from last checkpoint if interrupted
4. Report detailed progress
5. Handle errors gracefully

Working Directory: {{workingDir}}
Session ID: {{sessionId}}

PERFORM THIS TASK IN BACKGROUND MODE
`,
      'do': `# Task Execution
{{task}}

REQUIREMENTS:
1. Use mcp__sequentialthinking__sequentialthinking_tools with minimum 12 steps
2. Search comprehensively before starting
3. Update todo list frequently with TodoWrite
4. Verify solution works before claiming completion

EXECUTE THIS TASK WITH FULL VERIFICATION
`,
      'fix': `# Bug Fix Protocol
{{description}}

CRITICAL FIX REQUIREMENTS:
1. NEVER claim fixed without verification
2. Search BEYOND obvious files
3. Look for parent components that might override
4. Test the actual fix with appropriate tools:
   - Playwright for UI issues
   - Actual code execution for logic issues
   - Log analysis for runtime issues
5. Get user confirmation before marking resolved

Session: {{sessionId}}

FIX THIS ISSUE WITH MANDATORY VERIFICATION
`,
      'think': `# Deep Analysis Request
{{topic}}

ANALYSIS REQUIREMENTS:
1. Use mcp__sequentialthinking__sequentialthinking_tools (15+ thoughts)
2. Consider multiple perspectives
3. Challenge assumptions
4. Identify edge cases

PROVIDE DEEP ANALYSIS WITH STRUCTURED THINKING
`
    };

    // Create prompts directory if it doesn't exist
    await fs.ensureDir(this.promptsDir);

    // Load templates from files or use defaults
    for (const [name, defaultContent] of Object.entries(defaultTemplates)) {
      const filePath = path.join(this.promptsDir, `${name}.txt`);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        this.templates.set(name, content);
      } catch (error) {
        // Use default template and save it
        this.templates.set(name, defaultContent);
        await fs.writeFile(filePath, defaultContent, 'utf8');
      }
    }
  }

  async getPrompt(type, params = {}) {
    // Check cache first
    const cacheKey = `${type}:${JSON.stringify(params)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Get template
    let template = this.templates.get(type) || '';

    if (!template && params.task) {
      // Fallback to simple task prompt
      template = 'PERFORM THIS TASK: {{task}}';
    }

    // Replace all placeholders
    Object.entries(params).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, value);
    });

    // Handle conditional sections (e.g., {{#includeDebug}}...{{/includeDebug}})
    template = this.processConditionals(template, params);

    // Cache the result
    this.cache.set(cacheKey, template);

    return template;
  }

  processConditionals(template, params) {
    // Process conditional blocks
    const conditionalRegex = /{{#(\w+)}}([\s\S]*?){{\/\1}}/g;

    return template.replace(conditionalRegex, (match, key, content) => {
      if (params[key]) {
        return content;
      }
      return '';
    });
  }

  async enhancePrompt(prompt, options = {}) {
    let enhanced = prompt;

    if (options.includeFiles && options.includeFiles.length > 0) {
      enhanced += '\n\n## Related Files:\n';
      options.includeFiles.forEach(file => {
        enhanced += `\n### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`;
      });
    }

    if (options.includeSystemInfo) {
      enhanced += '\n\n## System Context:\n';
      enhanced += `- Node Version: ${process.version}\n`;
      enhanced += `- Platform: ${process.platform}\n`;
      enhanced += `- Working Directory: ${process.cwd()}\n`;
      enhanced += `- Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used\n`;
    }

    if (options.previousErrors && options.previousErrors.length > 0) {
      enhanced += '\n\n## Previous Errors:\n';
      options.previousErrors.forEach((error, i) => {
        enhanced += `${i + 1}. ${error}\n`;
      });
    }

    return enhanced;
  }

  async buildRefactorPrompt(options) {
    let prompt = '# Refactoring Task\n\n';
    prompt += `Target File: ${options.targetFile}\n\n`;
    prompt += '## Refactoring Patterns:\n';
    options.patterns.forEach((pattern, i) => {
      prompt += `${i + 1}. ${pattern}\n`;
    });

    if (options.preserveBehavior) {
      prompt += '\n## CRITICAL: Must preserve existing behavior\n';
      prompt += '- Run existing tests to verify\n';
      prompt += '- Compare output before/after\n';
      prompt += '- Maintain all public APIs\n';
    }

    prompt += '\n## Requirements:\n';
    prompt += '1. Use sequential thinking for analysis\n';
    prompt += '2. Create comprehensive tests\n';
    prompt += '3. Document all changes\n';
    prompt += '4. Verify no regressions\n';

    return prompt;
  }

  async buildBugFixPrompt(options) {
    let prompt = '# Bug Fix Task\n\n';
    prompt += '## Error Details:\n';
    prompt += `Message: ${options.errorMessage}\n`;

    if (options.stackTrace) {
      prompt += `\n### Stack Trace:\n\`\`\`\n${options.stackTrace}\n\`\`\`\n`;
    }

    if (options.relatedFiles && options.relatedFiles.length > 0) {
      prompt += '\n## Related Files:\n';
      options.relatedFiles.forEach(file => {
        prompt += `- ${file}\n`;
      });
    }

    if (options.previousAttempts && options.previousAttempts.length > 0) {
      prompt += '\n## Previous Fix Attempts:\n';
      options.previousAttempts.forEach((attempt, i) => {
        prompt += `${i + 1}. ${attempt}\n`;
      });
    }

    prompt += '\n## Fix Requirements:\n';
    prompt += '1. Identify root cause (not just symptoms)\n';
    prompt += '2. Search beyond obvious files\n';
    prompt += '3. Test the fix thoroughly\n';
    prompt += '4. Verify with appropriate tools\n';
    prompt += '5. NEVER claim fixed without proof\n';

    return prompt;
  }

  async buildTestPrompt(options) {
    let prompt = '# Test Generation Task\n\n';
    prompt += `Target File: ${options.targetFile}\n`;
    prompt += `Framework: ${options.framework}\n`;
    prompt += `Coverage Type: ${options.coverage} tests\n\n`;

    prompt += '## Test Requirements:\n';
    prompt += '1. Cover all public methods\n';
    prompt += '2. Test error conditions\n';

    if (options.includeEdgeCases) {
      prompt += '3. Include comprehensive edge cases:\n';
      prompt += '   - Null/undefined inputs\n';
      prompt += '   - Empty arrays/objects\n';
      prompt += '   - Boundary values\n';
      prompt += '   - Concurrent operations\n';
      prompt += '   - Resource exhaustion\n';
    }

    prompt += '\n## Test Structure:\n';
    prompt += '- Use descriptive test names\n';
    prompt += '- Group related tests\n';
    prompt += '- Include setup/teardown\n';
    prompt += '- Mock external dependencies\n';
    prompt += '- Verify both success and failure paths\n';

    return prompt;
  }

  optimizePrompt(prompt) {
    // Claude Code handles model selection automatically
    // Just ensure prompt is well-structured
    return prompt.trim();
  }

  truncateToTokenLimit(prompt, limit) {
    // Rough approximation: 1 token ≈ 4 characters
    const maxChars = limit * 4;
    if (prompt.length > maxChars) {
      return prompt.substring(0, maxChars - 20) + '...[truncated]';
    }
    return prompt;
  }

  composePrompts(sections) {
    return sections
      .filter(s => s && s.content)
      .map(s => {
        if (s.type === 'system') {
          return `# SYSTEM: ${s.content}`;
        } else if (s.type === 'context') {
          return `## Context:\n${s.content}`;
        } else {
          return s.content;
        }
      })
      .join('\n\n');
  }

  clearCache() {
    // Reload templates in case they changed
    this.loadTemplates();
  }
}

module.exports = PromptManager;
