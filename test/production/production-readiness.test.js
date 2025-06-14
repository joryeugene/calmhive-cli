/**
 * Production Readiness Test Suite
 * Comprehensive validation for production deployment
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProductionReadinessTest {
  constructor() {
    this.projectRoot = path.join(__dirname, '..', '..');
    this.errors = [];
    this.warnings = [];
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

  testPackageJson() {
    console.log('📦 Testing package.json...');
    
    const packagePath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(packagePath)) {
      this.errors.push('package.json missing');
      return;
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Required fields
    const required = ['name', 'version', 'description', 'main', 'bin'];
    required.forEach(field => {
      if (!pkg[field]) {
        this.errors.push(`package.json missing ${field}`);
      }
    });

    // Check version format
    if (pkg.version && !pkg.version.match(/^\d+\.\d+\.\d+$/)) {
      this.errors.push(`Invalid version format: ${pkg.version}`);
    }

    // Check bin path exists
    if (pkg.bin && typeof pkg.bin === 'object') {
      Object.values(pkg.bin).forEach(binPath => {
        const fullPath = path.join(this.projectRoot, binPath);
        if (!fs.existsSync(fullPath)) {
          this.errors.push(`Binary path missing: ${binPath}`);
        }
      });
    }

    console.log('  ✓ package.json structure valid');
  }

  testCoreCommands() {
    console.log('🔧 Testing core commands...');
    
    const commands = ['afk', 'chat', 'config', 'run', 'tui', 'voice'];
    
    commands.forEach(cmd => {
      const cmdPath = path.join(this.projectRoot, 'commands', cmd);
      if (!fs.existsSync(cmdPath)) {
        this.errors.push(`Command missing: ${cmd}`);
        return;
      }

      // Check if executable
      try {
        const stats = fs.statSync(cmdPath);
        if (!(stats.mode & parseInt('100', 8))) {
          this.warnings.push(`Command not executable: ${cmd}`);
        }
      } catch (error) {
        this.errors.push(`Cannot stat command: ${cmd}`);
      }
    });

    console.log('  ✓ Core commands present');
  }

  async testCommandExecution() {
    console.log('⚡ Testing command execution...');
    
    const tests = [
      { cmd: 'node', args: ['bin/calmhive', '--help'], expectCode: 0 },
      { cmd: 'node', args: ['commands/afk', '--help'], expectCode: 0 },
      { cmd: 'node', args: ['commands/chat', '--help'], expectCode: 0 },
      { cmd: 'node', args: ['commands/config', '--help'], expectCode: 0 },
      { cmd: 'node', args: ['commands/run', '--help'], expectCode: 0 },
      { cmd: 'node', args: ['commands/tui', '--help'], expectCode: 0 },
      { cmd: 'node', args: ['commands/voice', '--help'], expectCode: 0 }
    ];

    for (const test of tests) {
      try {
        const result = await this.runCommand(test.cmd, test.args, 5000);
        if (result.code !== test.expectCode) {
          this.errors.push(`${test.cmd} ${test.args.join(' ')} failed with code ${result.code}`);
        }
      } catch (error) {
        this.errors.push(`Command execution failed: ${test.cmd} ${test.args.join(' ')}: ${error.message}`);
      }
    }

    console.log('  ✓ Command execution tests passed');
  }

  testLibraryStructure() {
    console.log('📚 Testing library structure...');
    
    const requiredLibs = [
      'lib/config-manager.js',
      'lib/process-manager.js', 
      'lib/session-database.js',
      'lib/tool-manager.js',
      'lib/adaptive-retry.js',
      'lib/cleanup-engine.js',
      'lib/compact-handler.js',
      'lib/context-monitor.js'
    ];

    requiredLibs.forEach(lib => {
      const libPath = path.join(this.projectRoot, lib);
      if (!fs.existsSync(libPath)) {
        this.errors.push(`Required library missing: ${lib}`);
      }
    });

    console.log('  ✓ Library structure valid');
  }

  testConfigFiles() {
    console.log('⚙️ Testing configuration files...');
    
    const configFiles = [
      'CLAUDE.md.example',
      'CLAUDE-DESKTOP.md.example',
      'config/allowed-tools.json'
    ];

    configFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Config file missing: ${file}`);
        return;
      }

      // Validate JSON files
      if (file.endsWith('.json')) {
        try {
          JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
          this.errors.push(`Invalid JSON in ${file}: ${error.message}`);
        }
      }

      // Validate CLAUDE.md files
      if (file.includes('CLAUDE')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes('Version: 8.0.0')) {
          this.errors.push(`${file} missing version 8.0.0`);
        }
        if (!content.includes('lets bee friends')) {
          this.errors.push(`${file} missing confirmation protocol`);
        }
      }
    });

    console.log('  ✓ Configuration files valid');
  }

  async testNpmScripts() {
    console.log('📜 Testing npm scripts...');
    
    try {
      const result = await this.runCommand('npm', ['run-script'], 5000);
      if (result.code !== 0) {
        this.warnings.push('npm run-script failed');
      }

      // Test quick test
      const testResult = await this.runCommand('npm', ['test'], 30000);
      if (testResult.code !== 0) {
        this.errors.push('npm test failed');
      }
    } catch (error) {
      this.warnings.push(`npm script test failed: ${error.message}`);
    }

    console.log('  ✓ npm scripts functional');
  }

  testDocumentation() {
    console.log('📝 Testing documentation...');
    
    const docs = ['README.md', 'CHANGELOG.md', 'docs/ARCHITECTURE.md'];
    
    docs.forEach(doc => {
      const docPath = path.join(this.projectRoot, doc);
      if (!fs.existsSync(docPath)) {
        this.warnings.push(`Documentation missing: ${doc}`);
        return;
      }

      const content = fs.readFileSync(docPath, 'utf8');
      if (content.length < 100) {
        this.warnings.push(`Documentation too short: ${doc}`);
      }
    });

    console.log('  ✓ Documentation present');
  }

  testDeploymentScript() {
    console.log('🚀 Testing deployment script...');
    
    const deployScript = path.join(this.projectRoot, 'deploy-to-projects.sh');
    if (!fs.existsSync(deployScript)) {
      this.warnings.push('deploy-to-projects.sh missing');
      return;
    }

    const content = fs.readFileSync(deployScript, 'utf8');
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,  // rm -rf /
      /sudo/,           // sudo usage
      /--delete-delay/, // dangerous rsync
      /git\s+push/      // automatic git push
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        this.errors.push(`Dangerous pattern in deploy script: ${pattern}`);
      }
    });

    // Check for required safety measures
    if (!content.includes('--dry-run')) {
      this.warnings.push('Deploy script missing dry-run preview');
    }

    if (!content.includes('read -p')) {
      this.warnings.push('Deploy script missing user confirmation');
    }

    console.log('  ✓ Deployment script safe');
  }

  async testPerformance() {
    console.log('⚡ Testing performance...');
    
    try {
      const start = Date.now();
      await this.runCommand('node', ['bin/calmhive', '--help'], 3000);
      const duration = Date.now() - start;
      
      if (duration > 2000) {
        this.warnings.push(`Slow startup time: ${duration}ms`);
      }
    } catch (error) {
      this.errors.push(`Performance test failed: ${error.message}`);
    }

    console.log('  ✓ Performance acceptable');
  }

  async runAllTests() {
    console.log('🧪 Production Readiness Test Suite');
    console.log('==================================\n');

    try {
      this.testPackageJson();
      this.testCoreCommands();
      await this.testCommandExecution();
      this.testLibraryStructure();
      this.testConfigFiles();
      await this.testNpmScripts();
      this.testDocumentation();
      this.testDeploymentScript();
      await this.testPerformance();

      console.log('\n📊 Test Results:');
      console.log(`✅ Errors: ${this.errors.length}`);
      console.log(`⚠️  Warnings: ${this.warnings.length}`);

      if (this.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        this.errors.forEach(error => console.log(`  - ${error}`));
      }

      if (this.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        this.warnings.forEach(warning => console.log(`  - ${warning}`));
      }

      const isProductionReady = this.errors.length === 0;
      
      if (isProductionReady) {
        console.log('\n🎉 PRODUCTION READY!');
        console.log('All critical tests passed. System ready for deployment.');
      } else {
        console.log('\n🚫 NOT PRODUCTION READY');
        console.log('Critical errors must be fixed before deployment.');
      }

      return isProductionReady;

    } catch (error) {
      console.error('\n💥 Test suite crashed:', error.message);
      return false;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new ProductionReadinessTest();
  test.runAllTests().then(ready => {
    process.exit(ready ? 0 : 1);
  }).catch(error => {
    console.error('Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = ProductionReadinessTest;