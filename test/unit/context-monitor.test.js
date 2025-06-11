#!/usr/bin/env node

/**
 * Unit tests for ContextMonitor
 */

const ContextMonitor = require('../../lib/context-monitor');
const fs = require('fs');
const path = require('path');

console.log('Testing ContextMonitor...');

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

// Test initialization
const testSessionId = 'test-session-' + Date.now();
const monitor = new ContextMonitor(testSessionId);
assert(monitor instanceof ContextMonitor, 'ContextMonitor initialization');
assert(monitor.sessionId === testSessionId, 'Session ID stored correctly');

// Test event logging
monitor.logEvent('test_event', { data: 'test' });
assert(monitor.contextHistory.length === 1, 'Event logged to history');
assert(monitor.contextHistory[0].type === 'test_event', 'Event type correct');

// Test output monitoring
const testOutput = 'Error: Prompt is too long. Please run /compact to compress context.';
monitor.monitorOutput(testOutput);
assert(monitor.contextHistory.some(e => e.type === 'context_contextLimit'), 'Detects context limit');
assert(monitor.contextHistory.some(e => e.type === 'context_compactSuggestion'), 'Detects compact suggestion');

// Test compact attempt logging
monitor.logCompactAttempt('standard', true);
assert(monitor.compactAttempts.length === 1, 'Compact attempt logged');
assert(monitor.compactAttempts[0].success === true, 'Success status recorded');

monitor.logCompactAttempt('newline_prefix', false, new Error('Failed'));
assert(monitor.compactAttempts.length === 2, 'Failed attempt logged');
assert(monitor.compactAttempts[1].error === 'Failed', 'Error message recorded');

// Test report generation
const report = monitor.generateReport();
assert(report.sessionId === testSessionId, 'Report contains session ID');
assert(report.totalEvents > 0, 'Report shows total events');
assert(report.compactAttempts === 2, 'Report shows compact attempts');
assert(report.successfulCompacts === 1, 'Report counts successful compacts');

// Test pattern analysis
const patterns = monitor.analyzePatterns();
assert(typeof patterns.compactSuccessRate === 'number', 'Calculates success rate');
assert(patterns.compactSuccessRate === 0.5, 'Success rate is correct (1/2 = 0.5)');

// Clean up test files
const testLogPath = monitor.logPath;
const testReportPath = path.join(path.dirname(testLogPath), 'context-report.json');
if (fs.existsSync(testLogPath)) fs.unlinkSync(testLogPath);
if (fs.existsSync(testReportPath)) fs.unlinkSync(testReportPath);
// Clean up test directory
const testDir = path.dirname(testLogPath);
if (fs.existsSync(testDir)) fs.rmdirSync(testDir, { recursive: true });

console.log('ContextMonitor tests passed!');