#!/usr/bin/env node

/**
 * Calmhive Stdout Interceptor
 *
 * This module intercepts Claude's output to provide enhanced formatting,
 * metadata injection, and response processing.
 */

const { Transform } = require('stream');
const chalk = require('chalk');

class StdoutInterceptor extends Transform {
  constructor(options = {}) {
    super(options);

    this.options = {
      addMetadata: options.addMetadata !== false,
      syntaxHighlight: options.syntaxHighlight !== false,
      addTimestamps: options.addTimestamps || false,
      logResponses: options.logResponses || false,
      ...options
    };

    this.responseBuffer = '';
    this.inCodeBlock = false;
    this.codeBlockLang = '';
    this.sessionStartTime = Date.now();
  }

  _transform(chunk, encoding, callback) {
    let data = chunk.toString();

    // Process the output
    if (this.options.syntaxHighlight) {
      data = this.highlightSyntax(data);
    }

    if (this.options.addTimestamps) {
      data = this.addTimestamp(data);
    }

    if (this.options.logResponses) {
      this.logResponse(data);
    }

    callback(null, data);
  }

  highlightSyntax(text) {
    // Simple syntax highlighting for code blocks
    const lines = text.split('\n');
    const highlighted = lines.map(line => {
      // Check for code block markers
      if (line.startsWith('```')) {
        this.inCodeBlock = !this.inCodeBlock;
        if (this.inCodeBlock && line.length > 3) {
          this.codeBlockLang = line.slice(3).trim();
        } else {
          this.codeBlockLang = '';
        }
        return chalk.gray(line);
      }

      // Highlight code block content
      if (this.inCodeBlock) {
        return this.highlightCodeLine(line, this.codeBlockLang);
      }

      // Highlight markdown headers
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)[0].length;
        const colors = [chalk.bold.blue, chalk.bold.cyan, chalk.bold.green, chalk.bold.yellow];
        const color = colors[Math.min(level - 1, colors.length - 1)];
        return color(line);
      }

      // Highlight lists
      if (line.match(/^\s*[-*+]\s/)) {
        return line.replace(/^(\s*)([-*+])(\s)/, '$1' + chalk.yellow('$2') + '$3');
      }

      // Highlight inline code
      return line.replace(/`([^`]+)`/g, chalk.gray('`') + chalk.cyan('$1') + chalk.gray('`'));
    });

    return highlighted.join('\n');
  }

  highlightCodeLine(line, language) {
    // Basic syntax highlighting based on language
    switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'typescript':
    case 'ts':
      return this.highlightJavaScript(line);
    case 'python':
    case 'py':
      return this.highlightPython(line);
    case 'bash':
    case 'sh':
    case 'shell':
      return this.highlightBash(line);
    default:
      return chalk.gray(line);
    }
  }

  highlightJavaScript(line) {
    // Keywords
    line = line.replace(/\b(const|let|var|function|class|if|else|for|while|return|import|export|from|require)\b/g, chalk.magenta('$1'));
    // Strings
    line = line.replace(/(["'])([^"']*)\1/g, chalk.green('$1$2$1'));
    // Comments
    line = line.replace(/(\/\/.*$|\/\*.*?\*\/)/g, chalk.gray('$1'));
    // Numbers
    line = line.replace(/\b(\d+)\b/g, chalk.yellow('$1'));
    return line;
  }

  highlightPython(line) {
    // Keywords
    line = line.replace(/\b(def|class|if|else|elif|for|while|return|import|from|as|try|except|finally|with)\b/g, chalk.magenta('$1'));
    // Strings
    line = line.replace(/(["'])([^"']*)\1/g, chalk.green('$1$2$1'));
    // Comments
    line = line.replace(/(#.*$)/g, chalk.gray('$1'));
    // Numbers
    line = line.replace(/\b(\d+)\b/g, chalk.yellow('$1'));
    return line;
  }

  highlightBash(line) {
    // Commands
    line = line.replace(/^(\$|#)\s/g, chalk.gray('$1 '));
    // Keywords
    line = line.replace(/\b(if|then|else|fi|for|do|done|while|function|return|export)\b/g, chalk.magenta('$1'));
    // Strings
    line = line.replace(/(["'])([^"']*)\1/g, chalk.green('$1$2$1'));
    // Comments
    line = line.replace(/(#.*$)/g, chalk.gray('$1'));
    // Flags
    line = line.replace(/(\s)(-{1,2}[\w-]+)/g, '$1' + chalk.cyan('$2'));
    return line;
  }

  addTimestamp(text) {
    const elapsed = Date.now() - this.sessionStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const timestamp = chalk.gray(`[${seconds}s] `);

    // Add timestamp to each new line
    return text.split('\n').map(line => {
      if (line.trim()) {
        return timestamp + line;
      }
      return line;
    }).join('\n');
  }

  logResponse(data) {
    // Log responses for debugging or analysis
    this.responseBuffer += data;

    // You could write to a log file here
    // fs.appendFileSync(logPath, data);
  }

  getStats() {
    return {
      sessionDuration: Date.now() - this.sessionStartTime,
      responseLength: this.responseBuffer.length
    };
  }
}

/**
 * Create a stdout interceptor stream
 */
function createStdoutInterceptor(options = {}) {
  return new StdoutInterceptor(options);
}

/**
 * Wrap a child process with stdout interception
 */
function wrapProcessStdout(childProcess, options = {}) {
  const interceptor = createStdoutInterceptor(options);

  // Pass through stdin unchanged
  process.stdin.pipe(childProcess.stdin);

  // Pipe stdout through interceptor
  childProcess.stdout.pipe(interceptor).pipe(process.stdout);

  // Pass through stderr unchanged (or optionally intercept it too)
  childProcess.stderr.pipe(process.stderr);

  return interceptor;
}

module.exports = {
  StdoutInterceptor,
  createStdoutInterceptor,
  wrapProcessStdout
};
