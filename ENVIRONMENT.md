# Environment Variables

This document describes all environment variables used by the Calmhive CLI.

## Core Variables

### `CALMHIVE_DEBUG`
**Description**: Enables debug logging throughout the application  
**Values**: `0` (disabled) or `1` (enabled)  
**Default**: `0`  
**Usage**: 
```bash
CALMHIVE_DEBUG=1 calmhive afk "debug task"
```

### `CALMHIVE_TEST_MODE`
**Description**: Prevents side effects during test execution  
**Values**: `true` (test mode) or `false`/undefined (normal mode)  
**Default**: `false`  
**Usage**: Automatically set by npm test scripts
```bash
CALMHIVE_TEST_MODE=true npm test
```

**Effects in Test Mode**:
- Mocks Claude process spawning
- Uses in-memory session database
- Prevents actual file operations in some contexts
- Disables background process spawning
- Uses mock data for network operations

### `NODE_ENV`
**Description**: Standard Node.js environment indicator  
**Values**: `development`, `production`, `test`  
**Default**: `development`  
**Usage**:
```bash
NODE_ENV=production calmhive afk "production task"
```

**Effects**:
- `production`: Enables production logging, optimized error handling
- `development`: Verbose logging, detailed stack traces
- `test`: Minimal logging, test-specific behaviors

## Feature-Specific Variables

### `OPENAI_API_KEY`
**Description**: API key for OpenAI services (voice features)  
**Required for**: Voice interface commands (`calmhive voice`)  
**Security**: Keep confidential, never commit to version control  
**Usage**:
```bash
export OPENAI_API_KEY="sk-..."
calmhive voice
```

### `CALMHIVE_CLAUDE_API_KEY`
**Description**: Override for Claude API key (if different from default)  
**Default**: Uses Claude's standard API key configuration  
**Usage**:
```bash
export CALMHIVE_CLAUDE_API_KEY="sk-ant-..."
```

### `CALMHIVE_CONFIG_PATH`
**Description**: Custom path for CLAUDE.md configuration file  
**Default**: Standard Claude configuration locations  
**Usage**:
```bash
export CALMHIVE_CONFIG_PATH="/custom/path/CLAUDE.md"
```

## Path and Storage Variables

### `CALMHIVE_DATA_DIR`
**Description**: Override default data directory location  
**Default**: `~/.claude/calmhive/`  
**Usage**:
```bash
export CALMHIVE_DATA_DIR="/custom/data/path"
```

### `CALMHIVE_LOG_DIR`
**Description**: Override default log directory location  
**Default**: `~/.claude/calmhive/logs/`  
**Usage**:
```bash
export CALMHIVE_LOG_DIR="/var/log/calmhive"
```

### `CALMHIVE_CACHE_DIR`
**Description**: Override default cache directory location  
**Default**: `~/.claude/calmhive/cache/`  
**Usage**:
```bash
export CALMHIVE_CACHE_DIR="/tmp/calmhive-cache"
```

## AFk Background Processing Variables

### `CALMHIVE_MAX_ITERATIONS`
**Description**: Global maximum for AFk session iterations  
**Default**: `100`  
**Range**: `1-1000`  
**Usage**:
```bash
export CALMHIVE_MAX_ITERATIONS=50
```

### `CALMHIVE_CHECKPOINT_INTERVAL`
**Description**: Default checkpoint interval for AFk sessions (seconds)  
**Default**: `1800` (30 minutes)  
**Range**: `300-7200` (5 minutes to 2 hours)  
**Usage**:
```bash
export CALMHIVE_CHECKPOINT_INTERVAL=3600  # 1 hour
```

### `CALMHIVE_RETRY_DELAY`
**Description**: Base retry delay for failed operations (milliseconds)  
**Default**: `30000` (30 seconds)  
**Range**: `5000-300000` (5 seconds to 5 minutes)  
**Usage**:
```bash
export CALMHIVE_RETRY_DELAY=60000  # 1 minute
```

### `CALMHIVE_PREVENT_SLEEP`
**Description**: Whether to prevent system sleep during AFk sessions  
**Values**: `true` (prevent sleep) or `false` (allow sleep)  
**Default**: `true`  
**Usage**:
```bash
export CALMHIVE_PREVENT_SLEEP=false
```

## Network and API Variables

### `CALMHIVE_API_TIMEOUT`
**Description**: Timeout for API requests (milliseconds)  
**Default**: `30000` (30 seconds)  
**Range**: `5000-120000` (5 seconds to 2 minutes)  
**Usage**:
```bash
export CALMHIVE_API_TIMEOUT=60000  # 1 minute
```

### `CALMHIVE_PROXY_URL`
**Description**: HTTP proxy URL for API requests  
**Format**: `http://host:port` or `https://host:port`  
**Usage**:
```bash
export CALMHIVE_PROXY_URL="http://proxy.company.com:8080"
```

### `CALMHIVE_USER_AGENT`
**Description**: Custom User-Agent header for API requests  
**Default**: `Calmhive-CLI/14.2.9`  
**Usage**:
```bash
export CALMHIVE_USER_AGENT="CustomApp/1.0"
```

## Database and Storage Variables

### `CALMHIVE_DB_PATH`
**Description**: Override default SQLite database location  
**Default**: `~/.claude/calmhive/data/sessions.db`  
**Usage**:
```bash
export CALMHIVE_DB_PATH="/custom/path/sessions.db"
```

### `CALMHIVE_SESSION_RETENTION_DAYS`
**Description**: Number of days to retain completed sessions  
**Default**: `7`  
**Range**: `1-365`  
**Usage**:
```bash
export CALMHIVE_SESSION_RETENTION_DAYS=30
```

## Performance Variables

### `CALMHIVE_WORKER_THREADS`
**Description**: Number of worker threads for parallel processing  
**Default**: CPU core count  
**Range**: `1-16`  
**Usage**:
```bash
export CALMHIVE_WORKER_THREADS=4
```

### `CALMHIVE_MEMORY_LIMIT`
**Description**: Memory limit for individual AFk sessions (MB)  
**Default**: `512`  
**Range**: `128-2048`  
**Usage**:
```bash
export CALMHIVE_MEMORY_LIMIT=1024
```

## Security Variables

### `CALMHIVE_SECURE_MODE`
**Description**: Enables enhanced security measures  
**Values**: `true` (enhanced security) or `false` (standard)  
**Default**: `false`  
**Effects**: Additional input validation, restricted file access  
**Usage**:
```bash
export CALMHIVE_SECURE_MODE=true
```

### `CALMHIVE_DISABLE_TELEMETRY`
**Description**: Disables usage telemetry collection  
**Values**: `true` (disabled) or `false` (enabled)  
**Default**: `false`  
**Usage**:
```bash
export CALMHIVE_DISABLE_TELEMETRY=true
```

## Testing Variables

### `CALMHIVE_MOCK_API`
**Description**: Use mock API responses instead of real Claude API  
**Values**: `true` (mock) or `false` (real API)  
**Default**: `false`  
**Usage**: Primarily for testing and development
```bash
export CALMHIVE_MOCK_API=true
```

### `CALMHIVE_TEST_TIMEOUT`
**Description**: Override default test timeouts (milliseconds)  
**Default**: `10000` (10 seconds)  
**Usage**:
```bash
export CALMHIVE_TEST_TIMEOUT=30000  # 30 seconds
```

## Development Variables

### `CALMHIVE_DEV_MODE`
**Description**: Enables development-specific features and logging  
**Values**: `true` (dev mode) or `false` (normal)  
**Default**: `false`  
**Effects**: Enhanced logging, debug features, relaxed validations  
**Usage**:
```bash
export CALMHIVE_DEV_MODE=true
```

### `CALMHIVE_VERBOSE_LOGGING`
**Description**: Enables maximum verbosity in logging  
**Values**: `true` (verbose) or `false` (normal)  
**Default**: `false`  
**Usage**:
```bash
export CALMHIVE_VERBOSE_LOGGING=true
```

## Configuration Examples

### Development Setup
```bash
export NODE_ENV=development
export CALMHIVE_DEBUG=1
export CALMHIVE_DEV_MODE=true
export CALMHIVE_VERBOSE_LOGGING=true
```

### Production Setup
```bash
export NODE_ENV=production
export CALMHIVE_SESSION_RETENTION_DAYS=30
export CALMHIVE_CHECKPOINT_INTERVAL=3600
export CALMHIVE_DISABLE_TELEMETRY=true
```

### Testing Setup
```bash
export CALMHIVE_TEST_MODE=true
export CALMHIVE_MOCK_API=true
export NODE_ENV=test
```

### Secure Environment
```bash
export CALMHIVE_SECURE_MODE=true
export CALMHIVE_DISABLE_TELEMETRY=true
export CALMHIVE_API_TIMEOUT=60000
```

## Variable Precedence

Variables are evaluated in the following order (highest to lowest priority):

1. Command-line environment variables
2. `.env` file in current directory (if present)
3. System environment variables
4. Application defaults

## Security Considerations

**Sensitive Variables** (never commit to version control):
- `OPENAI_API_KEY`
- `CALMHIVE_CLAUDE_API_KEY`
- `CALMHIVE_PROXY_URL` (if contains credentials)

**Use environment files** for local development:
```bash
# .env (add to .gitignore)
OPENAI_API_KEY=sk-...
CALMHIVE_DEBUG=1
CALMHIVE_DEV_MODE=true
```

**For production deployments**, use secure environment variable injection provided by your deployment platform.