#!/usr/bin/env node
/**
 * Session Database Unit Tests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SessionDatabase = require('../../lib/session-database');

async function testSessionDatabase() {
  console.log('Testing SessionDatabase...');
  
  // Use a test database
  const testDbPath = path.join(__dirname, 'test-sessions.db');
  
  // Clean up any existing test db
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  const db = new SessionDatabase(testDbPath);
  
  try {
    // Test initialization
    await db.init();
    console.log('  ✓ Database initialization');
    
    // Test session creation
    const sessionData = {
      type: 'afk',
      task: 'Test task',
      status: 'running'
    };
    
    const createdSession = await db.createSession(sessionData);
    assert(createdSession, 'Session should be returned');
    assert(createdSession.id, 'Session ID should be present');
    console.log('  ✓ Session creation');
    
    // Test session retrieval
    const session = await db.getSession(createdSession.id);
    assert(session, 'Session should exist');
    assert.strictEqual(session.task, 'Test task');
    console.log('  ✓ Session retrieval');
    
    // Test session update
    await db.updateSession(createdSession.id, { status: 'completed' });
    const updatedSession = await db.getSession(createdSession.id);
    assert.strictEqual(updatedSession.status, 'completed');
    console.log('  ✓ Session update');
    
    // Test session deletion
    await db.deleteSession(createdSession.id);
    const deletedSession = await db.getSession(createdSession.id);
    assert.strictEqual(deletedSession, null);
    console.log('  ✓ Session deletion');
    
    console.log('SessionDatabase tests passed!');
    
  } finally {
    await db.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

testSessionDatabase().catch(error => {
  console.error('SessionDatabase test failed:', error);
  process.exit(1);
});