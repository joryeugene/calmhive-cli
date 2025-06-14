/**
 * NPM Full Command Test Suite
 * Tests ALL calmhive commands in npm-installed environment
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class NpmFullTest {
  constructor() {
    this.projectRoot = path.join(__dirname, '..', '..');
    this.testDir = path.join(os.tmpdir(), 'calmhive-npm-full-test-' + Date.now());
    this.fakeNodeModules = path.join(this.testDir, 'node_modules', '@calmhive', 'calmhive-cli');
    this.homeDir = path.join(this.testDir, 'home');
  }

  async setup() {
    console.log('🔧 Setting up complete npm environment simulation...');
    
    // Create fake node_modules structure
    fs.mkdirSync(this.fakeNodeModules, { recursive: true });
    fs.mkdirSync(this.homeDir, { recursive: true });
    fs.mkdirSync(path.join(this.homeDir, '.claude'), { recursive: true });
    
    // Copy ALL files that would be included in npm package
    const filesToCopy = [
      'package.json',
      'CLAUDE.md.example', 
      'CLAUDE-DESKTOP.md.example',
      'bin',
      'commands',
      'lib',
      'config',
      'index.js'
    ];
    
    for (const file of filesToCopy) {
      const srcPath = path.join(this.projectRoot, file);
      const destPath = path.join(this.fakeNodeModules, file);
      
      if (fs.existsSync(srcPath)) {
        if (fs.lstatSync(srcPath).isDirectory()) {
          this.copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    
    // Copy node_modules dependencies to simulate npm install
    const srcNodeModules = path.join(this.projectRoot, 'node_modules');
    const destNodeModules = path.join(this.fakeNodeModules, 'node_modules');
    if (fs.existsSync(srcNodeModules)) {
      this.copyDir(srcNodeModules, destNodeModules);
    }
    
    console.log('  ✓ Complete npm package structure with dependencies created');
  }

  copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async cleanup() {
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
  }

  async runCommand(command, args = [], timeout = 10000, input = null) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.fakeNodeModules,
        env: { 
          ...process.env, 
          HOME: this.homeDir,
          NODE_PATH: path.join(this.testDir, 'node_modules')
        }
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

      if (input) {
        child.stdin.write(input);
      }
      child.stdin.end();
    });
  }

  async testMainCalmhiveCommand() {
    console.log('🧪 Testing main calmhive command...');
    
    const tests = [
      { args: ['--help'], expectInOutput: 'Calmhive' },
      { args: ['--version'], expectInOutput: '8.0.0' },
      { args: ['config', '--help'], expectInOutput: 'CLAUDE.md Management' }
    ];

    for (const test of tests) {
      const result = await this.runCommand('node', ['bin/calmhive', ...test.args]);
      if (result.code !== 0) {
        throw new Error(`Main command failed: ${test.args.join(' ')} - ${result.stderr}`);
      }
      if (!result.stdout.includes(test.expectInOutput)) {
        throw new Error(`Expected "${test.expectInOutput}" in output: ${result.stdout}`);
      }
    }
    
    console.log('  ✓ Main calmhive command works');
    return true;
  }

  async testConfigCommand() {
    console.log('🧪 Testing config command in npm environment...');
    
    // Status check
    let result = await this.runCommand('node', ['commands/config', 'show']);
    if (result.code !== 0 || !result.stdout.includes('Configuration Status')) {
      throw new Error(`Config status failed: ${result.stderr}`);
    }
    console.log('  ✓ Config status works');

    // Install CLI template
    result = await this.runCommand('node', ['commands/config', 'install', '--force']);
    if (result.code !== 0 || !result.stdout.includes('Successfully installed')) {
      throw new Error(`Config install failed: ${result.stderr}`);
    }
    console.log('  ✓ Config install works');

    // Verify file exists
    const configPath = path.join(this.homeDir, '.claude', 'CLAUDE.md');
    if (!fs.existsSync(configPath)) {
      throw new Error('Config file was not created');
    }
    console.log('  ✓ Config file created successfully');

    // Test backup
    result = await this.runCommand('node', ['commands/config', 'backup']);
    if (result.code !== 0 || !result.stdout.includes('Backup created')) {
      throw new Error(`Config backup failed: ${result.stderr}`);
    }
    console.log('  ✓ Config backup works');

    // Test list backups
    result = await this.runCommand('node', ['commands/config', 'list-backups']);
    if (result.code !== 0 || !result.stdout.includes('Available backups')) {
      throw new Error(`Config list-backups failed: ${result.stderr}`);
    }
    console.log('  ✓ Config list-backups works');

    return true;
  }

  async testAfkCommand() {
    console.log('🧪 Testing AFk command in npm environment...');
    
    // Status check (should work even with no sessions)
    let result = await this.runCommand('node', ['commands/afk', 'status']);
    if (result.code !== 0) {
      throw new Error(`AFk status failed: ${result.stderr}`);
    }
    console.log('  ✓ AFk status works');

    // Help check
    result = await this.runCommand('node', ['commands/afk', '--help']);
    if (result.code !== 0 || !result.stdout.includes('background')) {
      throw new Error(`AFk help failed: ${result.stderr}`);
    }
    console.log('  ✓ AFk help works');

    return true;
  }

  async testChatCommand() {
    console.log('🧪 Testing chat command in npm environment...');
    
    // Help check
    let result = await this.runCommand('node', ['commands/chat', '--help']);
    if (result.code !== 0 || !result.stdout.includes('chat')) {
      throw new Error(`Chat help failed: ${result.stderr}`);
    }
    console.log('  ✓ Chat help works');

    return true;
  }

  async testRunCommand() {
    console.log('🧪 Testing run command in npm environment...');
    
    // Help check
    let result = await this.runCommand('node', ['commands/run', '--help']);
    if (result.code !== 0 || !result.stdout.includes('execute')) {
      throw new Error(`Run help failed: ${result.stderr}`);
    }
    console.log('  ✓ Run help works');

    return true;
  }

  async testTuiCommand() {
    console.log('🧪 Testing TUI command in npm environment...');
    
    // Help check
    let result = await this.runCommand('node', ['commands/tui', '--help']);
    if (result.code !== 0 || !result.stdout.includes('interface')) {
      throw new Error(`TUI help failed: ${result.stderr}`);
    }
    console.log('  ✓ TUI help works');

    return true;
  }

  async testVoiceCommand() {
    console.log('🧪 Testing voice command in npm environment...');
    
    // Help check
    let result = await this.runCommand('node', ['commands/voice', '--help']);
    if (result.code !== 0 || !result.stdout.includes('voice')) {
      throw new Error(`Voice help failed: ${result.stderr}`);
    }
    console.log('  ✓ Voice help works');

    return true;
  }

  async testAllAliases() {
    console.log('🧪 Testing all command aliases...');
    
    const aliases = [
      { alias: 'a', command: 'afk' },
      { alias: 'c', command: 'chat' },
      { alias: 'r', command: 'run' },
      { alias: 't', command: 'tui' },
      { alias: 'v', command: 'voice' }
    ];

    for (const { alias, command } of aliases) {
      const result = await this.runCommand('node', ['bin/calmhive', alias, '--help']);
      if (result.code !== 0) {
        throw new Error(`Alias ${alias} failed: ${result.stderr}`);
      }
    }
    
    console.log('  ✓ All aliases work correctly');
    return true;
  }

  async testErrorHandling() {
    console.log('🧪 Testing error handling in npm environment...');
    
    // Test invalid command
    let result = await this.runCommand('node', ['bin/calmhive', 'invalid-command']);
    if (result.code === 0) {
      throw new Error('Invalid command should have failed');
    }
    console.log('  ✓ Invalid commands handled properly');

    // Test invalid config command
    result = await this.runCommand('node', ['commands/config', 'invalid-subcommand']);
    if (result.code === 0) {
      throw new Error('Invalid config subcommand should have failed');
    }
    console.log('  ✓ Invalid config subcommands handled properly');

    return true;
  }

  async testPackageIntegrity() {
    console.log('🧪 Testing package integrity...');
    
    // Check all required files exist
    const requiredFiles = [
      'package.json',
      'CLAUDE.md.example',
      'CLAUDE-DESKTOP.md.example',
      'bin/calmhive',
      'commands/config',
      'commands/afk',
      'commands/chat',
      'commands/run',
      'commands/tui',
      'commands/voice',
      'lib/config-manager.js'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.fakeNodeModules, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    console.log('  ✓ All required files present in package');

    // Check package.json integrity
    const pkg = JSON.parse(fs.readFileSync(path.join(this.fakeNodeModules, 'package.json'), 'utf8'));
    if (pkg.name !== '@calmhive/calmhive-cli') {
      throw new Error('Package name incorrect');
    }
    if (!pkg.files || !pkg.files.includes('CLAUDE.md.example')) {
      throw new Error('Package files section missing template files');
    }
    
    console.log('  ✓ Package.json integrity verified');
    return true;
  }

  async runAllTests() {
    console.log('🧪 Complete NPM Installation Test Suite');
    console.log('======================================\n');

    const tests = [
      { name: 'Package Integrity', fn: () => this.testPackageIntegrity() },
      { name: 'Main Calmhive Command', fn: () => this.testMainCalmhiveCommand() },
      { name: 'Config Command', fn: () => this.testConfigCommand() },
      { name: 'AFk Command', fn: () => this.testAfkCommand() },
      { name: 'Chat Command', fn: () => this.testChatCommand() },
      { name: 'Run Command', fn: () => this.testRunCommand() },
      { name: 'TUI Command', fn: () => this.testTuiCommand() },
      { name: 'Voice Command', fn: () => this.testVoiceCommand() },
      { name: 'All Aliases', fn: () => this.testAllAliases() },
      { name: 'Error Handling', fn: () => this.testErrorHandling() }
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

    console.log('📊 Complete NPM Test Results:');
    console.log(`✅ Passed: ${passed}/${tests.length}`);
    console.log(`❌ Failed: ${failed}/${tests.length}`);

    const allPassed = failed === 0;
    
    if (allPassed) {
      console.log('\n🎉 ALL NPM TESTS PASSED!');
      console.log('Complete package will work correctly when installed via npm.');
      console.log('All commands, config management, and templates are accessible.');
    } else {
      console.log('\n⚠️  SOME NPM TESTS FAILED');
      console.log('Package has issues that will affect npm installation.');
    }

    return allPassed;
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new NpmFullTest();
  test.runAllTests().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(error => {
    console.error('Complete NPM test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = NpmFullTest;