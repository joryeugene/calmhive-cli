#!/usr/bin/env node
/**
 * Calmhive V3 Test Runner
 * 
 * Runs all tests for the Calmhive CLI
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function runTests() {
  log('🐝 Calmhive V3 Test Suite', 'blue');
  log('========================', 'blue');

  const testDirs = ['unit', 'integration', 'e2e'];
  let totalTests = 0;
  let passedTests = 0;

  for (const dir of testDirs) {
    const testDir = path.join(__dirname, dir);
    
    if (!fs.existsSync(testDir)) {
      log(`📁 ${dir} tests: directory not found, skipping`, 'yellow');
      continue;
    }

    const testFiles = fs.readdirSync(testDir)
      .filter(file => file.endsWith('.test.js') || file.endsWith('.test.sh'));

    if (testFiles.length === 0) {
      log(`📁 ${dir} tests: no test files found`, 'yellow');
      continue;
    }

    log(`\n📁 Running ${dir} tests (${testFiles.length} files)`, 'blue');
    
    for (const testFile of testFiles) {
      const testPath = path.join(testDir, testFile);
      totalTests++;

      try {
        log(`  ▶ ${testFile}...`, 'reset');
        
        if (testFile.endsWith('.js')) {
          await runCommand('node', [testPath]);
        } else if (testFile.endsWith('.sh')) {
          await runCommand('bash', [testPath]);
        }
        
        log(`  ✅ ${testFile} passed`, 'green');
        passedTests++;
      } catch (error) {
        log(`  ❌ ${testFile} failed: ${error.message}`, 'red');
      }
    }
  }

  // Summary
  log('\n📊 Test Summary', 'blue');
  log('===============', 'blue');
  log(`Total tests: ${totalTests}`);
  log(`Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'yellow');
  log(`Failed: ${totalTests - passedTests}`, totalTests === passedTests ? 'green' : 'red');

  if (passedTests === totalTests) {
    log('\n🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n💥 Some tests failed!', 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(`\n💥 Test runner failed: ${error.message}`, 'red');
  process.exit(1);
});