# Calmhive v3 Library Architecture

The `lib/` directory contains the core business logic and utilities that power Calmhive's Claude CLI wrapper functionality. This modular architecture enables sophisticated background processing, session management, and quality-of-life improvements.

## Core Modules

### Session Management
- **`session-database.js`** - SQLite-based session persistence and retrieval
- **`process-manager.js`** - AFk session lifecycle orchestration with adaptive retry logic
- **`progress-tracker.js`** - Detailed iteration progress monitoring and reporting
- **`context-monitor.js`** - Real-time context usage analysis and /compact management

### Rule Injection & Interception
- **`rule-injector.js`** - CLAUDE.md rule injection for consistent behavior
- **`chat-interceptor.js`** - Network-level Claude API interception and enhancement
- **`stdin-interceptor.js`** - Process input stream monitoring
- **`stdout-interceptor.js`** - Process output stream analysis

### Configuration & Templates
- **`config-manager.js`** - Template resolution and configuration synchronization
- **`template-manager.js`** - CLAUDE.md template management
- **`template-version-manager.js`** - Version synchronization across templates
- **`path-manager.js`** - Cross-platform path resolution and project detection

### Utility Libraries
- **`string-utils.js`** - Comprehensive string manipulation with validation
- **`array-utils.js`** - Safe array operations with performance optimizations
- **`object-utils.js`** - Deep object manipulation and validation
- **`math-utils.js`** - Mathematical utilities with precision handling
- **`date-utils.js`** - Date formatting and relative time calculations
- **`file-utils.js`** - Filesystem operations with safety checks
- **`color-utils.js`** - Terminal color and formatting utilities

### Background Processing
- **`afk-worker.js`** - Detached worker process for background AFk sessions
- **`adaptive-retry.js`** - Exponential backoff and usage limit handling
- **`cleanup-engine.js`** - Automatic cleanup of stale sessions and orphan processes

### Tool Integration
- **`tool-manager.js`** - Claude tool configuration and management
- **`tool-selector.js`** - Intelligent tool selection for different scenarios

### Advanced Features
- **`scheduler/`** - Cron-based task scheduling with Claude integration
- **`tui/`** - Terminal user interface for session monitoring
- **`voice/`** - Voice recognition and command processing
- **`consciousness/`** - AI behavior modification and consciousness protocols

## Architecture Principles

### Modular Design
Each module has a single responsibility and well-defined interfaces. Dependencies are minimal and explicit.

### Error Resilience
All modules implement comprehensive error handling with graceful degradation. No single failure should crash the entire system.

### Performance Optimization
- Utility functions are optimized for common use cases
- Database operations use efficient queries and connection pooling
- Background processing minimizes resource consumption

### Production Ready
- Comprehensive logging with different levels
- Metrics collection for monitoring
- Clean shutdown handling
- Process isolation for stability

## Key Design Patterns

### Singleton Pattern
- `rule-injector.js` - Single instance for rule management
- `session-database.js` - Shared database connection

### Observer Pattern
- `context-monitor.js` - Event-driven context monitoring
- `progress-tracker.js` - Real-time progress updates

### Strategy Pattern
- `adaptive-retry.js` - Configurable retry strategies
- `tool-selector.js` - Dynamic tool selection

### Factory Pattern
- `process-manager.js` - Process creation and management
- `config-manager.js` - Template instantiation

## Integration Points

### Claude Code API
The library integrates with Claude Code through:
- Command line argument parsing
- Process spawning and monitoring
- Output stream analysis
- Tool configuration

### External Dependencies
- **SQLite3** - Session persistence
- **Node.js Child Process** - Process management
- **Node.js FS** - File system operations
- **Node.js HTTP/HTTPS** - Network interception

### Data Flow
```
User Command → AFk Command → Process Manager → Session Database
                    ↓
Rule Injector → Chat Interceptor → Claude Process → Context Monitor
                    ↓
Progress Tracker → Log Files → TUI Display
```

## Development Guidelines

### Adding New Modules
1. Follow the established naming convention (`kebab-case.js`)
2. Include comprehensive JSDoc documentation
3. Add unit tests in `test/unit/`
4. Update this README with module description

### Error Handling
- Use try/catch blocks for all async operations
- Log errors with appropriate severity levels
- Provide user-friendly error messages
- Implement graceful fallbacks where possible

### Testing
- Each module should have corresponding unit tests
- Integration tests should cover module interactions
- Performance tests for utility functions
- End-to-end tests for complete workflows

### Documentation
- All public methods must have JSDoc comments
- Complex algorithms need inline explanations
- Examples should be provided for non-obvious usage
- Architecture decisions should be documented

## Performance Considerations

### Database Operations
- Use prepared statements for repeated queries
- Implement connection pooling for high-load scenarios
- Index frequently queried columns
- Batch operations where possible

### Memory Management
- Avoid memory leaks in long-running processes
- Use streams for large file operations
- Implement proper cleanup in error scenarios
- Monitor memory usage in background workers

### CPU Optimization
- Cache expensive computations
- Use efficient algorithms in utility functions
- Minimize regex operations in hot paths
- Optimize string operations for performance

## Security Considerations

### Input Validation
- Sanitize all user inputs
- Validate file paths to prevent directory traversal
- Escape shell commands properly
- Validate configuration values

### Process Isolation
- Background workers run in separate processes
- Graceful handling of process termination
- Proper cleanup of orphaned processes
- Resource limits for long-running operations

### Data Protection
- No sensitive data in logs
- Secure storage of configuration
- Proper file permissions
- Safe temporary file handling

## Monitoring & Debugging

### Logging
- Structured logging with consistent formats
- Different log levels for different audiences
- Detailed error context for debugging
- Performance metrics collection

### Diagnostics
- Health check endpoints for critical modules
- Status reporting for background processes
- Resource usage monitoring
- Error rate tracking

### Troubleshooting
- Comprehensive error messages with context
- Debug modes for verbose output
- Log file analysis tools
- Performance profiling capabilities

---

For specific module documentation, see the JSDoc comments in each source file. For architecture decisions and detailed design notes, see `docs/ARCHITECTURE.md`.