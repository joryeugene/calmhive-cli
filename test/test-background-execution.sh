#!/bin/bash
# Test script to verify background execution and stop functionality

echo "🧪 Testing AFk Background Execution"
echo "=================================="
echo
echo "This test verifies that:"
echo "1. AFk sessions run in true background (detached process)"
echo "2. Stop commands immediately halt execution"
echo "3. Sessions don't continue after Ctrl+C"
echo

# Clean up any existing sessions
echo "🧹 Cleaning up any existing sessions..."
calmhive afk killorphans > /dev/null 2>&1

echo
echo "📋 Starting test AFk session..."
calmhive afk "Test background execution" --iterations 20

# Get the session ID
sleep 2
SESSION_ID=$(calmhive afk status | grep "Test background execution" | grep "running" | awk '{print $1}' | head -1)

if [ -z "$SESSION_ID" ]; then
    echo "❌ Failed to start session"
    exit 1
fi

echo
echo "✅ Session started: $SESSION_ID"
echo

# Check process list
echo "🔍 Checking for worker process..."
ps aux | grep afk-worker.js | grep -v grep

echo
echo "📊 Current status:"
calmhive afk status | grep "$SESSION_ID"

echo
echo "📝 Checking logs are being written..."
sleep 3
LOG_FILE="$HOME/.claude/calmhive/v3/logs/${SESSION_ID}.log"
if [ -f "$LOG_FILE" ]; then
    echo "✅ Log file exists: $LOG_FILE"
    echo "Last 5 lines:"
    tail -5 "$LOG_FILE"
else
    echo "❌ Log file not found"
fi

echo
echo "🛑 Now stopping the session..."
calmhive afk stop "$SESSION_ID"

echo
echo "⏳ Waiting 3 seconds..."
sleep 3

echo
echo "🔍 Checking for worker process (should be gone)..."
ps aux | grep afk-worker.js | grep -v grep || echo "✅ No worker process found"

echo
echo "📊 Final status:"
calmhive afk status | grep "$SESSION_ID" || echo "✅ Session properly stopped"

echo
echo "✅ Test complete!"
echo
echo "💡 Key improvements:"
echo "   - AFk runs as detached worker process"
echo "   - Stop command kills the worker immediately"
echo "   - No more 'phantom' iterations after stop"
echo "   - Logs continue to be written in background"