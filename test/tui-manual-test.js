#!/usr/bin/env node
/**
 * Manual TUI Test for Log Viewer
 * Since @microsoft/tui-test isn't available, this provides a manual test framework
 */

const { spawn } = require('child_process');
const readline = require('readline');

class ManualTuiTest {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async startTuiTest() {
    console.log('🧪 Manual TUI Test - Log Viewer Functionality');
    console.log('===============================================\n');
    
    console.log('This test will help verify the TUI log viewer fix.');
    console.log('We fixed the path from v3/logs/{sessionId}.log to afk_registry/{sessionId}/worker.log\n');
    
    // Check if we have any AFk sessions with logs
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const afkDir = path.join(os.homedir(), '.claude/afk_registry');
    
    if (!fs.existsSync(afkDir)) {
      console.log('❌ No afk_registry directory found');
      this.rl.close();
      return;
    }
    
    const sessions = fs.readdirSync(afkDir).filter(dir => 
      dir.startsWith('afk-') && 
      fs.existsSync(path.join(afkDir, dir, 'worker.log'))
    );
    
    if (sessions.length === 0) {
      console.log('❌ No AFk sessions with logs found');
      this.rl.close();
      return;
    }
    
    console.log(`✅ Found ${sessions.length} AFk session(s) with logs:`);
    sessions.forEach((session, i) => {
      const logPath = path.join(afkDir, session, 'worker.log');
      const stat = fs.statSync(logPath);
      console.log(`  ${i + 1}. ${session} (${Math.round(stat.size / 1024)}KB, modified ${stat.mtime.toLocaleString()})`);
    });
    
    console.log('\n📋 Test Instructions:');
    console.log('1. Start the TUI with: node bin/calmhive tui');
    console.log('2. Navigate to the session list');
    console.log('3. Select one of the sessions listed above');
    console.log('4. Open the logs viewer (usually "l" key or similar)');
    console.log('5. Verify that logs are displayed correctly');
    console.log('6. Look for content like "AFk worker started" in the logs');
    
    const shouldStart = await this.askQuestion('\nWould you like to start the TUI now? (y/N): ');
    
    if (shouldStart.toLowerCase().startsWith('y')) {
      console.log('\n🚀 Starting TUI... (Press Ctrl+C to exit when done testing)');
      console.log('💡 Look for the sessions listed above and test their log viewers\n');
      
      // Start TUI but don't wait for it - let user test manually
      const tui = spawn('node', ['bin/calmhive', 'tui'], {
        stdio: 'inherit'
      });
      
      // Wait for user to finish testing
      await this.askQuestion('Press Enter when you\'ve finished testing the TUI...');
      
      try {
        tui.kill();
      } catch (e) {
        // TUI might already be closed
      }
      
      const result = await this.askQuestion('Did the log viewer display logs correctly? (y/N): ');
      
      if (result.toLowerCase().startsWith('y')) {
        console.log('✅ TUI log viewer test PASSED');
        console.log('🎉 Log path fix is working correctly!');
      } else {
        console.log('❌ TUI log viewer test FAILED');
        console.log('💡 The log path fix may need additional work');
      }
    } else {
      console.log('\n💡 You can manually test later with:');
      console.log('   node bin/calmhive tui');
      console.log('   Then navigate to logs for any of the sessions listed above');
    }
    
    this.rl.close();
  }

  askQuestion(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }
}

if (require.main === module) {
  const test = new ManualTuiTest();
  test.startTuiTest().catch(console.error);
}

module.exports = ManualTuiTest;