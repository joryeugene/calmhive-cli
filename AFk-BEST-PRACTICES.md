# AFk Best Practices Guide
*Mastering Away From Keyboard AI Development*

## Introduction

AFk (Away From Keyboard) is calmhive's signature feature that enables autonomous AI development while you sleep, eat, or focus on other tasks. No other tool in the market offers true "away from keyboard" autonomous task completion--this is our unique differentiator.

This guide provides battle-tested patterns, optimization strategies, and real-world workflows to maximize AFk effectiveness.

## Core Principles

### 1. The AFk Mindset
AFk is not just a feature--it's a paradigm shift from reactive to autonomous development:

- **Delegate, Don't Micromanage**: Trust the AI to work independently
- **Think in Workflows**: Design multi-step processes rather than single commands
- **Embrace Asynchronicity**: Start tasks before breaks, meals, or sleep
- **Monitor Strategically**: Check progress at natural intervals

### 2. The Golden Rules

#### Rule #1: Specificity Enables Autonomy
```bash
# ❌ Too vague - will struggle
calmhive afk "fix the code"

# ✅ Specific and actionable
calmhive afk "refactor authentication module to use async/await, add comprehensive error handling, and update all related tests" --iterations 10
```

#### Rule #2: Iteration Count Matters
- **Simple tasks**: 3-5 iterations
- **Complex refactoring**: 8-15 iterations  
- **Large features**: 15-25 iterations
- **System overhauls**: 25-50 iterations

#### Rule #3: Model Selection for Task Complexity
```bash
# Quick fixes and simple tasks
calmhive afk "fix typos in documentation" --model haiku --iterations 3

# Standard development work (default)
calmhive afk "implement user authentication" --model sonnet --iterations 10

# Complex architecture and algorithms
calmhive afk "design microservices architecture" --model opus --iterations 15
```

## AFk Workflow Patterns

### Pattern 1: The Night Shift
*Start complex tasks before bed*

```bash
# Before going to sleep (22:00)
calmhive afk "migrate entire codebase from JavaScript to TypeScript, ensuring all tests pass and maintaining full functionality" --iterations 30 --model opus

# Check progress next morning (07:00)
calmhive afk status
```

**Best For**: 
- Large refactoring projects
- Technology migrations
- Performance optimizations
- Comprehensive test writing

### Pattern 2: The Lunch Break
*Medium tasks during meals*

```bash
# Before lunch (12:00)
calmhive afk "implement OAuth integration with Google and GitHub, including error handling and user feedback" --iterations 12

# Check after lunch (13:00)
calmhive afk status
calmhive tui  # Review progress in detail
```

**Best For**:
- Feature implementations
- API integrations
- Bug fixes with testing
- Documentation updates

### Pattern 3: The Meeting Runner
*Quick wins during meetings*

```bash
# Before a 30-minute meeting
calmhive afk "add TypeScript types to user.js and order.js files" --iterations 5

# Check after meeting
calmhive afk results
```

**Best For**:
- Type definitions
- Code cleanup
- Simple bug fixes
- Quick refactoring

### Pattern 4: The Weekend Warrior
*Long-running improvements over weekends*

```bash
# Friday evening
calmhive afk "implement comprehensive monitoring, logging, and alerting system with dashboards" --iterations 40 --model opus

# Monitor periodically with mobile app (v14.0.0)
# Review results Monday morning
```

**Best For**:
- Infrastructure improvements
- New major features
- Architecture overhauls
- Performance engineering

## Advanced AFk Techniques

### Multi-Session Orchestration
```bash
# Start multiple focused AFk sessions
calmhive afk "optimize database queries and add indexes" --iterations 8 &
calmhive afk "implement caching layer with Redis" --iterations 10 &
calmhive afk "add comprehensive API documentation" --iterations 6 &

# Monitor all sessions
calmhive afk status --all
```

### Progressive Enhancement
```bash
# Session 1: Basic implementation
calmhive afk "implement basic user registration with email verification" --iterations 8

# After Session 1 completes, enhance with Session 2
calmhive afk "add OAuth login options and two-factor authentication to existing user system" --iterations 12

# Session 3: Polish and optimize
calmhive afk "optimize user authentication flow for performance and add comprehensive security tests" --iterations 10
```

### Context-Aware Task Design
```bash
# Include relevant context in your task description
calmhive afk "refactor payment processing in src/payments/ to handle webhooks properly. Current issue: webhooks sometimes fail silently. Use existing error-handling patterns from src/notifications/. Ensure backward compatibility with v1 API." --iterations 15
```

## AFk Task Templates

### Template: Security Audit
```bash
calmhive afk "perform comprehensive security audit: scan for hardcoded credentials, check dependencies for vulnerabilities, validate input sanitization, review authentication flows, and create security report with recommendations" --iterations 20 --model opus
```

### Template: Performance Optimization
```bash
calmhive afk "optimize application performance: profile bottlenecks, optimize database queries, implement caching strategies, reduce bundle size, and create before/after performance benchmarks" --iterations 18 --model opus
```

### Template: API Development
```bash
calmhive afk "design and implement RESTful API for user management: create endpoints for CRUD operations, add input validation, implement rate limiting, write comprehensive tests, and generate OpenAPI documentation" --iterations 15
```

### Template: Bug Investigation
```bash
calmhive afk "investigate and fix intermittent login failures: reproduce the issue, identify root cause, implement fix with proper error handling, add monitoring to prevent recurrence, and update relevant tests" --iterations 12
```

### Template: Code Quality Improvement
```bash
calmhive afk "improve code quality across the project: add TypeScript types, implement linting rules, refactor complex functions, add missing tests, and update documentation to match current implementation" --iterations 25
```

## Monitoring and Management

### Using the TUI for AFk Management
```bash
# Launch terminal interface
calmhive tui

# Navigate to AFk sessions tab
# Use vim navigation: j/k to move, Enter to view details
# Press 'l' for live logs, 'q' to quit
```

### Command Line Status Checking
```bash
# Quick status of all sessions
calmhive afk status

# Detailed status of specific session
calmhive afk status session-id-here

# Live log tailing
calmhive afk tail session-id-here

# Stop a running session if needed
calmhive afk stop session-id-here
```

### Progress Interpretation
- **"Analyzing codebase"**: Understanding project structure
- **"Planning approach"**: Designing implementation strategy
- **"Implementing changes"**: Active development work
- **"Running tests"**: Validating changes
- **"Refining implementation"**: Polishing and optimizing
- **"Documenting changes"**: Creating documentation

## Optimization Strategies

### Task Decomposition
Break large tasks into focused subtasks for better results:

```bash
# Instead of one massive task:
# "rebuild entire frontend architecture"

# Use progressive sessions:
calmhive afk "analyze current frontend architecture and create migration plan to modern React patterns" --iterations 8

# Then based on the plan:
calmhive afk "migrate components to React hooks and functional patterns" --iterations 12
calmhive afk "implement state management with Redux Toolkit" --iterations 10
calmhive afk "optimize build process and bundle splitting" --iterations 8
```

### Context Optimization
Prepare your project for AFk success:

1. **Clean Git State**: Commit or stash changes before starting AFk
2. **Clear Documentation**: Ensure README and inline docs are current
3. **Test Suite Health**: Fix broken tests before refactoring sessions
4. **Dependency Management**: Update packages if needed
5. **IDE Configuration**: Ensure linting and formatting rules are clear

### Error Recovery Patterns
```bash
# If an AFk session encounters issues:

# 1. Check the logs
calmhive afk tail session-id-here

# 2. Review what was accomplished
calmhive afk results session-id-here

# 3. Restart with refined context
calmhive afk "continue previous task: [specific next steps based on results]" --iterations 8
```

## v14.4.0 New Features

### AFk Scheduler
Schedule AFk sessions using natural language:

```bash
# Schedule daily code reviews  
calmhive schedule create "daily at 2am" "calmhive afk 'review and refactor legacy code in src/legacy/' --iterations 10"

# Weekend maintenance tasks
calmhive schedule create "weekly on Saturday at 9am" "calmhive afk 'update dependencies and run security audit' --iterations 15"

# Monitor scheduled sessions
calmhive schedule list
calmhive schedule status
```

**Scheduler Best Practices:**
- Use autonomous commands (`run`, `afk`) not interactive ones (`chat`)
- Schedule during low-usage periods (nights, weekends)
- Monitor with `calmhive tui` and `calmhive progress <session-id>`
- Use templates for consistent scheduled workflows

### Template System with Scheduler Integration
```bash
# Template-driven scheduled automation
calmhive schedule create "weekly on Friday at 5pm" "$(calmhive template apply code-review-automation)"
calmhive schedule create "daily at 3am" "$(calmhive template apply performance-optimization --env=production)"

# Template variables are substituted at schedule time
calmhive template apply security-audit --severity=high --notify=slack://security-channel
```

### Cloud Sync (Coming Soon)
```bash
# Enable cloud sync for multi-device monitoring
calmhive config set cloud-sync enabled

# Monitor AFk sessions from mobile app
# Get notifications when tasks complete
```

## Real-World Case Studies

### Case Study 1: E-commerce Refactoring
**Scenario**: Legacy PHP e-commerce site needed modern architecture

**Approach**:
```bash
# Day 1 (Friday evening)
calmhive afk "analyze legacy PHP codebase structure and create migration plan to Node.js with detailed architecture recommendations" --iterations 15 --model opus

# Day 3 (Sunday morning)  
calmhive afk "implement user authentication and session management in Node.js based on migration plan, ensuring backward compatibility" --iterations 12

# Day 5 (Tuesday evening)
calmhive afk "migrate product catalog and shopping cart functionality to new Node.js architecture with comprehensive testing" --iterations 18
```

**Results**: 3-week migration completed over 5 AFk sessions, 40% performance improvement

### Case Study 2: Startup MVP Development
**Scenario**: Solo founder needed MVP in 2 weeks

**Approach**:
```bash
# Week 1 - Foundation
calmhive afk "create React frontend with user authentication, dashboard, and basic CRUD operations using modern best practices" --iterations 20 --model opus

# Week 2 - Features  
calmhive afk "implement payment processing with Stripe, user notifications, and admin panel with analytics dashboard" --iterations 15 --model opus

# Week 2 - Polish
calmhive afk "add comprehensive error handling, loading states, responsive design, and deploy to production with CI/CD" --iterations 12
```

**Results**: Full MVP delivered on time, raised seed funding

### Case Study 3: Open Source Contribution
**Scenario**: Contributing major feature to large open source project

**Approach**:
```bash
# Research phase
calmhive afk "analyze codebase architecture and identify optimal implementation approach for feature request #1234" --iterations 8

# Implementation
calmhive afk "implement feature according to project guidelines, including comprehensive tests and documentation" --iterations 15

# Polish for review
calmhive afk "refine implementation based on maintainer feedback, optimize performance, and ensure code style compliance" --iterations 10
```

**Results**: Feature accepted, became project maintainer

## Troubleshooting Common Issues

### Issue: AFk Session Stalls
**Symptoms**: Session shows "running" but no progress for >30 minutes

**Solutions**:
```bash
# Check logs for specific error
calmhive afk tail session-id

# If API rate limited, session will auto-retry
# If stuck on complex decision, provide more context:
calmhive afk stop session-id
calmhive afk "continue previous task with this guidance: [specific direction]"
```

### Issue: Unsatisfactory Results
**Symptoms**: AFk completes but results don't meet expectations

**Solutions**:
1. **Increase iterations**: Complex tasks need more cycles
2. **Add specificity**: Include examples of desired outcome
3. **Use higher model**: Switch to Opus for complex work
4. **Provide context**: Reference existing patterns in codebase

### Issue: Resource Conflicts
**Symptoms**: Multiple AFk sessions interfere with each other

**Solutions**:
```bash
# Check all running sessions
calmhive afk status --all

# Ensure sessions work on different parts of codebase
# Use git branches for parallel AFk development:
git checkout -b afk-feature-a
calmhive afk "implement feature A" --iterations 10

git checkout -b afk-feature-b  
calmhive afk "implement feature B" --iterations 8
```

## Performance Optimization

### Model Selection Strategy
- **Haiku**: Simple, repetitive tasks (type definitions, basic fixes)
- **Sonnet**: Standard development work (most common choice)
- **Opus**: Complex architecture, algorithms, and critical business logic

### Iteration Optimization
Monitor success patterns and adjust:
```bash
# Track your successful iteration counts
echo "Task: Authentication system, Iterations: 12, Success: ✅" >> ~/.calmhive/afk-patterns.log

# Use successful patterns for similar tasks
grep "Authentication" ~/.calmhive/afk-patterns.log
```

### Context Window Management
Optimize for model context limits:
- Clean up generated files between sessions
- Remove verbose logs and debug output
- Archive old documentation before major rewrites
- Use focused task descriptions rather than background info

## Integration with Development Workflow

### Git Integration Patterns
```bash
# Start feature branch before AFk
git checkout -b feature/user-profiles
calmhive afk "implement user profile management with avatar upload and privacy settings" --iterations 12

# After AFk completion, review and refine
git add -A
git commit -m "feat: implement user profile management

- Added profile editing interface
- Implemented avatar upload with image processing  
- Added privacy settings and visibility controls
- Comprehensive test coverage
- API documentation updated

🤖 Generated with calmhive AFk"

# Push for review
git push origin feature/user-profiles
```

### CI/CD Integration
```bash
# Ensure AFk changes pass CI
calmhive afk "implement feature X ensuring all tests pass and code meets project quality standards" --iterations 10

# Or fix CI failures
calmhive afk "fix failing CI tests and linting issues while maintaining functionality" --iterations 6
```

### Code Review Preparation
```bash
# Have AFk prepare code for review
calmhive afk "review and polish recent changes: improve comments, ensure consistent style, add missing tests, and optimize for maintainability" --iterations 8
```

## Community and Collaboration

### Sharing AFk Patterns
```bash
# Use template system for consistent AFk workflows (v14.0.0)
calmhive template apply security-audit --target=production --notify=slack://dev-team
calmhive schedule create "weekly on Sunday at 1am" "$(calmhive template apply security-audit)"
```

### Team AFk Guidelines
1. **Coordinate Sessions**: Use shared calendar for AFk scheduling
2. **Branch Strategy**: Use dedicated AFk branches
3. **Communication**: Share AFk results in team channels
4. **Standards**: Establish team iteration count guidelines
5. **Review Process**: Code review all AFk output before merging

### Contributing to AFk Patterns
- Document successful AFk workflows
- Share iteration count recommendations
- Contribute to community template library
- Report and help improve edge cases

## Future AFk Capabilities

### v14.4.0 Features (Available Now)
- **✅ Scheduler**: Natural language cron scheduling for AFk automation
- **✅ Template System**: Variable substitution for complex workflows  
- **✅ Progress Tracking**: Detailed iteration summaries and monitoring
- **✅ Work Command**: Intelligent task automation with model selection

### Coming in v15.0.0
- **Cloud Sync**: Multi-device monitoring
- **Analytics**: Success rate and performance tracking
- **Mobile App**: Remote AFk monitoring

### Vision for v15.0.0+
- **Team Collaboration**: Shared AFk sessions
- **AI Learning**: Personalized iteration recommendations
- **IDE Integration**: Native VS Code AFk controls
- **Self-Improvement**: AFk sessions that optimize their own performance

---

*AFk represents the future of development--where AI works autonomously on your behalf. Master these patterns to 10x your development productivity.*

**Document Version**: 1.0 for v14.4.0  
**Last Updated**: 2025-07-04  
**Community**: Share your AFk patterns at https://discord.gg/calmhive