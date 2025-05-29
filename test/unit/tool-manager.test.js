#!/usr/bin/env node
/**
 * Tool Manager Unit Tests
 * 
 * Tests the security-critical tool permission system.
 * Ensures tools are properly loaded and validated.
 */

const assert = require('assert');
const toolManager = require('../../lib/tool-manager');

async function testToolManager() {
  console.log('Testing ToolManager...');
  
  const tm = toolManager;
  
  // Test basic functionality
  const allTools = tm.getAllTools();
  assert(typeof allTools === 'string', 'getAllTools should return string');
  assert(allTools.length > 0, 'Should have some tools configured');
  console.log('  ✓ Basic tool retrieval');
  
  // Test tools array format
  const toolsArray = tm.getAllToolsArray();
  assert(Array.isArray(toolsArray), 'getAllToolsArray should return array');
  assert(toolsArray.length > 0, 'Should have tools in array');
  console.log('  ✓ Tools array format');
  
  // Test essential tools are present
  const essentialTools = ['Task', 'Bash', 'Read', 'Write'];
  for (const tool of essentialTools) {
    assert(toolsArray.includes(tool), `Essential tool '${tool}' should be present`);
  }
  console.log('  ✓ Essential tools present');
  
  // Test default tools vs all tools
  const defaultTools = tm.getDefaultTools();
  assert(typeof defaultTools === 'string', 'getDefaultTools should return string');
  
  const defaultArray = defaultTools.split(',');
  const allArray = allTools.split(',');
  assert(defaultArray.length <= allArray.length, 'Default tools should be subset of all tools');
  console.log('  ✓ Default vs all tools relationship');
  
  // Test tool categories
  const hasCore = toolsArray.some(tool => ['Task', 'Bash', 'Read'].includes(tool));
  const hasMcp = toolsArray.some(tool => tool.startsWith('mcp__'));
  
  assert(hasCore, 'Should have core tools');
  console.log('  ✓ Core tools category validation');
  
  if (hasMcp) {
    console.log('  ✓ MCP tools detected (advanced features available)');
  } else {
    console.log('  ⚠ No MCP tools (basic mode)');
  }
  
  // Test security - ensure no dangerous standalone tools
  const dangerousPatterns = ['rm ', 'sudo', 'chmod 777'];
  const toolString = allTools.toLowerCase();
  
  for (const pattern of dangerousPatterns) {
    assert(!toolString.includes(pattern), `Should not contain dangerous pattern: ${pattern}`);
  }
  
  // Check for eval but allow browser_evaluate (legitimate tool)
  const evalOccurrences = toolString.match(/eval/g) || [];
  const browserEvaluateOccurrences = toolString.match(/browser_evaluate/g) || [];
  assert(evalOccurrences.length === browserEvaluateOccurrences.length, 
    'Any eval references should only be from browser_evaluate tool');
  console.log('  ✓ Security validation (no dangerous patterns)');
  
  // Test configuration loading resilience
  const tmConfig = tm.toolsConfig;
  assert(typeof tmConfig === 'object', 'Tool config should be object');
  assert(Array.isArray(tmConfig.defaultTools), 'Default tools should be array');
  console.log('  ✓ Configuration structure validation');
  
  console.log('ToolManager tests passed!');
}

testToolManager().catch(error => {
  console.error('ToolManager test failed:', error);
  process.exit(1);
});