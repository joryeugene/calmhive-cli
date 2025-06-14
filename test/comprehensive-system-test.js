#!/usr/bin/env node
/**
 * Comprehensive System Test for Calmhive V3
 * Tests all major functionality including fixes and new features
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ComprehensiveSystemTest {
  constructor() {
    this.testResults = [];
    this.passed = 0;
    this.failed = 0;
  }

  async runCommand(cmd, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn(cmd, args, { 
        stdio: 'pipe',
        ...options 
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      process.on('error', reject);
    });
  }

  logTest(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
    if (details) console.log(`   ${details}`);
    
    this.testResults.push({ name, passed, details });
    if (passed) this.passed++;
    else this.failed++;
  }

  async testSystemHealth() {
    console.log('🏥 Testing System Health...');
    
    // Check calmhive directory structure
    const claudeDir = path.join(os.homedir(), '.claude');
    const calmhiveDir = path.join(claudeDir, 'calmhive', 'v3');
    
    this.logTest(
      'Calmhive V3 directory structure',
      fs.existsSync(calmhiveDir) && 
      fs.existsSync(path.join(calmhiveDir, 'bin', 'calmhive')) &&
      fs.existsSync(path.join(calmhiveDir, 'commands', 'config')),
      `Main directory: ${calmhiveDir}`
    );

    // Check commands directory
    const commandsDir = path.join(claudeDir, 'commands');
    const expertFiles = fs.readdirSync(commandsDir).filter(f => f.startsWith('expert-'));
    
    this.logTest(
      'Expert command files generated',
      expertFiles.length >= 25,
      `Found ${expertFiles.length} expert files`
    );

    // Check AFk registry
    const afkDir = path.join(claudeDir, 'afk_registry');
    const afkSessions = fs.existsSync(afkDir) ? 
      fs.readdirSync(afkDir).filter(d => d.startsWith('afk-')) : [];
    
    this.logTest(
      'AFk registry exists',
      fs.existsSync(afkDir) && afkSessions.length > 0,
      `Found ${afkSessions.length} AFk sessions`
    );
  }

  async testConfigCommands() {
    console.log('\n⚙️  Testing Config Commands...');

    // Test config status (default behavior)
    const status = await this.runCommand('node', ['cmd/config']);
    this.logTest(
      'Config default behavior (show status)',
      status.code === 0 && status.stdout.includes('Configuration Status'),
      'Shows status by default'
    );

    // Test commands list (default behavior)
    const list = await this.runCommand('node', ['cmd/config', 'commands']);
    this.logTest(
      'Commands default behavior (list files)',
      list.code === 0 && list.stdout.includes('Command Files Summary'),
      'Defaults to list when no subcommand'
    );

    // Test explicit list
    const explicitList = await this.runCommand('node', ['cmd/config', 'commands', 'list']);
    this.logTest(
      'Explicit commands list',
      explicitList.code === 0 && explicitList.stdout.includes('expert-'),
      'Shows expert files in list'
    );

    // Test copy dry run
    const testDir = path.join(os.tmpdir(), 'calmhive-test-' + Date.now());
    const dryRun = await this.runCommand('node', [
      'cmd/config', 'commands', 'copy', testDir, 
      '--pattern', 'expert', '--dry-run'
    ]);
    
    this.logTest(
      'Copy dry run functionality',
      dryRun.code === 0 && dryRun.stdout.includes('Would copy files'),
      'Dry run shows preview without copying'
    );

    // Test actual copy
    const copy = await this.runCommand('node', [
      'cmd/config', 'commands', 'copy', testDir,
      '--pattern', 'expert'
    ]);
    
    let copySuccess = false;
    if (copy.code === 0) {
      const copiedFiles = fs.existsSync(testDir) ? 
        fs.readdirSync(testDir).filter(f => f.startsWith('expert-')) : [];
      copySuccess = copiedFiles.length > 20;
      
      // Cleanup
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    }
    
    this.logTest(
      'Copy with pattern filtering',
      copySuccess,
      `Successfully copied expert files`
    );

    // Test copy without destination (should fail with helpful message)
    const noDest = await this.runCommand('node', ['cmd/config', 'commands', 'copy']);
    this.logTest(
      'Copy validation (missing destination)',
      noDest.code !== 0 && noDest.stderr.includes('Missing destination'),
      'Requires destination with helpful error'
    );
  }

  async testAfkSystem() {
    console.log('\n🚀 Testing AFk System...');

    // Test AFk status
    const status = await this.runCommand('node', ['cmd/afk', 'status']);
    this.logTest(
      'AFk status command',
      status.code === 0 && status.stdout.includes('Sessions Summary'),
      'Shows session status'
    );

    // Test AFk help (default when no task)
    const help = await this.runCommand('node', ['cmd/afk']);
    this.logTest(
      'AFk default behavior (help)',
      help.code !== 0 && help.stderr.includes('Task description required'),
      'Shows help when task missing'
    );

    // Check for log files in AFk registry
    const afkDir = path.join(os.homedir(), '.claude/afk_registry');
    let logExists = false;
    
    if (fs.existsSync(afkDir)) {
      const sessions = fs.readdirSync(afkDir).filter(d => d.startsWith('afk-'));
      for (const session of sessions) {
        const logPath = path.join(afkDir, session, 'worker.log');
        if (fs.existsSync(logPath)) {
          logExists = true;
          break;
        }
      }
    }
    
    this.logTest(
      'AFk log files accessibility',
      logExists,
      'Worker logs found in afk_registry'
    );
  }

  async testMainEntry() {
    console.log('\n🎯 Testing Main Entry Point...');

    // Test main help
    const help = await this.runCommand('node', ['bin/calmhive']);
    this.logTest(
      'Main entry help',
      help.code === 0 && help.stdout.includes('Calmhive') && help.stdout.includes('Commands:'),
      'Shows help by default'
    );

    // Test version
    const version = await this.runCommand('node', ['bin/calmhive', '--version']);
    this.logTest(
      'Version command',
      version.code === 0 && version.stdout.match(/\d+\.\d+\.\d+/),
      `Version: ${version.stdout.trim()}`
    );

    // Test command existence
    const commands = ['afk', 'chat', 'config', 'run', 'tui', 'voice'];
    const commandsDir = path.join(__dirname, '..', 'commands');
    
    for (const cmd of commands) {
      const exists = fs.existsSync(path.join(commandsDir, cmd));
      this.logTest(
        `Command file exists: ${cmd}`,
        exists,
        `Path: cmd/${cmd}`
      );
    }
  }

  async testFileOrganization() {
    console.log('\n📁 Testing File Organization...');

    const commandsDir = path.join(os.homedir(), '.claude/commands');
    
    // Test archive structure
    const archiveDir = path.join(commandsDir, 'archive');
    const afkIterationsDir = path.join(archiveDir, 'afk-iterations');
    const enhancedVersionsDir = path.join(archiveDir, 'enhanced-versions');
    
    this.logTest(
      'Archive directory structure',
      fs.existsSync(afkIterationsDir) && fs.existsSync(enhancedVersionsDir),
      'AFk iterations and enhanced versions archived'
    );

    // Test iteration files are archived
    const mainIterations = fs.readdirSync(commandsDir).filter(f => f.startsWith('iteration-'));
    const archivedIterations = fs.existsSync(afkIterationsDir) ? 
      fs.readdirSync(afkIterationsDir).filter(f => f.startsWith('iteration-')) : [];
    
    this.logTest(
      'Iteration files properly archived',
      mainIterations.length <= 2 && archivedIterations.length >= 8,
      `Main: ${mainIterations.length}, Archived: ${archivedIterations.length}`
    );

    // Test expert files exist and have content
    const expertFiles = fs.readdirSync(commandsDir).filter(f => f.startsWith('expert-'));
    let validExpertFiles = 0;
    
    for (const file of expertFiles.slice(0, 5)) { // Check first 5
      const filePath = path.join(commandsDir, file);
      const stat = fs.statSync(filePath);
      if (stat.size > 1000) { // At least 1KB
        validExpertFiles++;
      }
    }
    
    this.logTest(
      'Expert files have substantial content',
      validExpertFiles >= 5,
      `${validExpertFiles}/5 files checked have >1KB content`
    );
  }

  async runAllTests() {
    console.log('🚀 Comprehensive Calmhive V3 System Test');
    console.log('==========================================\n');

    await this.testSystemHealth();
    await this.testMainEntry();
    await this.testConfigCommands();
    await this.testAfkSystem();
    await this.testFileOrganization();

    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);

    if (this.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! System is healthy and ready for production.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the issues above.');
      
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(t => !t.passed)
        .forEach(t => console.log(`   - ${t.name}: ${t.details}`));
    }

    return this.failed === 0;
  }
}

if (require.main === module) {
  const test = new ComprehensiveSystemTest();
  test.runAllTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = ComprehensiveSystemTest;