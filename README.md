# 🐝 Calmhive: Claude That Never Quits

> Enhance Claude CLI with AFk iterative sessions, usage limit recovery, voice control, and process monitoring.

[![npm version](https://img.shields.io/npm/v/@calmhive/calmhive-cli.svg)](https://www.npmjs.com/package/@calmhive/calmhive-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Install

```bash
npm install -g @calmhive/calmhive-cli
```

**Prerequisites**: 
- Node.js 18+
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) with Max/Pro/Teams subscription (for MCP tools)
- OpenAI API key (for voice features only)

## ✨ Why Calmhive?

- **🔄 Adaptive Retry** - Automatically recovers from Claude usage limits with exponential backoff
- **🎙️ Voice Control** - Say "hey friend" or "calmhive" to activate voice commands
- **📊 97 MCP Tools** - Pre-approved access to Memento, Sequential Thinking, Playwright, and more
- **🏃 AFk Iterations** - Run multiple Claude sessions sequentially in the background
- **🖥️ Process Management** - Beautiful TUI to monitor all your AFk sessions

## 🎯 Quick Start

```bash
# Chat with Claude interactively
calmhive chat "explain this useEffect dependency array"

# Run a task (wrapper for claude run with tools)
calmhive run "add TypeScript types to all .js files in src/"

# Long task in background (with adaptive retry!)
calmhive afk "audit npm dependencies for vulnerabilities" --iterations 15

# Control with your voice
calmhive voice  # Say "hey friend, analyze this codebase"

# Monitor everything
calmhive tui    # See all running sessions in one place
```

## 📚 Commands

### `chat` - Interactive Conversation (alias: `c`)
Talk to Claude with full access to 97 tools. Supports all Claude flags.
```bash
calmhive chat                    # Start interactive session
calmhive c "debug this error"    # Quick question
calmhive chat -c                 # Continue previous conversation
```

### `run` - Task Execution (alias: `r`)  
Wrapper for `claude run` with automatic tool approval. Perfect for scripts and CI/CD.
```bash
calmhive run "add type annotations to services/auth.js"
calmhive r "find and fix n+1 queries in the API"
calmhive run "migrate database schema to TypeScript"
```

### `afk` - Away From Keyboard Iterations (alias: `a`)
Run multiple Claude sessions sequentially with automatic retry on usage limits.
```bash
calmhive afk "refactor entire codebase" --iterations 20
calmhive afk status              # Check all running tasks
calmhive afk status -d           # Detailed view with full task info
calmhive afk tail abc-123        # Watch live progress
calmhive afk stop abc-123        # Stop a task
```

### `voice` - Voice Control (alias: `v`)
Full-featured voice interface with speech recognition and text-to-speech.
```bash
calmhive voice                   # Start voice interface  
calmhive voice --debug           # Debug mode
# Say "hey friend", "calmhive", or "ok friend" to activate
```

### `tui` - Terminal UI (alias: `t`)
Beautiful interface to monitor and manage all sessions.
```bash
calmhive tui                     # Launch the UI
# Use arrow keys to navigate, Enter to view logs
```

## 🔥 Killer Feature: Adaptive Retry

Ever had an overnight task die at iteration 10 due to usage limits? Not anymore!

```
Iteration 10 ✓
⚠️ Usage limit detected
⏳ Waiting 60s before retry...
⏳ Waiting 120s before retry... 
✅ Iteration 11 started!
```

Calmhive automatically detects and handles usage limits with exponential backoff.

## 🚦 What's Next?

After installation:
1. Run `calmhive chat` to start interactive mode
2. Try `calmhive run "create a hello world script"` for automation
3. Use `calmhive voice` to enable voice control
4. Explore with `calmhive --help`

## 🛠️ Advanced Usage

### Use Different Models
```bash
calmhive chat --model opus "complex analysis"
calmhive run --model sonnet "standard task"
```

### Pipe Input/Output
```bash
cat code.js | calmhive chat -p "review this"
calmhive run "generate SQL schema" > schema.sql
```

### Custom AFk Iterations
```bash
# Simple prompt mode
calmhive afk "task" --simple --iterations 5

# Advanced mode with sequential thinking
calmhive afk "complex task" --custom-steps --iterations 25
```

## 🔧 Installation Troubleshooting

**Command not found?**
```bash
# Add to your shell profile:
export PATH="$PATH:$(npm prefix -g)/bin"
```

**Permission errors?**
```bash
# Use a Node version manager instead:
npx @calmhive/calmhive-cli chat "hello"
```

**Claude CLI missing?**
Install from [claude.ai/claude-cli](https://docs.anthropic.com/en/docs/claude-cli)

**Best with Claude Max!**
While Pro/Teams work great, Claude Max offers the highest rate limits for heavy automation workflows.

**Voice not working?**
```bash
# Install uv package manager if needed:
curl -LsSf https://astral.sh/uv/install.sh | sh

# Set OpenAI API key:
export OPENAI_API_KEY=your_key_here

# Start voice interface:
calmhive voice
```

**MCP Tools not available?**
Calmhive requires Claude Max, Pro, or Teams subscription for MCP (Model Context Protocol) tools. With Claude Free, basic chat/run commands work but advanced features are limited.

**Need detailed MCP setup?**
See our comprehensive [MCP Setup Guide](docs/MCP_SETUP.md) for step-by-step instructions on configuring essential tools like Sequential Thinking and OmniSearch.

## 💡 Tips & Tricks

### 🔄 AFk Session Best Practices

**Stopping AFk Sessions**
```bash
# ❌ DON'T use Ctrl+C (won't work - AFk runs in background)
# ✅ DO use proper stop command:
calmhive afk stop <session-id>
```

**Continue Where You Left Off**
```bash
# After an AFk session completes, pick up the conversation:
calmhive chat -c  # Claude remembers the context!
```

**Monitor Progress**
```bash
calmhive afk status           # See all sessions
calmhive afk tail <session>   # Watch live logs
calmhive tui                  # Visual interface
```

### ⚠️ Common Issues & Solutions

**Mixed Console Output**
If you see iterations jumping (1 → 3), you may have multiple AFk processes:
```bash
ps aux | grep "commands/afk"  # Check for duplicates
kill <pid>                    # Kill orphan processes
```

**Long Tasks Timing Out**
AFk sessions can run for hours - no artificial timeouts!
```bash
# These will run as long as needed:
calmhive afk "complex refactoring" -i 30
calmhive afk "comprehensive testing" -i 50
```

**Usage Limit Recovery**
Calmhive automatically handles rate limits with exponential backoff:
```
✅ Iteration 5 complete
⚠️ Usage limit detected  
⏳ Waiting 30s → 1m → 2m → 4m...
✅ Iteration 6 started!
```

### 🚀 Workflow Power Tips

**Chaining Commands**
```bash
# 1. Run AFk session for bulk work
calmhive afk "audit security vulnerabilities" -i 10

# 2. After completion, dive deeper interactively  
calmhive chat -c "focus on the critical ones"

# 3. Or run follow-up automation
calmhive run "apply the security fixes you identified"
```

**Smart Model Selection**
```bash
calmhive chat --model sonnet "standard work"     # Balanced (default)
calmhive afk --model sonnet "standard work" -i 5 # Balanced performance
calmhive chat --model opus "complex analysis"    # Most capable
```

**Pipe Workflows**
```bash
# Process files through Claude
find . -name "*.js" | calmhive chat -p "list potential bugs in these files"

# Generate and save output
calmhive run "create comprehensive test suite" > test-plan.md
```

**Using Prompt Files**
```bash
# Pass a markdown file as AFk task description
calmhive afk "$(cat prompt.md)" --iterations 20

# Use complex prompts from files
calmhive chat "$(cat detailed-instructions.md)"
calmhive run "$(cat build-script-prompt.md)"
```

**Voice + AFk Combo**
```bash
# Start voice interface
calmhive voice

# Say: "Start an AFk session to refactor the entire authentication system with 20 iterations"
# Then monitor with TUI while doing other work!
```

### 🎯 Pro Tips

- **Context Continuity**: Use `chat -c` after AFk to maintain conversation history
- **Background Monitoring**: Keep `calmhive tui` open in a separate terminal  
- **Smart Iterations**: 5-15 iterations for most tasks, 20+ for major refactoring
- **Clean Shutdown**: Always use `afk stop` instead of killing terminals
- **Model Efficiency**: Sonnet for most work (default), Opus for complex reasoning

## 📖 More Info

- **[Architecture Guide](docs/ARCHITECTURE.md)** - Detailed command documentation
- **[MCP Setup Guide](docs/MCP_SETUP.md)** - Configure powerful MCP tools
- **[npm Package](https://www.npmjs.com/package/@calmhive/calmhive-cli)** - Version history
- **[GitHub Repository](https://github.com/joryeugene/calmhive-cli)** - Source code & issues
- **[Try Claude AI](https://claude.ai/referral/rb3lQwQWDg)** - Get started with Claude (referral link)

## 🤝 Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [architecture docs](docs/ARCHITECTURE.md) to understand the codebase.

## 📄 License

MIT © 2025 Jory

---

**lets bee friends** 🐝🌟