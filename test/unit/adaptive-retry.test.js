#!/usr/bin/env node
/**
 * Adaptive Retry Unit Tests
 * 
 * Tests the critical retry logic that handles Claude usage limits.
 * This is one of Calmhive's key differentiators.
 */

const assert = require('assert');
const AdaptiveRetry = require('../../lib/adaptive-retry');

async function testAdaptiveRetry() {
  console.log('Testing AdaptiveRetry...');
  
  const retry = new AdaptiveRetry();
  
  // Test initial state
  assert.strictEqual(retry.consecutiveFailures, 0, 'Should start with 0 failures');
  console.log('  ✓ Initial state');
  
  // Test delay calculation
  const initialDelay = retry.getNextDelay();
  assert.strictEqual(initialDelay, 30000, 'Initial delay should be 30 seconds');
  console.log('  ✓ Initial delay calculation');
  
  // Test failure recording and exponential backoff
  retry.recordFailure();
  const secondDelay = retry.getNextDelay();
  assert.strictEqual(secondDelay, 60000, 'Second delay should be 60 seconds (2x)');
  
  retry.recordFailure();
  const thirdDelay = retry.getNextDelay();
  assert.strictEqual(thirdDelay, 120000, 'Third delay should be 120 seconds (4x)');
  console.log('  ✓ Exponential backoff progression');
  
  // Test max delay cap
  retry.consecutiveFailures = 10; // Force high failure count
  const maxDelay = retry.getNextDelay();
  assert.strictEqual(maxDelay, 3600000, 'Should cap at max delay (1 hour)');
  console.log('  ✓ Maximum delay cap');
  
  // Test success reset
  retry.recordSuccess();
  assert.strictEqual(retry.consecutiveFailures, 0, 'Success should reset failure count');
  const resetDelay = retry.getNextDelay();
  assert.strictEqual(resetDelay, 30000, 'Delay should reset to initial value');
  console.log('  ✓ Success reset behavior');
  
  // Test retry with immediate success (no wait needed)
  const immediateSuccessSpawner = () => true;
  const result = await retry.waitWithRetry(immediateSuccessSpawner, 3);
  assert.strictEqual(result, true, 'Should return success result immediately');
  console.log('  ✓ Retry mechanism with immediate success');
  
  // Test retry limits (catches expected error)
  let failureAttempts = 0;
  const alwaysFailSpawner = () => {
    failureAttempts++;
    return false;
  };
  
  try {
    const retryForFailure = new AdaptiveRetry();
    await retryForFailure.waitWithRetry(alwaysFailSpawner, 1);
    assert.fail('Should have thrown error after max retries');
  } catch (error) {
    assert(error.message.includes('Failed after'), 'Should throw meaningful error message');
    assert.strictEqual(failureAttempts, 1, 'Should only attempt once with maxRetries=1');
    console.log('  ✓ Retry limit enforcement and error handling');
  }
  
  console.log('AdaptiveRetry tests passed!');
}

testAdaptiveRetry().catch(error => {
  console.error('AdaptiveRetry test failed:', error);
  process.exit(1);
});