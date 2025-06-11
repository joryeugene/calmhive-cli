#!/usr/bin/env node

const assert = require('assert');

function testObjectCreation() {
  console.log('Testing object creation...');
  const obj = { name: 'test', value: 42 };
  assert.strictEqual(obj.name, 'test', 'Object name property should be "test"');
  assert.strictEqual(obj.value, 42, 'Object value property should be 42');
  console.log('✓ Object creation test passed');
}

function testArrayMethods() {
  console.log('Testing array methods...');
  const numbers = [1, 2, 3, 4, 5];
  const doubled = numbers.map(n => n * 2);
  assert.deepStrictEqual(doubled, [2, 4, 6, 8, 10], 'Array map should double all values');
  
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  assert.strictEqual(sum, 15, 'Array reduce should sum to 15');
  console.log('✓ Array methods test passed');
}

function testDateOperations() {
  console.log('Testing date operations...');
  const date = new Date(2025, 4, 30); // Year, month (0-indexed), day
  assert.strictEqual(date.getFullYear(), 2025, 'Year should be 2025');
  assert.strictEqual(date.getMonth(), 4, 'Month should be 4 (May)');
  assert.strictEqual(date.getDate(), 30, 'Date should be 30');
  console.log('✓ Date operations test passed');
}

function testRegularExpressions() {
  console.log('Testing regular expressions...');
  const email = 'test@example.com';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert.strictEqual(emailRegex.test(email), true, 'Email regex should match valid email');
  
  const invalidEmail = 'not-an-email';
  assert.strictEqual(emailRegex.test(invalidEmail), false, 'Email regex should not match invalid email');
  console.log('✓ Regular expressions test passed');
}

function testErrorHandling() {
  console.log('Testing error handling...');
  let errorCaught = false;
  try {
    JSON.parse('invalid json');
  } catch (error) {
    errorCaught = true;
    assert.strictEqual(error instanceof SyntaxError, true, 'Should catch SyntaxError');
  }
  assert.strictEqual(errorCaught, true, 'Error should be caught');
  console.log('✓ Error handling test passed');
}

function runTests() {
  console.log('Running basic functionality tests...\n');
  
  try {
    testObjectCreation();
    testArrayMethods();
    testDateOperations();
    testRegularExpressions();
    testErrorHandling();
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = {
  testObjectCreation,
  testArrayMethods,
  testDateOperations,
  testRegularExpressions,
  testErrorHandling,
  runTests
};