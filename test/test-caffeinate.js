#!/usr/bin/env node

/**
 * Test caffeinate (sleep prevention) functionality
 * Tests that caffeinate starts/stops correctly for AFk sessions
 */

const { spawn, execSync } = require('child_process');
const ProcessManager = require('../lib/process-manager');
const path = require('path');
const fs = require('fs');

class CaffeinateTest {
  constructor() {
    this.pm = new ProcessManager();
    this.passed = 0;
    this.failed = 0;
  }

  async run() {
    console.log('🧪 Testing Caffeinate Sleep Prevention...');
    console.log('   (Using test mode to avoid Claude usage limits)\n');
    
    // Set test mode to mock Claude process
    process.env.CALMHIVE_TEST_MODE = '1';
    
    await this.testCaffeinateForLongSession();
    await this.testNoCaffeinateForShortSession();
    await this.testNoCaffeinateWithFlag();
    await this.testCaffeinateCleanupOnStop();
    await this.testCaffeinateInOrphanCleanup();
    
    this.printResults();
  }

  async testCaffeinateForLongSession() {
    console.log('📋 Test 1: Caffeinate starts for >5 iterations');
    
    try {
      // Start a session with 10 iterations
      const sessionPromise = this.pm.startAfkSession('Test caffeinate long', {
        iterations: 10
      });
      
      // Give it a moment to start
      await this.sleep(2000);
      
      // Check if caffeinate is running
      const caffeinateRunning = this.isCaffeinateRunning();
      
      if (caffeinateRunning) {
        console.log('✅ Caffeinate started correctly for 10 iterations\n');
        this.passed++;
      } else {
        console.log('❌ Caffeinate did not start for 10 iterations\n');
        this.failed++;
      }
      
      // Stop the session
      const sessions = await this.pm.getStatus();
      const running = sessions.find(s => s.status === 'running');
      if (running) {
        await this.pm.stopSession(running.id);
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
      this.failed++;
    }
  }

  async testNoCaffeinateForShortSession() {
    console.log('📋 Test 2: No caffeinate for ≤5 iterations');
    
    try {
      // Start a session with 3 iterations
      const sessionPromise = this.pm.startAfkSession('Test short session', {
        iterations: 3
      });
      
      // Give it a moment to start
      await this.sleep(2000);
      
      // Check if caffeinate is running
      const caffeinateRunning = this.isCaffeinateRunning();
      
      if (!caffeinateRunning) {
        console.log('✅ Caffeinate correctly not started for 3 iterations\n');
        this.passed++;
      } else {
        console.log('❌ Caffeinate incorrectly started for 3 iterations\n');
        this.failed++;
      }
      
      // Stop the session
      const sessions = await this.pm.getStatus();
      const running = sessions.find(s => s.status === 'running');
      if (running) {
        await this.pm.stopSession(running.id);
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
      this.failed++;
    }
  }

  async testNoCaffeinateWithFlag() {
    console.log('📋 Test 3: --no-prevent-sleep flag disables caffeinate');
    
    try {
      // Start a session with 10 iterations but preventSleep=false
      const sessionPromise = this.pm.startAfkSession('Test no sleep prevention', {
        iterations: 10,
        preventSleep: false
      });
      
      // Give it a moment to start
      await this.sleep(2000);
      
      // Check if caffeinate is running
      const caffeinateRunning = this.isCaffeinateRunning();
      
      if (!caffeinateRunning) {
        console.log('✅ Caffeinate correctly disabled by flag\n');
        this.passed++;
      } else {
        console.log('❌ Caffeinate started despite --no-prevent-sleep\n');
        this.failed++;
      }
      
      // Stop the session
      const sessions = await this.pm.getStatus();
      const running = sessions.find(s => s.status === 'running');
      if (running) {
        await this.pm.stopSession(running.id);
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
      this.failed++;
    }
  }

  async testCaffeinateCleanupOnStop() {
    console.log('📋 Test 4: Caffeinate stops when session stops');
    
    try {
      // Start a session with 20 iterations
      const sessionPromise = this.pm.startAfkSession('Test cleanup', {
        iterations: 20
      });
      
      // Give it a moment to start
      await this.sleep(2000);
      
      // Verify caffeinate is running
      const initialCheck = this.isCaffeinateRunning();
      if (!initialCheck) {
        console.log('⚠️ Caffeinate did not start, skipping cleanup test\n');
        return;
      }
      
      // Stop the session
      const sessions = await this.pm.getStatus();
      const running = sessions.find(s => s.status === 'running');
      if (running) {
        await this.pm.stopSession(running.id);
      }
      
      // Give it a moment to clean up
      await this.sleep(1000);
      
      // Check if caffeinate stopped
      const caffeinateRunning = this.isCaffeinateRunning();
      
      if (!caffeinateRunning) {
        console.log('✅ Caffeinate stopped correctly on session stop\n');
        this.passed++;
      } else {
        console.log('❌ Caffeinate still running after session stop\n');
        this.failed++;
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
      this.failed++;
    }
  }

  async testCaffeinateInOrphanCleanup() {
    console.log('📋 Test 5: Orphan caffeinate cleanup');
    
    try {
      // Start a caffeinate process manually (simulating orphan)
      const caffeinate = spawn('caffeinate', ['-i', '-m', '-s'], {
        detached: true,
        stdio: 'ignore'
      });
      const orphanPid = caffeinate.pid;
      
      // Give it a moment to start
      await this.sleep(1000);
      
      // Run orphan cleanup
      const result = await this.pm.killOrphanProcesses();
      
      // Check if our orphan was killed
      let orphanKilled = false;
      try {
        process.kill(orphanPid, 0);
        orphanKilled = false;
      } catch (e) {
        orphanKilled = true;
      }
      
      if (orphanKilled) {
        console.log(`✅ Orphan caffeinate (PID ${orphanPid}) cleaned up\n`);
        this.passed++;
      } else {
        console.log(`❌ Orphan caffeinate (PID ${orphanPid}) not cleaned up\n`);
        this.failed++;
        // Clean up manually
        try { process.kill(orphanPid, 'SIGTERM'); } catch (e) {}
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
      this.failed++;
    }
  }

  isCaffeinateRunning() {
    try {
      const output = execSync('ps aux | grep caffeinate | grep -v grep', {
        encoding: 'utf8'
      });
      return output.includes('-i') && output.includes('-m');
    } catch (e) {
      return false;
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
      console.log('\n🎉 All caffeinate tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Some tests failed');
      process.exit(1);
    }
  }
}

// Run tests
if (require.main === module) {
  const test = new CaffeinateTest();
  test.run().catch(console.error);
}

module.exports = CaffeinateTest;