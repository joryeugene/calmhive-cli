# Sleep Prevention Feature (v3.3.0+)

## Overview
Calmhive now automatically prevents your Mac from sleeping during long AFk sessions using the macOS `caffeinate` command. This ensures overnight or long-running tasks complete without interruption.

## How It Works

### Automatic Activation
- Sleep prevention activates automatically for sessions with **more than 5 iterations**
- Uses `caffeinate -i -m -s` to prevent idle sleep, display sleep, and system sleep
- Caffeinate process is managed alongside the AFk session

### Clean Lifecycle
1. **Start**: Caffeinate spawns when AFk session begins (if >5 iterations)
2. **Run**: Keeps Mac awake throughout all iterations
3. **Stop**: Caffeinate is killed when session completes or is stopped
4. **Cleanup**: Orphan caffeinate processes are cleaned up by `killorphans`

## Usage

### Default Behavior (Automatic)
```bash
# These will prevent sleep automatically
calmhive afk "big refactor" --iterations 10     # ☕ caffeinate enabled
calmhive afk "overnight task" --iterations 50   # ☕ caffeinate enabled
```

### Short Sessions (No Prevention)
```bash
# These won't activate sleep prevention
calmhive afk "quick fix" --iterations 3         # No caffeinate (≤5)
calmhive afk "small task" --iterations 5        # No caffeinate (≤5)
```

### Manual Override
```bash
# Disable sleep prevention even for long sessions
calmhive afk "task" --iterations 20 --no-prevent-sleep
```

## Monitoring

### Check Status
```bash
# See if sleep prevention is active
calmhive afk status -d    # Shows caffeinate PID if active

# Verify caffeinate process
ps aux | grep caffeinate
```

### Session Logs
```bash
# Logs show caffeinate lifecycle
calmhive afk tail <session-id>
# [timestamp] Sleep prevention enabled (caffeinate PID: 12345)
# [timestamp] Sleep prevention disabled
```

## Technical Details

### Process Management
- Caffeinate PID is stored in session metadata
- Tracked in `activeProcesses` map for lifecycle management
- Killed on session stop, error, or completion

### Flags Used
- `-i`: Prevent idle sleep (user inactivity)
- `-m`: Prevent disk sleep
- `-s`: Prevent system sleep on AC power

### Error Handling
- Gracefully handles missing caffeinate command
- Falls back to normal operation if caffeinate fails
- Cleans up orphan processes with `killorphans`

## Platform Support
- **macOS**: Full support with native caffeinate
- **Linux**: No effect (caffeinate not available)
- **Windows**: No effect (caffeinate not available)

## Testing
Run the test suite:
```bash
node test/test-caffeinate.js
```

Tests verify:
1. Caffeinate starts for >5 iterations
2. No caffeinate for ≤5 iterations  
3. --no-prevent-sleep flag works
4. Cleanup on session stop
5. Orphan process cleanup

## Troubleshooting

### Caffeinate Not Starting
- Check if caffeinate exists: `which caffeinate`
- Verify iterations > 5
- Check logs for error messages

### Mac Still Sleeping
- Ensure you're on AC power (caffeinate -s only works on AC)
- Check Energy Saver settings aren't overriding
- Verify caffeinate process is running: `ps aux | grep caffeinate`

### Orphan Caffeinate Processes
```bash
# Clean up any orphan processes
calmhive afk killorphans
```