const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Calmhive Rule Injector - Reliable CLAUDE.md Rule Injection
 *
 * This module provides reliable CLAUDE.md rule injection at the Calmhive level,
 * ensuring every conversation gets rules regardless of tool usage or conversation type.
 *
 * Unlike hooks (which only fire before tool use), this approach guarantees
 * rule injection for ALL Calmhive commands: chat, run, afk, voice, etc.
 *
 * @example
 * const ruleInjector = require('./rule-injector');
 * const task = ruleInjector.injectRules('analyze the codebase');
 * // Returns: 'analyze the codebase\n\n<system-reminder>...CLAUDE.md content...</system-reminder>'
 */

class RuleInjector {
  /**
   * Creates a new RuleInjector instance
   *
   * Initializes paths for Claude configuration directory, CLAUDE.md file,
   * and user settings. Automatically loads user preferences on creation.
   */
  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.claudeMdPath = path.join(this.claudeDir, 'CLAUDE.md');
    this.enabled = false; // Default disabled to reduce log clutter
    this.settingsPath = path.join(this.claudeDir, 'calmhive-settings.json');

    // Load user settings
    this.loadSettings();
  }

  /**
   * Load user settings for rule injection
   */
  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        this.enabled = settings.ruleInjection === true; // Default to false unless explicitly enabled
      }
    } catch (error) {
      // If settings file is corrupt, default to disabled
      this.enabled = false;
    }
  }

  /**
   * Save user settings
   */
  saveSettings() {
    try {
      if (!fs.existsSync(this.claudeDir)) {
        fs.mkdirSync(this.claudeDir, { recursive: true });
      }

      const settings = {
        ruleInjection: this.enabled,
        lastModified: new Date().toISOString()
      };

      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      // Fail silently - don't break command execution for settings issues
    }
  }

  /**
   * Enable rule injection
   */
  enable() {
    this.enabled = true;
    this.saveSettings();
  }

  /**
   * Disable rule injection
   */
  disable() {
    this.enabled = false;
    this.saveSettings();
  }

  /**
   * Check if rule injection is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Extract rules from actual ~/.claude/CLAUDE.md file
   */
  extractRulesFromCLAUDEmd() {
    try {
      if (!fs.existsSync(this.claudeMdPath)) {
        return null;
      }

      // Read the actual CLAUDE.md content and return it in full
      const content = fs.readFileSync(this.claudeMdPath, 'utf8');

      if (content.trim().length === 0) {
        return null;
      }

      // Return the full CLAUDE.md content as rules
      return `CLAUDE.md RULES:\n\n${content}`;

    } catch (error) {
      return null;
    }
  }

  /**
   * Inject rules into a user message/prompt
   * @param {string} userMessage - The user's message or prompt
   * @param {Object} options - Options for injection
   * @returns {string} - Message with rules injected (or original if disabled/no rules)
   */
  injectRules(userMessage, options = {}) {
    // Skip injection if disabled
    if (!this.enabled) {
      return userMessage;
    }

    // Skip injection if rules already present (prevent double injection)
    if (userMessage.includes('CLAUDE.md RULES:')) {
      return userMessage;
    }

    // Extract rules from CLAUDE.md
    const rules = this.extractRulesFromCLAUDEmd();
    if (!rules) {
      return userMessage;
    }

    // Different injection patterns based on command type
    const commandType = options.commandType || 'chat';

    switch (commandType) {
    case 'chat':
      // For interactive chat, prepend rules to user message
      return `${rules}\n\nUSER: ${userMessage}`;

    case 'run':
      // For run command, insert rules before task execution
      return `${rules}\n\nTASK: ${userMessage}`;

    case 'afk':
      // For AFk, inject rules at start of each iteration
      return `${rules}\n\nAFK TASK: ${userMessage}`;

    case 'voice':
      // For voice, inject rules before voice command
      return `${rules}\n\nVOICE COMMAND: ${userMessage}`;

    default:
      // Generic injection pattern
      return `${rules}\n\n${userMessage}`;
    }
  }

  /**
   * Inject rules for multi-turn conversations
   * @param {Array} messages - Array of conversation messages
   * @param {Object} options - Options for injection
   * @returns {Array} - Messages with rules injected in appropriate places
   */
  injectRulesIntoConversation(messages, options = {}) {
    if (!this.enabled || !Array.isArray(messages)) {
      return messages;
    }

    const rules = this.extractRulesFromCLAUDEmd();
    if (!rules) {
      return messages;
    }

    // Find the last user message and inject rules if not already present
    const updatedMessages = [...messages];

    for (let i = updatedMessages.length - 1; i >= 0; i--) {
      if (updatedMessages[i].role === 'user') {
        const content = updatedMessages[i].content;

        // Only inject if rules not already present
        if (!content.includes('CLAUDE.md RULES:')) {
          updatedMessages[i] = {
            ...updatedMessages[i],
            content: `${rules}\n\nUSER: ${content}`
          };
        }
        break;
      }
    }

    return updatedMessages;
  }

  /**
   * Get status information for debugging
   */
  getStatus() {
    return {
      enabled: this.enabled,
      claudeMdExists: fs.existsSync(this.claudeMdPath),
      settingsPath: this.settingsPath,
      rulesExtracted: !!this.extractRulesFromCLAUDEmd()
    };
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage() {
    const status = this.getStatus();

    if (!status.enabled) {
      return '❌ Rule injection DISABLED by user';
    }

    if (!status.claudeMdExists) {
      return '⚠️  No CLAUDE.md file found - rules cannot be injected';
    }

    if (!status.rulesExtracted) {
      return '⚠️  No extractable rules found in CLAUDE.md';
    }

    return '✅ Rule injection ENABLED and ready';
  }
}

// Export singleton instance
module.exports = new RuleInjector();
