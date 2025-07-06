#!/usr/bin/env node

/**
 * Calmhive Stdin Interceptor
 *
 * This module provides an alternative approach to rule injection by intercepting
 * stdin data before it reaches Claude. This works at the process I/O level
 * rather than the network level.
 */

const { Transform } = require('stream');
const fs = require('fs');
const path = require('path');
const os = require('os');

class StdinInterceptor extends Transform {
  constructor(options = {}) {
    super(options);

    this.claudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
    this.settingsPath = path.join(os.homedir(), '.claude', 'calmhive-settings.json');
    this.claudeMdContent = null;
    this.ruleInjectionEnabled = true;
    this.conversationStarted = false;
    this.messageBuffer = '';

    this.loadClaudeMd();
    this.loadSettings();
  }

  loadClaudeMd() {
    try {
      if (fs.existsSync(this.claudeMdPath)) {
        this.claudeMdContent = fs.readFileSync(this.claudeMdPath, 'utf8');
        console.error('[Calmhive Stdin] Loaded CLAUDE.md for injection');
      } else {
        console.error('[Calmhive Stdin] Warning: CLAUDE.md not found');
      }
    } catch (error) {
      console.error('[Calmhive Stdin] Error loading CLAUDE.md:', error.message);
    }
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        this.ruleInjectionEnabled = settings.ruleInjection !== false;
      }
    } catch (error) {
      // Default to enabled if settings can't be read
      this.ruleInjectionEnabled = true;
    }
  }

  injectRules(message) {
    if (!this.claudeMdContent || !this.ruleInjectionEnabled) {
      return message;
    }

    // Skip if already injected
    if (message.includes('CLAUDE.md RULES:')) {
      return message;
    }

    // Inject rules
    return `CLAUDE.md RULES:\n\n${this.claudeMdContent}\n\n---\n\nOriginal message:\n${message}`;
  }

  _transform(chunk, encoding, callback) {
    // Convert chunk to string
    let data = chunk.toString();

    // For interactive mode, we need to handle line-by-line input
    this.messageBuffer += data;

    // Check if we have a complete line (ended with newline)
    if (data.includes('\n')) {
      // Process complete message
      const lines = this.messageBuffer.split('\n');
      const completeLines = lines.slice(0, -1);
      this.messageBuffer = lines[lines.length - 1];

      // Process each complete line
      for (let line of completeLines) {
        if (line.trim()) {
          // This looks like a user message
          const enhancedLine = this.injectRules(line);
          if (enhancedLine !== line) {
            console.error('[Calmhive Stdin] Injected CLAUDE.md into message');
            this.conversationStarted = true;
          }
          callback(null, enhancedLine + '\n');
        } else {
          // Empty line, pass through
          callback(null, line + '\n');
        }
      }
    } else {
      // No complete line yet, buffer the data
      callback();
    }
  }

  _flush(callback) {
    // Process any remaining buffered data
    if (this.messageBuffer.trim()) {
      const enhanced = this.injectRules(this.messageBuffer);
      if (enhanced !== this.messageBuffer) {
        console.error('[Calmhive Stdin] Injected CLAUDE.md into final message');
      }
      callback(null, enhanced);
    } else {
      callback();
    }
  }
}

/**
 * Create a stdin interceptor stream
 */
function createStdinInterceptor(options = {}) {
  return new StdinInterceptor(options);
}

/**
 * Wrap a child process with stdin interception
 */
function wrapProcessStdin(childProcess, options = {}) {
  const interceptor = createStdinInterceptor(options);

  // Pipe stdin through interceptor to child process
  process.stdin.pipe(interceptor).pipe(childProcess.stdin);

  // Pass through stdout and stderr unchanged
  childProcess.stdout.pipe(process.stdout);
  childProcess.stderr.pipe(process.stderr);

  return interceptor;
}

module.exports = {
  StdinInterceptor,
  createStdinInterceptor,
  wrapProcessStdin
};
