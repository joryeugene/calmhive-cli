/**
 * Config Command Test Suite
 * Tests for calmhive config command functionality
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ConfigManager = require('../../lib/config-manager');

class ConfigTest {
  constructor() {
    this.testDir = path.join(os.tmpdir(), 'calmhive-config-test-' + Date.now());
    this.mockHome = this.testDir;
    this.mockClaudeDir = path.join(this.testDir, '.claude');
    this.mockConfigPath = path.join(this.mockClaudeDir, 'CLAUDE.md');
    this.mockBackupDir = path.join(this.mockClaudeDir, 'backups');
    this.originalHome = process.env.HOME;
    this.projectRoot = path.join(__dirname, '..', '..');
  }

  async setup() {
    console.log(`🔧 Setting up test environment: ${this.testDir}`);
    
    // Create test directory structure
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.testDir, { recursive: true });
    fs.mkdirSync(this.mockClaudeDir, { recursive: true });
    
    // Mock HOME environment
    process.env.HOME = this.mockHome;
    
    // Create mock template files
    this.createMockTemplate(false); // CLI template
    this.createMockTemplate(true);  // Desktop template
  }

  async cleanup() {
    // Kill any processes spawned by this test
    try {
      const { spawn } = require('child_process');
      const killProcess = spawn('pkill', ['-f', this.testDir], { stdio: 'ignore' });
      await new Promise(resolve => {
        killProcess.on('close', () => resolve());
        setTimeout(resolve, 1000); // Timeout after 1 second
      });
    } catch (error) {
      // Ignore errors - process might not exist
    }
    
    // Restore environment
    process.env.HOME = this.originalHome;
    
    // Clean up test directory
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
  }

  createMockTemplate(desktop = false) {
    const filename = desktop ? 'CLAUDE-DESKTOP.md.example' : 'CLAUDE.md.example';
    const templatePath = path.join(this.projectRoot, filename);
    
    const content = `# CLAUDE CODE PRACTICAL ENGINEERING FRAMEWORK
# Version: 8.0.0 - Simplified Excellence Through Rich Hickey Principles${desktop ? ' (Desktop Optimized)' : ''}

<intent_mandate>
🚨 MANDATORY INTENT DECLARATION - RULE #0 🚨

BEFORE ANY IMPLEMENTATION, COMPLETE THIS SENTENCE:
"The job the user hired me to do is _______."

If you cannot state this clearly, ask for clarification.
NO EXECUTION WITHOUT UNDERSTANDING.
</intent_mandate>

Test template content for ${desktop ? 'desktop' : 'CLI'} version.
This is a mock template for testing purposes.

lets bee friends`;

    fs.writeFileSync(templatePath, content);
  }

  async runCommand(args) {
    return new Promise((resolve, reject) => {
      const configPath = path.join(this.projectRoot, 'cmd', 'config');
      const child = spawn('node', [configPath, ...args], {
        env: { ...process.env, HOME: this.mockHome },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      child.on('error', reject);
      
      // Auto-respond 'n' to any confirmation prompts
      child.stdin.write('n\n');
      child.stdin.end();
    });
  }

  async testConfigManager() {
    console.log('🧪 Testing ConfigManager class...');
    
    const manager = new ConfigManager();
    
    // Test status with no config
    const status = manager.getStatus();
    if (status.configExists) {
      throw new Error('Should report no config exists');
    }
    
    // Test template validation
    const validation = manager.validateTemplate(false);
    if (!validation.valid) {
      throw new Error(`CLI template validation failed: ${validation.error}`);
    }
    
    const desktopValidation = manager.validateTemplate(true);
    if (!desktopValidation.valid) {
      throw new Error(`Desktop template validation failed: ${desktopValidation.error}`);
    }
    
    console.log('✅ ConfigManager tests passed');
  }

  async testHelpCommand() {
    console.log('🧪 Testing help command...');
    const result = await this.runCommand(['--help']);
    
    if (result.code !== 0) {
      throw new Error(`Help command failed with code ${result.code}`);
    }
    
    if (!result.stdout.includes('Calmhive Config')) {
      throw new Error('Help output missing expected content');
    }
    
    console.log('✅ Help command works');
  }

  async testShowStatus() {
    console.log('🧪 Testing status display...');
    const result = await this.runCommand(['show']);
    
    if (result.code !== 0) {
      throw new Error(`Status command failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Configuration Status')) {
      throw new Error('Status output missing expected content');
    }
    
    if (!result.stdout.includes('❌ No')) {
      throw new Error('Should show no existing file');
    }
    
    console.log('✅ Status display works');
  }

  async testInstallConfig() {
    console.log('🧪 Testing config installation...');
    
    // Test dry run first
    let result = await this.runCommand(['install', '--dry-run']);
    
    if (result.code !== 0) {
      throw new Error(`Dry run failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Dry run')) {
      throw new Error('Dry run output missing');
    }
    
    // Test actual installation
    result = await this.runCommand(['install', '--force']);
    
    if (result.code !== 0) {
      throw new Error(`Install command failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Successfully installed')) {
      throw new Error('Install success message missing');
    }
    
    // Verify file was created
    if (!fs.existsSync(this.mockConfigPath)) {
      throw new Error('CLAUDE.md was not created');
    }
    
    console.log('✅ Config installation works');
  }

  async testBackupOperations() {
    console.log('🧪 Testing backup operations...');
    
    // First install a config
    await this.runCommand(['install', '--force']);
    
    // Test backup creation
    let result = await this.runCommand(['backup']);
    
    if (result.code !== 0) {
      throw new Error(`Backup command failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Backup created')) {
      throw new Error('Backup success message missing');
    }
    
    // Test backup listing
    result = await this.runCommand(['list-backups']);
    
    if (result.code !== 0) {
      throw new Error(`List backups failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Available backups')) {
      throw new Error('Backup list output missing');
    }
    
    console.log('✅ Backup operations work');
  }

  async testDesktopVersion() {
    console.log('🧪 Testing desktop version...');
    
    const result = await this.runCommand(['install', '--desktop', '--force']);
    
    if (result.code !== 0) {
      throw new Error(`Desktop install failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('CLAUDE-DESKTOP.md.example')) {
      throw new Error('Desktop install success message missing');
    }
    
    // Verify content includes desktop marker
    const content = fs.readFileSync(this.mockConfigPath, 'utf8');
    if (!content.includes('Desktop Optimized')) {
      throw new Error('Desktop template was not installed correctly');
    }
    
    console.log('✅ Desktop version installation works');
  }

  async testDiffCommand() {
    console.log('🧪 Testing diff command...');
    
    // Test diff with no existing file
    let result = await this.runCommand(['diff']);
    
    if (result.code !== 0) {
      throw new Error(`Diff command failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('No existing CLAUDE.md found')) {
      throw new Error('Should indicate no existing file');
    }
    
    // Install config and test diff with identical files
    await this.runCommand(['install', '--force']);
    result = await this.runCommand(['diff']);
    
    if (result.code !== 0) {
      throw new Error(`Diff command failed with existing file: ${result.stderr}`);
    }
    
    console.log('✅ Diff command works');
  }

  async testRestoreOperations() {
    console.log('🧪 Testing restore operations...');
    
    // Setup: install config, backup, modify, then restore
    await this.runCommand(['install', '--force']);
    await this.runCommand(['backup']);
    
    // Modify the config
    fs.writeFileSync(this.mockConfigPath, 'modified content for testing');
    
    // Test restore
    const result = await this.runCommand(['restore', '--force']);
    
    if (result.code !== 0) {
      throw new Error(`Restore command failed with code ${result.code}: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('restored successfully')) {
      throw new Error('Restore success message missing');
    }
    
    // Verify content was restored
    const content = fs.readFileSync(this.mockConfigPath, 'utf8');
    if (content === 'modified content for testing') {
      throw new Error('File was not restored from backup');
    }
    
    console.log('✅ Restore operations work');
  }

  async testErrorHandling() {
    console.log('🧪 Testing error handling...');
    
    // Test invalid command
    let result = await this.runCommand(['invalid-command']);
    
    if (result.code === 0) {
      throw new Error('Should fail with invalid command');
    }
    
    if (!result.stdout.includes('Unknown command')) {
      throw new Error('Should show unknown command error');
    }
    
    // Test restore with no backups
    result = await this.runCommand(['restore']);
    
    if (result.code !== 0) {
      throw new Error(`Restore with no backups should handle gracefully: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('No backups available')) {
      throw new Error('Should indicate no backups available');
    }
    
    console.log('✅ Error handling works');
  }

  async runAllTests() {
    console.log('🚀 Starting Config Command Test Suite...\n');
    
    let success = false;
    
    try {
      await this.setup();
      
      await this.testConfigManager();
      await this.testHelpCommand();
      await this.testShowStatus();
      await this.testInstallConfig();
      await this.testBackupOperations();
      await this.testDesktopVersion();
      await this.testDiffCommand();
      await this.testRestoreOperations();
      await this.testErrorHandling();
      
      console.log('\n✅ All config command tests passed!');
      success = true;
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      if (error.stdout) console.log('STDOUT:', error.stdout);
      if (error.stderr) console.log('STDERR:', error.stderr);
      success = false;
      
    } finally {
      await this.cleanup();
    }
    
    return success;
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new ConfigTest();
  test.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = ConfigTest;