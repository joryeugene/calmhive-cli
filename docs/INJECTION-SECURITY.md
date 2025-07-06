# Rule Injection Security & Scope

*Last Updated: 2025-01-07*
*Version: 1.0.0*

## 🔒 Security Overview

Calmhive's rule injection system is designed with **process isolation** and **user control** as top priorities. This document explains exactly what is and isn't affected by rule injection.

## 🎯 What Gets Injected

### ✅ Affected (Only These)
- **Calmhive chat sessions** - Interactive chats started with `calmhive chat`
- **Calmhive commands** - `calmhive run`, `calmhive afk`, etc.
- **Explicit Calmhive usage** - Only when you deliberately use Calmhive

### ❌ NOT Affected (Guaranteed)
- **Other Claude apps** - VS Code extensions, Claude Desktop, etc.
- **Other CLI tools** - Any non-Calmhive tools that use Anthropic API
- **System-wide HTTP** - No global network interception
- **Other Node.js apps** - Process isolation prevents cross-contamination
- **Background services** - No persistent system modifications

## 🛡️ How Isolation Works

### Process-Specific Interception
```bash
# When you run this:
calmhive chat

# Internally it becomes:
node --require ./lib/chat-interceptor.js $(which claude) [args]
```

The `--require` flag only affects **that specific process**. When the process ends, all interception stops.

### Technical Boundaries
1. **Process Isolation**: Interceptor only loads in the Claude CLI process launched by Calmhive
2. **No Global Patching**: We don't modify system-wide Node.js modules
3. **No Persistent Changes**: No background services or system modifications
4. **Clean Termination**: All interception ends when the command completes

## 🔍 Verification Commands

### Check Current Status
```bash
# See if injection is enabled
calmhive intercept status

# Detailed information
calmhive intercept info

# Test injection functionality
calmhive intercept test
```

### Verify Process Isolation
```bash
# Start Calmhive in one terminal
calmhive chat

# In another terminal, test other apps aren't affected
# (run any other Node.js app that uses Anthropic API)
```

## 🎛️ User Control Options

### Global Control
```bash
# Disable injection for all commands
calmhive intercept off

# Re-enable with specific method
calmhive intercept on --method=network

# Check status anytime
calmhive intercept status
```

### Per-Session Control
```bash
# Disable for single session
calmhive chat --no-intercept

# Use different interception method
calmhive chat --intercept=stdio
```

### Settings File Control
Edit `~/.claude/calmhive-settings.json`:
```json
{
  "ruleInjection": false  // Disables globally
}
```

### Environment Variable Override
```bash
# Disable via environment (overrides all settings)
export CALMHIVE_NO_INJECT=1
calmhive chat  # Will not inject
```

## 📊 Token Usage & Costs

### Cost Analysis
- **CLAUDE.md size**: ~32KB (your file size)
- **Added per message**: ~32KB of tokens
- **Typical cost**: ~$0.XX per message (depends on model)

### Cost Optimization Options
1. **Selective Usage**: Only enable for complex tasks
2. **Condensed Rules**: Create shorter version for cost-sensitive work
3. **Method Selection**: `--intercept=stdio` has no API cost impact

### ROI Evaluation
Use the built-in A/B testing to measure value:
```bash
# Test if injection improves your outputs
node test/test-output-quality.js
```

## 🚨 What Could Go Wrong?

### Unlikely but Possible Issues
1. **Process Memory**: Large CLAUDE.md files use more memory
2. **Network Overhead**: Slightly larger requests
3. **Response Time**: Minimal delay from larger requests

### What Won't Happen
- ❌ Other apps getting your rules injected
- ❌ Rules sent to wrong services
- ❌ Persistent system changes
- ❌ Background processes affected
- ❌ Data leakage to other applications

## 🔧 Troubleshooting Isolation

### Verify Only Calmhive is Affected
1. **Run Calmhive**: `calmhive chat "test message"`
2. **Check injection**: Should see debug output about injection
3. **Test other app**: Use any other Claude tool
4. **Verify isolation**: Other app should NOT show injection

### Debug Process Boundaries
```bash
# Enable debug mode
export CALMHIVE_DEBUG=1

# Run Calmhive command
calmhive chat "test"

# Check for injection messages in output
# Should see: [Calmhive Interceptor] messages
```

### Emergency Disable
If anything seems wrong:
```bash
# Immediate global disable
calmhive intercept off

# Or delete settings file
rm ~/.claude/calmhive-settings.json

# Or use bypass
claude chat  # Direct Claude, bypasses Calmhive entirely
```

## 📋 Security Checklist

Before using rule injection, verify:

- [ ] You understand it only affects Calmhive commands
- [ ] You know how to disable it globally (`calmhive intercept off`)
- [ ] You've tested that other Claude apps aren't affected
- [ ] You're comfortable with the token cost increase
- [ ] You have a backup plan (direct Claude CLI usage)

## 🤝 User Trust

We understand that intercepting API requests is a sensitive operation. That's why we've designed the system with:

- **Full Transparency**: Complete source code available
- **User Control**: Multiple ways to disable/control
- **Process Isolation**: Cannot affect other applications
- **No Persistence**: No permanent system changes
- **Easy Verification**: Built-in tools to test and verify

## 📞 Support & Questions

If you have security concerns or questions:

1. **Check documentation**: This file and `RULE-INJECTION.md`
2. **Test isolation**: Use the verification commands above
3. **Report issues**: If you find any cross-contamination or unexpected behavior
4. **Emergency disable**: `calmhive intercept off` immediately stops all injection

## 🎯 Bottom Line

**Calmhive rule injection is designed to be:**
- ✅ **Safe**: Process-isolated, no system-wide effects
- ✅ **Controllable**: Multiple disable options
- ✅ **Transparent**: Full visibility into what's happening
- ✅ **Reversible**: Easy to turn off permanently
- ✅ **Verifiable**: Built-in testing and status commands

**Use it confidently knowing it only affects what you explicitly run through Calmhive.**