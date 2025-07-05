#!/usr/bin/env node
/**
 * Template Manager - v14.0.0
 * Manages predefined task templates for common workflows
 */

const fs = require('fs').promises;
const path = require('path');

class TemplateManager {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates');
    this.userTemplatesDir = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'calmhive', 'templates');
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {return;}

    try {
      await fs.mkdir(this.userTemplatesDir, { recursive: true });
      await this.createBuiltinTemplates();
      this.initialized = true;
    } catch (error) {
      console.error(`Failed to initialize template manager: ${error.message}`);
    }
  }

  /**
   * Create built-in templates if they don't exist
   */
  async createBuiltinTemplates() {
    const builtinTemplates = [
      {
        name: 'bug-fix',
        title: 'Bug Fix Workflow',
        description: 'Systematic approach to identifying and fixing bugs',
        tags: ['debugging', 'testing', 'quality'],
        iterations: 8,
        template: `# Bug Fix: {ISSUE_DESCRIPTION}

## Investigation Phase (Iterations 1-3)
1. Reproduce the bug consistently
2. Analyze error logs and stack traces  
3. Identify root cause through debugging

## Fix Phase (Iterations 4-6)
4. Implement targeted fix
5. Add comprehensive tests
6. Verify fix resolves the issue

## Validation Phase (Iterations 7-8)
7. Run full test suite
8. Test edge cases and regression scenarios

**Goal**: Fix {ISSUE_DESCRIPTION} with robust testing and no regressions`
      },
      {
        name: 'feature-development',
        title: 'Feature Development',
        description: 'End-to-end feature implementation with testing',
        tags: ['development', 'testing', 'design'],
        iterations: 12,
        template: `# Feature Development: {FEATURE_NAME}

## Planning Phase (Iterations 1-2)
1. Define requirements and acceptance criteria
2. Design architecture and identify dependencies

## Core Development (Iterations 3-8)
3. Implement core functionality
4. Add comprehensive unit tests
5. Integrate with existing systems
6. Handle error cases and edge scenarios
7. Add logging and monitoring
8. Optimize performance

## Polish & Testing (Iterations 9-12)
9. End-to-end testing
10. User experience refinement
11. Documentation updates
12. Final integration testing

**Goal**: Deliver production-ready {FEATURE_NAME} with full test coverage`
      },
      {
        name: 'refactoring',
        title: 'Code Refactoring',
        description: 'Safe refactoring with comprehensive testing',
        tags: ['refactoring', 'quality', 'maintenance'],
        iterations: 10,
        template: `# Refactoring: {TARGET_CODE}

## Analysis Phase (Iterations 1-2)
1. Analyze current code structure and identify issues
2. Design improved architecture

## Preparation (Iterations 3-4)
3. Add comprehensive tests for existing behavior
4. Document current functionality

## Refactoring (Iterations 5-8)
5. Implement structural improvements
6. Extract reusable components
7. Improve naming and clarity
8. Optimize performance

## Validation (Iterations 9-10)
9. Verify all tests pass
10. Performance benchmarking and final validation

**Goal**: Improve {TARGET_CODE} maintainability while preserving functionality`
      },
      {
        name: 'testing-setup',
        title: 'Test Infrastructure Setup',
        description: 'Comprehensive testing framework implementation',
        tags: ['testing', 'infrastructure', 'quality'],
        iterations: 6,
        template: `# Testing Setup: {PROJECT_NAME}

## Framework Setup (Iterations 1-2)
1. Choose and configure testing frameworks
2. Set up test environment and tooling

## Test Implementation (Iterations 3-4)
3. Write unit tests for core functionality
4. Add integration tests

## CI/CD Integration (Iterations 5-6)
5. Configure automated testing pipeline
6. Add coverage reporting and quality gates

**Goal**: Establish robust testing infrastructure for {PROJECT_NAME}`
      },
      {
        name: 'performance-optimization',
        title: 'Performance Optimization',
        description: 'Systematic performance analysis and improvement',
        tags: ['performance', 'optimization', 'monitoring'],
        iterations: 8,
        template: `# Performance Optimization: {TARGET_SYSTEM}

## Profiling Phase (Iterations 1-2)
1. Establish performance baselines
2. Identify bottlenecks through profiling

## Database Optimization (Iterations 3-4)
3. Optimize database queries and indexes
4. Implement efficient data access patterns

## Application Optimization (Iterations 5-6)
5. Optimize algorithms and data structures
6. Implement caching strategies

## Validation (Iterations 7-8)
7. Performance testing and benchmarking
8. Load testing and monitoring setup

**Goal**: Improve {TARGET_SYSTEM} performance by measurable metrics`
      }
    ];

    for (const template of builtinTemplates) {
      const templatePath = path.join(this.userTemplatesDir, `${template.name}.json`);

      try {
        await fs.access(templatePath);
        // Template already exists, skip
      } catch (error) {
        // Template doesn't exist, create it
        await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
      }
    }
  }

  /**
   * List all available templates
   */
  async listTemplates() {
    await this.init();

    try {
      const files = await fs.readdir(this.userTemplatesDir);
      const templates = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const templatePath = path.join(this.userTemplatesDir, file);
            const content = await fs.readFile(templatePath, 'utf8');
            const template = JSON.parse(content);
            templates.push({
              name: template.name,
              title: template.title,
              description: template.description,
              tags: template.tags || [],
              iterations: template.iterations || 5
            });
          } catch (error) {
            console.warn(`Failed to parse template ${file}: ${error.message}`);
          }
        }
      }

      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(`Failed to list templates: ${error.message}`);
      return [];
    }
  }

  /**
   * Get a specific template
   */
  async getTemplate(templateName) {
    await this.init();

    try {
      const templatePath = path.join(this.userTemplatesDir, `${templateName}.json`);
      const content = await fs.readFile(templatePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Template '${templateName}' not found`);
    }
  }

  /**
   * Apply template with variable substitution
   */
  async applyTemplate(templateName, variables = {}) {
    const template = await this.getTemplate(templateName);

    let content = template.template;

    // Replace variables in the format {VARIABLE_NAME}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key.toUpperCase()}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }

    return {
      ...template,
      appliedTemplate: content,
      variables
    };
  }

  /**
   * Create a new custom template
   */
  async createTemplate(templateData) {
    await this.init();

    const template = {
      name: templateData.name,
      title: templateData.title,
      description: templateData.description,
      tags: templateData.tags || [],
      iterations: templateData.iterations || 5,
      template: templateData.template,
      created: new Date().toISOString(),
      author: 'user'
    };

    // Validate required fields
    if (!template.name || !template.title || !template.template) {
      throw new Error('Template must have name, title, and template content');
    }

    // Ensure name is filesystem-safe
    template.name = template.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const templatePath = path.join(this.userTemplatesDir, `${template.name}.json`);
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2));

    return template;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateName) {
    await this.init();

    const templatePath = path.join(this.userTemplatesDir, `${templateName}.json`);

    try {
      await fs.unlink(templatePath);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete template '${templateName}': ${error.message}`);
    }
  }

  /**
   * Search templates by tag or keyword
   */
  async searchTemplates(query) {
    const templates = await this.listTemplates();
    const searchTerm = query.toLowerCase();

    return templates.filter(template =>
      template.name.includes(searchTerm) ||
      template.title.toLowerCase().includes(searchTerm) ||
      template.description.toLowerCase().includes(searchTerm) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Get template statistics
   */
  async getStats() {
    const templates = await this.listTemplates();

    const allTags = templates.flatMap(t => t.tags);
    const tagCounts = allTags.reduce((counts, tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
      return counts;
    }, {});

    return {
      totalTemplates: templates.length,
      averageIterations: Math.round(templates.reduce((sum, t) => sum + t.iterations, 0) / templates.length),
      popularTags: Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count })),
      templatesDir: this.userTemplatesDir
    };
  }

  /**
   * Export template to markdown file
   */
  async exportTemplate(templateName, outputPath) {
    const template = await this.getTemplate(templateName);

    const markdown = `# ${template.title}

**Description:** ${template.description}
**Tags:** ${template.tags.join(', ')}
**Recommended Iterations:** ${template.iterations}

## Template Content

${template.template}

---
*Template created: ${template.created || 'Unknown'}*
*Author: ${template.author || 'Unknown'}*
`;

    await fs.writeFile(outputPath, markdown);
    return outputPath;
  }
}

module.exports = TemplateManager;
