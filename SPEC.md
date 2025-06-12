# Calmhive V3 Specification

## Core System Architecture

### 1. Command Structure
Calmhive V3 provides 6 core commands with intelligent mode selection:
- `chat` - Interactive conversation with full tool access
- `run` - Task execution wrapper for `claude run`
- `afk` - Background iterative sessions with retry logic
- `voice` - Voice interface with speech recognition/synthesis
- `tui` - Terminal UI for session monitoring
- `update` - Automatic version updates from npm

### 2. AFk Background Processing System (STABLE)
**Architecture**: SQLite-based session tracking with detached worker processes
- **Process Model**: Parent spawns detached `afk-worker.js` processes
- **Session Database**: `~/.claude/calmhive/data/sessions.db`
- **Log Management**: Individual session logs in `~/.claude/calmhive/v3/logs/`
- **Registry Cleanup**: Automatic cleanup of legacy `~/.claude/afk_registry/`

**Critical Features**:
- **Running Session Protection**: `maxAge.running: 0` - Never auto-delete running sessions
- **Adaptive Retry**: Exponential backoff for Claude usage limits
- **Sleep Prevention**: Automatic `caffeinate` for sessions >5 iterations
- **Context Compression**: Multiple `/compact` strategies for context limits

### 3. Safety and Reliability
**Process Isolation**:
- True background execution with worker processes
- Proper cleanup of orphaned processes and caffeinate PIDs
- Session state persistence across terminal restarts

**Data Safety**:
- Dry-run modes for destructive operations
- Comprehensive audit logging for cleanup operations
- Confirmation prompts with force override options

### 4. Model Selection Strategy
- **Automatic Selection**: Based on task complexity and user patterns
- **Haiku**: Quick questions, simple tasks
- **Sonnet**: Default for most operations, balanced performance
- **Opus**: Complex reasoning, architecture decisions

### 5. Tool Integration
**Core Tools** (Always Available):
- Read, Write, Edit, MultiEdit, Bash
- Glob, Grep, LS for file operations
- TodoRead/TodoWrite for task management

**MCP Tools** (Optional, subscription-dependent):
- Sequential Thinking for complex analysis
- GitHub integration for repository operations
- Playwright for browser automation
- OmniSearch for web research

## API Contracts

### AFk Session Lifecycle
```javascript
// Session States
'created' → 'running' → ['completed'|'failed'|'error'|'stopped']

// Required Fields
{
  id: string,           // UUID session identifier
  task: string,         // User-provided task description
  status: string,       // Current session state
  started_at: number,   // Unix timestamp
  iterations: number,   // Target iteration count
  current_iteration: number
}
```

### Cleanup Engine Policies
```javascript
{
  maxAge: {
    completed: 7,    // days
    failed: 30,      // days  
    error: 30,       // days
    stopped: 14,     // days
    running: 0       // never delete
  },
  preserve: {
    recent: 10,      // always keep N most recent
    starred: true    // preserve starred sessions
  }
}
```

## Version Compatibility

### Breaking Changes
- **Major Version**: Incompatible API changes, database schema changes
- **Minor Version**: New features, backward-compatible additions
- **Patch Version**: Bug fixes, clarifications, performance improvements

### Backward Compatibility Requirements
- All command interfaces must remain stable within major versions
- Database migrations must be automatic and reversible
- Legacy AFk registry support maintained until v4.0.0

## Security Considerations

### File System Access
- Calmhive provides Claude with full system access
- No sandboxing or permission restrictions by design
- User responsibility for backup and safety measures

### Process Management
- Worker processes inherit parent environment
- Cleanup of orphaned processes on system restart
- PID tracking for reliable process termination

## Performance Requirements

### AFk System
- Maximum 69 iterations per session
- Session startup time <2 seconds
- Log file rotation for sessions >100MB
- Database cleanup maintains <1000 active sessions

### Resource Management
- Memory usage <100MB base + 50MB per active session
- Log compression for sessions older than 30 days
- Automatic cleanup of temporary files

---

**Specification Version**: 3.4.0  
**Last Updated**: 2025-06-12  
**Breaking Changes**: None since 3.0.0