/**
 * Tool Manager - Centralized tool permissions for all V3 commands
 * Manages the master list of allowed tools including MCP tools
 */

const fs = require('fs-extra');
const path = require('path');

class ToolManager {
  /**
   * Initialize ToolManager with configuration loading
   * Sets up path to allowed-tools.json and loads the current tool configuration
   */
  constructor() {
    this.configPath = path.join(__dirname, '../config/allowed-tools.json');
    this.toolsConfig = this.loadConfig();
  }

  /**
   * Load tool configuration from allowed-tools.json with fallback to defaults
   * Handles file not found and JSON parse errors gracefully
   * @returns {Object} Configuration object with defaultTools and mcpTools arrays
   */
  loadConfig() {
    try {
      const config = fs.readJsonSync(this.configPath);
      return config;
    } catch (error) {
      console.error('Warning: Could not load tool config, using defaults');
      // Return safe defaults if config file is missing or malformed
      return {
        defaultTools: [
          'Task', 'Bash', 'Glob', 'Grep', 'LS', 'Read', 'Edit',
          'MultiEdit', 'Write', 'TodoRead', 'TodoWrite'
        ],
        mcpTools: []
      };
    }
  }

  /**
     * Get all available tools as an array
     * @returns {string[]} All tools for --allowedTools flag
     */
  getAllToolsArray() {
    return [...this.toolsConfig.defaultTools, ...this.toolsConfig.mcpTools];
  }

  /**
     * Get all available tools as a comma-separated string
     * @returns {string} All tools for --allowedTools flag
     */
  getAllTools() {
    return this.getAllToolsArray().join(',');
  }

  /**
     * Get only default tools (no MCP tools)
     * @returns {string} Default tools for basic operations
     */
  getDefaultTools() {
    return this.toolsConfig.defaultTools.join(',');
  }

  /**
     * Get only MCP tools
     * @returns {string} MCP tools for advanced operations
     */
  getMcpTools() {
    return this.toolsConfig.mcpTools.join(',');
  }

  /**
     * Get tools by category
     * @param {string[]} categories - Array of categories like ['default', 'github', 'sequentialthinking']
     * @returns {string[]} Filtered tools as array
     */
  getToolsByCategory(categories = ['default']) {
    let tools = [];

    categories.forEach(category => {
      switch(category) {
      case 'default':
        tools.push(...this.toolsConfig.defaultTools);
        break;
      case 'github':
        tools.push(...this.toolsConfig.mcpTools.filter(t => t.includes('github')));
        break;
      case 'sequentialthinking':
        tools.push(...this.toolsConfig.mcpTools.filter(t => t.includes('sequentialthinking')));
        break;
      case 'playwright':
        tools.push(...this.toolsConfig.mcpTools.filter(t => t.includes('playwright')));
        break;
      case 'asana':
        tools.push(...this.toolsConfig.mcpTools.filter(t => t.includes('asana')));
        break;
      case 'all':
        return this.getAllToolsArray();
      }
    });

    // Remove duplicates
    return [...new Set(tools)];
  }
}

// Export singleton instance
module.exports = new ToolManager();
