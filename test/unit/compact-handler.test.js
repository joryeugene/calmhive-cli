#!/usr/bin/env node

/**
 * Unit tests for CompactHandler
 */

const CompactHandler = require('../../lib/compact-handler');

console.log('Testing CompactHandler...');

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

// Test initialization
const handler = new CompactHandler();
assert(handler instanceof CompactHandler, 'CompactHandler initialization');

// Test context indicator detection
assert(handler.needsCompact('Error: Prompt is too long'), 'Detects "Prompt is too long"');
assert(handler.needsCompact('Context low - please use /compact'), 'Detects "Context low"');
assert(handler.needsCompact('Run /compact to compact context'), 'Detects compact suggestion');
assert(handler.needsCompact('Hitting context limit'), 'Detects "context limit"');
assert(handler.needsCompact('Message too long to process'), 'Detects "Message too long"');
assert(!handler.needsCompact('Everything is fine'), 'Does not false positive');

// Test summarization
const longText = 'a'.repeat(300);
const summary = handler.summarize(longText);
assert(summary.length < 250, 'Summarizes long text');
assert(summary.includes('...'), 'Summary includes ellipsis');

const shortText = 'Short text';
assert(handler.summarize(shortText) === shortText, 'Does not summarize short text');

// Test history compression
const history = [
  { role: 'system', content: 'System message' },
  { role: 'user', content: 'Question?' },
  { role: 'assistant', content: 'Answer.' },
  { role: 'user', content: 'a'.repeat(1000) },
  { role: 'assistant', content: 'b'.repeat(1000) }
];

const compressed = handler.compressHistory(history);
assert(compressed.length > 0, 'Compresses history');
assert(compressed.some(m => m.role === 'system'), 'Preserves system messages');
assert(compressed.some(m => m.role === 'summary'), 'Creates summaries for long exchanges');

// Test key point extraction
const historyWithKeyPoints = [
  { role: 'user', content: 'TODO: Fix the bug' },
  { role: 'assistant', content: 'ERROR: File not found' },
  { role: 'user', content: 'FIXED: Bug resolved' }
];

const keyPoints = handler.extractKeyPoints(historyWithKeyPoints);
assert(keyPoints.length === 3, 'Extracts all key points');
assert(keyPoints.some(k => k.includes('TODO:')), 'Extracts TODO');
assert(keyPoints.some(k => k.includes('ERROR:')), 'Extracts ERROR');
assert(keyPoints.some(k => k.includes('FIXED:')), 'Extracts FIXED');

console.log('CompactHandler tests passed!');