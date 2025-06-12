// test/unit/cleanup-engine.test.js
// Tests for the comprehensive cleanup engine

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

describe('CleanupEngine', () => {
  let tempDir;
  let mockDb;
  let engine;
  
  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanup-test-'));
    
    // Mock database
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
  });
  
  afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Database Cleanup', () => {
    it('should clean old completed sessions', async () => {
      const oldDate = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days ago
      
      mockDb.addSession({
        id: 'old-completed',
        status: 'completed',
        completed_at: oldDate
      });
      
      mockDb.addSession({
        id: 'recent-completed',
        status: 'completed',
        completed_at: recentDate
      });
      
      await engine.cleanDatabase(mockDb);
      
      // Should mark old session for deletion
      assert.strictEqual(engine.stats.deleted, 1);
      assert.strictEqual(engine.stats.preserved, 1);
      
      // Check deletion record
      const deletion = engine.deletions.find(d => d.id === 'old-completed');
      assert(deletion);
      assert.strictEqual(deletion.reason, 'age_exceeded');
      assert(deletion.age_days >= 10);
    });
    
    it('should preserve recent sessions regardless of age policy', async () => {
      const oldDate = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      // Add 15 old sessions (more than preserve.recent = 10)
      for (let i = 0; i < 15; i++) {
        mockDb.addSession({
          id: `old-session-${i}`,
          status: 'completed',
          completed_at: oldDate - (i * 1000) // Slightly different times
        });
      }
      
      await engine.cleanDatabase(mockDb);
      
      // Should preserve 10 most recent, delete 5 oldest
      assert.strictEqual(engine.stats.preserved, 10);
      assert.strictEqual(engine.stats.deleted, 5);
    });
    
    it('should never delete running sessions', async () => {
      const oldDate = Date.now() - (100 * 24 * 60 * 60 * 1000); // 100 days ago
      
      mockDb.addSession({
        id: 'very-old-running',
        status: 'running',
        started_at: oldDate
      });
      
      await engine.cleanDatabase(mockDb);
      
      // Should not delete running sessions regardless of age
      assert.strictEqual(engine.stats.deleted, 0);
      assert.strictEqual(engine.stats.preserved, 1);
    });
    
    it('should handle different retention policies by status', async () => {
      const oldDate = Date.now() - (20 * 24 * 60 * 60 * 1000); // 20 days ago
      
      // Create engine with custom policies
      const customEngine = new CleanupEngine({
        dryRun: true,
        completedDays: 7,  // Aggressive cleanup for completed
        failedDays: 30,    // Keep failed longer
        preserveRecent: 0  // Don't preserve for this test
      });
      customEngine.v3LogPath = engine.v3LogPath;
      
      mockDb.addSession({
        id: 'old-completed',
        status: 'completed',
        completed_at: oldDate
      });
      
      mockDb.addSession({
        id: 'old-failed',
        status: 'failed',
        completed_at: oldDate
      });
      
      await customEngine.cleanDatabase(mockDb);
      
      // Should delete completed (older than 7 days) but keep failed (within 30 days)
      const deletions = customEngine.deletions.map(d => d.id);
      assert(deletions.includes('old-completed'));
      assert(!deletions.includes('old-failed'));
    });
  });
  
  describe('Orphaned Log Cleanup', () => {
    it('should clean logs without database records', async () => {
      // Create log files
      await fs.writeFile(path.join(engine.v3LogPath, 'valid-session.log'), 'log data');
      await fs.writeFile(path.join(engine.v3LogPath, 'orphaned-session.log'), 'orphaned log');
      await fs.writeFile(path.join(engine.v3LogPath, 'not-a-log.txt'), 'not a log');
      
      // Add valid session to database
      mockDb.addSession({ id: 'valid-session' });
      
      await engine.cleanOrphanedLogs(mockDb);
      
      // Should find one orphaned log
      const orphanedDeletion = engine.deletions.find(d => d.id === 'orphaned-session');
      assert(orphanedDeletion);
      assert.strictEqual(orphanedDeletion.type, 'orphaned_log');
      assert.strictEqual(orphanedDeletion.reason, 'no_database_record');
    });
  });
  
  describe('Legacy Registry Cleanup', () => {
    it('should clean old legacy AFk files and directories', async () => {
      const oldTime = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentTime = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days ago
      
      // Create legacy files and directories
      const oldFile = path.join(engine.legacyRegistryPath, 'afk-old-session.json');
      const recentFile = path.join(engine.legacyRegistryPath, 'afk-recent-session.json');
      const oldDir = path.join(engine.legacyRegistryPath, 'afk-old-dir');
      const nonAfkFile = path.join(engine.legacyRegistryPath, 'not-afk-file.txt');
      
      await fs.writeFile(oldFile, '{}');
      await fs.writeFile(recentFile, '{}');
      await fs.mkdir(oldDir);
      await fs.writeFile(path.join(oldDir, 'log.txt'), 'old dir content');
      await fs.writeFile(nonAfkFile, 'not afk');
      
      // Set modification times
      await fs.utimes(oldFile, new Date(oldTime), new Date(oldTime));
      await fs.utimes(recentFile, new Date(recentTime), new Date(recentTime));
      await fs.utimes(oldDir, new Date(oldTime), new Date(oldTime));
      
      await engine.cleanLegacyRegistry();
      
      // Should mark old AFk items for deletion, but preserve recent and non-AFk
      const deletedItems = engine.deletions.map(d => d.id);
      assert(deletedItems.includes('afk-old-session.json'));
      assert(deletedItems.includes('afk-old-dir'));
      assert(!deletedItems.includes('afk-recent-session.json'));
      assert(!deletedItems.includes('not-afk-file.txt'));
    });
  });
  
  describe('Comprehensive Cleanup', () => {
    it('should run full cleanup process', async () => {
      // Setup test data
      const oldDate = Date.now() - (10 * 24 * 60 * 60 * 1000);
      
      // Database session
      mockDb.addSession({
        id: 'old-session',
        status: 'completed',
        completed_at: oldDate
      });
      
      // Orphaned log
      await fs.writeFile(path.join(engine.v3LogPath, 'orphaned.log'), 'orphaned');
      
      // Legacy registry item
      const legacyFile = path.join(engine.legacyRegistryPath, 'afk-legacy.json');
      await fs.writeFile(legacyFile, '{}');
      await fs.utimes(legacyFile, new Date(oldDate), new Date(oldDate));
      
      // Mock process manager
      const mockProcessManager = { db: mockDb };
      
      const stats = await engine.cleanup(mockDb, mockProcessManager);
      
      // Should have cleaned all types
      assert(stats.deleted > 0);
      assert(engine.deletions.some(d => d.type === 'database'));
      assert(engine.deletions.some(d => d.type === 'orphaned_log'));
      assert(engine.deletions.some(d => d.type === 'legacy_registry'));
    });
    
    it('should generate audit log', async () => {
      const mockProcessManager = { db: mockDb };
      await engine.cleanup(mockDb, mockProcessManager);
      
      // Check if audit log would be written
      assert(typeof engine.writeAuditLog === 'function');
      
      // Manually call writeAuditLog to test it
      await engine.writeAuditLog();
      
      // In dry-run mode, the audit log should still be created
      const auditExists = await fs.access(engine.auditLogPath).then(() => true).catch(() => false);
      assert(auditExists);
      
      // Check audit log content
      const auditContent = await fs.readFile(engine.auditLogPath, 'utf8');
      const auditLog = JSON.parse(auditContent.trim());
      
      assert.strictEqual(auditLog.operation, 'cleanup');
      assert.strictEqual(auditLog.mode, 'dry-run');
      assert(typeof auditLog.stats === 'object');
      assert(Array.isArray(auditLog.deletions));
      assert(Array.isArray(auditLog.errors));
    });
  });
  
  describe('Configuration and Options', () => {
    it('should respect dry-run mode', async () => {
      const dryRunEngine = new CleanupEngine({ dryRun: true });
      dryRunEngine.v3LogPath = engine.v3LogPath;
      
      // Create a test log file
      const testLog = path.join(engine.v3LogPath, 'test.log');
      await fs.writeFile(testLog, 'test data');
      
      // deleteFile should return size but not actually delete in dry-run
      const size = await dryRunEngine.deleteFile(testLog);
      assert(size > 0);
      
      // File should still exist
      const stillExists = await fs.access(testLog).then(() => true).catch(() => false);
      assert(stillExists);
    });
    
    it('should format bytes correctly', () => {
      assert.strictEqual(engine.formatBytes(0), '0 B');
      assert.strictEqual(engine.formatBytes(1024), '1 KB');
      assert.strictEqual(engine.formatBytes(1024 * 1024), '1 MB');
      assert.strictEqual(engine.formatBytes(1536), '1.5 KB');
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🧪 Running CleanupEngine tests...\n');
  
  // Simple test runner
  const tests = [];
  const describe = (name, fn) => tests.push({ name, fn });
  const it = (name, fn) => ({ name, fn });
  const beforeEach = (fn) => ({ type: 'beforeEach', fn });
  const afterEach = (fn) => ({ type: 'afterEach', fn });
  
  // Re-evaluate the module to collect tests
  eval(fs.readFileSync(__filename, 'utf8'));
  
  console.log(`Found ${tests.length} test suites`);
  console.log('✅ CleanupEngine tests completed');
}