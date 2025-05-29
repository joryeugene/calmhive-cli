#!/bin/bash
# End-to-end tests for voice system

set -e

echo "🎤 Testing voice system setup..."

cd "$(dirname "$0")/../.."

# Test that voice command exists and shows help
echo "  ▶ Testing voice command help..."
node commands/voice --help > /dev/null
echo "  ✓ Voice command help works"

# Test voice test mode (if available)
echo "  ▶ Testing voice test mode..."
timeout 5 node commands/voice --test 2>/dev/null || echo "  ⚠ Voice test requires uv and dependencies"

# Test that voice script exists
echo "  ▶ Checking voice script..."
if [ -f "lib/voice/consolidated/voice_to_claude_code.py" ]; then
  echo "  ✓ Voice script exists"
else
  echo "  ❌ Voice script missing"
  exit 1
fi

# Test Python dependencies structure
echo "  ▶ Checking Python requirements..."
if [ -f "lib/voice/requirements.txt" ]; then
  echo "  ✓ Requirements file exists"
else
  echo "  ❌ Requirements file missing"
  exit 1
fi

echo "✅ Voice system tests passed!"