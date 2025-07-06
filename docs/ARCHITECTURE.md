# Calmhive v14.0.0 Architecture

> Technical guide for understanding and extending Calmhive CLI

## Overview
Calmhive v14.0.0 features a **comprehensive 6-command architecture** that provides clear separation between interactive chat, headless automation, background processing, and scheduled automation. Built on Node.js with MCP integration for powerful tools and natural language scheduling.

**[⬅️ Back to README](../README.md)** | **[🌐 Calmhive.com](https://calmhive.com/)** | **[🔗 Prompthive.sh](https://prompthive.sh/)**

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
- ✅ Auto tool access (86 tools: 15 core + 71 MCP integrations)
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
- ✅ Comprehensive tool integration
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

### 📅 `calmhive schedule` - Automated Task Scheduling
**Purpose**: Natural language cron scheduling with Claude integration

```bash
# Create scheduled tasks
calmhive schedule create "daily at 9am" "calmhive run 'analyze security logs'"
calmhive schedule create "weekly on Friday" "calmhive afk 'generate reports' --iterations 5"

# Manage schedules
calmhive schedule list           # Show all scheduled tasks
calmhive schedule status         # Check schedule daemon
calmhive schedule stop <id>      # Remove scheduled task
```

## When to Use Each Command

| Command | Use Case | Mode | Example |
|---------|----------|------|---------|
| `chat` | Questions, exploration, debugging | Interactive | "How does this code work?" |
| `run` | Tasks, fixes, automation | Headless | "Fix the login bug" |
| `voice` | Hands-free interaction | Interactive | Voice input |
| `tui` | Process monitoring | Interactive | Visual process management |
| `afk` | Long-running tasks | Background | Multi-step analysis |
| `schedule` | Automated recurring tasks | Daemon | "Daily security audit" |

## Architecture Highlights

- **Clean Separation**: Interactive (`chat`) vs Headless (`run`) vs Background (`afk`) vs Scheduled (`schedule`)
- **True Automation**: Proper stdin handling enables genuinely non-interactive execution
- **Natural Language Scheduling**: Convert "daily at 9am" to cron expressions via ClaudeCronParser
- **Template System**: Variable substitution for complex automation workflows
- **MCP Integration**: 95+ tools available including Sequential Thinking, Playwright, GitHub, Asana
- **Adaptive Retry**: Intelligent handling of Claude API usage limits
- **Context Compression**: Automatic `/compact` handling when approaching context limits
- **Process Management**: SQLite-backed session tracking with beautiful TUI

## Implementation Details

### Chat Command
- Direct passthrough to Claude
- Automatically adds all 95+ tools (15 core + 80+ MCP integrations)
- Supports all Claude flags unchanged
- Uses `stdio: 'inherit'` for full interactivity

### Run Command  
- Uses Claude `-p` flag correctly
- Pipes stdin (like AFk) for true headless execution
- Smart prompting encourages MCP tool usage
- Includes verification requirements
- No `stdio: 'inherit'` - truly non-interactive

### Schedule Command
- Natural language cron scheduling via ClaudeCronParser
- Template variable substitution support
- Background daemon manages scheduled tasks
- Integrates with AFk for complex automation workflows
- JSON-based schedule persistence

### Smart Prompting in Run
The `run` command automatically enhances your task with:
- Instructions to use MCP tools appropriately
- Sequential thinking for complex analysis
- Verification requirements
- Knowledge storage suggestions
- Protocol compliance ("lets bee friends")

## Tool Access & MCP Setup

All commands have access to 95+ tools:
- **15 Default Tools**: File ops, search, bash, web tools, etc.
- **80+ Safe MCP Tools**: Read-only operations across 10+ MCP servers
  - Memento: Knowledge graph operations
  - Sequential Thinking: Structured analysis  
  - GitHub/GitMCP: Code research
  - Playwright: Browser automation
  - Context7: Library documentation
  - Figma: Design file access
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
3. **Verify**: Run `calmhive chat "test sequential thinking"` to confirm tools work

For detailed MCP setup instructions, see the [Terminal Velocity blog post](http://jorypestorious.com/blog/terminal-velocity/) which covers installation of essential tools like Sequential Thinking.

## File Structure

```
v3/
├── bin/calmhive          # Main entry point
├── cmd/                  # Command implementations
│   ├── chat             # Interactive Claude
│   ├── run              # Headless automation
│   ├── afk              # Background processing
│   ├── voice            # Voice control
│   ├── tui              # Terminal UI
│   ├── schedule         # Natural language scheduling
│   └── work             # Intelligent task automation
├── lib/                 # Core libraries
│   ├── adaptive-retry.js       # Usage limit handling
│   ├── process-manager.js      # AFk process control
│   ├── session-database.js     # SQLite session storage
│   ├── tool-manager.js         # MCP tool integration
│   ├── compact-handler.js      # Context compression 
│   ├── context-monitor.js      # Usage tracking
│   └── scheduler/              # Scheduling engine
│       ├── schedule-engine.js  # Core scheduling logic
│       └── claude-cron-parser.js # Natural language to cron
└── config/
    └── allowed-tools.json      # 95+ available tools (15 core + 80+ MCP)
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
calmhive schedule list          # Scheduling
calmhive work "fix bug"         # Smart automation
```

## Contributing

1. **Add a Command**: Create new file in `cmd/` directory following existing patterns
2. **Add a Tool**: Update `config/allowed-tools.json` with safe MCP tools
3. **Test**: Add tests to `tests/` and update run-all-tests.js
4. **Document**: Update README.md and this file

## Key Components

### Adaptive Retry (`lib/adaptive-retry.js`)
Handles Claude API usage limits with exponential backoff (30s → 60s → 120s → 240s...)

### Process Manager (`lib/process-manager.js`)
Manages AFk background processes with proper cleanup and iteration tracking. Includes integrated context compression handling.

### Session Database (`lib/session-database.js`)
SQLite storage for process metadata, logs, and state management

### Schedule Engine (`lib/scheduler/schedule-engine.js`)
Core scheduling logic for managing cron-based automation:
- Daemon process management
- Task execution coordination
- Error handling and retry logic
- Schedule persistence and restoration

### Claude Cron Parser (`lib/scheduler/claude-cron-parser.js`)
Natural language to cron expression conversion:
- Converts "daily at 9am" to "0 9 * * *"
- Supports complex scheduling patterns
- Validates and normalizes expressions
- JSON output format for automation

### Compact Handler (`lib/compact-handler.js`)
Automatically handles context compression when Claude approaches limits:
- Tries multiple `/compact` command formats for compatibility
- Provides fallback manual compression strategies
- Integrates seamlessly with AFk sessions

### Context Monitor (`lib/context-monitor.js`)
Tracks and analyzes context usage patterns:
- Monitors context consumption across iterations
- Logs compression attempts and success rates
- Generates usage reports for optimization

---

**Need help?** Check the [README](../README.md) or run `calmhive <command> --help`

---

## 🔗 Links & Resources

- **[Calmhive.com](https://calmhive.com/)** - Official website with demos and getting started guides  
- **[Prompthive.sh](https://prompthive.sh/)** - Perfect companion for prompt management and automation
- **[GitHub Repository](https://github.com/joryeugene/calmhive-cli)** - Source code, issues, and contributions
- **[npm Package](https://www.npmjs.com/package/@calmhive/calmhive-cli)** - Installation and version history