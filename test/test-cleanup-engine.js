// test/test-cleanup-engine.js
// Simple test for cleanup engine functionality

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const CleanupEngine = require('../lib/cleanup-engine');

// Mock SessionDatabase
class MockSessionDatabase {
  constructor() {
    this.sessions = [];
  }
  
  async getAllSessions() {
    return this.sessions;
  }
  
  async deleteSession(id) {
    this.sessions = this.sessions.filter(s => s.id !== id);
    return true;
  }
  
  addSession(session) {
    this.sessions.push({
      id: session.id || 'test-session',
      status: session.status || 'completed',
      started_at: session.started_at || Date.now(),
      completed_at: session.completed_at || Date.now(),
      ...session
    });
  }
}

async function runTest(name, testFn) {
  try {
    console.log(`  Testing ${name}...`);
    await testFn();
    console.log(`  ✅ ${name}`);
    return true;
  } catch (error) {
    console.log(`  ❌ ${name}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing CleanupEngine...\n');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Basic cleanup engine creation
  total++;
  if (await runTest('Basic engine creation', async () => {
    const engine = new CleanupEngine({ dryRun: true });
    if (!engine.dryRun) throw new Error('Dry run not set');
    if (!engine.policies) throw new Error('Policies not initialized');
  })) passed++;
  
  // Test 2: Database cleanup with old sessions
  total++;
  if (await runTest('Database cleanup with old sessions', async () => {
    const mockDb = new MockSessionDatabase();
    const engine = new CleanupEngine({ dryRun: true, preserveRecent: 0 });
    
    // Add old session (10 days old, older than default 7 day retention)
    const oldDate = Date.now() - (10 * 24 * 60 * 60 * 1000);
    mockDb.addSession({
      id: 'old-session',
      status: 'completed',
      completed_at: oldDate
    });
    
    await engine.cleanDatabase(mockDb);
    
    
    if (engine.stats.deleted !== 1) {
      throw new Error(`Expected 1 deletion, got ${engine.stats.deleted}`);
    }
    
    // In dry-run mode, deletion records aren't created, but stats are tracked
    // The session should be marked for deletion but not actually deleted from mockDb
    const sessions = await mockDb.getAllSessions();
    if (sessions.length !== 1) {
      throw new Error(`Expected session to remain in dry-run mode, got ${sessions.length}`);
    }
  })) passed++;
  
  // Test 3: Preserve recent sessions
  total++;
  if (await runTest('Preserve recent sessions', async () => {
    const mockDb = new MockSessionDatabase();
    const engine = new CleanupEngine({ dryRun: true, preserveRecent: 2 });
    
    // Add multiple old sessions
    const oldDate = Date.now() - (10 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 5; i++) {
      mockDb.addSession({
        id: `session-${i}`,
        status: 'completed',
        completed_at: oldDate - (i * 1000) // Different times for sorting
      });
    }
    
    await engine.cleanDatabase(mockDb);
    
    if (engine.stats.preserved !== 2) {
      throw new Error(`Expected 2 preserved, got ${engine.stats.preserved}`);
    }
    if (engine.stats.deleted !== 3) {
      throw new Error(`Expected 3 deleted, got ${engine.stats.deleted}`);
    }
  })) passed++;
  
  // Test 4: Never delete running sessions
  total++;
  if (await runTest('Never delete running sessions', async () => {
    const mockDb = new MockSessionDatabase();
    const engine = new CleanupEngine({ dryRun: true, preserveRecent: 0 });
    
    // Add very old running session - should be skipped entirely
    const veryOldDate = Date.now() - (100 * 24 * 60 * 60 * 1000);
    mockDb.addSession({
      id: 'ancient-running',
      status: 'running',
      started_at: veryOldDate
    });
    
    await engine.cleanDatabase(mockDb);
    
    // Running sessions are skipped entirely, so no stats change
    if (engine.stats.deleted !== 0) {
      throw new Error(`Expected 0 deletions, got ${engine.stats.deleted}`);
    }
    if (engine.stats.preserved !== 0) {
      throw new Error(`Expected 0 preserved (skipped), got ${engine.stats.preserved}`);
    }
    
    // Session should still exist in database
    const sessions = await mockDb.getAllSessions();
    if (sessions.length !== 1) {
      throw new Error(`Expected 1 session remaining, got ${sessions.length}`);
    }
  })) passed++;
  
  // Test 5: File size formatting
  total++;
  if (await runTest('File size formatting', async () => {
    const engine = new CleanupEngine();
    
    if (engine.formatBytes(0) !== '0 B') throw new Error('0 bytes format wrong');
    if (engine.formatBytes(1024) !== '1 KB') throw new Error('1 KB format wrong');
    if (engine.formatBytes(1024 * 1024) !== '1 MB') throw new Error('1 MB format wrong');
    if (engine.formatBytes(1536) !== '1.5 KB') throw new Error('1.5 KB format wrong');
  })) passed++;
  
  // Test 6: Custom retention policies
  total++;
  if (await runTest('Custom retention policies', async () => {
    const engine = new CleanupEngine({
      dryRun: true,
      completedDays: 1,
      failedDays: 30,
      preserveRecent: 0
    });
    
    if (engine.policies.maxAge.completed !== 1) {
      throw new Error('Custom completed days not set');
    }
    if (engine.policies.maxAge.failed !== 30) {
      throw new Error('Custom failed days not set');
    }
  })) passed++;
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All cleanup engine tests passed!');
    return 0;
  } else {
    console.log('❌ Some tests failed');
    return 1;
  }
}

if (require.main === module) {
  main().then(process.exit).catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
}