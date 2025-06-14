/**
 * NPM Installation Test
 * Simulates how calmhive works when installed via npm globally
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class NpmInstallTest {
  constructor() {
    this.projectRoot = path.join(__dirname, '..', '..');
    this.testDir = path.join(os.tmpdir(), 'calmhive-npm-test-' + Date.now());
    this.fakeNodeModules = path.join(this.testDir, 'node_modules', '@calmhive', 'calmhive-cli');
  }

  async setup() {
    console.log('🔧 Setting up npm installation simulation...');
    
    // Create fake node_modules structure
    fs.mkdirSync(this.fakeNodeModules, { recursive: true });
    
    // Copy essential files that would be included in npm package
    const filesToCopy = [
      'package.json',
      'CLAUDE.md.example',
      'CLAUDE-DESKTOP.md.example',
      'bin',
      'commands',
      'lib',
      'config'
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
    
    console.log('  ✓ Fake npm installation created');
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

  async runCommand(command, args = [], timeout = 10000) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.fakeNodeModules,
        env: { 
          ...process.env, 
          HOME: this.testDir,
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

      child.stdin.end();
    });
  }

  async testConfigManagerPathResolution() {
    console.log('🧪 Testing config manager path resolution...');
    
    // Test that config manager can find templates in npm-like structure
    const testScript = `
      const ConfigManager = require('./lib/config-manager');
      const fs = require('fs');
      
      try {
        const cm = new ConfigManager();
        console.log('ROOT:', cm.calmhiveRoot);
        console.log('CLI_TEMPLATE:', cm.getTemplatePath(false));
        console.log('DESKTOP_TEMPLATE:', cm.getTemplatePath(true));
        console.log('CLI_EXISTS:', fs.existsSync(cm.getTemplatePath(false)));
        console.log('DESKTOP_EXISTS:', fs.existsSync(cm.getTemplatePath(true)));
        process.exit(0);
      } catch (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
      }
    `;
    
    const result = await this.runCommand('node', ['-e', testScript]);
    
    if (result.code !== 0) {
      throw new Error(`Path resolution failed: ${result.stderr}`);
    }
    
    const output = result.stdout;
    if (!output.includes('CLI_EXISTS: true') || !output.includes('DESKTOP_EXISTS: true')) {
      throw new Error(`Templates not found: ${output}`);
    }
    
    console.log('  ✓ Config manager finds templates in npm structure');
    return true;
  }

  async testConfigCommandFromNpmInstall() {
    console.log('🧪 Testing config command from npm-like install...');
    
    // Create isolated home directory
    fs.mkdirSync(path.join(this.testDir, '.claude'), { recursive: true });
    
    // Test config status
    let result = await this.runCommand('node', ['commands/config', 'show']);
    if (result.code !== 0) {
      throw new Error(`Config status failed: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Templates:')) {
      throw new Error(`Config status missing template info: ${result.stdout}`);
    }
    
    console.log('  ✓ Config status works from npm structure');
    
    // Test config install
    result = await this.runCommand('node', ['commands/config', 'install', '--force']);
    if (result.code !== 0) {
      throw new Error(`Config install failed: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Successfully installed')) {
      throw new Error(`Config install didn't complete: ${result.stdout}`);
    }
    
    console.log('  ✓ Config install works from npm structure');
    
    // Verify file was created
    const configPath = path.join(this.testDir, '.claude', 'CLAUDE.md');
    if (!fs.existsSync(configPath)) {
      throw new Error('CLAUDE.md was not created');
    }
    
    console.log('  ✓ Config file successfully created');
    return true;
  }

  async testBinaryExecution() {
    console.log('🧪 Testing binary execution from npm-like install...');
    
    // Test main binary
    const result = await this.runCommand('node', ['bin/calmhive', '--help']);
    if (result.code !== 0) {
      throw new Error(`Binary execution failed: ${result.stderr}`);
    }
    
    if (!result.stdout.includes('Calmhive')) {
      throw new Error(`Binary help output missing: ${result.stdout}`);
    }
    
    console.log('  ✓ Main binary works from npm structure');
    return true;
  }

  async runAllTests() {
    console.log('🧪 NPM Installation Test Suite');
    console.log('==============================\n');

    const tests = [
      { name: 'Config Manager Path Resolution', fn: () => this.testConfigManagerPathResolution() },
      { name: 'Config Command from NPM Install', fn: () => this.testConfigCommandFromNpmInstall() },
      { name: 'Binary Execution', fn: () => this.testBinaryExecution() }
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

    console.log('📊 NPM Installation Test Results:');
    console.log(`✅ Passed: ${passed}/${tests.length}`);
    console.log(`❌ Failed: ${failed}/${tests.length}`);

    const allPassed = failed === 0;
    
    if (allPassed) {
      console.log('\n🎉 ALL NPM INSTALLATION TESTS PASSED!');
      console.log('Package will work correctly when installed via npm.');
    } else {
      console.log('\n⚠️  SOME NPM INSTALLATION TESTS FAILED');
      console.log('Package may have issues when installed via npm.');
    }

    return allPassed;
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new NpmInstallTest();
  test.runAllTests().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(error => {
    console.error('NPM installation test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = NpmInstallTest;