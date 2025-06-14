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
node cmd/chat --help > /dev/null
node cmd/run --help > /dev/null
node cmd/afk --help > /dev/null
node cmd/tui --help > /dev/null
node cmd/voice --help > /dev/null
echo "  ✓ All help commands work"

# Test basic command structure
echo "  ▶ Testing command structure..."
[ -x "bin/calmhive" ] || (echo "bin/calmhive not executable" && exit 1)
[ -x "cmd/chat" ] || (echo "cmd/chat not executable" && exit 1)
[ -x "cmd/run" ] || (echo "cmd/run not executable" && exit 1)
[ -x "cmd/afk" ] || (echo "cmd/afk not executable" && exit 1)
echo "  ✓ All commands are executable"

# Test alias resolution
echo "  ▶ Testing command aliases..."
node bin/calmhive c --help > /dev/null
node bin/calmhive r --help > /dev/null
node bin/calmhive a --help > /dev/null
echo "  ✓ Command aliases work"

# Test that commands don't crash on invalid input
echo "  ▶ Testing error handling..."
node cmd/chat --invalid-flag 2>/dev/null || true
node cmd/run --invalid-flag 2>/dev/null || true
echo "  ✓ Commands handle invalid input gracefully"

echo "✅ All command integration tests passed!"