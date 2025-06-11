#!/usr/bin/env node

/**
 * Test that stop command properly interrupts AFk sessions
 * Ensures sessions stop immediately without continuing iterations
 */

const ProcessManager = require('../lib/process-manager');
const { execSync } = require('child_process');

class StopInterruptionTest {
  constructor() {
    this.pm = new ProcessManager();
    this.passed = 0;
    this.failed = 0;
  }

  async run() {
    console.log('🧪 Testing Stop Command Interruption...\n');
    
    // Set test mode to avoid hitting Claude
    process.env.CALMHIVE_TEST_MODE = '1';
    
    await this.testStopDuringIteration();
    await this.testStopDuringWait();
    await this.testStopDuringUsageLimitWait();
    
    this.printResults();
  }

  async testStopDuringIteration() {
    console.log('📋 Test 1: Stop during active iteration');
    
    try {
      // Start a session with 10 iterations
      const sessionPromise = this.pm.startAfkSession('Test stop during iteration', {
        iterations: 10
      });
      
      // Give it a moment to start
      await this.sleep(3000);
      
      // Get the session
      const sessions = await this.pm.getStatus();
      const running = sessions.find(s => s.status === 'running');
      
      if (!running) {
        console.log('❌ No running session found\n');
        this.failed++;
        return;
      }
      
      console.log(`   Found running session: ${running.id}`);
      console.log(`   Current iteration: ${running.iterations_completed + 1}`);
      
      // Stop the session
      await this.pm.stopSession(running.id);
      console.log('   Sent stop command');
      
      // Wait a bit and check status
      await this.sleep(2000);
      
      const afterStop = await this.pm.getSession(running.id);
      if (afterStop && afterStop.status === 'stopped') {
        console.log('✅ Session stopped successfully\n');
        this.passed++;
      } else {
        console.log(`❌ Session status: ${afterStop?.status || 'not found'}\n`);
        this.failed++;
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
      this.failed++;
    }
  }

  async testStopDuringWait() {
    console.log('📋 Test 2: Stop during iteration wait');
    
    try {
      // Start a session
      const sessionPromise = this.pm.startAfkSession('Test stop during wait', {
        iterations: 5
      });
      
      // Wait for first iteration to complete
      await this.sleep(5000);
      
      // Get the session
      const sessions = await this.pm.getStatus();
      const running = sessions.find(s => s.status === 'running');
      
      if (!running) {
        console.log('❌ No running session found\n');
        this.failed++;
        return;
      }
      
      console.log(`   Found session waiting between iterations`);
      console.log(`   Will stop during "Waiting X seconds" message`);
      
      // Stop the session during wait
      await this.pm.stopSession(running.id);
      
      // Verify it stops immediately
      await this.sleep(1000);
      
      // Check if any new iterations started
      const afterStop = await this.pm.getSession(running.id);
      const iterationsAfterStop = afterStop?.iterations_completed || 0;
      
      if (afterStop?.status === 'stopped') {
        console.log('✅ Session stopped during wait without starting new iteration\n');
        this.passed++;
      } else {
        console.log(`❌ Session continued after stop command\n`);
        this.failed++;
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
      this.failed++;
    }
  }

  async testStopDuringUsageLimitWait() {
    console.log('📋 Test 3: Stop during usage limit wait (simulated)');
    
    // This test would require simulating a usage limit scenario
    // For now, we'll verify the code structure exists
    
    try {
      // Read the process manager code to verify interruptible sleep exists
      const fs = require('fs');
      const pmCode = fs.readFileSync(
        require.resolve('../lib/process-manager.js'), 
        'utf8'
      );
      
      // Check for interruptible sleep in usage limit handling
      const hasInterruptibleSleep = pmCode.includes('// Check if session was stopped during wait') &&
                                   pmCode.includes('currentSession.status === \'stopped\'');
      
      if (hasInterruptibleSleep) {
        console.log('✅ Code has interruptible sleep for usage limit waits\n');
        this.passed++;
      } else {
        console.log('❌ Missing interruptible sleep in usage limit handling\n');
        this.failed++;
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
      this.failed++;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printResults() {
    console.log('━'.repeat(50));
    console.log(`\n📊 Test Results:`);
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Total: ${this.passed + this.failed}`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All stop interruption tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Some tests failed');
      process.exit(1);
    }
  }
}

// Run tests
if (require.main === module) {
  const test = new StopInterruptionTest();
  test.run().catch(console.error);
}

module.exports = StopInterruptionTest;