const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * ConfigManager - Handles CLAUDE.md configuration file management
 * Provides safe operations with backups, diffs, and validation
 */
class ConfigManager {
  constructor() {
    this.homeDir = process.env.HOME || process.env.USERPROFILE;
    this.claudeDir = path.join(this.homeDir, '.claude');
    this.configPath = path.join(this.claudeDir, 'CLAUDE.md');
    this.backupDir = path.join(this.claudeDir, 'backups');

    // Find calmhive root - works in both dev and npm installed scenarios
    this.calmhiveRoot = this.findCalmhiveRoot();
  }

  /**
   * Find the calmhive package root directory
   */
  findCalmhiveRoot() {
    // Method 1: Try to resolve the package.json from installed package
    try {
      const packagePath = require.resolve('@calmhive/calmhive-cli/package.json');
      return path.dirname(packagePath);
    } catch (error) {
      // Method 2: Look for package.json starting from current location
      let currentDir = __dirname;
      while (currentDir !== path.dirname(currentDir)) {
        const packagePath = path.join(currentDir, 'package.json');
        if (fs.existsSync(packagePath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            if (pkg.name === '@calmhive/calmhive-cli') {
              return currentDir;
            }
          } catch (error) {
            // Continue searching
          }
        }
        currentDir = path.dirname(currentDir);
      }

      // Method 3: Fallback to relative path (development)
      return path.join(__dirname, '..');
    }
  }

  /**
   * Ensure necessary directories exist
   */
  ensureDirectories() {
    if (!fs.existsSync(this.claudeDir)) {
      fs.mkdirSync(this.claudeDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Get path to template file
   */
  getTemplatePath() {
    // Single CLAUDE.md template for both CLI and desktop
    const filename = 'CLAUDE.md';
    return path.join(this.calmhiveRoot, filename);
  }

  /**
   * Generate timestamped backup filename
   */
  generateBackupPath() {
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .replace(/T/, '_');
    return path.join(this.backupDir, `CLAUDE.md.backup.${timestamp}`);
  }

  /**
   * Get configuration status
   */
  getStatus() {
    const status = {
      configExists: fs.existsSync(this.configPath),
      configPath: this.configPath,
      backupDir: this.backupDir,
      templateExists: fs.existsSync(this.getTemplatePath())
    };

    if (status.configExists) {
      const stats = fs.statSync(this.configPath);
      status.lastModified = stats.mtime;
      status.size = stats.size;

      // Try to detect version from file
      try {
        const content = fs.readFileSync(this.configPath, 'utf8');
        const versionMatch = content.match(/Version:\s*([0-9]+\.[0-9]+\.[0-9]+)/);
        status.version = versionMatch ? versionMatch[1] : 'unknown';
      } catch (error) {
        status.version = 'unknown';
      }
    }

    // Get available backups
    status.backups = this.listBackups();

    return status;
  }

  /**
   * List available backups
   */
  listBackups() {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    return fs.readdirSync(this.backupDir)
      .filter(file => file.startsWith('CLAUDE.md.backup.'))
      .map(file => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          created: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.created - a.created);
  }

  /**
   * Create backup of current config
   */
  createBackup() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error('No existing CLAUDE.md to backup');
    }

    this.ensureDirectories();
    const backupPath = this.generateBackupPath();
    fs.copyFileSync(this.configPath, backupPath);

    return {
      backupPath,
      size: fs.statSync(backupPath).size
    };
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(backupFilename) {
    let backupPath;

    if (backupFilename) {
      // Specific backup requested
      backupPath = path.join(this.backupDir, backupFilename);
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupFilename}`);
      }
    } else {
      // Use most recent backup
      const backups = this.listBackups();
      if (backups.length === 0) {
        throw new Error('No backups available');
      }
      backupPath = backups[0].path;
    }

    // Create backup of current config before restoring
    let currentBackup = null;
    if (fs.existsSync(this.configPath)) {
      currentBackup = this.createBackup();
    }

    // Restore from backup
    this.ensureDirectories();
    fs.copyFileSync(backupPath, this.configPath);

    return {
      restoredFrom: backupPath,
      currentBackedUpTo: currentBackup ? currentBackup.backupPath : null
    };
  }

  /**
   * Get diff between current config and template
   */
  async getDiff() {
    const templatePath = this.getTemplatePath();

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const templateName = 'CLAUDE.md';

    if (!fs.existsSync(this.configPath)) {
      return {
        isNewFile: true,
        templateName,
        templateSize: fs.statSync(templatePath).size,
        diff: null
      };
    }

    // Use diff command to compare files
    return new Promise((resolve, reject) => {
      const diffProcess = spawn('diff', ['-u', this.configPath, templatePath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      diffProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      diffProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      diffProcess.on('close', (code) => {
        if (code === 0) {
          // Files are identical
          resolve({
            isNewFile: false,
            isIdentical: true,
            templateName,
            diff: null
          });
        } else if (code === 1) {
          // Files differ
          resolve({
            isNewFile: false,
            isIdentical: false,
            templateName,
            diff: stdout
          });
        } else {
          // Error occurred
          reject(new Error(`Diff command failed: ${stderr || 'Unknown error'}`));
        }
      });

      diffProcess.on('error', (error) => {
        reject(new Error(`Failed to run diff: ${error.message}`));
      });
    });
  }

  /**
   * Install configuration from template
   */
  async installConfig(dryRun = false) {
    const templatePath = this.getTemplatePath();
    const templateName = 'CLAUDE.md'; // Single template for both CLI and desktop

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const result = {
      templateName,
      templatePath,
      configPath: this.configPath,
      isUpdate: fs.existsSync(this.configPath),
      dryRun,
      backupCreated: null
    };

    if (dryRun) {
      // Just return what would happen
      result.templateSize = fs.statSync(templatePath).size;
      return result;
    }

    // Create backup if config exists
    if (result.isUpdate) {
      result.backupCreated = this.createBackup();
    }

    // Ensure directories exist
    this.ensureDirectories();

    // Copy template to config location
    fs.copyFileSync(templatePath, this.configPath);
    result.size = fs.statSync(this.configPath).size;

    return result;
  }

  /**
   * Validate template file
   */
  validateTemplate() {
    const templatePath = this.getTemplatePath();

    if (!fs.existsSync(templatePath)) {
      return { valid: false, error: 'Template file not found' };
    }

    try {
      const content = fs.readFileSync(templatePath, 'utf8');

      // Basic validation
      if (content.length < 100) {
        return { valid: false, error: 'Template file too small' };
      }

      if (!content.includes('CLAUDE CODE PRACTICAL ENGINEERING FRAMEWORK')) {
        return { valid: false, error: 'Not a valid CLAUDE.md template' };
      }

      // Check for version
      const versionMatch = content.match(/Version:\s*([0-9]+\.[0-9]+\.[0-9]+)/);
      if (!versionMatch) {
        return { valid: false, error: 'No version found in template' };
      }

      return {
        valid: true,
        version: versionMatch[1],
        size: content.length
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }


  /**
   * Get available command files from ~/.claude/commands
   */
  getCommandFiles() {
    const commandsDir = path.join(this.claudeDir, 'commands');
    if (!fs.existsSync(commandsDir)) {
      return [];
    }

    const files = [];
    const scan = (dir, relativePath = '') => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relPath = path.join(relativePath, item);

        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch (error) {
          // Skip broken symlinks or files that can't be read
          continue;
        }

        if (stat.isDirectory()) {
          // Skip certain directories
          if (!['archive', 'old', 'delete', 'cleanup'].includes(item)) {
            scan(fullPath, relPath);
          }
        } else if (item.endsWith('.md') && !item.startsWith('.')) {
          files.push({
            name: item,
            path: fullPath,
            relativePath: relPath,
            size: stat.size,
            modified: stat.mtime
          });
        }
      }
    };

    scan(commandsDir);
    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  /**
   * Copy command files to destination directory
   */
  copyCommandFiles(destDir, options = {}) {
    const { dryRun = false, patterns = [], force = false } = options;
    const commandFiles = this.getCommandFiles();

    // Filter files based on patterns if provided
    let filesToCopy = commandFiles;
    if (patterns.length > 0) {
      filesToCopy = commandFiles.filter(file =>
        patterns.some(pattern =>
          file.name.includes(pattern) || file.relativePath.includes(pattern)
        )
      );
    }

    const results = {
      totalFiles: filesToCopy.length,
      copied: [],
      skipped: [],
      errors: [],
      dryRun
    };

    for (const file of filesToCopy) {
      const destPath = path.join(destDir, file.relativePath);
      const destExists = fs.existsSync(destPath);

      if (destExists && !force && !dryRun) {
        results.skipped.push({
          file: file.relativePath,
          reason: 'exists'
        });
        continue;
      }

      if (dryRun) {
        results.copied.push({
          file: file.relativePath,
          action: destExists ? 'overwrite' : 'create',
          size: file.size
        });
      } else {
        try {
          // Ensure destination directory exists
          const destDirPath = path.dirname(destPath);
          if (!fs.existsSync(destDirPath)) {
            fs.mkdirSync(destDirPath, { recursive: true });
          }

          // Copy file
          fs.copyFileSync(file.path, destPath);
          results.copied.push({
            file: file.relativePath,
            action: destExists ? 'overwritten' : 'created',
            size: file.size
          });
        } catch (error) {
          results.errors.push({
            file: file.relativePath,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  /**
   * Get summary of command files for display
   */
  getCommandFilesSummary() {
    const files = this.getCommandFiles();
    const categories = {};

    for (const file of files) {
      const dir = path.dirname(file.relativePath);
      const category = dir === '.' ? 'root' : dir;

      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(file);
    }

    return {
      totalFiles: files.length,
      categories,
      totalSize: files.reduce((sum, f) => sum + f.size, 0)
    };
  }
}

module.exports = ConfigManager;
