# Changelog

All notable changes to the Calmhive CLI will be documented in this file.

## [3.4.0] - 2025-06-12

### Added
- 🧹 **Comprehensive AFk Cleanup System**: Enhanced session cleanup with advanced options
  - Multi-target cleanup: database sessions, orphaned logs, legacy registry
  - Advanced options: `--dry-run`, `--force`, `--verbose`, `--legacy-only`, `--db-only`
  - Safety-first design: never deletes running sessions (maxAge.running: 0)
  - Configurable retention policies by session status (completed: 7d, failed: 30d, etc.)
  - Comprehensive audit logging with timestamps and space tracking
  - Smart command routing: simple usage → legacy cleanup, advanced → comprehensive engine
- 🛡️ **Enhanced Safety Features**: Confirmation prompts and dry-run previews

### Changed
- AFk cleanup command now supports advanced options while maintaining backward compatibility
- Enhanced help documentation with detailed cleanup examples

### Technical
- Added 365-line CleanupEngine class with configurable policies
- Comprehensive test suite (6 test cases) covering all edge cases
- Zero breaking changes to existing workflows

## [3.3.1] - 2025-06-11

### Fixed
- **Background Execution**: AFk sessions now run as truly detached background processes
  - Solves issue where stop command didn't actually interrupt running iterations
  - Sessions continue running even after terminal is closed (true background mode)
  - Worker process architecture ensures proper isolation from parent process
- **Log Handling**: Background AFk sessions properly write logs to file
- **Process Cleanup**: Stop command now properly kills background worker processes

### Changed
- AFk sessions always run in background mode for proper process isolation
- Updated process search to find and kill afk-worker.js processes
- Worker process handles all output redirection to log files

## [3.3.0] - 2024-01-11

### Added
- ☕ **Automatic Sleep Prevention**: AFk sessions with >5 iterations now automatically prevent system sleep using macOS `caffeinate`
  - Prevents MacBook from sleeping during long overnight sessions
  - Automatically cleans up caffeinate process on completion/stop
  - Can be disabled with `--no-prevent-sleep` flag
- 📈 **Increased Max Iterations**: Maximum iterations increased from 50 to 69
- 🧪 **Caffeinate Tests**: Added comprehensive test suite for sleep prevention feature

### Changed
- AFk help output now shows sleep prevention feature
- Session status display includes sleep prevention status
- Orphan process cleanup now handles orphan caffeinate processes

### Fixed
- Sessions no longer stall when MacBook goes to sleep during long iterations
- Stop command now properly interrupts AFk sessions immediately (no more "Waiting X seconds" after stop)
- Sessions check for stop status during iteration waits and usage limit waits

### Removed
- Model display from session status (was always null/undefined)
- Custom Steps display from session status (not implemented)

## [3.2.3] - 2024-01-10

### Fixed
- Context compression strategies for better `/compact` command success
- Improved error handling for usage limit detection

## [3.2.0] - 2024-01-09

### Added
- Automatic context compression when approaching limits
- Multiple `/compact` command strategies
- Context usage monitoring and reporting

### Changed
- Better handling of context limit scenarios
- Improved iteration continuity

## [3.1.0] - 2024-01-08

### Added
- Adaptive retry with exponential backoff for usage limits
- Process status verification with PID tracking
- Orphan process cleanup

### Fixed
- Phantom process issues from v2
- Accurate session status tracking

## [3.0.0] - 2024-01-07

### Changed
- Complete rewrite of AFk system for reliability
- New process management architecture
- SQLite-based session tracking

### Added
- Terminal UI (TUI) for session monitoring
- Voice interface with OpenAI integration
- MCP tool support
- Comprehensive test suite

### Removed
- Legacy v2 AFk implementation
- Unreliable process tracking methods