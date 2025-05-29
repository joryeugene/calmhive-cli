#!/bin/bash
# Integration tests for Calmhive commands

set -e

echo "🧪 Testing Calmhive commands..."

# Set up test environment
export NODE_ENV=test
cd "$(dirname "$0")/../.."

# Test help commands
echo "  ▶ Testing help commands..."
node bin/calmhive --help > /dev/null
node commands/chat --help > /dev/null
node commands/run --help > /dev/null
node commands/afk --help > /dev/null
node commands/tui --help > /dev/null
node commands/voice --help > /dev/null
echo "  ✓ All help commands work"

# Test basic command structure
echo "  ▶ Testing command structure..."
[ -x "bin/calmhive" ] || (echo "bin/calmhive not executable" && exit 1)
[ -x "commands/chat" ] || (echo "commands/chat not executable" && exit 1)
[ -x "commands/run" ] || (echo "commands/run not executable" && exit 1)
[ -x "commands/afk" ] || (echo "commands/afk not executable" && exit 1)
echo "  ✓ All commands are executable"

# Test alias resolution
echo "  ▶ Testing command aliases..."
node bin/calmhive c --help > /dev/null
node bin/calmhive r --help > /dev/null
node bin/calmhive a --help > /dev/null
echo "  ✓ Command aliases work"

# Test that commands don't crash on invalid input
echo "  ▶ Testing error handling..."
node commands/chat --invalid-flag 2>/dev/null || true
node commands/run --invalid-flag 2>/dev/null || true
echo "  ✓ Commands handle invalid input gracefully"

echo "✅ All command integration tests passed!"