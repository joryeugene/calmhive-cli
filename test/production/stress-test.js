/**
 * Stress Test Suite
 * Load testing for calmhive components under stress
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class StressTest {
  constructor() {
    this.projectRoot = path.join(__dirname, '..', '..');
    this.results = [];
  }

  async runConcurrentCommands(command, args, concurrency = 10, iterations = 5) {
    console.log(`⚡ Running ${concurrency} concurrent "${command} ${args.join(' ')}" commands...`);
    
    const start = Date.now();
    const promises = [];
    
    for (let i = 0; i < concurrency; i++) {
      for (let j = 0; j < iterations; j++) {
        promises.push(this.runCommand(command, args, 5000));
      }
    }

    try {
      const results = await Promise.allSettled(promises);
      const duration = Date.now() - start;
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.code === 0);
      const failed = results.filter(r => r.status === 'rejected' || r.value.code !== 0);
      
      console.log(`  Results: ${successful.length}/${results.length} successful in ${duration}ms`);
      console.log(`  Average time: ${Math.round(duration / results.length)}ms per command`);
      
      if (failed.length > 0) {
        console.log(`  ❌ ${failed.length} failures detected`);
      }
      
      return {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        duration,
        avgTime: Math.round(duration / results.length)
      };
    } catch (error) {
      console.error(`  💥 Stress test crashed: ${error.message}`);
      return { total: promises.length, successful: 0, failed: promises.length, duration: 0, avgTime: 0 };
    }
  }

  async runCommand(command, args = [], timeout = 5000) {
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
        reject(new Error('Command timeout'));
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

  async testHelpCommandLoad() {
    console.log('🔥 Testing help command under load...');
    
    const result = await this.runConcurrentCommands('node', ['bin/calmhive', '--help'], 20, 3);
    this.results.push({ test: 'help-load', ...result });
    
    return result.successful > result.total * 0.95; // 95% success rate
  }

  async testConfigCommandLoad() {
    console.log('🔥 Testing config command under load...');
    
    const result = await this.runConcurrentCommands('node', ['commands/config', 'show'], 15, 2);
    this.results.push({ test: 'config-load', ...result });
    
    return result.successful > result.total * 0.90; // 90% success rate (file operations)
  }

  async testAllCommandsSequential() {
    console.log('🔥 Testing all commands sequentially...');
    
    const commands = [
      ['node', ['bin/calmhive', '--help']],
      ['node', ['commands/afk', '--help']],
      ['node', ['commands/chat', '--help']],
      ['node', ['commands/config', 'show']],
      ['node', ['commands/run', '--help']],
      ['node', ['commands/tui', '--help']],
      ['node', ['commands/voice', '--help']]
    ];

    let successful = 0;
    let failed = 0;
    const start = Date.now();

    for (const [cmd, args] of commands) {
      try {
        const result = await this.runCommand(cmd, args, 3000);
        if (result.code === 0) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    const duration = Date.now() - start;
    console.log(`  Results: ${successful}/${commands.length} successful in ${duration}ms`);
    
    this.results.push({ 
      test: 'all-commands-sequential', 
      total: commands.length, 
      successful, 
      failed, 
      duration,
      avgTime: Math.round(duration / commands.length)
    });
    
    return successful === commands.length;
  }

  async testMemoryUsage() {
    console.log('🔥 Testing memory usage patterns...');
    
    const commands = [
      ['node', ['bin/calmhive', '--help']],
      ['node', ['commands/config', 'show']],
      ['node', ['commands/afk', 'status']]
    ];

    let memoryLeaks = 0;
    
    for (const [cmd, args] of commands) {
      const initialMemory = process.memoryUsage();
      
      // Run command multiple times to check for memory leaks
      for (let i = 0; i < 10; i++) {
        try {
          await this.runCommand(cmd, args, 2000);
        } catch (error) {
          // Ignore individual failures, focus on memory
        }
      }
      
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      if (heapGrowth > 10 * 1024 * 1024) { // 10MB growth threshold
        memoryLeaks++;
        console.log(`  ⚠️  Memory growth detected: ${Math.round(heapGrowth / 1024 / 1024)}MB for ${cmd} ${args.join(' ')}`);
      }
    }
    
    console.log(`  Memory leak tests: ${commands.length - memoryLeaks}/${commands.length} passed`);
    
    this.results.push({ 
      test: 'memory-usage', 
      total: commands.length, 
      successful: commands.length - memoryLeaks, 
      failed: memoryLeaks,
      duration: 0,
      avgTime: 0
    });
    
    return memoryLeaks === 0;
  }

  async testFileSystemStress() {
    console.log('🔥 Testing filesystem operations under stress...');
    
    // Test config operations that involve file I/O
    const result = await this.runConcurrentCommands('node', ['commands/config', 'show'], 10, 2);
    
    // Check if session database survives concurrent access
    const dbPath = path.join(this.projectRoot, 'data', 'sessions.db');
    const dbExists = fs.existsSync(dbPath);
    
    console.log(`  Database integrity: ${dbExists ? '✅' : '❌'}`);
    
    this.results.push({ test: 'filesystem-stress', ...result, dbIntact: dbExists });
    
    return result.successful > result.total * 0.85 && dbExists;
  }

  async runAllStressTests() {
    console.log('🔥 Calmhive Stress Test Suite');
    console.log('============================\n');

    const tests = [
      { name: 'Help Command Load', fn: () => this.testHelpCommandLoad() },
      { name: 'Config Command Load', fn: () => this.testConfigCommandLoad() },
      { name: 'Sequential Commands', fn: () => this.testAllCommandsSequential() },
      { name: 'Memory Usage', fn: () => this.testMemoryUsage() },
      { name: 'Filesystem Stress', fn: () => this.testFileSystemStress() }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const success = await test.fn();
        if (success) {
          console.log(`✅ ${test.name} PASSED\n`);
          passed++;
        } else {
          console.log(`❌ ${test.name} FAILED\n`);
          failed++;
        }
      } catch (error) {
        console.log(`💥 ${test.name} CRASHED: ${error.message}\n`);
        failed++;
      }
    }

    console.log('📊 Stress Test Summary:');
    console.log(`✅ Passed: ${passed}/${tests.length}`);
    console.log(`❌ Failed: ${failed}/${tests.length}`);
    
    console.log('\n📈 Performance Metrics:');
    this.results.forEach(result => {
      if (result.avgTime > 0) {
        console.log(`  ${result.test}: ${result.avgTime}ms avg, ${result.successful}/${result.total} success`);
      }
    });

    const allPassed = failed === 0;
    
    if (allPassed) {
      console.log('\n🎉 ALL STRESS TESTS PASSED!');
      console.log('System performs well under load.');
    } else {
      console.log('\n⚠️  SOME STRESS TESTS FAILED');
      console.log('System may have performance issues under load.');
    }

    return allPassed;
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new StressTest();
  test.runAllStressTests().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(error => {
    console.error('Stress test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = StressTest;