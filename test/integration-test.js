#!/usr/bin/env node
/**
 * Integration Test for Calmhive V3 
 * Tests core functionality including config commands copy
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function runCommand(cmd, args = [], options = {}) {
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

async function testConfigCommandsCopy() {
  console.log('🧪 Testing config commands copy functionality...');
  
  const testDir = path.join(os.tmpdir(), 'calmhive-test-' + Date.now());
  
  try {
    // Test dry run
    const dryRun = await runCommand('node', [
      'cmd/config', 'commands', 'copy', testDir, 
      '--pattern', 'expert', '--dry-run'
    ]);
    
    if (dryRun.code !== 0) {
      throw new Error(`Dry run failed: ${dryRun.stderr}`);
    }
    
    if (!dryRun.stdout.includes('Would copy files:')) {
      throw new Error('Dry run output missing expected content');
    }
    
    // Test actual copy
    const copy = await runCommand('node', [
      'cmd/config', 'commands', 'copy', testDir,
      '--pattern', 'expert'
    ]);
    
    if (copy.code !== 0) {
      throw new Error(`Copy failed: ${copy.stderr}`);
    }
    
    // Verify files were copied
    const files = fs.readdirSync(testDir);
    const expertFiles = files.filter(f => f.startsWith('expert-'));
    
    if (expertFiles.length === 0) {
      throw new Error('No expert files were copied');
    }
    
    console.log(`✅ Successfully copied ${expertFiles.length} expert files`);
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
    
  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    throw error;
  }
}

async function testConfigCommandsList() {
  console.log('🧪 Testing config commands list functionality...');
  
  const list = await runCommand('node', ['cmd/config', 'commands', 'list']);
  
  if (list.code !== 0) {
    throw new Error(`List command failed: ${list.stderr}`);
  }
  
  if (!list.stdout.includes('Command Files Summary:')) {
    throw new Error('List output missing expected content');
  }
  
  if (!list.stdout.includes('expert-')) {
    throw new Error('List output missing expert files');
  }
  
  console.log('✅ Commands list working correctly');
}

async function testDefaultBehaviors() {
  console.log('🧪 Testing command default behaviors...');
  
  // Test config commands defaults to list
  const defaultList = await runCommand('node', ['cmd/config', 'commands']);
  
  if (defaultList.code !== 0) {
    throw new Error(`Default commands behavior failed: ${defaultList.stderr}`);
  }
  
  if (!defaultList.stdout.includes('Command Files Summary:')) {
    throw new Error('Default commands behavior not showing list');
  }
  
  console.log('✅ Default behaviors working correctly');
}

async function runTests() {
  console.log('🚀 Starting Calmhive V3 Integration Tests\n');
  
  const tests = [
    testConfigCommandsList,
    testDefaultBehaviors,
    testConfigCommandsCopy
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message);
      failed++;
    }
    console.log('');
  }
  
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };