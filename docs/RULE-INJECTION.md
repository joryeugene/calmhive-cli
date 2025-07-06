# Calmhive Rule Injection System

*Last Updated: 2025-07-06*
*Version: 14.2.8*

## Overview

The Calmhive CLI provides a sophisticated multi-layer system for automatically injecting CLAUDE.md rules into conversations with Claude. This ensures consistent behavior and adherence to user-defined guidelines while intelligently avoiding injection spam.

### Key Features
- **Smart Injection**: Injects CLAUDE.md only when needed, not on every API call
- **Typing Detection** (v14.2.8): Prevents injection spam during rapid typing (#2-29)
- **AFk Rule Persistence** (v14.2.8): Re-injects rules at each iteration to prevent drift
- **Request Type Detection**: Distinguishes user messages from tool calls and streaming
- **Message Deduplication**: Prevents multiple injections of the same message
- **Multiple Interception Methods**: Network-level, stdio-level, or both
- **Configurable**: Enable/disable via settings or command flags
- **Enhanced Output**: Optional syntax highlighting and timestamps
- **Cross-Platform**: Works on all platforms Claude supports

## How It Works

### 1. Smart Injection System (v3.0+)

The injection system now uses intelligent request analysis to inject CLAUDE.md only when appropriate:

#### Request Type Detection
- **Fresh User Messages**: Short conversations without tool use → INJECT
- **Tool Execution Context**: Messages with recent tool calls → SKIP
- **Continued Conversations**: Long conversations with tool use → SKIP
- **Duplicate Messages**: Same message content seen before → SKIP
- **Typing Continuations** (v14.2.8): Partial messages during typing → SKIP

#### Message Analysis
The system analyzes each request for:
- `bodyData.tools` - Presence of tool definitions
- `bodyData.stream` - Streaming vs non-streaming requests  
- Message history length and patterns
- Recent assistant messages with tool use
- Message content deduplication
- Typing patterns - Detects if current message extends a recent one

#### Debug Mode
Enable detailed logging with `CALMHIVE_DEBUG=1`:
```bash
CALMHIVE_DEBUG=1 calmhive chat
```

This shows:
- Request analysis for each API call
- Injection decisions and reasoning
- Message deduplication in action
- Request body structures

### 2. Rule Source
- Primary source: `~/.claude/CLAUDE.md`
- Dynamically loaded at runtime
- No hardcoded rules - always reads the actual file
- Future: Support for project-specific CLAUDE.md files

### 2. Interception Methods

#### Network Interception (Default)
Intercepts HTTP requests at the network level:
- Patches `global.fetch`
- Patches Node's `http` and `https` modules
- Patches `axios` if available
- Works with all HTTP libraries

#### Stdio Interception
Intercepts at the process I/O level:
- Transforms stdin before it reaches Claude
- Transforms stdout for enhanced formatting
- Library-agnostic approach
- Enables additional features like syntax highlighting

#### Both (Comprehensive)
Uses both network and stdio interception for maximum coverage.

### 3. Injection Points

#### Command-Level Injection
- **chat**: Supports all three interception methods
- **run**: Injects into task description before execution
- **afk**: Injects at start AND re-injects at each iteration (v14.2.8)
- **voice**: Injects into transcribed messages (planned)

#### AFk Rule Persistence (v14.2.8)
AFk sessions now re-inject CLAUDE.md rules at the beginning of each iteration to prevent rule drift during long-running background tasks:
- Iteration 1: Full task with rules injected
- Iterations 2+: Rules re-injected with "Continue working on: [task]"
- Prevents Claude from forgetting guidelines during multi-hour sessions
- Rule injector prevents double injection automatically

### 4. Configuration

Control rule injection via `~/.claude/calmhive-settings.json`:

```json
{
  "ruleInjection": {
    "enabled": true,
    "method": "network",  // "network", "stdio", "both", "none"
    "contextAware": false,  // future: project-specific rules
    "shortcuts": {  // future: command shortcuts
      "!!!": "inject rules",
      "!c": "clear context"
    }
  },
  "interception": {
    "syntaxHighlight": true,  // stdio only
    "addTimestamps": false,   // stdio only
    "logResponses": false     // debugging
  }
}
```

For backward compatibility, simple boolean format still works:
```json
{
  "ruleInjection": false  // disables all injection
}
```

## Usage Examples

### Interactive Chat with Different Methods
```bash
# Default network interception
calmhive chat

# Use stdio interception with syntax highlighting
calmhive chat --intercept=stdio --highlight

# Use both methods for maximum coverage
calmhive chat --intercept=both

# Disable injection temporarily
calmhive chat --no-intercept
```

### Pipe Mode
```bash
# Rules injected into the piped message
echo "Explain this code" | calmhive chat -p
```

### Background Tasks
```bash
# Rules injected into task instructions
calmhive afk "Refactor authentication system"
```

### Enhanced Output
```bash
# Add timestamps to track response time
calmhive chat --timestamps

# Enable syntax highlighting for code
calmhive chat --highlight
```

## Technical Implementation

### Network Interceptor (`lib/chat-interceptor.js`)
For interactive chat sessions, the network interceptor:
1. Loads before Claude CLI using Node's `--require` flag
2. Patches multiple HTTP methods:
   - `global.fetch` for fetch API
   - `http.request` and `https.request` for Node HTTP
   - `axios` interceptors if axios is used
3. Modifies request bodies to inject CLAUDE.md content
4. Transparent to Claude CLI - no modifications needed

### Stdin Interceptor (`lib/stdin-interceptor.js`)
For process-level interception:
1. Creates a Transform stream between user and Claude
2. Buffers input to detect complete messages
3. Injects rules into user messages
4. Handles both line-buffered and raw input

### Stdout Interceptor (`lib/stdout-interceptor.js`)
For enhanced output:
1. Creates a Transform stream for Claude's output
2. Adds syntax highlighting for code blocks
3. Supports multiple languages (JS, Python, Bash)
4. Optional timestamps and metadata

### Rule Injector (`lib/rule-injector.js`)
Core module for rule management:
1. Loads CLAUDE.md dynamically
2. Checks settings for enable/disable
3. Provides consistent injection format
4. Used by all commands

## Disabling Rule Injection

### Method 1: Command Flag
Disable for a single session:
```bash
calmhive chat --no-intercept
```

### Method 2: Settings File
Disable permanently via `~/.claude/calmhive-settings.json`:
```json
{
  "ruleInjection": false
}
```

### Method 3: Delete CLAUDE.md
Remove or rename the file:
```bash
mv ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.disabled
```

### Method 4: Use Base Claude
Bypass Calmhive entirely:
```bash
claude chat  # Uses Claude directly without injection
```

## Creating Your CLAUDE.md

1. Create the file:
```bash
touch ~/.claude/CLAUDE.md
```

2. Add your rules and guidelines:
```markdown
# My Claude Rules

## Code Style
- Use 2 spaces for indentation
- Prefer const over let
- Always use semicolons

## Behavior
- Be concise but thorough
- Ask clarifying questions when needed
- Explain complex concepts simply
```

3. Rules take effect immediately - no restart needed

## Troubleshooting

### Smart Injection Issues (v3.0+)

#### Rules Not Being Injected
1. **Enable Debug Mode**: `CALMHIVE_DEBUG=1 calmhive chat`
2. **Check Request Analysis**: Look for "Request analysis" and "Injection decision" logs
3. **Verify Message Type**: Ensure you're sending fresh user messages, not in tool execution context
4. **Check Deduplication**: See if message was already processed with "Already processed this message"

#### Understanding Injection Decisions
Debug output shows injection reasoning:
```
[Calmhive Debug] Injection decision: INJECT (fresh-user-message)
[Calmhive Debug] Injection decision: SKIP (tool-execution-context)
[Calmhive Debug] Already processed this message: 19_Hello,howareyou?...
```

#### Common Scenarios

**Scenario**: Rules injected once then stop
- **Cause**: Normal behavior - smart deduplication prevents re-injection
- **Solution**: This is correct - each unique message gets injected once

**Scenario**: No injection during tool use
- **Cause**: System correctly detects tool execution context
- **Solution**: This is correct - tools already have context from initial injection

**Scenario**: Rules inject on every message
- **Cause**: Old injection system or debug mode issue
- **Solution**: Verify you're running v3.0+ with smart injection

### Legacy Issues

#### Rules Not Being Injected (General)
1. Check if CLAUDE.md exists: `ls -la ~/.claude/CLAUDE.md`
2. Verify settings: `cat ~/.claude/calmhive-settings.json`
3. Check interceptor loading: Look for `[Calmhive Interceptor]` in stderr
4. Try different interception method: `--intercept=stdio` or `--intercept=both`

### Verifying Injection
```bash
# Test with a simple message
echo "test" | calmhive chat -p | head -20
# Should show "CLAUDE.md RULES:" at the beginning

# Check which interceptor is active
calmhive chat --intercept=network 2>&1 | grep "Interceptor"
# Should show: [Calmhive Interceptor] Network interception active
```

### Performance Issues
- Network interception has minimal overhead
- Stdio interception with highlighting may slow down on very large outputs
- Use `--intercept=network` for best performance

### Common Issues

**Issue**: Rules appear twice
- **Cause**: Using both interception methods with pipe mode
- **Solution**: Use `--intercept=network` for pipe mode

**Issue**: Syntax highlighting not working
- **Cause**: Using network interception
- **Solution**: Use `--intercept=stdio` or `--intercept=both`

**Issue**: Chat seems slower
- **Cause**: Large CLAUDE.md file
- **Solution**: Keep rules concise and focused

## Security Considerations

- CLAUDE.md is read from your home directory only
- No network access or external file inclusion
- Rules are only injected into Claude API requests
- Settings file uses standard JSON format
- No code execution from rules

## Future Enhancements

### Near Term (v14.x)
- ✅ Multiple interception methods
- ✅ Syntax highlighting
- ✅ Timestamp support
- Context-aware injection (project-specific rules)
- Command shortcuts and expansions
- Response logging and analysis

### Long Term (v15.x)
- PTY wrapper for full terminal control
- Rule templates for different scenarios
- Integration with voice command
- AI-powered rule suggestions
- Rule validation and conflict detection

## API Reference

### Command Flags
- `--intercept=METHOD` - Set interception method (network|stdio|both)
- `--no-intercept` - Disable rule injection
- `--highlight` - Enable syntax highlighting (stdio only)
- `--timestamps` - Add timestamps to output (stdio only)

### Settings Schema
```typescript
interface CalmhiveSettings {
  ruleInjection?: boolean | {
    enabled: boolean;
    method?: 'network' | 'stdio' | 'both' | 'none';
    contextAware?: boolean;
    shortcuts?: Record<string, string>;
  };
  interception?: {
    syntaxHighlight?: boolean;
    addTimestamps?: boolean;
    logResponses?: boolean;
  };
}
```

### Environment Variables
- `CALMHIVE_NO_INJECT` - Set to disable injection (overrides settings)
- `CALMHIVE_INTERCEPT_METHOD` - Set default interception method
- `CALMHIVE_DEBUG` - Enable debug logging

---

For more information, see:
- [ENHANCED-INTERCEPTION.md](./ENHANCED-INTERCEPTION.md) - Technical details
- [Calmhive README](../README.md) - General documentation
- [Claude Code Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) - Hook system (limited use)