# 🐝 Calmhive v8.0.0 - Claude That Never Quits

> Enhance Claude CLI with AFk iterative sessions, usage limit recovery, voice control, and process monitoring.

## ⚠️ CRITICAL SECURITY WARNING ⚠️

**CALMHIVE IS A POWERFUL TOOL THAT GIVES CLAUDE AI DIRECT ACCESS TO YOUR SYSTEM. BY USING THIS SOFTWARE, YOU ACCEPT FULL RESPONSIBILITY FOR ANY ACTIONS IT MAY TAKE.**

### 🚨 POTENTIAL RISKS:
- **File System Destruction**: Claude can execute `rm -rf`, `rsync --delete`, or other destructive commands that could completely wipe your files
- **Data Loss**: Your personal notes, second brain, knowledge bases, or any directory could be permanently deleted
- **System Modifications**: Claude can modify system files, install/uninstall software, change configurations
- **Network Access**: Claude can make network requests, upload/download files, interact with APIs
- **Code Execution**: Claude can run arbitrary code in any programming language on your system
- **Privilege Escalation**: If run with elevated permissions, Claude could modify system-critical files

### 📋 REQUIRED SAFETY MEASURES:

**BEFORE USING CALMHIVE:**

1. **BACKUP EVERYTHING**:
   - Create complete system backups (Time Machine, etc.)
   - Backup critical data to remote locations (cloud storage, external drives)
   - Ensure you can restore your entire system if needed

2. **Version Control**:
   - Use Git for ALL projects - local Git repos are NOT sufficient backup
   - Push to remote repositories (GitHub, GitLab, etc.) regularly
   - Consider your local Git history expendable

3. **Isolation Strategies**:
   - Run Calmhive in sandboxed environments when possible
   - Avoid running with sudo/admin privileges unless absolutely necessary
   - Consider using containers or VMs for risky operations

4. **Monitoring**:
   - Regularly review what commands Claude is executing
   - Stop immediately if you see unexpected destructive commands
   - Use `calmhive afk status` to monitor background processes

### 🛡️ THIS IS NOT A TOY
This tool amplifies Claude's capabilities to include direct system control. While powerful for productivity, it's equally capable of causing irreversible damage. **A simple miscommunication or AI misunderstanding could result in complete data loss.**

### 💾 DID YOU BACKUP?
- Is your entire file system backed up remotely?
- Are your personal notes/knowledge base in cloud storage?
- Can you recover if your home directory gets deleted?
- Are your Git repositories pushed to remote origins?

**If you answered "no" to any of these questions, STOP and create proper backups before proceeding.**

By continuing to use Calmhive, you acknowledge these risks and confirm you have taken appropriate precautions.

[![npm version](https://img.shields.io/npm/v/@calmhive/calmhive-cli.svg)](https://www.npmjs.com/package/@calmhive/calmhive-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Install

### Option 1: npm (Recommended)
```bash
npm install -g @calmhive/calmhive-cli
```

### Option 2: Git Clone + PATH Setup
```bash
# Clone the repository
git clone https://github.com/joryeugene/calmhive-cli.git $HOME/repos/calmhive-cli

# Add to your PATH (choose your shell)
# For bash (~/.bashrc or ~/.bash_profile):
echo 'export PATH="$HOME/repos/calmhive-cli/bin:$PATH"' >> ~/.bashrc

# For zsh (~/.zshrc):
echo 'export PATH="$HOME/repos/calmhive-cli/bin:$PATH"' >> ~/.zshrc

# Reload your shell
source ~/.bashrc  # or ~/.zshrc

# Test it works
calmhive --help
```

**Prerequisites**:
- Node.js 18+
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) with Max/Pro/Teams subscription (for MCP tools)
- OpenAI API key (for voice features only)

## ✨ Why Calmhive?

- **🔄 Adaptive Retry** - Automatically recovers from Claude usage limits with exponential backoff
- **🎙️ Voice Control** - Say "hey friend" or "calmhive" to activate voice commands
- **🔧 MCP Tools** - Optional access to Sequential Thinking, Playwright, GitHub integration (when configured)
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
calmhive afk "refactor entire codebase" --iterations 20  # Auto sleep prevention
calmhive afk "overnight task" --iterations 50            # Max: 69 iterations
calmhive afk "quick fix" --iterations 3 --no-prevent-sleep  # No caffeinate
calmhive afk status              # Check all running tasks
calmhive afk status -d           # Detailed view with full task info
calmhive afk tail abc-123        # Watch live progress
calmhive afk stop abc-123        # Stop a task
calmhive afk cleanup             # Clean old sessions (7 days)
calmhive afk cleanup --dry-run   # Preview cleanup safely
calmhive afk cleanup 30 --force  # Custom retention, skip prompts
```

### `voice` - Voice Control (alias: `v`)
Full-featured voice interface with speech recognition and text-to-speech.
```bash
calmhive voice                   # Start voice interface
calmhive voice --debug           # Debug mode
# Say "hey friend", "calmhive", or "ok friend" to activate
```

### `update` - Update Calmhive
Automatically update to the latest version from npm.
```bash
calmhive update                  # Update to latest version
```

### `tui` - Terminal UI (alias: `t`)
Beautiful interface to monitor and manage all sessions.
```bash
calmhive tui                     # Launch the UI
# Use arrow keys to navigate, Enter to view logs
```

## 🔥 Killer Features

### Adaptive Retry with Usage Limits
Ever had an overnight task die at iteration 10 due to usage limits? Not anymore!

```
Iteration 10 ✓
⚠️ Usage limit detected
⏳ Waiting 60s before retry...
⏳ Waiting 120s before retry...
✅ Iteration 11 started!
```

Calmhive automatically detects and handles usage limits with exponential backoff.

### Sleep Prevention for Long Sessions (v3.3.0+)
Your MacBook won't sleep during long AFk sessions:

```
☕ Sleep prevention enabled (caffeinate PID: 12345)
🚀 Starting iteration 1 of 50
... runs all night without interruption ...
☕ Sleep prevention disabled (caffeinate stopped)
```

Automatic for sessions >5 iterations, disable with `--no-prevent-sleep`.

### Automatic Context Compression (v3.2.0+)
When Claude hits context limits, Calmhive automatically attempts multiple strategies to compress the conversation:

```
⚠️ Context limit approaching
🗜️ Attempting context compression...
✅ Context compressed successfully!
```

Features:
- Multiple `/compact` command formats for compatibility
- Automatic retry with different compression strategies
- Context usage monitoring and reporting
- Fallback manual compression if needed

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

**Command not found after npm install?**
```bash
# Add npm global binaries to PATH:
export PATH="$PATH:$(npm prefix -g)/bin"

# Or find where npm installs global packages:
npm prefix -g
```

**Permission errors with npm?**
```bash
# Use npx to run without global install:
npx @calmhive/calmhive-cli chat "hello"

# Or use the git clone method above for full control
```

**Git clone setup example:**
```bash
# Create repos directory if it doesn't exist
mkdir -p $HOME/repos

# Clone and setup
git clone https://github.com/joryeugene/calmhive-cli.git $HOME/repos/calmhive-cli

# Add to PATH (same as Option 2 above)
echo 'export PATH="$HOME/repos/calmhive-cli/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Test it works
calmhive --help
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

### 📝 CLAUDE.md for Persistent Context

Create a `~/.claude/CLAUDE.md` file to provide persistent context across all Claude sessions:
- Global coding preferences and standards
- Frequently used tools and workflows
- Custom instructions for your AI assistant

**Choose the right template:**
- `CLAUDE.md.example` - For Claude Code CLI (includes TodoRead/Write, Batch tools)
- `CLAUDE-DESKTOP.md.example` - For Claude Desktop app (optimized for desktop environment)

Copy to your Claude configuration and customize as needed. Learn more in the [Terminal Velocity guide](http://jorypestorious.com/blog/terminal-velocity/).

### 🔄 AFk Session Best Practices

**Sleep Prevention (v3.3.0+)**
```bash
# Automatic for >5 iterations - your Mac stays awake!
calmhive afk "big project" --iterations 20  # ☕ caffeinate enabled

# Disable if you prefer manual sleep control
calmhive afk "small task" --iterations 8 --no-prevent-sleep
```

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
calmhive afk "comprehensive testing" -i 69  # Max iterations increased!
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

## 🎯 Power User Configuration

Calmhive includes an advanced **CLAUDE.md.example** file with powerful directives that transform Claude's behavior:

### 🔥 "Secret Sauce" Features
- **Thoroughness Engine**: "We gain trust through thoroughness" - ensures Claude reads every detail
- **Specification-First Development**: Clear specs → flawless execution ([based on this approach](http://jorypestorious.com/blog/ai-engineer-spec/))
- **Parallelization Strategy**: MultiEdit batch operations, concurrent tool usage
- **Verification Protocol**: Never claims "it's fixed" without concrete proof
- **Optional MCP Integration**: Sequential Thinking, Playwright, GitHub integration (if configured)

### ⚡ Quick Setup
```bash
# 1. Find your calmhive installation
CALMHIVE_PATH="$(npm root -g)/@calmhive/calmhive-cli"
echo "Calmhive installed at: $CALMHIVE_PATH"

# 2. Copy the enhanced directives to your global Claude config
cp "$CALMHIVE_PATH/CLAUDE.md.example" ~/.claude/CLAUDE.md

# 3. Configure available tools based on your MCP setup
# Check what MCP tools you have configured
claude mcp list

# 4. Edit tool allowlist to match your setup
nano "$CALMHIVE_PATH/config/allowed-tools.json"
# Remove any MCP tools you don't have installed
# Keep the 16 default tools (Read, Edit, Bash, etc.)

# 5. Test the enhanced behavior
calmhive chat "analyze this codebase"  # Watch the difference!
```

The **v4.3.0 CLAUDE.md** transforms Claude from a helpful assistant into an engineering powerhouse that:
- ✅ Reads every detail before acting
- ✅ Uses parallel operations for maximum speed  
- ✅ Tests solutions comprehensively before reporting success
- ✅ Follows specification-first development principles
- ✅ Integrates with optional MCP tools when configured

## 📖 Documentation

### Core Documentation
- **[SPEC.md](SPEC.md)** - Technical specification and architecture
- **[CURRENT.md](CURRENT.md)** - Current features and capabilities  
- **[DELTA.md](DELTA.md)** - Roadmap and future development
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes

### Guides & Resources
- **[Blog Post](http://jorypestorious.com/blog/calmhive/)** - Full story behind Calmhive
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
