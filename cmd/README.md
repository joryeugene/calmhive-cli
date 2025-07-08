# Calmhive v3 Commands Directory

The `cmd/` directory contains all executable command implementations for the Calmhive CLI. Each file represents a distinct command that can be invoked through the main `calmhive` dispatcher.

## Command Architecture

### Naming Convention
- Single letter aliases (e.g., `a` for `afk`, `c` for `chat`)
- Full descriptive names for primary commands
- All commands are executable Node.js scripts with `#!/usr/bin/env node`

### Command Structure
```javascript
#!/usr/bin/env node

// Command implementation with:
// - Argument parsing and validation
// - Help text and usage examples
// - Error handling and user feedback
// - Integration with lib/ modules
```

## Available Commands

### Core Workflow Commands

#### `afk` (alias: `a`)
**Background processing and session management**
- Start long-running Claude sessions with adaptive retry
- Monitor session status and progress
- Tail logs in real-time
- Stop and resume sessions
- Clean up orphaned processes

```bash
calmhive afk "analyze codebase" --iterations 10
calmhive afk status --detailed
calmhive afk tail afk-12345
calmhive afk stop afk-12345
```

#### `chat` (alias: `c`)
**Interactive conversation interface**
- Direct Claude interaction with rule injection
- Conversation continuity and context management
- Tool integration and command execution
- Real-time response streaming

```bash
calmhive chat "help me debug this function"
calmhive chat --model opus "complex architectural question"
```

#### `run` (alias: `r`)
**Single-task execution**
- Execute specific tasks with Claude
- Automatic tool selection and execution
- Result validation and reporting
- Integration with existing workflows

```bash
calmhive run "fix all TypeScript errors"
calmhive run --dry-run "refactor authentication module"
```

### Configuration Commands

#### `config`
**Template and settings management**
- Install and update CLAUDE.md templates
- Sync configuration across environments
- Validate template versions
- Manage rule injection settings

```bash
calmhive config install
calmhive config show
calmhive config sync
calmhive config validate
```

#### `setup`
**Initial system configuration**
- First-time setup and validation
- Dependency checks and installation
- Configuration file creation
- Tool integration verification

```bash
calmhive setup
calmhive setup --validate
calmhive setup --repair
```

### Monitoring Commands

#### `tui` (alias: `t`)
**Terminal user interface**
- Real-time session monitoring dashboard
- Interactive log viewing and filtering
- Session management and control
- System status and health monitoring

```bash
calmhive tui
calmhive tui --focus sessions
calmhive tui --logs afk-12345
```

#### `progress`
**Progress tracking and reporting**
- Detailed iteration analysis
- Performance metrics and trends
- Progress visualization
- Export capabilities

```bash
calmhive progress afk-12345
calmhive progress --summary --last-week
calmhive progress --export csv
```

### Advanced Features

#### `voice` (alias: `v`)
**Voice interface and control**
- Voice-to-text command recognition
- Hands-free Claude interaction
- Background voice monitoring
- Custom trigger word configuration

```bash
calmhive voice
calmhive voice --calibrate
calmhive voice --background
```

#### `schedule`
**Task scheduling and automation**
- Cron-based task scheduling
- Automated AFk session creation
- Recurring task management
- Schedule validation and testing

```bash
calmhive schedule add "daily backup" "0 2 * * *"
calmhive schedule list
calmhive schedule run backup-task
```

#### `work` (alias: `w`) - HIDDEN COMMAND
**Intelligent task execution wrapper**
- Automatic task complexity analysis
- Smart model selection (haiku/sonnet/opus)
- Optimal iteration count determination
- Seamless AFk integration with smart defaults

```bash
calmhive work "fix the login bug"
calmhive work "implement user profiles" --iterations 5
calmhive work "refactor authentication" --model opus
calmhive work "add dark mode toggle" --dry-run
```

### Utility Commands

#### `template`
**Template management and customization**
- Create custom command templates
- Share and import template collections
- Template validation and testing
- Version control integration

```bash
calmhive template create bug-hunting
calmhive template import ./custom-templates
calmhive template validate
```

#### `intercept`
**Debugging and interception tools**
- Network request monitoring
- Rule injection testing
- Debug mode activation
- Performance profiling

```bash
calmhive intercept enable
calmhive intercept status
calmhive intercept logs --tail
```

## Command Implementation Pattern

### Standard Structure
All commands follow this implementation pattern:

```javascript
#!/usr/bin/env node

const RequiredModules = require('../lib/required-modules');

class CommandName {
  constructor() {
    // Initialize dependencies
  }

  async execute() {
    // Parse arguments
    // Validate inputs
    // Execute command logic
    // Handle errors gracefully
  }

  showHelp() {
    // Comprehensive help text
    // Usage examples
    // Option descriptions
  }

  // Additional methods as needed
}

// Execute if called directly
if (require.main === module) {
  const command = new CommandName();
  command.execute().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = CommandName;
```

### Argument Parsing
Commands use consistent argument parsing patterns:
- Option flags with `--` prefix
- Short aliases with `-` prefix
- Positional arguments for required values
- Help flags (`--help`, `-h`) always supported

### Error Handling
All commands implement comprehensive error handling:
- User-friendly error messages
- Proper exit codes (0 for success, 1+ for errors)
- Graceful degradation when possible
- Debug information for troubleshooting

### Help System
Each command provides detailed help information:
- Command description and purpose
- Usage syntax with examples
- Option descriptions and defaults
- Common use cases and workflows

## Integration with Main Dispatcher

### Command Discovery
The main `calmhive` binary automatically discovers commands by:
1. Scanning the `cmd/` directory for executable files
2. Mapping aliases to full command names
3. Providing command suggestions for typos
4. Generating dynamic help based on available commands

### Argument Forwarding
Arguments are forwarded from the main dispatcher:
```bash
calmhive <command> <args...>
# Becomes:
./cmd/<command> <args...>
```

### Environment Setup
Commands inherit environment from the main process:
- Working directory preservation
- Environment variable access
- Signal handling for graceful shutdown
- Logging configuration

## Development Guidelines

### Adding New Commands
1. Create executable file in `cmd/` directory
2. Follow the standard implementation pattern
3. Add comprehensive help text and examples
4. Include unit and integration tests
5. Update this documentation

### Testing Commands
- Unit tests for command logic in `test/unit/`
- Integration tests for end-to-end workflows
- Manual testing documentation in `test/manual/`
- Error scenario validation

### Documentation Requirements
- Inline code documentation with JSDoc
- Help text with clear examples
- Integration patterns with other commands
- Error handling and troubleshooting guides

### Performance Considerations
- Fast startup time (< 1 second for simple commands)
- Efficient argument parsing
- Lazy loading of heavy dependencies
- Proper resource cleanup

## Command Dependencies

### Shared Libraries
Most commands depend on core libraries:
- `lib/process-manager.js` - Session management
- `lib/config-manager.js` - Configuration handling
- `lib/path-manager.js` - Path resolution
- `lib/session-database.js` - Data persistence

### External Tools
Some commands integrate with external tools:
- `claude` - Claude Code CLI (required)
- `caffeinate` - Sleep prevention (macOS)
- `ps` - Process monitoring (Unix)
- `node` - Runtime for workers

### Optional Dependencies
Advanced features may require:
- Python - Voice recognition
- SQLite - Session persistence
- System tools - Process management

---

For specific command documentation, run `calmhive <command> --help` or see the individual command source files for detailed implementation notes.