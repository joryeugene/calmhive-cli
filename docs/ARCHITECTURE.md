# Calmhive V3 Architecture

> Technical guide for understanding and extending Calmhive CLI

## Overview
Calmhive V3 features a **streamlined 5-command architecture** that provides clear separation between interactive chat, headless automation, and background processing. Built on Node.js with MCP integration for 97 powerful tools.

**[⬅️ Back to README](../README.md)**

## Core Commands

### 🗣️ `calmhive chat` - Interactive Claude
**Purpose**: Direct conversation with Claude with full tool access

```bash
# Interactive session
calmhive chat

# Direct question
calmhive chat "analyze this codebase"

# Pipe mode
echo "question" | calmhive chat -p

# Continue previous session
calmhive chat -c "let's continue"

# Resume specific session
calmhive chat -r

# Use different model
calmhive chat --model opus "complex analysis task"
```

**Features**:
- ✅ Supports ALL Claude flags (`-c`, `-r`, `-p`, `--model`, etc.)
- ✅ Auto tool access (97 tools including MCP)
- ✅ True interactive experience
- ✅ Perfect for Q&A, exploration, debugging

### 🚀 `calmhive run` - Headless Automation  
**Purpose**: Non-interactive task execution with smart prompting

```bash
# Execute tasks headlessly
calmhive run "create comprehensive test suite"
calmhive run "fix authentication bug and verify"
calmhive run "analyze performance and create report"
calmhive run "refactor API for better maintainability"
```

**Features**:
- ✅ TRUE headless execution (non-interactive)
- ✅ Smart prompting with MCP integration
- ✅ Sequential thinking for complex tasks
- ✅ Automatic verification requirements
- ✅ Knowledge storage via memento
- ✅ Perfect for automation, scripts, CI/CD

### 🎤 `calmhive voice` - Voice Interface
**Purpose**: Voice input to Claude (with text fallback)

```bash
calmhive voice --test    # Test voice dependencies
calmhive voice           # Start voice interface
```

### 📊 `calmhive tui` - Process Management
**Purpose**: Terminal UI for monitoring and managing processes

```bash
calmhive tui            # Launch TUI
calmhive tui -m         # Monitor-only mode
```

### 🔄 `calmhive afk` - Background Processing
**Purpose**: Long-running background tasks with monitoring

```bash
# Start background task
calmhive afk "analyze entire codebase and create documentation" --iterations 5

# Monitor processes
calmhive afk status              # Compact view
calmhive afk status -d           # Detailed view
calmhive afk tail <session-id>   # Live logs
calmhive afk stop <session-id>   # Stop session
```

## When to Use Each Command

| Command | Use Case | Mode | Example |
|---------|----------|------|---------|
| `chat` | Questions, exploration, debugging | Interactive | "How does this code work?" |
| `run` | Tasks, fixes, automation | Headless | "Fix the login bug" |
| `voice` | Hands-free interaction | Interactive | Voice input |
| `tui` | Process monitoring | Interactive | Visual process management |
| `afk` | Long-running tasks | Background | Multi-step analysis |

## Architecture Highlights

- **Clean Separation**: Interactive (`chat`) vs Headless (`run`) vs Background (`afk`)
- **True Automation**: Proper stdin handling enables genuinely non-interactive execution
- **MCP Integration**: 97 tools available including Memento, Sequential Thinking, Playwright
- **Adaptive Retry**: Intelligent handling of Claude API usage limits
- **Context Compression** (v3.2.0+): Automatic `/compact` handling when approaching context limits
- **Process Management**: SQLite-backed session tracking with beautiful TUI

## Implementation Details

### Chat Command
- Direct passthrough to Claude
- Automatically adds all 97 tools (16 default + 81 MCP)
- Supports all Claude flags unchanged
- Uses `stdio: 'inherit'` for full interactivity

### Run Command  
- Uses Claude `-p` flag correctly
- Pipes stdin (like AFk) for true headless execution
- Smart prompting encourages MCP tool usage
- Includes verification requirements
- No `stdio: 'inherit'` - truly non-interactive

### Smart Prompting in Run
The `run` command automatically enhances your task with:
- Instructions to use MCP tools appropriately
- Sequential thinking for complex analysis
- Verification requirements
- Knowledge storage suggestions
- Protocol compliance ("lets bee friends")

## Tool Access & MCP Setup

All commands have access to 97 tools:
- **16 Default Tools**: File ops, search, bash, web tools, etc.
- **81 Safe MCP Tools**: Read-only operations across 10 MCP servers
  - Memento: Knowledge graph operations
  - Sequential Thinking: Structured analysis  
  - GitHub/GitMCP: Code research
  - Playwright: Browser automation
  - And more...

### Setting Up MCP Tools

**IMPORTANT**: Calmhive requires Claude Max, Pro, or Teams subscription for MCP (Model Context Protocol) tools. Claude Free users can use basic chat/run commands but advanced features are limited.

> **Why Claude Max?** While Pro/Teams subscriptions work perfectly, Claude Max offers 5-20x higher rate limits, making it ideal for long-running AFk sessions and heavy automation workflows.

**Easy Setup**: The fastest way to get MCP tools working is:

1. **Install Claude Desktop** and configure your MCP tools there
2. **Import to Claude CLI**: 
   ```bash
   claude mcp add-from-claude-desktop -s user
   ```
3. **Verify**: Run `calmhive chat "test memento search"` to confirm tools work

For detailed MCP setup instructions, see the [Terminal Velocity blog post](https://github.com/joryeugene/ai-dev-tooling/blob/main/blog/02-terminal-velocity.md#must-use-mcp-tools-amplify-your-ai) which covers installation of essential tools like Memento and Sequential Thinking.

## File Structure

```
v3/
├── bin/calmhive          # Main entry point
├── commands/             # Command implementations
│   ├── chat/            # Interactive Claude
│   ├── run/             # Headless automation
│   ├── afk/             # Background processing
│   ├── voice/           # Voice control
│   └── tui/             # Terminal UI
├── lib/                 # Core libraries
│   ├── adaptive-retry.js     # Usage limit handling
│   ├── process-manager.js    # AFk process control
│   ├── session-database.js   # SQLite session storage
│   ├── tool-manager.js       # MCP tool integration
│   ├── compact-handler.js    # Context compression (v3.2.0+)
│   └── context-monitor.js    # Usage tracking (v3.2.0+)
└── config/
    └── allowed-tools.json    # 97 available tools
```

## Testing

### Run Test Suite
```bash
cd /path/to/calmhive/v3
node tests/run-all-tests.js
```

### Manual Testing
```bash
# Test each command type
calmhive chat "hello"           # Interactive
calmhive run "create test.txt"  # Headless
calmhive afk "analyze" -i 1     # Background
calmhive voice --test           # Voice deps
calmhive tui                   # Process UI
```

## Contributing

1. **Add a Command**: Create new directory in `commands/` with index.js
2. **Add a Tool**: Update `config/allowed-tools.json` with safe MCP tools
3. **Test**: Add tests to `tests/` and update run-all-tests.js
4. **Document**: Update README.md and this file

## Key Components

### Adaptive Retry (`lib/adaptive-retry.js`)
Handles Claude API usage limits with exponential backoff (30s → 60s → 120s → 240s...)

### Process Manager (`lib/process-manager.js`)
Manages AFk background processes with proper cleanup and iteration tracking. In v3.2.0+, includes integrated context compression handling.

### Session Database (`lib/session-database.js`)
SQLite storage for process metadata, logs, and state management

### Compact Handler (`lib/compact-handler.js`) - v3.2.0+
Automatically handles context compression when Claude approaches limits:
- Tries multiple `/compact` command formats for compatibility
- Provides fallback manual compression strategies
- Integrates seamlessly with AFk sessions

### Context Monitor (`lib/context-monitor.js`) - v3.2.0+
Tracks and analyzes context usage patterns:
- Monitors context consumption across iterations
- Logs compression attempts and success rates
- Generates usage reports for optimization

---

**Need help?** Check the [README](../README.md) or run `calmhive <command> --help`