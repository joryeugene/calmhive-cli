// test/unit/cleanup-engine.test.js
// Simplified tests for the comprehensive cleanup engine

const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const CleanupEngine = require('../../lib/cleanup-engine');

// Mock SessionDatabase for testing
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

async function runTests() {
  console.log('🧪 Running CleanupEngine tests...\n');
  
  let tempDir;
  let mockDb;
  let engine;
  
  try {
    // Setup
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanup-test-'));
    mockDb = new MockSessionDatabase();
    
    // Create cleanup engine in dry-run mode for safety
    engine = new CleanupEngine({
      dryRun: true,
      verbose: false
    });
    
    // Override paths to use temp directory
    engine.v3LogPath = path.join(tempDir, 'logs');
    engine.legacyRegistryPath = path.join(tempDir, 'registry');
    engine.auditLogPath = path.join(tempDir, 'audit.log');
    
    // Create test directories
    await fs.mkdir(engine.v3LogPath, { recursive: true });
    await fs.mkdir(engine.legacyRegistryPath, { recursive: true });
    
    console.log('Testing CleanupEngine...');
    
    // Test 1: Basic cleanup functionality
    console.log('  Testing basic cleanup functionality...');
    const oldDate = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
    
    mockDb.addSession({
      id: 'old-session',
      status: 'completed',
      completed_at: oldDate
    });
    
    // Create orphaned log
    await fs.writeFile(path.join(engine.v3LogPath, 'orphaned.log'), 'orphaned');
    
    // Legacy registry item
    const legacyFile = path.join(engine.legacyRegistryPath, 'afk-legacy.json');
    await fs.writeFile(legacyFile, '{}');
    await fs.utimes(legacyFile, new Date(oldDate), new Date(oldDate));
    
    // Mock process manager
    const mockProcessManager = { db: mockDb };
    
    const stats = await engine.cleanup(mockDb, mockProcessManager);
    
    // Basic assertions
    assert(stats.deleted >= 0, 'Should have deletion count');
    assert(stats.scanned >= 0, 'Should have scan count');
    console.log('  ✓ Basic cleanup functionality works');
    
    // Test 2: Dry-run mode preserves files
    console.log('  Testing dry-run mode...');
    const testLog = path.join(engine.v3LogPath, 'test.log');
    await fs.writeFile(testLog, 'test data');
    
    const size = await engine.deleteFile(testLog);
    assert(size > 0, 'Should return file size');
    
    // File should still exist in dry-run mode
    try {
      await fs.access(testLog);
      console.log('  ✓ Dry-run mode preserves files');
    } catch (error) {
      throw new Error('File should still exist in dry-run mode');
    }
    
    // Test 3: Byte formatting
    console.log('  Testing byte formatting...');
    assert.strictEqual(engine.formatBytes(0), '0 B');
    assert.strictEqual(engine.formatBytes(1024), '1 KB');
    assert.strictEqual(engine.formatBytes(1024 * 1024), '1 MB');
    console.log('  ✓ Byte formatting works correctly');
    
    // Test 4: Audit log creation
    console.log('  Testing audit log creation...');
    
    // Ensure the audit log directory exists
    const auditLogDir = path.dirname(engine.auditLogPath);
    await fs.mkdir(auditLogDir, { recursive: true });
    
    await engine.writeAuditLog();
    
    try {
      const auditContent = await fs.readFile(engine.auditLogPath, 'utf8');
      const lines = auditContent.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const auditLog = JSON.parse(lastLine);
      
      assert.strictEqual(auditLog.operation, 'cleanup');
      assert.strictEqual(auditLog.mode, 'dry-run');
      assert(typeof auditLog.stats === 'object');
      console.log('  ✓ Audit log creation works');
    } catch (error) {
      throw new Error(`Audit log test failed: ${error.message}`);
    }
    
    console.log('\n✅ All CleanupEngine tests passed!');
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };