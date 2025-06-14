# Calmhive V3 Specification

## What This Is

**Calmhive is a CLI wrapper for Claude Code** that adds background processing, session management, and quality-of-life improvements.

**Not**: An enterprise platform, business software, or complex framework
**Is**: A practical tool that makes Claude Code more useful for developers

## Core System Architecture

**Purpose**: Enhance Claude Code with background processing and session management
**Philosophy**: Simple, reliable tools without bloat - easy to install and share

### 1. Command Structure
Calmhive provides 6 core commands with clean namespace separation:
- `chat` - Interactive conversation with full tool access
- `run` - Task execution wrapper for `claude run`
- `afk` - Background iterative sessions with retry logic
- `voice` - Voice interface with speech recognition/synthesis
- `tui` - Terminal UI for session monitoring
- `update` - Automatic version updates from npm

**Directory Structure**:
- **`/cmd/`** → Executable command files (calmhive binary functionality)
- **`/commands/`** → Claude Code markdown templates (AI assistant functionality)
- **`/lib/path-manager.js`** → Centralized path resolution (single source of truth)

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
**Core Claude Tools** (Always Available):
- Read, Write, Edit, MultiEdit, Bash
- Glob, Grep, LS for file operations
- TodoRead/TodoWrite for task management

**MCP Tools** (Optional, when user has them configured):
- Sequential Thinking, GitHub, Playwright, etc.
- Calmhive uses whatever tools Claude Code has access to
- No special MCP integration - just passes through to Claude

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

## Design Principles

### Simplicity Over Features
- CLI wrapper, not a platform
- Enhance Claude Code without replacing it
- Easy to install, share, and maintain
- Reliable across different environments

### User-Focused
- Solves real problems developers face
- Works reliably when shared with team/friends
- Clear error messages and helpful feedback
- No enterprise complexity

### Operational Excellence Requirements
- **Test Hygiene**: All tests must restore original state completely
- **Process Management**: No hanging processes, proper cleanup
- **System Cleanliness**: No user directory pollution, isolated test environments
- **Path Management**: Centralized path resolution prevents hardcoded dependencies

## Error Handling Architecture

### Error Classification System
**Critical Errors** (System failures):
- Database corruption or access failures
- Process management failures (PID conflicts, orphaned processes)
- Configuration file corruption

**User Errors** (Fixable by user):
- Invalid session IDs → Suggest fuzzy matching from recent sessions
- Missing API keys → Show setup instructions
- Permission issues → Provide troubleshooting steps

**Operational Errors** (Recoverable):
- Context limits exceeded → Suggest /compact command usage
- Network/API failures → Show retry guidance and status
- Claude usage limits → Display helpful retry timing

### Error Response Format
```javascript
{
  category: 'user|operational|critical',
  message: 'Clear description of what went wrong',
  suggestion: 'Specific next steps to resolve',
  command: 'Exact command to run (if applicable)',
  reference: 'Link to docs or help section'
}
```

### Error Recovery Protocols
- **Graceful degradation**: System continues operating when possible
- **Context preservation**: Save state before attempting recovery
- **User guidance**: Always provide actionable next steps
- **Automatic retry**: For transient failures with exponential backoff

## Session Resume System Architecture

### Database Schema Extensions
```sql
-- Additional fields for session recovery
ALTER TABLE sessions ADD COLUMN resume_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN last_checkpoint INTEGER;
ALTER TABLE sessions ADD COLUMN recovery_data TEXT DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN interruption_reason TEXT;
ALTER TABLE sessions ADD COLUMN context_snapshot TEXT;
```

### Resume State Management
**Checkpoint Creation**:
- Save state every 3 iterations or 30 minutes
- Store current working directory, iteration context
- Preserve tool state and intermediate results

**Recovery Detection**:
- Scan for 'running' sessions with dead PIDs on startup
- Detect network interruptions vs user termination
- Analyze last successful checkpoint for resume viability

**Resume Process**:
1. Validate session can be resumed (< 24 hours old)
2. Restore working directory and environment
3. Continue from last checkpoint iteration + 1
4. Increment resume_count for tracking

### Resume Command Interface
```bash
# Automatic detection
calmhive afk resume         # Resume most recent interrupted session

# Specific session
calmhive afk resume <session-id>

# Resume with options
calmhive afk resume <session-id> --from-iteration 5 --reset-context
```

---

## Config Management Architecture

### Template Distribution System
**Purpose**: Distribute and sync CLAUDE.md templates through npm package

**Template Resolution Strategy**:
1. **NPM Package Detection**: `require.resolve('@calmhive/calmhive-cli/package.json')`
2. **Development Fallback**: Walk up directory tree for package.json with matching name
3. **Local Development**: Relative path from lib directory

**Template Files Included in NPM Package**:
- `CLAUDE.md.example` (CLI-optimized template with anti-fabrication)
- `CLAUDE-DESKTOP.md.example` (Desktop-optimized with same protections)
- Both templates include complete binary thinking prevention

### Anti-Fabrication Framework
**Purpose**: Prevent AI from fabricating non-existent files, commands, or features

**Core Mandate**:
```xml
<anti_fabrication_mandate>
🚨 ABSOLUTE TRUTH REQUIREMENT - NO FABRICATION ALLOWED 🚨

FABRICATION INCLUDES:
- Referencing non-existent files or directories 
- Making up technical details about flags, commands, or functionality
- Claiming features exist when they don't
- Inventing configuration options or parameters

VERIFICATION MANDATES:
- BEFORE referencing ANY file: Use Read, Glob, or LS to verify existence
- BEFORE stating technical facts: Search documentation or verify through tools
- BEFORE claiming functionality: Test it or find proof it exists
</anti_fabrication_mandate>
```

### Binary Thinking Prevention
**Purpose**: Prevent overcorrection from fabrication to assuming nothing exists

**Core Framework**:
```xml
<binary_thinking_prevention>
🚨 STOP BINARY THINKING - VERIFY INDIVIDUALLY 🚨

BINARY THINKING PATTERNS TO ELIMINATE:
- "All of these are fake" → Check each one individually
- "None of these exist" → Verify each claim separately  
- "Everything is wrong" → Test specific components
- "Just delete it if it's broken" → Debug and fix the actual problem

INDIVIDUAL VERIFICATION MANDATE:
- VERIFY each claim/command/feature independently 
- TEST one thing at a time, not sweeping conclusions
- DOCUMENT what works vs what doesn't work specifically
</binary_thinking_prevention>
```

### Config Sync Commands
**Purpose**: Manage CLAUDE.md configuration with safety and validation

**Command Interface**:
```bash
calmhive config show                    # Current configuration status
calmhive config install [--desktop]     # Install/update from template  
calmhive config diff [--desktop]        # Compare with template
calmhive config backup                  # Create manual backup
calmhive config restore [filename]      # Restore from backup
calmhive config commands list           # List available command files
calmhive config commands copy <dest>    # Copy commands to destination
```

**Safety Features**:
- Automatic backups before destructive operations
- Dry-run mode for preview (`--dry-run`)
- Force mode for scripting (`--force`)
- Template validation before installation

## Namespace Architecture

### Problem Solved
**Issue**: Executable command files and Claude Code markdown templates competed for same `/commands/` directory, creating namespace collision and violating CLI best practices.

**Solution**: Clean separation with centralized path management:
- **Executables**: `/cmd/` directory (Node.js command implementations)
- **Templates**: `/commands/` directory (Claude Code markdown files)
- **Path Resolution**: `lib/path-manager.js` provides single source of truth

### Implementation Details
**PathManager Class** (`lib/path-manager.js`):
- Detects npm vs development environments automatically
- Provides centralized path resolution for all components
- Eliminates hardcoded path dependencies throughout system
- Makes future directory structure changes trivial

**Benefits**:
- ✅ Follows Unix CLI conventions (separate executable and content directories)
- ✅ Maintains Claude Code compatibility (`~/.claude/commands/` templates)
- ✅ Eliminates hardcoded paths (single source of truth)
- ✅ Simplifies future maintenance and restructuring

---

**Specification Version**: 8.0.1
**Last Updated**: 2025-06-14 - Namespace collision fix and centralized path management complete