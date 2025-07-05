#!/usr/bin/env node

/**
 * Compact Handler for Claude Code
 * Handles context compression more robustly
 */

const fs = require('fs');
const path = require('path');

class CompactHandler {
  constructor() {
    this.contextIndicators = [
      'Prompt is too long',
      'Context low',
      'Run /compact to compact',
      'context limit',
      'Message too long',
      'approaching context limit'
    ];
  }

  /**
   * Check if output indicates context limit
   */
  needsCompact(output) {
    const lowerOutput = output.toLowerCase();
    return this.contextIndicators.some(indicator =>
      lowerOutput.includes(indicator.toLowerCase())
    );
  }

  /**
   * Send compact command with proper formatting
   */
  async sendCompactCommand(process) {
    try {
      // Try multiple approaches
      const commands = [
        '/compact\n',           // Basic command
        '\n/compact\n',         // With newline prefix
        '/compact\r\n',         // With carriage return
        'compact\n',            // Without slash
        '\x03/compact\n'       // With interrupt character
      ];

      for (const cmd of commands) {
        console.log(`📦 Attempting compact with format: ${JSON.stringify(cmd)}`);
        process.stdin.write(cmd);

        // Give it time to process
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if it worked by looking for response
        // This would need to be integrated with stdout monitoring
      }

      return true;
    } catch (error) {
      console.error(`⚠️ Failed to send compact command: ${error.message}`);
      return false;
    }
  }

  /**
   * Alternative: Save context and restart with compressed history
   */
  async compressContextManually(sessionId, conversationHistory) {
    try {
      const compressedHistory = this.compressHistory(conversationHistory);
      const contextFile = path.join(process.env.HOME, '.claude', 'afk_registry', sessionId, 'compressed_context.json');

      fs.writeFileSync(contextFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        compressed: true,
        compressedHistory: compressedHistory, // Actually use the compressed history
        summary: this.generateSummary(conversationHistory),
        keyPoints: this.extractKeyPoints(conversationHistory),
        recentContext: conversationHistory.slice(-5) // Keep last 5 exchanges
      }, null, 2));

      return contextFile;
    } catch (error) {
      console.error(`⚠️ Failed to compress context: ${error.message}`);
      return null;
    }
  }

  /**
   * Compress conversation history
   */
  compressHistory(history) {
    // Simple compression: keep system messages and summarize user/assistant exchanges
    const compressed = [];
    let currentExchange = null;

    for (const msg of history) {
      if (msg.role === 'system') {
        compressed.push(msg);
      } else if (msg.role === 'user') {
        currentExchange = { user: msg.content, assistant: null };
      } else if (msg.role === 'assistant' && currentExchange) {
        currentExchange.assistant = msg.content;
        // Summarize if too long
        if (currentExchange.user.length + currentExchange.assistant.length > 1000) {
          compressed.push({
            role: 'summary',
            content: `User asked about: ${this.summarize(currentExchange.user)}. Assistant provided: ${this.summarize(currentExchange.assistant)}`
          });
        } else {
          compressed.push({ role: 'user', content: currentExchange.user });
          compressed.push({ role: 'assistant', content: currentExchange.assistant });
        }
        currentExchange = null;
      }
    }

    return compressed;
  }

  /**
   * Simple summarization
   */
  summarize(text) {
    if (text.length < 200) {return text;}
    // Take first and last parts
    return text.substring(0, 100) + '...' + text.substring(text.length - 100);
  }

  /**
   * Extract key points from conversation
   */
  extractKeyPoints(history) {
    const keyPoints = [];

    for (const msg of history) {
      if (msg.content && msg.content.includes('TODO:')) {
        keyPoints.push(`TODO: ${msg.content.split('TODO:')[1].split('\n')[0]}`);
      }
      if (msg.content && msg.content.includes('ERROR:')) {
        keyPoints.push(`ERROR: ${msg.content.split('ERROR:')[1].split('\n')[0]}`);
      }
      if (msg.content && msg.content.includes('FIXED:')) {
        keyPoints.push(`FIXED: ${msg.content.split('FIXED:')[1].split('\n')[0]}`);
      }
    }

    return keyPoints;
  }

  /**
   * Generate summary of conversation
   */
  generateSummary(history) {
    const userMessages = history.filter(m => m.role === 'user').length;
    const assistantMessages = history.filter(m => m.role === 'assistant').length;
    const totalChars = history.reduce((sum, m) => sum + (m.content?.length || 0), 0);

    return {
      exchanges: Math.min(userMessages, assistantMessages),
      totalMessages: history.length,
      totalCharacters: totalChars,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = CompactHandler;
