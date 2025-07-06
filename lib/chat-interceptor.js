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
const crypto = require('crypto');

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
const debugMode = process.env.CALMHIVE_DEBUG === '1' || process.env.CALMHIVE_INTERCEPTOR_DEBUG === '1';

// Conversation tracking for smart injection
let processedMessages = new Map(); // Track messages we've already injected into with timestamps
let recentMessages = []; // Track recent messages to detect typing patterns
let conversationSessions = new Map(); // Track conversation sessions
let totalInjections = 0;
let lastCleanupTime = Date.now();
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up every hour
const MESSAGE_TTL = 60 * 60 * 1000; // Keep messages for 1 hour

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
 * Generate a cryptographic hash for user message content
 */
function hashUserMessage(content) {
  if (!content) {return null;}
  // Use SHA-256 for better uniqueness
  const hash = crypto.createHash('sha256');
  hash.update(content.toString());
  return hash.digest('hex').substring(0, 16); // Use first 16 chars for readability
}

/**
 * Clean up old entries from tracking maps
 */
function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL) {
    return; // Not time for cleanup yet
  }

  lastCleanupTime = now;
  let cleaned = 0;

  // Clean up old processed messages
  for (const [hash, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_TTL) {
      processedMessages.delete(hash);
      cleaned++;
    }
  }

  // Clean up old conversation sessions
  for (const [sessionId, data] of conversationSessions.entries()) {
    if (now - data.lastSeen > MESSAGE_TTL) {
      conversationSessions.delete(sessionId);
      cleaned++;
    }
  }

  if (debugMode && cleaned > 0) {
    console.error(`[Calmhive Debug] Cleaned up ${cleaned} old entries`);
  }
}

/**
 * Check if current message is likely typing continuation of recent message
 * 
 * This function implements sophisticated typing detection to prevent duplicate
 * rule injection during real-time typing. It analyzes recent message patterns
 * to identify:
 * - Text expansion (user continuing to type)
 * - Text deletion (user backspacing)
 * - Similar messages (user editing/revising)
 * 
 * Uses a combination of string similarity algorithms and temporal analysis.
 */
function isTypingContinuation(currentContent) {
  if (!currentContent || recentMessages.length === 0) {return false;}

  const now = Date.now();
  const currentText = currentContent.toString().trim();

  // Check recent messages (within last 5 seconds)
  // This window captures typical typing speed variations
  const recentTyping = recentMessages.filter(msg => now - msg.timestamp < 5000);

  for (const recent of recentTyping) {
    const recentText = recent.content.toString().trim();

    // PATTERN 1: Text Expansion Detection
    // Current message is longer and starts with the recent message
    // Example: "hello" → "hello world" (user continuing to type)
    if (currentText.length > recentText.length &&
        currentText.startsWith(recentText)) {
      if (debugMode) {
        console.error(`[Calmhive Debug] Detected typing continuation: "${recentText}" → "${currentText}"`);
      }
      return true;
    }

    // PATTERN 2: Text Deletion Detection
    // Recent message is longer and starts with current message
    // Example: "hello world" → "hello" (user backspacing)
    if (recentText.length > currentText.length &&
        recentText.startsWith(currentText)) {
      if (debugMode) {
        console.error(`[Calmhive Debug] Detected typing backspace: "${recentText}" → "${currentText}"`);
      }
      return true;
    }

    // PATTERN 3: High Similarity Detection
    // Messages are very similar but not exact prefixes (editing/revising)
    // Uses custom similarity algorithm optimized for typing patterns
    const similarity = calculateSimilarity(currentText, recentText);
    if (similarity > 0.8 && Math.abs(currentText.length - recentText.length) < 20) {
      if (debugMode) {
        console.error(`[Calmhive Debug] Detected similar message (${(similarity * 100).toFixed(1)}% similar)`);
      }
      return true;
    }
  }

  return false;
}

/**
 * Calculate similarity between two strings (0-1)
 * 
 * Custom similarity algorithm optimized for typing detection.
 * More efficient than full Levenshtein distance for our use case.
 * 
 * Algorithm:
 * 1. Fast path: exact match returns 1.0
 * 2. Fast path: substring relationship (common in typing)
 * 3. Character-order matching (preserves typing sequence)
 * 
 * Time complexity: O(n) where n is length of longer string
 * Space complexity: O(1)
 */
function calculateSimilarity(str1, str2) {
  if (str1 === str2) {return 1;} // Fast path: exact match
  if (!str1 || !str2) {return 0;} // Fast path: empty strings

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  // Fast path: substring relationship
  // Common when user is expanding or contracting text
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }

  // Character-order matching algorithm
  // Counts characters that appear in the same relative order
  // This preserves typing sequence better than bag-of-words approaches
  let commonChars = 0;
  let shortIndex = 0;

  for (let i = 0; i < longer.length && shortIndex < shorter.length; i++) {
    if (longer[i] === shorter[shortIndex]) {
      commonChars++;
      shortIndex++;
    }
  }

  // Normalize by the length of the longer string
  // This prevents short strings from having inflated similarity scores
  return commonChars / Math.max(str1.length, str2.length);
}

/**
 * Track a message for typing pattern detection
 */
function trackMessage(content) {
  const now = Date.now();
  recentMessages.push({
    content: content,
    timestamp: now
  });

  // Keep only last 10 messages and recent messages (last 10 seconds)
  recentMessages = recentMessages
    .filter(msg => now - msg.timestamp < 10000)
    .slice(-10);
}

/**
 * Generate conversation session ID from message history
 * 
 * Creates a stable identifier for conversation sessions to prevent
 * duplicate rule injection across multi-turn conversations.
 * 
 * Session ID Strategy:
 * 1. Single message: Hash the original user message
 * 2. Multi-turn: Extract and hash the original first message
 * 3. Already injected: Extract original content from injection
 * 
 * This ensures the same conversation gets the same session ID
 * regardless of how many times it's been processed.
 */
function getConversationSessionId(bodyData) {
  if (!bodyData.messages || bodyData.messages.length === 0) {
    return null;
  }

  // CASE 1: Single message conversations (new conversations)
  if (bodyData.messages.length === 1) {
    const firstMessage = bodyData.messages[0];
    if (firstMessage.role === 'user') {
      // Extract text content from various message formats
      // Claude API supports both string and structured content
      const content = typeof firstMessage.content === 'string'
        ? firstMessage.content
        : (Array.isArray(firstMessage.content) ? firstMessage.content.map(c => {
          if (typeof c === 'string') {return c;}
          if (c.type === 'text' && c.text) {return c.text;}
          return '';
        }).join(' ') : '');

      // Don't track if already injected (to avoid duplicate tracking)
      // This prevents circular session creation
      if (content.includes('CLAUDE.md RULES:')) {
        return null;
      }

      return hashUserMessage(content);
    }
  }

  // CASE 2: Multi-turn conversations (continuing conversations)
  // Find the first user message to use as session anchor
  const firstMessage = bodyData.messages.find(m => m.role === 'user');
  if (!firstMessage) {return null;}

  // Extract content using the same logic as single messages
  const firstContent = typeof firstMessage.content === 'string'
    ? firstMessage.content
    : (Array.isArray(firstMessage.content) ? firstMessage.content.map(c => {
      if (typeof c === 'string') {return c;}
      if (c.type === 'text' && c.text) {return c.text;}
      return '';
    }).join(' ') : '');

  if (debugMode) {
    console.error('[Calmhive Debug] First message content length:', firstContent.length);
    console.error('[Calmhive Debug] First message includes CLAUDE.md:', firstContent.includes('CLAUDE.md RULES:'));
    if (firstContent.includes('CLAUDE.md RULES:')) {
      console.error('[Calmhive Debug] Looking for original message...');
    }
  }

  // CASE 3: Previously injected conversations
  // Extract the original message from our injection wrapper
  if (firstContent.includes('CLAUDE.md RULES:')) {
    // Use regex to extract the original user message
    // Our injection format includes "Original message:" marker
    const originalMatch = firstContent.match(/Original message:\n(.+)$/s);
    if (originalMatch) {
      const sessionId = hashUserMessage(originalMatch[1]);
      if (debugMode) {
        console.error('[Calmhive Debug] Found original message, session ID:', sessionId);
      }
      return sessionId;
    } else if (debugMode) {
      console.error('[Calmhive Debug] Could not extract original message from injected content');
    }
  }

  // Don't track sessions for non-injected first messages
  // This prevents creating sessions for conversations we haven't processed
  return null;
}

/**
 * Check if this conversation session has already been injected
 */
function isConversationAlreadyInjected(bodyData) {
  const sessionId = getConversationSessionId(bodyData);
  if (!sessionId) {
    if (debugMode) {
      console.error('[Calmhive Debug] No session ID found, not a tracked conversation');
    }
    return false;
  }

  const now = Date.now();

  if (debugMode) {
    console.error(`[Calmhive Debug] Checking session: ${sessionId}`);
    console.error('[Calmhive Debug] Tracked sessions:', Array.from(conversationSessions.keys()));
  }

  // Check if we've injected into this conversation recently (within 30 minutes)
  if (conversationSessions.has(sessionId)) {
    const sessionData = conversationSessions.get(sessionId);
    if (now - sessionData.timestamp < 30 * 60 * 1000) { // 30 minutes
      if (debugMode) {
        console.error(`[Calmhive Debug] Conversation session already injected: ${sessionId.slice(0, 20)}...`);
      }
      return true;
    }
  }

  if (debugMode) {
    console.error('[Calmhive Debug] Session not found in tracked sessions');
  }

  return false;
}

/**
 * Mark conversation session as injected
 */
function markConversationInjected(bodyData) {
  const sessionId = getConversationSessionId(bodyData);
  if (sessionId) {
    if (debugMode) {
      console.error(`[Calmhive Debug] Marking session as injected: ${sessionId}`);
    }
    conversationSessions.set(sessionId, {
      timestamp: Date.now(),
      lastSeen: Date.now(),
      messageCount: bodyData.messages.length
    });
  } else if (debugMode) {
    console.error('[Calmhive Debug] Cannot mark session - no session ID found');
  }
}

/**
 * Analyze request type to determine if injection should occur
 */
function analyzeRequestType(bodyData) {
  const analysis = {
    isUserMessage: false,
    isToolCall: false,
    isStreaming: false,
    messageCount: bodyData.messages ? bodyData.messages.length : 0,
    hasTools: !!bodyData.tools,
    hasRecentToolUse: false,
    requestType: 'unknown'
  };

  if (!bodyData.messages || !Array.isArray(bodyData.messages)) {
    analysis.requestType = 'non-message';
    return analysis;
  }

  // Check for tool definitions in request
  if (bodyData.tools && Array.isArray(bodyData.tools) && bodyData.tools.length > 0) {
    analysis.isToolCall = true;
    analysis.requestType = 'tool-enabled';
  }

  // Check for streaming
  if (bodyData.stream === true) {
    analysis.isStreaming = true;
  }

  // Analyze message history for tool use patterns
  const assistantMessages = bodyData.messages.filter(m => m.role === 'assistant');
  analysis.hasRecentToolUse = assistantMessages.some(m => {
    if (Array.isArray(m.content)) {
      return m.content.some(c => c.type === 'tool_use');
    }
    if (typeof m.content === 'string') {
      return m.content.includes('tool_use') || m.content.includes('<function_calls>');
    }
    return false;
  });

  // Get the last user message
  const lastUserMessage = bodyData.messages.filter(m => m.role === 'user').pop();
  if (lastUserMessage) {
    // Determine if this looks like a fresh user message vs tool execution context
    const userContent = typeof lastUserMessage.content === 'string'
      ? lastUserMessage.content
      : (Array.isArray(lastUserMessage.content) ? lastUserMessage.content.map(c => c.text || '').join(' ') : '');

    // Fresh user message indicators: short, no tool references, direct human language
    const isLikelyFreshUserMessage =
      !analysis.hasRecentToolUse &&
      analysis.messageCount <= 3 && // Short conversation
      !userContent.includes('CLAUDE.md RULES:') && // Not already injected
      userContent.length > 0 && userContent.length < 500; // Reasonable length

    if (isLikelyFreshUserMessage) {
      analysis.isUserMessage = true;
      analysis.requestType = 'fresh-user-message';
    } else if (analysis.hasRecentToolUse || analysis.messageCount > 10) {
      analysis.requestType = 'tool-execution-context';
    } else {
      analysis.requestType = 'continued-conversation';
    }
  }

  if (debugMode) {
    console.error('[Calmhive Debug] Request analysis:', JSON.stringify(analysis, null, 2));
  }

  return analysis;
}

/**
 * Check if this request should receive injection based on request analysis
 */
function shouldInjectForRequest(bodyData) {
  // First check if ANY user message in the conversation already has CLAUDE.md injected
  const hasInjectedMessage = bodyData.messages.some(msg => {
    if (msg.role !== 'user') {return false;}
    const content = typeof msg.content === 'string'
      ? msg.content
      : (Array.isArray(msg.content) ? msg.content.map(c => {
        if (typeof c === 'string') {return c;}
        if (c.type === 'text' && c.text) {return c.text;}
        return '';
      }).join(' ') : '');
    return content.includes('CLAUDE.md RULES:');
  });

  if (hasInjectedMessage) {
    if (debugMode) {
      console.error('[Calmhive Debug] Conversation already has CLAUDE.md injected in a previous message');
    }
    return false;
  }

  // Get the user message content for deduplication
  const lastUserMessage = bodyData.messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) {
    if (debugMode) {
      console.error('[Calmhive Debug] No user message found');
    }
    return false;
  }

  // Check if this is a tool result message (actual tool execution)
  const isToolResult = Array.isArray(lastUserMessage.content) &&
    lastUserMessage.content.some(c => c.type === 'tool_result');

  if (isToolResult) {
    if (debugMode) {
      console.error('[Calmhive Debug] Skipping injection - tool result message');
    }
    return false;
  }

  const userContent = typeof lastUserMessage.content === 'string'
    ? lastUserMessage.content
    : (Array.isArray(lastUserMessage.content) ? lastUserMessage.content.map(c => {
      if (typeof c === 'string') {return c;}
      if (c.type === 'text' && c.text) {return c.text;}
      return '';
    }).join(' ') : '');

  // Skip if message already contains CLAUDE.md (re-injection prevention)
  if (userContent.includes('CLAUDE.md RULES:')) {
    if (debugMode) {
      console.error('[Calmhive Debug] Message already contains CLAUDE.md rules');
    }
    return false;
  }

  // Check if this conversation session has already been injected (CRITICAL FIX for conversation spam)
  if (isConversationAlreadyInjected(bodyData)) {
    if (debugMode) {
      console.error('[Calmhive Debug] Conversation already injected, skipping');
    }
    trackMessage(userContent); // Still track for typing detection
    return false;
  }

  // Check if this is typing continuation (CRITICAL FIX for typing spam)
  if (isTypingContinuation(userContent)) {
    if (debugMode) {
      console.error('[Calmhive Debug] Skipping injection - typing continuation detected');
    }
    trackMessage(userContent); // Still track for future typing detection
    return false;
  }

  // Create a simple hash for deduplication
  const messageHash = hashUserMessage(userContent);

  // Skip if we've already processed this exact message
  if (processedMessages.has(messageHash)) {
    if (debugMode) {
      console.error(`[Calmhive Debug] Already processed this message: ${messageHash.slice(0, 20)}...`);
    }
    return false;
  }

  // Mark this message as processed and inject
  processedMessages.set(messageHash, Date.now());
  trackMessage(userContent); // Track for typing pattern detection
  markConversationInjected(bodyData); // Mark conversation session as injected

  if (debugMode) {
    console.error('[Calmhive Debug] Injection decision: INJECT (new user message)');
  }

  return true;
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
  // Run cleanup periodically
  cleanupOldEntries();

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
      console.error('[Calmhive Debug] === REQUEST ANALYSIS ===');
      console.error('[Calmhive Debug] Request has tools:', !!bodyData.tools);
      console.error('[Calmhive Debug] Stream setting:', bodyData.stream);
      console.error('[Calmhive Debug] Messages count:', bodyData.messages ? bodyData.messages.length : 0);
      console.error('[Calmhive Debug] Model:', bodyData.model);

      if (bodyData.messages && bodyData.messages.length > 0) {
        const lastMessage = bodyData.messages[bodyData.messages.length - 1];
        console.error('[Calmhive Debug] Last message role:', lastMessage.role);

        // Check for tool use in recent assistant messages
        const assistantMessages = bodyData.messages.filter(m => m.role === 'assistant');
        const hasToolUse = assistantMessages.some(m =>
          (Array.isArray(m.content) && m.content.some(c => c.type === 'tool_use')) ||
          (typeof m.content === 'string' && m.content.includes('tool_use'))
        );
        console.error('[Calmhive Debug] Has recent tool use:', hasToolUse);
      }

      console.error('[Calmhive Debug] Full request body:', JSON.stringify(bodyData, null, 2));
      console.error('[Calmhive Debug] ========================');
    }

    // Check if this is a message request
    if (bodyData.messages && Array.isArray(bodyData.messages)) {
      let modified = false;

      // Use request analysis to determine if injection should occur
      if (!shouldInjectForRequest(bodyData)) {
        if (debugMode) {
          console.error('[Calmhive Debug] Skipping injection based on request analysis');
        }
      } else {
        // Find the last user message to inject into
        for (let i = bodyData.messages.length - 1; i >= 0; i--) {
          if (bodyData.messages[i].role === 'user') {
            const content = bodyData.messages[i].content;


            // Handle different content formats
            if (typeof content === 'string') {
              const newContent = injectRulesIntoMessage(content);
              if (newContent !== content) {
                bodyData.messages[i].content = newContent;
                modified = true;
                totalInjections++;
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
                    totalInjections++;
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
      }

      if (modified) {
        // Return modified body in same format as input
        const modifiedBody = typeof originalBody === 'string' ? JSON.stringify(bodyData) :
          originalBody instanceof Uint8Array ? new TextEncoder().encode(JSON.stringify(bodyData)) :
            bodyData;


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
          // Clean logging - show when injection occurs
          console.error(`[Calmhive Interceptor] Rules injected (injection #${totalInjections})`);
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
