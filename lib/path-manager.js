/**
 * Centralized path management for Calmhive
 * Single source of truth for all file and directory paths
 */

const path = require('path');
const fs = require('fs');

class PathManager {
  /**
   * Initialize PathManager with environment detection
   * Determines if running from npm package vs development environment
   * Sets up root directory path for all subsequent path operations
   */
  constructor() {
    // Detect if we're running from npm package or development
    this.isNpmPackage = this.detectNpmEnvironment();
    this.rootDir = this.findRootDirectory();
  }

  /**
   * Detect if running from npm package installation vs development environment
   * Uses node_modules presence in path as primary detection method
   * @returns {boolean} true if running from npm package, false if in development
   */
  detectNpmEnvironment() {
    // Check if we're in node_modules
    const currentPath = __dirname;
    return currentPath.includes('node_modules');
  }

  /**
   * Find the root directory of the calmhive installation by searching for package.json
   * Traverses up the directory tree looking for package.json with '@calmhive/calmhive-cli' name
   * Uses fallback logic for edge cases where package.json isn't found
   * @returns {string} Absolute path to the calmhive root directory
   */
  findRootDirectory() {
    let currentDir = __dirname;

    // Go up until we find package.json with our name
    while (currentDir !== path.dirname(currentDir)) {
      const packagePath = path.join(currentDir, 'package.json');

      if (fs.existsSync(packagePath)) {
        try {
          const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          if (packageData.name === '@calmhive/calmhive-cli') {
            return currentDir;
          }
        } catch (error) {
          // Continue searching if package.json is malformed
        }
      }

      currentDir = path.dirname(currentDir);
    }

    // Fallback - assume we're in lib/ directory
    return path.dirname(__dirname);
  }

  /**
   * Get the main bin directory
   */
  getBinDir() {
    return path.join(this.rootDir, 'bin');
  }

  /**
   * Get the commands directory (for executable commands)
   */
  getCommandsDir() {
    return path.join(this.rootDir, 'cmd');
  }

  /**
   * Get the templates directory (for Claude Code markdown files)
   */
  getTemplatesDir() {
    return path.join(this.rootDir, 'commands');
  }

  /**
   * Get the lib directory
   */
  getLibDir() {
    return path.join(this.rootDir, 'lib');
  }

  /**
   * Get the config directory
   */
  getConfigDir() {
    return path.join(this.rootDir, 'config');
  }

  /**
   * Get path to specific command executable
   */
  getCommandPath(commandName) {
    return path.join(this.getCommandsDir(), commandName);
  }

  /**
   * Get path to specific template file
   */
  getTemplatePath(templateName) {
    return path.join(this.getTemplatesDir(), templateName);
  }

  /**
   * Get path to specific lib file
   */
  getLibPath(libName) {
    return path.join(this.getLibDir(), libName);
  }

  /**
   * Check if a command exists
   */
  commandExists(commandName) {
    return fs.existsSync(this.getCommandPath(commandName));
  }

  /**
   * Check if a template exists
   */
  templateExists(templateName) {
    return fs.existsSync(this.getTemplatePath(templateName));
  }

  /**
   * Get all available commands
   */
  getAvailableCommands() {
    const commandsDir = this.getCommandsDir();

    if (!fs.existsSync(commandsDir)) {
      return [];
    }

    return fs.readdirSync(commandsDir)
      .filter(file => {
        const filePath = path.join(commandsDir, file);
        return fs.statSync(filePath).isFile();
      });
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates() {
    const templatesDir = this.getTemplatesDir();

    if (!fs.existsSync(templatesDir)) {
      return [];
    }

    return fs.readdirSync(templatesDir)
      .filter(file => {
        const filePath = path.join(templatesDir, file);
        return fs.statSync(filePath).isFile() && file.endsWith('.md');
      });
  }

  /**
   * Get version from package.json
   */
  getVersion() {
    try {
      const packagePath = path.join(this.rootDir, 'package.json');
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageData.version;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get debug information about paths
   */
  getDebugInfo() {
    return {
      isNpmPackage: this.isNpmPackage,
      rootDir: this.rootDir,
      binDir: this.getBinDir(),
      commandsDir: this.getCommandsDir(),
      templatesDir: this.getTemplatesDir(),
      libDir: this.getLibDir(),
      configDir: this.getConfigDir(),
      version: this.getVersion(),
      availableCommands: this.getAvailableCommands(),
      availableTemplates: this.getAvailableTemplates()
    };
  }
}

// Export singleton instance
module.exports = new PathManager();
