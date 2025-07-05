# 🐝 Calmhive v14 Scheduling System - Complete Guide

## Overview

Calmhive v14 introduces powerful natural language scheduling that lets you automate any Claude task. Say "every Monday at 9am" and Calmhive handles the rest.

## How It Works - The Magic Behind Natural Language Scheduling

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      NATURAL LANGUAGE SCHEDULING FLOW                     │
└─────────────────────────────────────────────────────────────────────────┘

     "every Monday at 8am"              ┌─────────────────┐
              │                         │  Claude Code    │
              ▼                         │  CLI Parser     │
    ┌─────────────────┐                │                 │
    │ Schedule Create │ ──────JSON────▶│ claude -p       │
    │    Command      │                │ "Convert to     │
    └─────────────────┘                │  cron..."       │
              ▲                         └────────┬────────┘
              │                                  │
              │                                  │ JSON Response
              │                                  ▼
              │                         ┌─────────────────┐
              │                         │  Cron Result:   │
              │                         │  "0 8 * * 1"    │
              │                         │  Type: recurring│
              │                         └────────┬────────┘
              │                                  │
              │                                  ▼
    ┌─────────────────┐                ┌─────────────────┐
    │   node-cron     │◀───────────────│ Schedule Engine │
    │   Executor      │                │   Persistence   │
    └────────┬────────┘                └─────────────────┘
              │                                  │
              │ Triggers at scheduled time       │ Saves to
              ▼                                  ▼
    ┌─────────────────┐                ┌─────────────────┐
    │  Calmhive AFk   │                │ schedules.json  │
    │    Command      │                │   Database      │
    └─────────────────┘                └─────────────────┘
```

## The Full AFk Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCHEDULED AFk EXECUTION                           │
└─────────────────────────────────────────────────────────────────────────┘

    CRON TRIGGER                        AFk BACKGROUND PROCESS
    "0 8 * * 1"                              ┌─────────┐
         │                           ┌──────▶│ Worker  │──┐
         ▼                           │       └─────────┘  │
   ┌──────────┐      ┌────────┐     │                    │
   │node-cron │─────▶│AFk Cmd │─────┤       ┌─────────┐  │     ┌──────────┐
   └──────────┘      └────────┘     │──────▶│ Worker  │──┼────▶│ Progress │
                                     │       └─────────┘  │     │ Tracker  │
                                     │                    │     └──────────┘
                                     │       ┌─────────┐  │          │
                                     └──────▶│ Worker  │──┘          │
                                             └─────────┘             │
                                                                     ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                          PROGRESS DATABASE                        │
   │  Iteration 1: ✓ Set up environment                               │
   │  Iteration 2: ✓ Ran npm audit, found 3 vulnerabilities           │
   │  Iteration 3: ⚡ Patching critical: prototype pollution          │
   │  Iteration 4: ... Updating dependencies                          │
   └──────────────────────────────────────────────────────────────────┘
```

## Real-World Example: Weekly Security Audit

Here's a production-ready scheduled task that developers actually need:

```bash
# Create a weekly security audit that runs every Monday at 8am
./cmd/schedule create "every Monday at 8am" \
  "calmhive afk 'Conduct a comprehensive security audit of all npm dependencies. \
  Run npm audit to identify vulnerabilities. For each vulnerability found, \
  research the security advisory details, understand the attack vector, and \
  evaluate the impact on our codebase. For critical and high severity issues, \
  check if patches are available and test them in isolation. For medium/low \
  issues, document them with mitigation strategies. Update all dependencies \
  that have security patches available, running the full test suite after each \
  update to ensure compatibility. If breaking changes are detected, create a \
  migration plan. Generate a security report including: vulnerabilities found, \
  patches applied, dependencies that need manual updates, and any temporary \
  mitigations implemented. Commit the updated package-lock.json with detailed \
  notes about each security fix.' --iterations 8"
```

### What This Does (Step by Step)

1. **Every Monday at 8am**: Cron expression `0 8 * * 1`
2. **Launches AFk Worker**: Runs in background for 8 iterations
3. **Security Audit Process**:
   - Iteration 1-2: Run npm audit, analyze vulnerabilities
   - Iteration 3-4: Research critical vulnerabilities, test patches
   - Iteration 5-6: Apply patches, run test suite
   - Iteration 7: Document mitigations for non-patchable issues
   - Iteration 8: Generate report and commit changes

## Natural Language Examples That Work

```bash
# Time-based schedules
"every day at 6am"           → "0 6 * * *"     # Daily code quality scan
"every Monday at 9am"        → "0 9 * * 1"     # Weekly team report
"every Friday at 5pm"        → "0 17 * * 5"    # End-of-week cleanup
"daily at midnight"          → "0 0 * * *"     # Nightly builds
"every hour"                 → "0 * * * *"     # Hourly health checks
"every 30 minutes"           → "*/30 * * * *"  # Frequent monitoring

# Complex schedules
"every weekday at 2pm"       → "0 14 * * 1-5"  # Business hours only
"every 2 weeks on Friday"    → "0 0 * * 5/2"   # Bi-weekly sprints
"first Monday of month"      → "0 0 1-7 * 1"   # Monthly reviews
```

## More Practical Scheduled Tasks

### 1. Daily Code Quality Maintenance
```bash
./cmd/schedule create "daily at 3am" \
  "calmhive afk 'Run comprehensive code quality checks. Execute ESLint \
  with --fix on all JavaScript files. Run prettier on all source files. \
  Check for unused dependencies with depcheck. Find and remove console.log \
  statements from production code. Update import statements to use consistent \
  ordering. Run tests to ensure no regressions. Commit all automatic fixes \
  with detailed change summary.' --iterations 6"
```

### 2. Weekly Documentation Freshness
```bash
./cmd/schedule create "every Sunday at 10am" \
  "calmhive afk 'Verify all documentation is current. Extract and test all \
  code examples from markdown files. Check that CLI commands in docs match \
  actual implementation. Verify API examples work with current version. \
  Update any outdated configuration examples. Add documentation for any \
  undocumented public functions. Cross-reference README features with actual \
  implementation. Generate documentation coverage report.' --iterations 10"
```

### 3. Hourly System Health Monitor
```bash
./cmd/schedule create "every hour" \
  "calmhive afk 'Check system health and auto-fix common issues. Monitor: \
  disk space in .claude directory, orphaned AFk processes, database integrity, \
  large log files. For issues found: archive old sessions, clean logs over \
  100MB, terminate stuck processes, optimize database. Generate health report \
  with metrics and actions taken. Alert if manual intervention needed.' \
  --iterations 3"
```

## Understanding the Progress Tracking

When a scheduled AFk task runs, you can monitor it with enhanced progress tracking:

```bash
# Check progress of a running scheduled task
./cmd/progress <session-id>

# Example output:
📊 Progress for afk-12345678-security-audit

Status: Running (Iteration 4/8)
Started: 2025-07-05 08:00:00
Elapsed: 12m 34s

Current Iteration:
  🔄 Patching lodash vulnerability (CVE-2021-23337)
  
Completed Milestones:
  ✓ Ran npm audit - found 3 vulnerabilities
  ✓ Analyzed critical prototype pollution issue
  ✓ Created test harness for patch validation

Recent Actions:
  - Updated lodash from 4.17.20 to 4.17.21
  - Running test suite for compatibility
  - Documented breaking change in _.template

Challenges:
  ⚠️ Breaking change in lodash template function needs migration guide
```

## Integration with Templates

Combine scheduling with templates for maximum power:

```bash
# Use a template in a scheduled task
./cmd/schedule create "daily at 2am" \
  "calmhive afk '$(calmhive template apply performance-optimization \
  TARGET_SYSTEM=\"API endpoints\")' --iterations 8"

# This expands to the full template content at runtime!
```

## Architecture Benefits

1. **Natural Language**: No cron syntax memorization needed
2. **Claude-Powered**: Uses Claude's understanding for complex expressions  
3. **Persistent**: Survives system restarts
4. **Observable**: Track progress of long-running tasks
5. **Integrated**: Works with all Calmhive features (AFk, templates, etc.)

## YouTube Demo Talking Points

When demoing this feature:

1. **Start with the Problem**: "Ever forget to run security audits? Or clean up code?"
2. **Show Natural Language**: Type `"every Monday at 9am"` - it just works!
3. **Demonstrate Real Task**: Create the security audit schedule live
4. **Show Progress Tracking**: `./cmd/progress` to see what it's actually doing
5. **Highlight Integration**: Templates + Scheduling = Automation superpowers
6. **End with Value**: "Set it once, never worry about code quality again"

## How Scheduling Works

Once you create a schedule, it runs automatically at the specified times. The scheduler service manages all your scheduled tasks in the background.

### Starting the Scheduler

```bash
# Start the scheduler service with all enabled schedules
./cmd/schedule restore
```

The scheduler will:
- Restore all your enabled schedules
- Keep running to execute tasks at their scheduled times
- Show you the status of active schedules

### Stopping the Scheduler

Simply press `Ctrl+C` when the scheduler is running, or close the terminal window.

## Updating Schedules (NEW!)

The scheduler now supports updating existing schedules without deleting and recreating them.

### Update Command Syntax

```bash
./cmd/schedule update <schedule-id> [options]

Options:
  --time <natural_language>    Update schedule time
  --command <command>          Update command to execute  
  --name <name>               Update schedule name
  --timezone <timezone>       Update timezone
  --enable                    Enable the schedule
  --disable                   Disable the schedule
```

### Update Examples

```bash
# Change schedule time
./cmd/schedule update abc123 --time "daily at 3pm"

# Update both time and command
./cmd/schedule update abc123 --time "every 6 hours" --command "calmhive afk 'new task'"

# Disable a schedule temporarily
./cmd/schedule update abc123 --disable

# Re-enable with new timezone
./cmd/schedule update abc123 --enable --timezone "Europe/London"

# Update security audit to run more frequently during critical periods
./cmd/schedule update security-audit --time "every 4 hours"
```

### Common Update Scenarios

1. **Adjusting Frequency**: Change from daily to hourly during high-activity periods
2. **Task Evolution**: Update commands as requirements change
3. **Timezone Changes**: Update when traveling or for daylight savings
4. **Temporary Disable**: Pause schedules during maintenance windows

## Troubleshooting

### Timezone Auto-Detection (Fixed in v14!)
Schedules now automatically detect your system timezone. No more Pacific time surprises!

```bash
# Your timezone is auto-detected, but you can override:
./cmd/schedule create "daily at 9am" "task" --timezone "Europe/London"

# Update timezone for existing schedule:
./cmd/schedule update abc123 --timezone "Asia/Tokyo"
```

### Common Issues

1. **"Unknown command: schedule"**: You're using npm version. Use `./cmd/schedule` from v3 directory
2. **Schedule not running**: Check with `./cmd/schedule status` - scheduler may be stopped
3. **Wrong time**: Timezone issue - see fix above
4. **Can't see progress**: Use `./cmd/afk status` to find session ID first

## The Power of Automation

With Calmhive scheduling, you can:
- Never miss security updates
- Keep code quality high automatically  
- Generate reports while you sleep
- Run heavy tasks during off-hours
- Maintain documentation freshness
- Monitor system health 24/7

All with natural language that anyone can understand!