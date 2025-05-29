#!/usr/bin/env node
/**
 * Quick test runner for basic functionality
 */

const { spawn } = require('child_process');

function runTest(command, args, timeout = 10000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    
    const timer = setTimeout(() => {
      child.kill();
      resolve({ success: false, reason: 'timeout' });
    }, timeout);
    
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ success: code === 0, code });
    });
    
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ success: false, error: error.message });
    });
  });
}

async function quickTest() {
  console.log('🐝 Quick Calmhive Test Suite');
  console.log('============================');
  
  const tests = [
    { name: 'Main help', cmd: 'node', args: ['bin/calmhive', '--help'] },
    { name: 'Chat help', cmd: 'node', args: ['commands/chat', '--help'] },
    { name: 'Run help', cmd: 'node', args: ['commands/run', '--help'] },
    { name: 'AFk help', cmd: 'node', args: ['commands/afk', '--help'] },
    { name: 'TUI help', cmd: 'node', args: ['commands/tui', '--help'] },
    { name: 'Voice help', cmd: 'node', args: ['commands/voice', '--help'] }
  ];
  
  let passed = 0;
  
  for (const test of tests) {
    process.stdout.write(`  ${test.name}... `);
    const result = await runTest(test.cmd, test.args, 5000);
    
    if (result.success) {
      console.log('✅');
      passed++;
    } else {
      console.log(`❌ (${result.reason || result.error || 'failed'})`);
    }
  }
  
  console.log(`\nResults: ${passed}/${tests.length} tests passed`);
  
  if (passed === tests.length) {
    console.log('🎉 All quick tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed');
    process.exit(1);
  }
}

quickTest().catch(console.error);