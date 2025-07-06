#!/usr/bin/env node

/**
 * Calmhive Chat Interceptor
 *
 * This module intercepts Claude API calls at the network level to inject
 * CLAUDE.md rules into every message in interactive chat sessions.
 *
 * Based on the claude-trace approach by Simon Willison
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Store original fetch
const originalFetch = global.fetch;

// Load CLAUDE.md content
const claudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
let claudeMdContent = null;

try {
  if (fs.existsSync(claudeMdPath)) {
    claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
    console.error('[Calmhive Interceptor] Loaded CLAUDE.md for injection');
  } else {
    console.error('[Calmhive Interceptor] Warning: CLAUDE.md not found');
  }
} catch (error) {
  console.error('[Calmhive Interceptor] Error loading CLAUDE.md:', error.message);
}

// Check if rule injection is enabled
const settingsPath = path.join(os.homedir(), '.claude', 'calmhive-settings.json');
let ruleInjectionEnabled = true;
const debugMode = process.env.CALMHIVE_DEBUG === '1';

try {
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    ruleInjectionEnabled = settings.ruleInjection !== false;
  }
} catch (error) {
  // Default to enabled if settings can't be read
  ruleInjectionEnabled = true;
}

if (debugMode) {
  console.error('[Calmhive Debug] Debug mode enabled');
  console.error('[Calmhive Debug] Rule injection enabled:', ruleInjectionEnabled);
  console.error('[Calmhive Debug] CLAUDE.md content length:', claudeMdContent ? claudeMdContent.length : 0);
}

/**
 * Check if a URL is a Claude API endpoint
 */
function isClaudeAPI(url) {
  if (typeof url === 'string') {
    return url.includes('anthropic.com') || url.includes('claude.ai');
  }
  if (url instanceof URL) {
    return url.hostname.includes('anthropic.com') || url.hostname.includes('claude.ai');
  }
  return false;
}

/**
 * Inject CLAUDE.md into a message
 */
function injectRulesIntoMessage(message) {
  // Skip if already injected
  if (message.includes('CLAUDE.md RULES:')) {
    return message;
  }

  // Prepend rules to message
  return `CLAUDE.md RULES:\n\n${claudeMdContent}\n\n---\n\nOriginal message:\n${message}`;
}

/**
 * Modify request body to inject rules
 */
function modifyRequestBody(body) {
  if (!body || !claudeMdContent || !ruleInjectionEnabled) {
    if (debugMode) {
      console.error('[Calmhive Debug] Skipping injection - body:', !!body, 'claudeMd:', !!claudeMdContent, 'enabled:', ruleInjectionEnabled);
    }
    return body;
  }

  try {
    let bodyData;
    const originalBody = body;

    // Parse body based on type
    if (typeof body === 'string') {
      bodyData = JSON.parse(body);
    } else if (body instanceof Uint8Array) {
      bodyData = JSON.parse(new TextDecoder().decode(body));
    } else {
      bodyData = body;
    }

    if (debugMode) {
      console.error('[Calmhive Debug] Original request body:', JSON.stringify(bodyData, null, 2));
    }

    // Check if this is a message request
    if (bodyData.messages && Array.isArray(bodyData.messages)) {
      let modified = false;

      // Find the last user message
      for (let i = bodyData.messages.length - 1; i >= 0; i--) {
        if (bodyData.messages[i].role === 'user') {
          const content = bodyData.messages[i].content;

          // Handle different content formats
          if (typeof content === 'string') {
            const newContent = injectRulesIntoMessage(content);
            if (newContent !== content) {
              bodyData.messages[i].content = newContent;
              modified = true;
              if (debugMode) {
                console.error('[Calmhive Debug] Injected into string content');
                console.error('[Calmhive Debug] Original length:', content.length);
                console.error('[Calmhive Debug] New length:', newContent.length);
              }
            }
          } else if (Array.isArray(content)) {
            // Handle multi-part messages
            for (let j = 0; j < content.length; j++) {
              if (content[j].type === 'text' && content[j].text) {
                const newText = injectRulesIntoMessage(content[j].text);
                if (newText !== content[j].text) {
                  content[j].text = newText;
                  modified = true;
                  if (debugMode) {
                    console.error('[Calmhive Debug] Injected into multipart content');
                  }
                }
                break; // Only inject into first text part
              }
            }
          }

          break; // Only modify the last user message
        }
      }

      if (modified) {
        // Return modified body in same format as input
        const modifiedBody = typeof originalBody === 'string' ? JSON.stringify(bodyData) :
          originalBody instanceof Uint8Array ? new TextEncoder().encode(JSON.stringify(bodyData)) :
            bodyData;

        if (debugMode) {
          console.error('[Calmhive Debug] Request body was modified!');
          console.error('[Calmhive Debug] Modified request body preview:', JSON.stringify(bodyData, null, 2).substring(0, 500) + '...');
        }

        return modifiedBody;
      }
    }

    if (debugMode) {
      console.error('[Calmhive Debug] No modification needed - not a message request or already injected');
    }

  } catch (error) {
    console.error('[Calmhive Interceptor] Error modifying request:', error);
    if (debugMode) {
      console.error('[Calmhive Debug] Request modification failed:', error.stack);
    }
  }

  return body;
}

// Monkey-patch global fetch
if (originalFetch) {
  global.fetch = async function(url, options = {}) {
    // Check if this is a Claude API request
    if (isClaudeAPI(url)) {
      // Clone options to avoid modifying the original
      const modifiedOptions = { ...options };

      // Modify the request body if present
      if (modifiedOptions.body) {
        const modifiedBody = modifyRequestBody(modifiedOptions.body);
        if (modifiedBody !== modifiedOptions.body) {
          modifiedOptions.body = modifiedBody;
          console.error('[Calmhive Interceptor] Injected CLAUDE.md into request');
        }
      }

      // Call original fetch with modified options
      return originalFetch.call(this, url, modifiedOptions);
    }

    // Call original fetch for non-Claude requests
    return originalFetch.call(this, url, options);
  };

  // Store reference to original on our function for testing
  global.fetch._originalFetch = originalFetch;

  console.error('[Calmhive Interceptor] Network interception active');
}

// Also patch Node's HTTP/HTTPS modules for comprehensive coverage
const http = require('http');
const https = require('https');

function patchModule(module) {
  const originalRequest = module.request;

  module.request = function(options, callback) {
    // Check if this is a Claude API request
    const isClaudeReq = (options.hostname &&
      (options.hostname.includes('anthropic.com') ||
       options.hostname.includes('claude.ai')));

    if (!isClaudeReq) {
      return originalRequest.apply(this, arguments);
    }

    // Create intercepted request
    const req = originalRequest.call(this, options, callback);
    const originalWrite = req.write;
    const originalEnd = req.end;

    const chunks = [];

    req.write = function(chunk, encoding, callback) {
      // Buffer chunks instead of sending them
      if (chunk) {
        chunks.push({ chunk, encoding });
      }
      // Call callback if provided, but don't actually write yet
      if (callback) {callback();}
      return true;
    };

    req.end = function(chunk, encoding, callback) {
      // Add final chunk if present
      if (chunk) {
        chunks.push({ chunk, encoding });
      }

      // Reconstruct the full body
      let requestBody = '';
      chunks.forEach(({ chunk, encoding }) => {
        if (Buffer.isBuffer(chunk)) {
          requestBody += chunk.toString(encoding || 'utf8');
        } else {
          requestBody += chunk.toString();
        }
      });

      // Modify the body if needed
      let finalBody = requestBody;
      if (requestBody && claudeMdContent && ruleInjectionEnabled) {
        const modifiedBody = modifyRequestBody(requestBody);
        if (modifiedBody !== requestBody) {
          finalBody = modifiedBody;
          console.error('[Calmhive Interceptor] Injected CLAUDE.md via HTTP/HTTPS');
          if (process.env.CALMHIVE_DEBUG) {
            console.error('[Calmhive Debug] Original length:', requestBody.length);
            console.error('[Calmhive Debug] Modified length:', finalBody.length);
          }
        }
      }

      // Now write all the data at once
      if (finalBody) {
        originalWrite.call(this, finalBody);
      }

      return originalEnd.call(this, callback);
    };

    return req;
  };
}

// Patch both HTTP and HTTPS
patchModule(http);
patchModule(https);

// Try to patch axios if it's available
try {
  // First check if axios exists in Claude's dependencies
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function(id) {
    const module = originalRequire.apply(this, arguments);

    // If this is axios being loaded, patch it
    if (id === 'axios' || id.includes('axios')) {
      patchAxios(module);
    }

    return module;
  };

  // Also try to patch axios if it's already loaded
  try {
    const axios = require('axios');
    patchAxios(axios);
  } catch (e) {
    // Axios not directly available
  }
} catch (error) {
  // Module patching not available
}

function patchAxios(axios) {
  if (!axios || !axios.interceptors || axios.__calmhive_patched__) {
    return;
  }

  axios.__calmhive_patched__ = true;

  // Add request interceptor
  axios.interceptors.request.use(
    (config) => {
      if (isClaudeAPI(config.url) && claudeMdContent && ruleInjectionEnabled) {
        // Modify request data
        if (config.data) {
          const modifiedData = modifyRequestBody(config.data);
          if (modifiedData !== config.data) {
            config.data = modifiedData;
            console.error('[Calmhive Interceptor] Injected CLAUDE.md via axios');
          }
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  console.error('[Calmhive Interceptor] Patched axios');
}

console.error('[Calmhive Interceptor] Ready for rule injection');
