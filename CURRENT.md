# Calmhive V3 Current State

## Version 8.0.1 - Production Ready CLI Wrapper with Namespace Architecture

### Config Management System ✅
**Status**: Production Ready
**Implementation**: `lib/config-manager.js`, `commands/config`

**Capabilities**:
- **Template Distribution**: CLAUDE.md templates included in npm package
- **Smart Resolution**: Automatically finds templates in npm vs development environments
- **Anti-Fabrication Protection**: Enhanced templates prevent AI fabrication
- **Binary Thinking Prevention**: Stops overcorrection patterns
- **Safe Operations**: Automatic backups, dry-run mode, validation
- **Command File Sync**: 7 workflow templates (3 expert personas + 4 workflows) for external tools

**Usage**:
```bash
calmhive config show                    # Current status
calmhive config install                 # Install CLI template
calmhive config install --desktop       # Install desktop template
calmhive config diff                    # Compare with template
calmhive config commands copy ~/dest/   # Copy command files
```

### AFk Cleanup System ✅
**Status**: Production Ready
**Implementation**: `lib/cleanup-engine.js`

**Simple Capabilities**:
- Clean old sessions and logs automatically
- Safe preview with `--dry-run` 
- Force cleanup with `--force` for scripts
- Keeps running sessions safe (never deletes)
- Smart retention: 7 days completed, 30 days failed, 14 days stopped

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
├── bin/calmhive           # Main entry point (updated for centralized paths)
├── cmd/                   # NEW: Executable command files
│   ├── afk, a             # Background processing commands
│   ├── chat, c            # Interactive chat commands
│   ├── config             # Configuration management
│   ├── run, r             # Task execution commands
│   ├── tui, t             # Terminal UI commands
│   └── voice, v           # Voice interface commands
├── commands/              # Claude Code markdown templates (preserved)
│   ├── expert-*.md        # Expert persona templates
│   ├── bug-hunting.md     # Workflow templates
│   └── *.md               # Additional templates
├── lib/                   # Core libraries
│   ├── path-manager.js    # NEW: Centralized path resolution
│   ├── cleanup-engine.js  # Comprehensive cleanup
│   ├── session-database.js
│   ├── process-manager.js
│   └── stream-handler.js
├── test/                  # Test suites (updated for new paths)
│   ├── test-cleanup-engine.js
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

### Production Test Suite ✅
- **NPM Installation Tests**: 10/10 passing - all commands work when installed via npm
- **Production Readiness**: Comprehensive validation of package structure
- **Stress Testing**: Concurrent operations, memory leak detection
- **Integration Tests**: End-to-end workflows, error handling
- **Platform Compatibility**: Verified on Node.js 18+ environments

### Core Functionality ✅
- AFk background execution with session management
- Command-line interface and all aliases
- Config management with template file resolution
- Process isolation and cleanup

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

## Recent Major Changes

### ✅ Namespace Collision Fix (v8.0.1)
**Problem**: Executable commands and Claude Code templates shared `/commands/` directory
**Solution**: Clean architectural separation with centralized path management

**Implementation**:
- **Executables**: Moved to `/cmd/` directory (11 command files)
- **Templates**: Preserved in `/commands/` directory (8 markdown files)
- **PathManager**: New centralized path resolution system (`lib/path-manager.js`)
- **Binary**: Updated to use centralized paths, eliminating hardcoded dependencies

**Benefits**:
- ✅ Follows CLI best practices (separate executables from content)
- ✅ Maintains Claude Code compatibility (templates in expected location)
- ✅ Eliminates hardcoded path dependencies
- ✅ Makes future restructuring trivial

**Test Results**: 18/18 core functionality tests passing

## Known Issues

### Operational Issues Fixed
- ✅ **Namespace collision**: Resolved with clean directory separation
- ✅ **Hardcoded paths**: Eliminated via centralized PathManager
- ✅ **CLI conventions**: Now follows Unix standards properly

### Test Hygiene Issues (Ongoing)
- ⚠️ **Test cleanup**: Some tests don't restore original state properly
- ⚠️ **Process management**: Hanging node processes during testing
- ⚠️ **User directory pollution**: Tests modify ~/.claude without full restoration

### Limitations
- Voice requires OpenAI API key
- MCP tools require Claude subscription (Max/Pro/Teams)
- macOS-specific sleep prevention (`caffeinate`)

---

**Current Version**: 8.0.1
**Last Updated**: 2025-06-14
**Production Status**: Namespace architecture complete, core functionality verified
**Scope**: Practical Claude CLI wrapper for developers, teams, and friends
**Architecture**: Clean separation of executables (/cmd/) and templates (/commands/) with centralized path management

## What Calmhive Actually Is

Calmhive is a **reliable CLI wrapper for Claude Code** that adds practical features:
- Background task processing (AFk system)
- Session management and cleanup
- Voice interface (optional)
- Terminal UI for monitoring
- Smart model selection

**Not a platform, not enterprise software** - just a well-built tool that makes Claude Code more useful for daily development work. Easy to install, share with teammates, and maintain.