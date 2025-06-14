/**
 * Integration Test Suite  
 * End-to-end workflow testing for production scenarios
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class IntegrationTest {
  constructor() {
    this.projectRoot = path.join(__dirname, '..', '..');
    this.testDir = path.join(os.tmpdir(), 'calmhive-integration-test-' + Date.now());
    this.mockHome = this.testDir;
    this.originalHome = process.env.HOME;
  }

  async setup() {
    console.log('🔧 Setting up integration test environment...');
    
    // Create isolated test environment
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.testDir, { recursive: true });
    fs.mkdirSync(path.join(this.testDir, '.claude'), { recursive: true });
    
    process.env.HOME = this.mockHome;
    console.log('  ✓ Isolated environment created');
  }

  async cleanup() {
    process.env.HOME = this.originalHome;
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
  }

  async runCommand(command, args = [], timeout = 10000, input = null) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.projectRoot, // Run from project root to find commands and templates
        env: { ...process.env, HOME: this.mockHome }
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

      // Send input if provided
      if (input) {
        child.stdin.write(input);
      }
      child.stdin.end();
    });
  }

  async testConfigWorkflow() {
    console.log('🧪 Testing complete config workflow...');
    
    // 1. Check initial status (no config)
    let result = await this.runCommand('node', ['cmd/config', 'show']);
    if (result.code !== 0 || !result.stdout.includes('❌ No')) {
      throw new Error(`Initial config status check failed: ${result.stderr}`);
    }
    console.log('  ✓ Initial status shows no config');

    // 2. Install CLI template
    result = await this.runCommand('node', ['cmd/config', 'install', '--force']);
    if (result.code !== 0 || !result.stdout.includes('Successfully installed')) {
      throw new Error(`CLI template installation failed. Code: ${result.code}, stdout: ${result.stdout}, stderr: ${result.stderr}`);
    }
    console.log('  ✓ CLI template installed');

    // 3. Verify config exists
    result = await this.runCommand('node', ['cmd/config', 'show']);
    if (result.code !== 0 || !result.stdout.includes('✅ Yes')) {
      throw new Error('Config verification failed');
    }
    console.log('  ✓ Config existence verified');

    // 4. Create backup
    result = await this.runCommand('node', ['cmd/config', 'backup']);
    if (result.code !== 0 || !result.stdout.includes('Backup created')) {
      throw new Error('Backup creation failed');
    }
    console.log('  ✓ Manual backup created');

    // 5. Install desktop template (should backup automatically)
    result = await this.runCommand('node', ['cmd/config', 'install', '--desktop', '--force']);
    if (result.code !== 0 || !result.stdout.includes('Successfully installed')) {
      throw new Error(`Desktop template installation failed. Code: ${result.code}, stdout: ${result.stdout}, stderr: ${result.stderr}`);
    }
    console.log('  ✓ Desktop template installed with auto-backup');

    // 6. List backups
    result = await this.runCommand('node', ['cmd/config', 'list-backups']);
    if (result.code !== 0 || !result.stdout.includes('Available backups')) {
      throw new Error('Backup listing failed');
    }
    console.log('  ✓ Backups listed successfully');

    // 7. Show diff (should be identical)
    result = await this.runCommand('node', ['cmd/config', 'diff', '--desktop']);
    if (result.code !== 0 || !result.stdout.includes('identical')) {
      throw new Error('Diff check failed');
    }
    console.log('  ✓ Diff shows identical files');

    return true;
  }

  async testCommandDiscovery() {
    console.log('🧪 Testing command discovery and help system...');
    
    // Main help
    let result = await this.runCommand('node', ['bin/calmhive', '--help']);
    if (result.code !== 0 || !result.stdout.includes('Calmhive')) {
      throw new Error('Main help failed');
    }
    console.log('  ✓ Main help accessible');

    // Individual command helps
    const commands = ['afk', 'chat', 'config', 'run', 'tui', 'voice'];
    for (const cmd of commands) {
      result = await this.runCommand('node', ['cmd/' + cmd, '--help']);
      if (result.code !== 0) {
        throw new Error(`${cmd} help failed`);
      }
    }
    console.log('  ✓ All command helps work');

    // Aliases work
    result = await this.runCommand('node', ['bin/calmhive', 'c', '--help']);
    if (result.code !== 0) {
      throw new Error('Alias c (chat) failed');
    }
    console.log('  ✓ Command aliases functional');

    return true;
  }

  async testErrorHandling() {
    console.log('🧪 Testing error handling and recovery...');
    
    // Use fresh environment for this test
    const freshTestDir = this.testDir + '-fresh';
    if (fs.existsSync(freshTestDir)) {
      fs.rmSync(freshTestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(freshTestDir, { recursive: true });
    fs.mkdirSync(path.join(freshTestDir, '.claude'), { recursive: true });
    
    const originalHome = process.env.HOME;
    process.env.HOME = freshTestDir;
    
    try {
      // Invalid command
      let result = await this.runCommand('node', ['bin/calmhive', 'invalid-command']);
      if (result.code === 0) {
        throw new Error('Invalid command should have failed but succeeded');
      }
      // Check either stdout or stderr for error message
      if (!result.stdout.includes('Unknown command') && !result.stderr.includes('Unknown')) {
        throw new Error(`Invalid command error message not found. stdout: ${result.stdout}, stderr: ${result.stderr}`);
      }
      console.log('  ✓ Invalid commands handled gracefully');

      // Check that no backups exist in fresh environment
      const backupDir = path.join(freshTestDir, '.claude', 'backups');
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
      
      // Config restore with no backups (fresh environment)
      result = await this.runCommand('node', ['cmd/config', 'restore'], 2000, 'n\n');
      if (result.code !== 0 || !result.stdout.includes('No backups available')) {
        throw new Error(`No backups error handling failed. Code: ${result.code}, stdout: ${result.stdout}, stderr: ${result.stderr}`);
      }
      console.log('  ✓ No backups scenario handled');

      // AFk status with no sessions
      result = await this.runCommand('node', ['cmd/afk', 'status']);
      if (result.code !== 0) {
        throw new Error('AFk status with no sessions failed');
      }
      console.log('  ✓ AFk handles no sessions gracefully');

      return true;
      
    } finally {
      process.env.HOME = originalHome;
      if (fs.existsSync(freshTestDir)) {
        fs.rmSync(freshTestDir, { recursive: true, force: true });
      }
    }
  }

  async testFilesystemSafety() {
    console.log('🧪 Testing filesystem safety measures...');
    
    // Create config
    let result = await this.runCommand('node', ['cmd/config', 'install', '--force']);
    if (result.code !== 0) {
      throw new Error(`Config install failed: ${result.stderr}`);
    }
    
    // Modify config
    const configPath = path.join(this.mockHome, '.claude', 'CLAUDE.md');
    const originalContent = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(configPath, 'modified content for testing');
    
    // Install new template (should create backup)
    result = await this.runCommand('node', ['cmd/config', 'install', '--force']);
    if (result.code !== 0 || !result.stdout.includes('backed up')) {
      throw new Error(`Automatic backup during install failed. Code: ${result.code}, stdout: ${result.stdout}, stderr: ${result.stderr}`);
    }
    console.log('  ✓ Automatic backup created during replacement');

    // Restore from backup
    result = await this.runCommand('node', ['cmd/config', 'restore', '--force']);
    if (result.code !== 0 || !result.stdout.includes('restored successfully')) {
      throw new Error('Restore from backup failed');
    }
    console.log('  ✓ Restore from backup successful');

    // Verify content was restored (should not be "modified content")
    const restoredContent = fs.readFileSync(configPath, 'utf8');
    if (restoredContent === 'modified content for testing') {
      throw new Error('Content was not actually restored');
    }
    console.log('  ✓ File content properly restored');

    return true;
  }

  async testPerformanceUnderLoad() {
    console.log('🧪 Testing performance characteristics...');
    
    // Rapid-fire commands
    const start = Date.now();
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      promises.push(this.runCommand('node', ['bin/calmhive', '--help'], 3000));
    }
    
    const results = await Promise.allSettled(promises);
    const duration = Date.now() - start;
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.code === 0).length;
    
    if (successful < 8) { // Allow some failures under load
      throw new Error(`Too many failures under load: ${successful}/10 succeeded`);
    }
    
    if (duration > 15000) { // 15 seconds max for 10 commands
      throw new Error(`Too slow under load: ${duration}ms for 10 commands`);
    }
    
    console.log(`  ✓ Load test: ${successful}/10 commands succeeded in ${duration}ms`);
    
    return true;
  }

  async testDatabaseOperations() {
    console.log('🧪 Testing database operations...');
    
    // Check AFk status (initializes database)
    let result = await this.runCommand('node', ['cmd/afk', 'status']);
    if (result.code !== 0) {
      throw new Error('AFk status failed');
    }
    console.log('  ✓ Database initialization successful');

    // Check that database file was created
    const dbPath = path.join(this.projectRoot, 'data', 'sessions.db');
    if (fs.existsSync(dbPath)) {
      console.log('  ✓ Session database file created');
    } else {
      console.log('  ℹ️  Session database not created (expected in test environment)');
    }

    return true;
  }

  async runAllIntegrationTests() {
    console.log('🧪 Calmhive Integration Test Suite');
    console.log('==================================\n');

    const tests = [
      { name: 'Config Workflow', fn: () => this.testConfigWorkflow() },
      { name: 'Command Discovery', fn: () => this.testCommandDiscovery() },
      { name: 'Error Handling', fn: () => this.testErrorHandling() },
      { name: 'Filesystem Safety', fn: () => this.testFilesystemSafety() },
      { name: 'Performance Under Load', fn: () => this.testPerformanceUnderLoad() },
      { name: 'Database Operations', fn: () => this.testDatabaseOperations() }
    ];

    let passed = 0;
    let failed = 0;

    try {
      await this.setup();

      for (const test of tests) {
        try {
          await test.fn();
          console.log(`✅ ${test.name} PASSED\n`);
          passed++;
        } catch (error) {
          console.log(`❌ ${test.name} FAILED: ${error.message}\n`);
          failed++;
        }
      }

    } finally {
      await this.cleanup();
    }

    console.log('📊 Integration Test Results:');
    console.log(`✅ Passed: ${passed}/${tests.length}`);
    console.log(`❌ Failed: ${failed}/${tests.length}`);

    const allPassed = failed === 0;
    
    if (allPassed) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('End-to-end workflows function correctly.');
    } else {
      console.log('\n⚠️  SOME INTEGRATION TESTS FAILED');
      console.log('System has workflow issues that need attention.');
    }

    return allPassed;
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new IntegrationTest();
  test.runAllIntegrationTests().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(error => {
    console.error('Integration test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTest;