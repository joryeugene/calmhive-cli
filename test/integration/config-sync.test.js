/**
 * Config Sync Integration Test
 * Tests actual config installation and sync functionality
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class ConfigSyncTest {
  constructor() {
    this.projectRoot = path.join(__dirname, '..', '..');
    this.tempDir = null;
    this.originalUserConfig = path.join(os.homedir(), '.claude/CLAUDE.md');
    this.backupPath = null;
  }

  async runCommand(command, args = [], timeout = 10000) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.projectRoot 
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out: ${command} ${args.join(' ')}`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async setup() {
    console.log('🔧 Setting up test environment...');
    
    // Create temp directory for testing
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-sync-test-'));
    
    // Backup existing user config if it exists
    try {
      await fs.access(this.originalUserConfig);
      this.backupPath = path.join(this.tempDir, 'original-claude.md.backup');
      await fs.copyFile(this.originalUserConfig, this.backupPath);
      console.log('  ✓ Backed up existing user config');
    } catch (error) {
      console.log('  ✓ No existing user config to backup');
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Restore original user config if we backed it up
    if (this.backupPath) {
      try {
        await fs.copyFile(this.backupPath, this.originalUserConfig);
        console.log('  ✓ Restored original user config');
      } catch (error) {
        console.log(`  ⚠️ Failed to restore original config: ${error.message}`);
      }
    } else {
      // Remove test config if no original existed
      try {
        await fs.unlink(this.originalUserConfig);
        console.log('  ✓ Removed test config');
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
    
    // Remove temp directory
    if (this.tempDir) {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
        console.log('  ✓ Removed temp directory');
      } catch (error) {
        console.log(`  ⚠️ Failed to remove temp directory: ${error.message}`);
      }
    }
  }

  async testConfigShow() {
    console.log('📊 Testing config show command...');
    
    const result = await this.runCommand('node', ['cmd/config', 'show']);
    
    if (result.code !== 0) {
      throw new Error(`Config show failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Configuration Status')) {
      throw new Error('Config show output missing expected header');
    }
    
    console.log('  ✓ Config show command works');
  }

  async testConfigInstall() {
    console.log('💾 Testing config install (CLI template)...');
    
    // Remove existing config for clean test
    try {
      await fs.unlink(this.originalUserConfig);
    } catch (error) {
      // Ignore if doesn't exist
    }
    
    // Install CLI template
    const result = await this.runCommand('node', ['cmd/config', 'install', '--force']);
    
    if (result.code !== 0) {
      throw new Error(`Config install failed with code ${result.code}: ${result.stderr}`);
    }
    
    // Verify file was created
    try {
      const content = await fs.readFile(this.originalUserConfig, 'utf8');
      
      // Check version matches package.json
      const pkg = JSON.parse(await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf8'));
      if (!content.includes(`Version: ${pkg.version}`)) {
        throw new Error(`Installed config missing correct version ${pkg.version}`);
      }
      
      // Check for key sections
      if (!content.includes('lets bee friends')) {
        throw new Error('Installed config missing confirmation protocol');
      }
      
      if (!content.includes('<intent_mandate>')) {
        throw new Error('Installed config missing intent mandate section');
      }
      
      console.log('  ✓ CLI template installed correctly');
      
    } catch (error) {
      throw new Error(`Failed to verify installed config: ${error.message}`);
    }
  }

  async testConfigDesktopInstall() {
    console.log('🖥️ Testing config install (Desktop template)...');
    
    const result = await this.runCommand('node', ['cmd/config', 'install', '--desktop', '--force']);
    
    if (result.code !== 0) {
      throw new Error(`Desktop config install failed with code ${result.code}: ${result.stderr}`);
    }
    
    // Verify desktop template was installed
    try {
      const content = await fs.readFile(this.originalUserConfig, 'utf8');
      
      if (!content.includes('Desktop Optimized')) {
        throw new Error('Desktop template not properly installed');
      }
      
      console.log('  ✓ Desktop template installed correctly');
      
    } catch (error) {
      throw new Error(`Failed to verify desktop config: ${error.message}`);
    }
  }

  async testConfigCommands() {
    console.log('📁 Testing config commands functionality...');
    
    // Test commands list
    const listResult = await this.runCommand('node', ['cmd/config', 'commands', 'list']);
    
    if (listResult.code !== 0) {
      throw new Error(`Config commands list failed: ${listResult.stderr}`);
    }
    
    if (!listResult.stdout.includes('Command Files Summary')) {
      throw new Error('Commands list missing expected header');
    }
    
    if (!listResult.stdout.includes('Total files:')) {
      throw new Error('Commands list missing file count');
    }
    
    // Test commands copy to temp directory
    const testCopyDir = path.join(this.tempDir, 'test-commands');
    const copyResult = await this.runCommand('node', ['cmd/config', 'commands', 'copy', testCopyDir]);
    
    if (copyResult.code !== 0) {
      throw new Error(`Config commands copy failed: ${copyResult.stderr}`);
    }
    
    // Verify files were copied
    try {
      const files = await fs.readdir(testCopyDir);
      if (files.length === 0) {
        throw new Error('No files were copied to destination');
      }
      
      // Check for some expected files
      const fileNames = files.map(f => f.toLowerCase());
      if (!fileNames.some(f => f.includes('bug-hunting'))) {
        throw new Error('Expected template files not found in copy');
      }
      
      console.log(`  ✓ Commands copy functionality works (${files.length} files copied)`);
      
    } catch (error) {
      throw new Error(`Failed to verify copied commands: ${error.message}`);
    }
  }

  async testConfigDiff() {
    console.log('🔍 Testing config diff functionality...');
    
    const result = await this.runCommand('node', ['cmd/config', 'diff']);
    
    if (result.code !== 0) {
      throw new Error(`Config diff failed with code ${result.code}: ${result.stderr}`);
    }
    
    // Should show either "identical" or differences
    if (!result.stdout.includes('Comparing with') && !result.stdout.includes('identical')) {
      throw new Error('Config diff output unexpected format');
    }
    
    console.log('  ✓ Config diff functionality works');
  }

  async testConfigBackup() {
    console.log('💾 Testing config backup functionality...');
    
    const result = await this.runCommand('node', ['cmd/config', 'backup']);
    
    if (result.code !== 0) {
      throw new Error(`Config backup failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Backup created successfully')) {
      throw new Error('Backup success message not found');
    }
    
    console.log('  ✓ Config backup functionality works');
  }

  async runAllTests() {
    console.log('🧪 Config Sync Integration Test Suite');
    console.log('====================================\n');

    try {
      await this.setup();
      
      await this.testConfigShow();
      await this.testConfigInstall();
      await this.testConfigDesktopInstall();
      await this.testConfigCommands();
      await this.testConfigDiff();
      await this.testConfigBackup();
      
      console.log('\n✅ All config sync tests passed!');
      console.log('🎉 Config functionality is working correctly');
      
      return true;
      
    } catch (error) {
      console.error(`\n❌ Config sync test failed: ${error.message}`);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new ConfigSyncTest();
  test.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = ConfigSyncTest;