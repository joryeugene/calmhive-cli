#!/usr/bin/env node
/**
 * Quick test runner for basic functionality
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function runTest(command, args, options = {}) {
  const { timeout = 10000, expectFailure = false, checkOutput = null } = options;
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    
    const child = spawn(command, args, { 
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timer = setTimeout(() => {
      child.kill();
      resolve({ success: false, reason: 'timeout', stdout, stderr });
    }, timeout);
    
    child.on('exit', (code) => {
      clearTimeout(timer);
      
      let success = expectFailure ? code !== 0 : code === 0;
      
      if (success && checkOutput) {
        success = checkOutput(stdout, stderr);
      }
      
      resolve({ success, code, stdout, stderr });
    });
    
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ success: false, error: error.message, stdout, stderr });
    });
  });
}

async function quickTest() {
  console.log('🐝 Quick Calmhive Test Suite');
  console.log('============================');
  
  // Define test categories
  const categories = [
    {
      name: 'Basic Help Commands',
      tests: [
        { name: 'Main help', cmd: 'node', args: ['bin/calmhive', '--help'] },
        { name: 'Chat help', cmd: 'node', args: ['commands/chat', '--help'] },
        { name: 'Run help', cmd: 'node', args: ['commands/run', '--help'] },
        { name: 'AFk help', cmd: 'node', args: ['commands/afk', '--help'] },
        { name: 'TUI help', cmd: 'node', args: ['commands/tui', '--help'] },
        { name: 'Voice help', cmd: 'node', args: ['commands/voice', '--help'] }
      ]
    },
    {
      name: 'Command Aliases',
      tests: [
        { name: 'AFk alias (a)', cmd: 'node', args: ['bin/calmhive', 'a', '--help'] },
        { name: 'Chat alias (c)', cmd: 'node', args: ['bin/calmhive', 'c', '--help'] },
        { name: 'Run alias (r)', cmd: 'node', args: ['bin/calmhive', 'r', '--help'] },
        { name: 'TUI alias (t)', cmd: 'node', args: ['bin/calmhive', 't', '--help'] },
        { name: 'Voice alias (v)', cmd: 'node', args: ['bin/calmhive', 'v', '--help'] }
      ]
    },
    {
      name: 'Error Handling',
      tests: [
        { 
          name: 'Unknown command', 
          cmd: 'node', 
          args: ['bin/calmhive', 'invalid-command'],
          options: { 
            expectFailure: true,
            checkOutput: (stdout, stderr) => stderr.includes('Unknown command')
          }
        },
        {
          name: 'No command provided',
          cmd: 'node',
          args: ['bin/calmhive'],
          options: {
            checkOutput: (stdout) => stdout.includes('Usage:')
          }
        }
      ]
    },
    {
      name: 'Core Functionality',
      tests: [
        {
          name: 'AFk status check',
          cmd: 'node',
          args: ['commands/afk', 'status'],
          options: {
            checkOutput: (stdout) => stdout.includes('AFk Sessions') || stdout.includes('No active sessions')
          }
        },
        {
          name: 'Session database exists',
          cmd: 'test',
          args: ['-f', 'data/sessions.db'],
          options: { timeout: 1000 }
        },
        {
          name: 'Tools config exists',
          cmd: 'test',
          args: ['-f', 'config/allowed-tools.json'],
          options: { timeout: 1000 }
        }
      ]
    },
    {
      name: 'Safe Operations',
      tests: [
        {
          name: 'Config file readable',
          cmd: 'node',
          args: ['-e', 'require("./config/allowed-tools.json"); console.log("OK")'],
          options: {
            checkOutput: (stdout) => stdout.includes('OK')
          }
        },
        {
          name: 'Process manager load',
          cmd: 'node',
          args: ['-e', 'require("./lib/process-manager.js"); console.log("Loaded")'],
          options: {
            checkOutput: (stdout) => stdout.includes('Loaded')
          }
        }
      ]
    }
  ];
  
  let totalTests = 0;
  let totalPassed = 0;
  
  for (const category of categories) {
    console.log(`\n${category.name}:`);
    
    for (const test of category.tests) {
      process.stdout.write(`  ${test.name}... `);
      const result = await runTest(test.cmd, test.args, test.options || {});
      
      totalTests++;
      
      if (result.success) {
        console.log('✅');
        totalPassed++;
      } else {
        console.log(`❌ (${result.reason || result.error || 'failed'})`);
        if (process.env.DEBUG) {
          console.log(`    stdout: ${result.stdout}`);
          console.log(`    stderr: ${result.stderr}`);
        }
      }
    }
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Results: ${totalPassed}/${totalTests} tests passed`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 All quick tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed');
    console.log('Run with DEBUG=1 for more details');
    process.exit(1);
  }
}

quickTest().catch(console.error);