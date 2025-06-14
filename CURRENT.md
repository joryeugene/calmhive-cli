# Calmhive V3 Current State

## Version 3.4.9 Features

### Comprehensive AFk Cleanup System ✅
**Status**: Production Ready
**Implementation**: `lib/cleanup-engine.js` (365 lines)

**Capabilities**:
- Multi-target cleanup: database sessions, orphaned logs, legacy registry
- Advanced options: `--dry-run`, `--force`, `--verbose`, `--legacy-only`, `--db-only`
- Configurable retention policies by session status
- Comprehensive audit logging with space tracking
- Smart command routing for backward compatibility

**Usage**:
```bash
calmhive afk cleanup             # Clean old sessions (7 days)
calmhive afk cleanup --dry-run   # Preview cleanup safely
calmhive afk cleanup 30 --force  # Custom retention, skip prompts
```

### Core AFk System ✅
**Status**: Stable, Production Ready

**Features**:
- **Parallel Execution**: Multiple AFk sessions run simultaneously with unique session IDs
- True background execution with detached worker processes
- SQLite session database with full CRUD operations
- Adaptive retry with exponential backoff for usage limits
- Sleep prevention for sessions >5 iterations (`caffeinate`)
- Context compression with multiple fallback strategies
- Running session protection (never auto-deleted)

**Commands**:
```bash
calmhive afk "task" --iterations 20
calmhive afk status              # List all sessions
calmhive afk status -d           # Detailed view
calmhive afk tail <session-id>   # Live log viewing
calmhive afk stop <session-id>   # Immediate termination
```

### Terminal UI (TUI) ✅
**Status**: Fully Functional
**Implementation**: `commands/tui`

**Features**:
- Real-time session monitoring
- Interactive log viewing
- Session management (start/stop)
- Beautiful blessed-based interface

### Voice Interface ✅
**Status**: Functional (Requires OpenAI API)
**Implementation**: `commands/voice`

**Features**:
- Speech recognition with wake words ("hey friend", "calmhive")
- Text-to-speech responses
- Full command integration
- Debug mode for troubleshooting

### Model Management ✅
**Status**: Automatic Selection Working

**Strategy**:
- Haiku: Quick questions (<20 chars, contains "what is")
- Sonnet: Default for most operations
- Opus: Complex analysis, architecture work
- Manual override with `--model` flag

## Current Capabilities

### Supported Commands
- ✅ `chat` - Interactive Claude sessions
- ✅ `run` - Task execution wrapper
- ✅ `afk` - Background iterations
- ✅ `voice` - Voice control
- ✅ `tui` - Process monitoring
- ✅ `update` - Auto-updates

### File Structure
```
calmhive/v3/
├── bin/calmhive           # Main entry point
├── commands/              # Command implementations
├── lib/                   # Core libraries
│   ├── cleanup-engine.js  # NEW: Comprehensive cleanup
│   ├── session-database.js
│   ├── process-manager.js
│   └── stream-handler.js
├── test/                  # Test suites
│   ├── test-cleanup-engine.js  # NEW: Cleanup tests
│   └── unit/cleanup-engine.test.js
└── data/                  # SQLite database
```

### Dependencies
```json
{
  "blessed": "^0.1.81",      // TUI framework
  "fs-extra": "^11.3.0",    // Enhanced file operations
  "sqlite3": "^5.1.7",      // Session database
  "uuid": "^11.1.0",        // Session ID generation
  "xml2js": "^0.6.2"        // XML parsing for voice
}
```

## Test Coverage

### Cleanup Engine Tests ✅
- 6/6 test cases passing
- Covers all retention policies
- Tests running session protection
- Validates file size calculations

### Main Test Suite ✅
- 18/18 core tests passing
- AFk background execution
- Session database operations
- Process management

### Integration Tests ✅
- Command-line interface
- End-to-end AFk workflows
- Voice system integration

## Configuration

### Default Settings
- AFk max iterations: 69
- Cleanup retention: 7 days (completed), 30 days (failed/error), 14 days (stopped)
- Sleep prevention: Auto-enabled for >5 iterations
- Model selection: Automatic with Sonnet default

### Environment Variables
- `OPENAI_API_KEY`: Required for voice features
- `ANTHROPIC_API_KEY`: Inherited from Claude CLI
- `CALMHIVE_DEBUG`: Enable debug logging

## Known Issues

### Minor Issues
- None currently identified

### Limitations
- Voice requires OpenAI API key
- MCP tools require Claude subscription (Max/Pro/Teams)
- macOS-specific sleep prevention (`caffeinate`)

---

**Current Version**: 3.4.9
**Last Updated**: 2025-06-13
**Production Status**: Published to npm