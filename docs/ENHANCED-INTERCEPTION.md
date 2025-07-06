# Enhanced Claude CLI Interception Architecture

## Overview

This document outlines the comprehensive approach to intercepting and enhancing Claude CLI interactions through multiple interception layers. The goal is to ensure CLAUDE.md rules are injected into every message while providing additional capabilities for enhancing the Claude experience.

## Sources and Inspirations

### Network Interception
- **claude-trace** by Simon Willison: https://simonwillison.net/2025/Jun/2/claude-trace/
  - Uses Node.js `--require` flag to load interceptor before main script
  - Patches global.fetch and http/https modules
  - Stores and displays all API interactions

### Axios Interception Patterns
- **Axios Interceptors Documentation**: https://axios-http.com/docs/interceptors
  - Request interceptors for modifying outgoing data
  - Response interceptors for processing incoming data
  - Error handling and retry logic

### PTY and Terminal Control
- **node-pty**: https://github.com/microsoft/node-pty
  - Full terminal emulation support
  - Used by VS Code, Hyper, and other terminal applications
  - Provides proper handling of escape sequences and terminal features

### Stdin/Stdout Manipulation
- **Node.js Stream Documentation**: https://nodejs.org/api/stream.html
  - Transform streams for modifying data in-flight
  - Duplex streams for bidirectional communication
  - Pipe chains for composable transformations

## Architecture Layers

### 1. Network Layer Interception
```
User Input → Claude CLI → [Network Interceptor] → API Request → Claude API
                                    ↓
                          Inject CLAUDE.md Rules
```

**Current Implementation**: `/lib/chat-interceptor.js`
- Patches `global.fetch`
- Patches `http.request` and `https.request`
- Modifies request bodies to inject rules

**Enhancement Needed**:
- Add axios interceptor support
- Add response interception
- Support streaming responses

### 2. Process I/O Interception
```
User Input → [Stdin Interceptor] → Claude CLI → [Stdout Interceptor] → Terminal
                    ↓                                    ↓
           Pre-process Input                    Post-process Output
```

**Benefits**:
- Works regardless of network library used
- Can add command shortcuts and expansions
- Can enhance output formatting

### 3. PTY Wrapper (Advanced)
```
Terminal → [PTY Wrapper] → Virtual Terminal → Claude CLI
               ↓
        Full Control Over I/O
```

**Benefits**:
- Complete terminal control
- Support for special keys and escape sequences
- Terminal resizing support
- Most comprehensive but complex approach

## Implementation Plan

### Phase 1: Enhanced Network Interceptor

#### 1.1 Add Axios Support
```javascript
// Patch axios if it exists
try {
  const axios = require('axios');
  
  // Add request interceptor
  axios.interceptors.request.use((config) => {
    if (isClaudeAPI(config.url)) {
      config.data = modifyRequestBody(config.data);
    }
    return config;
  });
  
  // Add response interceptor
  axios.interceptors.response.use((response) => {
    // Log or modify responses
    return response;
  });
} catch (e) {
  // Axios not available
}
```

#### 1.2 Response Interception
- Capture API responses for debugging
- Support streaming responses
- Add response metadata

#### 1.3 Context-Aware Injection
- Detect project context from cwd
- Load project-specific CLAUDE.md if exists
- Merge with global CLAUDE.md

### Phase 2: Stdin/Stdout Wrappers

#### 2.1 Stdin Interceptor (`/lib/stdin-interceptor.js`)
```javascript
const { Transform } = require('stream');

class StdinInterceptor extends Transform {
  _transform(chunk, encoding, callback) {
    // Pre-process user input
    let input = chunk.toString();
    
    // Add command shortcuts
    input = processShortcuts(input);
    
    // Inject rules if it's a message
    if (isUserMessage(input)) {
      input = injectRules(input);
    }
    
    callback(null, input);
  }
}

// Usage in chat command
const interceptor = new StdinInterceptor();
process.stdin.pipe(interceptor).pipe(claudeProcess.stdin);
```

#### 2.2 Stdout Interceptor (`/lib/stdout-interceptor.js`)
```javascript
class StdoutInterceptor extends Transform {
  _transform(chunk, encoding, callback) {
    // Post-process Claude output
    let output = chunk.toString();
    
    // Add syntax highlighting
    output = highlightCode(output);
    
    // Add metadata
    output = addMetadata(output);
    
    callback(null, output);
  }
}
```

### Phase 3: PTY Support (Optional)

#### 3.1 PTY Wrapper (`/lib/pty-wrapper.js`)
```javascript
const pty = require('node-pty');

class PTYWrapper {
  constructor(command, args) {
    this.pty = pty.spawn(command, args, {
      name: 'xterm-color',
      cols: process.stdout.columns,
      rows: process.stdout.rows,
      cwd: process.cwd(),
      env: process.env
    });
    
    this.setupInterception();
  }
  
  setupInterception() {
    // Intercept data flowing through PTY
    this.pty.on('data', (data) => {
      // Process and forward data
      process.stdout.write(data);
    });
    
    process.stdin.on('data', (data) => {
      // Inject rules before sending to PTY
      const enhanced = this.enhanceInput(data);
      this.pty.write(enhanced);
    });
  }
}
```

### Phase 4: Configuration and Control

#### 4.1 Settings Structure
```json
{
  "ruleInjection": {
    "enabled": true,
    "method": "network|stdio|pty",
    "contextAware": true,
    "projectOverrides": true,
    "shortcuts": {
      "!!": "repeat last command",
      "!r": "inject rules",
      "!c": "clear context"
    }
  },
  "interception": {
    "logRequests": false,
    "logResponses": false,
    "modifyResponses": false
  }
}
```

#### 4.2 Command Flags
```bash
calmhive chat --intercept=network  # Use network interception (default)
calmhive chat --intercept=stdio    # Use stdin/stdout wrappers
calmhive chat --intercept=pty      # Use PTY wrapper
calmhive chat --no-intercept        # Disable all interception
```

## Testing Strategy

### Unit Tests
1. Test each interceptor in isolation
2. Mock Claude CLI behavior
3. Verify rule injection
4. Test configuration loading

### Integration Tests
1. Test with actual Claude CLI
2. Test all interception methods
3. Test streaming responses
4. Test error conditions

### Performance Tests
1. Measure latency overhead
2. Memory usage monitoring
3. CPU usage profiling
4. Streaming performance

## Security Considerations

1. **Rule Injection Safety**
   - Never inject into non-Claude APIs
   - Validate injected content
   - Prevent injection attacks

2. **Process Security**
   - Maintain process isolation
   - Don't leak sensitive data
   - Respect user privacy

3. **Configuration Security**
   - Validate all configuration
   - Safe defaults
   - Clear documentation

## Rollout Plan

1. **v14.1.0**: Enhanced network interceptor with axios support
2. **v14.2.0**: Stdin/stdout interceptors
3. **v14.3.0**: PTY support (experimental)
4. **v15.0.0**: Full integration with configuration UI

## References

- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html)
- [Transform Streams Guide](https://nodejs.org/api/stream.html#stream_implementing_a_transform_stream)
- [Axios Interceptors](https://axios-http.com/docs/interceptors)
- [node-pty Documentation](https://github.com/microsoft/node-pty)
- [claude-trace Implementation](https://github.com/badlogic/lemmy/tree/main/apps/claude-trace)
- [Terminal Control Sequences](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html)

## Notes from Analysis

### Why Multiple Approaches?

1. **Network Interception**
   - Pros: Works at API level, sees all data
   - Cons: Must support all HTTP libraries

2. **Stdio Interception**
   - Pros: Library-agnostic, simple to implement
   - Cons: Limited control, text-only

3. **PTY Wrapper**
   - Pros: Full terminal control, most powerful
   - Cons: Complex, platform-specific issues

### Key Insights

- Claude CLI appears to use axios internally (not fetch)
- Interactive mode requires continuous injection, not just first message
- Response interception enables powerful debugging features
- PTY support would enable terminal UI enhancements

### Implementation Priority

1. Fix axios support in network interceptor (HIGH)
2. Add basic stdio interceptors (MEDIUM)
3. Add configuration UI (MEDIUM)
4. Implement PTY support (LOW)

---

*Last Updated: 2025-01-07*
*Version: 1.0.0*