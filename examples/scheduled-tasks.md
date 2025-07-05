# 🐝 Calmhive Scheduled Task Examples

A collection of production-ready scheduled tasks that solve real developer problems. These can be used as templates or inspiration for your own automated workflows.

## Code Quality & Maintenance

### 1. Daily ESLint Deep Scan & Auto-Fix
**Schedule**: Every day at 6am  
**Iterations**: 10  
**Purpose**: Maintain code quality automatically without manual intervention

```bash
calmhive schedule create "every day at 6am" \
  "calmhive afk 'Perform comprehensive ESLint analysis on the entire codebase. First, run eslint on all JavaScript files in lib/, cmd/, and test/ directories to get a full diagnostic report. Categorize all warnings by type (no-unused-vars, prefer-const, no-case-declarations, etc). For the top 5 most common warning types, systematically fix 10 instances of each type, ensuring proper variable usage or safe removal of dead code. After each fix, run the specific test file related to that module to ensure no regressions. Create a detailed report showing: total warnings before/after, warnings fixed by category, any code patterns that need manual review. If any tests fail, revert that specific fix and document why it needs manual intervention. Finally, commit all successful fixes with a message detailing each category of fixes made.' --iterations 10"
```

**Benefits**:
- Prevents ESLint warnings from accumulating
- Safe automated fixes with test verification
- Detailed audit trail of changes
- Focuses on most common issues first

### 2. Bi-weekly Dead Code Elimination
**Schedule**: Every 2 weeks on Friday at 4pm  
**Iterations**: 12  
**Purpose**: Automatically find and safely remove unused code

```bash
calmhive schedule create "every 2 weeks on Friday at 4pm" \
  "calmhive afk 'Identify and safely remove dead code from the codebase. Use multiple detection methods: 1) Run coverage reports to find uncovered functions, 2) Use AST analysis to find unreferenced exports, 3) Search for commented-out code blocks older than 30 days, 4) Find unused dependencies in package.json. For each piece of dead code found, trace all potential references using advanced grep patterns and AST parsing. Create a backup branch before removal. Remove dead code in small batches, running relevant tests after each removal. Document any code that appears dead but might be used by external tools or scripts. Generate a report showing: lines of code removed, functions deleted, dependencies removed, and estimated bundle size reduction. Only proceed with removal if all tests pass. Commit with detailed message about what was removed and why it was safe to remove.' --iterations 12"
```

**Benefits**:
- Reduces technical debt automatically
- Multiple detection methods for accuracy
- Safe removal with backup and testing
- Improves bundle size and maintainability

## Security & Dependencies

### 3. Weekly Dependency Security Audit
**Schedule**: Every Monday at 8am  
**Iterations**: 8  
**Purpose**: Proactive security vulnerability management

```bash
calmhive schedule create "every Monday at 8am" \
  "calmhive afk 'Conduct a comprehensive security audit of all npm dependencies. Run npm audit to identify vulnerabilities. For each vulnerability found, research the security advisory details, understand the attack vector, and evaluate the impact on our codebase. For critical and high severity issues, check if patches are available and test them in isolation. For medium/low issues, document them with mitigation strategies. Update all dependencies that have security patches available, running the full test suite after each update to ensure compatibility. If breaking changes are detected, create a migration plan. Generate a security report including: vulnerabilities found, patches applied, dependencies that need manual updates, and any temporary mitigations implemented. Commit the updated package-lock.json with detailed notes about each security fix.' --iterations 8"
```

**Benefits**:
- Automated security patching
- Risk assessment for each vulnerability
- Compatibility testing before updates
- Compliance audit trail

## Testing & Performance

### 4. Daily Test Coverage Gap Analysis
**Schedule**: Every day at 11pm  
**Iterations**: 8  
**Purpose**: Continuously improve test coverage for critical code

```bash
calmhive schedule create "every day at 11pm" \
  "calmhive afk 'Analyze test coverage gaps and write missing tests for uncovered code. Run nyc coverage report to identify files with less than 80% coverage. For each low-coverage file, analyze the uncovered lines and understand why they lack tests. Prioritize by: 1) Critical business logic, 2) Error handling paths, 3) Edge cases, 4) Integration points. For the top 3 most critical uncovered functions, write comprehensive test suites including: happy path tests, error scenarios, edge cases, and integration tests. Use property-based testing for functions with complex input domains. Ensure each new test is meaningful and not just coverage padding. After writing tests, verify they actually catch bugs by temporarily breaking the implementation. Document any code that is intentionally not tested (e.g., CLI output formatting) with @no-coverage comments. Commit new tests with messages explaining what scenarios they cover.' --iterations 8"
```

**Benefits**:
- Automated test writing for critical paths
- Focuses on meaningful coverage, not padding
- Verifies tests actually catch bugs
- Documents untestable code properly

### 5. Weekly Performance Profiling & Optimization
**Schedule**: Every Wednesday at 2am  
**Iterations**: 10  
**Purpose**: Find and fix performance bottlenecks automatically

```bash
calmhive schedule create "every Wednesday at 2am" \
  "calmhive afk 'Profile application performance and optimize bottlenecks. Set up performance benchmarks for key operations: 1) AFk session initialization, 2) Database queries, 3) File I/O operations, 4) Template rendering. Run each benchmark 100 times to get statistically significant results. Use Node.js profiler and flame graphs to identify CPU bottlenecks. For the top 3 bottlenecks found, implement optimizations such as: caching frequently accessed data, optimizing database queries with better indexes, reducing unnecessary file system calls, implementing lazy loading, or improving algorithm complexity. After each optimization, re-run benchmarks to measure improvement. Only keep optimizations that show >10% improvement without increasing code complexity significantly. Create a performance report showing: baseline metrics, bottlenecks identified, optimizations applied, and performance gains achieved. Commit optimizations with benchmark results in the commit message.' --iterations 10"
```

**Benefits**:
- Data-driven optimization decisions
- Statistically significant measurements
- Only keeps meaningful improvements
- Detailed performance tracking

## Documentation & API

### 6. Weekly Documentation Freshness Check
**Schedule**: Every Sunday at 10am  
**Iterations**: 12  
**Purpose**: Keep documentation in sync with code automatically

```bash
calmhive schedule create "every Sunday at 10am" \
  "calmhive afk 'Ensure all documentation accurately reflects the current codebase state. Scan all markdown files for code examples, API references, and configuration snippets. For each code example found, verify it actually works by extracting and executing it in a clean environment. Check that all mentioned CLI commands still exist and have the same flags. Verify that configuration examples match the current schema. For any outdated documentation found: 1) Update code examples to working versions, 2) Fix incorrect CLI commands and flags, 3) Update configuration examples with new required fields, 4) Add deprecation notices for removed features, 5) Include examples of new features added since last update. Cross-reference README.md with actual implemented features to ensure feature parity. Generate a documentation health report showing: outdated examples fixed, new features documented, deprecated features marked. Commit documentation updates with clear notes about what was outdated and how it was fixed.' --iterations 12"
```

**Benefits**:
- Documentation never gets stale
- All examples guaranteed to work
- New features get documented
- Deprecations tracked properly

## Infrastructure & Monitoring

### 7. Hourly Health Check with Auto-Remediation
**Schedule**: Every hour  
**Iterations**: 3  
**Purpose**: Keep system healthy with automatic fixes

```bash
calmhive schedule create "every hour" \
  "calmhive afk 'Perform system health check and auto-remediate common issues. Check: 1) Disk space usage in .claude/calmhive directory, 2) Session database integrity, 3) Orphaned AFk processes, 4) Corrupted schedule files, 5) Lock file staleness. For disk space issues: identify sessions older than 30 days and archive them, clean up log files larger than 100MB, remove duplicate backup files. For database issues: run integrity check, repair corrupted entries, optimize database file. For orphaned processes: identify AFk processes without active sessions, send graceful shutdown signals, force kill if unresponsive after 30 seconds. For corrupted files: attempt recovery from backups, rebuild from partial data if possible. Generate health report with: issues found, auto-remediation actions taken, issues requiring manual intervention. Only take destructive actions if backup exists. Create system snapshot before remediation. Log all actions for audit trail.' --iterations 3"
```

**Benefits**:
- Prevents system degradation
- Automatic cleanup and optimization
- Safe with backup requirements
- Detailed audit logging

### 8. Daily Development Environment Optimizer
**Schedule**: Daily at 3am  
**Iterations**: 6  
**Purpose**: Keep development environment fast and clean

```bash
calmhive schedule create "daily at 3am" \
  "calmhive afk 'Optimize the development environment for maximum productivity. First, analyze git repository for: uncommitted changes older than 7 days, branches that have been merged but not deleted, large files that should be in .gitignore. Clean up: remove merged branches locally and remotely, suggest commits for old uncommitted work, add common build artifacts to .gitignore. Next, optimize node_modules: remove duplicate packages, run npm dedupe, identify and remove unused dependencies from package.json. Then, analyze TypeScript/JavaScript imports: find and fix circular dependencies, optimize import order for faster compilation, convert require() to ES6 imports where beneficial. Also check for: outdated VS Code settings, missing helpful extensions, suboptimal linter rules. Generate environment health score and improvement recommendations. Apply safe optimizations automatically, list risky ones for manual review. Measure and report startup time improvements.' --iterations 6"
```

**Benefits**:
- Faster development environment
- Cleaner git repository
- Optimized dependencies
- Better IDE configuration

## Learning & Improvement

### 9. Weekly CLAUDE.md Evolution
**Schedule**: Every Friday at 5pm  
**Iterations**: 8  
**Purpose**: Learn from usage patterns and improve AI instructions

```bash
calmhive schedule create "every Friday at 5pm" \
  "calmhive afk 'Evolve CLAUDE.md based on usage patterns from the past week. Analyze all AFk session logs to identify: 1) Common command patterns that could become proven patterns, 2) Frequent errors that need anti-pattern documentation, 3) Successful troubleshooting approaches that should be remembered, 4) New tool combinations that work well together. For each pattern identified, verify it worked successfully at least 3 times. Add new proven patterns to the appropriate sections with real examples. For anti-patterns, document what went wrong and the correct approach. Update the Quick Reference Card with new shortcuts discovered. Enhance behavioral triggers based on observed issues. Keep all existing content but mark outdated patterns as deprecated. Ensure all code examples in CLAUDE.md actually work by testing them. Generate a CLAUDE.md evolution report showing: new patterns added, anti-patterns documented, shortcuts discovered. Commit the updated CLAUDE.md with notes about what real-world usage taught us.' --iterations 8"
```

**Benefits**:
- AI instructions improve over time
- Captures institutional knowledge
- Documents what works and what doesn't
- Continuously learning system

### 10. Monthly API Compatibility Report
**Schedule**: First Monday of every month at 9am  
**Iterations**: 15  
**Purpose**: Ensure API compatibility and proper versioning

```bash
calmhive schedule create "first Monday of every month at 9am" \
  "calmhive afk 'Generate comprehensive API compatibility report for all public interfaces. Identify all exported functions, classes, and constants from index files and lib modules. For each public API: 1) Check if the signature has changed from last month, 2) Verify that all documented parameters are still accepted, 3) Test that return types match documentation, 4) Ensure error handling is consistent. Run integration tests that external users might have to ensure we have not broken compatibility. For any breaking changes found, determine if they were intentional and properly versioned. Create migration guides for any breaking changes. Test that old usage patterns still work or fail gracefully with helpful error messages. Generate a compatibility matrix showing which versions support which APIs. If critical compatibility issues are found, create compatibility shims. Document all findings in CHANGELOG.md with proper semantic versioning notes.' --iterations 15"
```

**Benefits**:
- Prevents accidental breaking changes
- Ensures proper semantic versioning
- Creates migration guides automatically
- Maintains backwards compatibility

## Tips for Creating Your Own Scheduled Tasks

1. **Be Specific**: The more detailed your prompt, the better the results
2. **Include Safety Checks**: Always test before making changes
3. **Set Appropriate Iterations**: More complex tasks need more iterations
4. **Consider Timing**: Run heavy tasks during off-hours
5. **Add Reporting**: Generate reports for audit trails
6. **Make It Idempotent**: Tasks should be safe to run multiple times
7. **Handle Errors Gracefully**: Plan for failures and rollbacks

## Integration Ideas

- Combine with templates: `$(calmhive template apply bug-fix ISSUE="memory leak")`
- Chain multiple schedules: Morning analysis → Afternoon fixes → Evening report
- Use with monitoring: Health checks → Auto-remediation → Alerts
- Build workflows: Test → Build → Deploy → Monitor

## Additional Premium Examples

### 11. Monthly API Compatibility Report
**Schedule**: First Monday of every month at 9am  
**Iterations**: 15  
**Purpose**: Ensure API compatibility and proper versioning

```bash
calmhive schedule create "first Monday of every month at 9am" \
  "calmhive afk 'Generate comprehensive API compatibility report for all public interfaces. Identify all exported functions, classes, and constants from index files and lib modules. For each public API: 1) Check if the signature has changed from last month, 2) Verify that all documented parameters are still accepted, 3) Test that return types match documentation, 4) Ensure error handling is consistent. Run integration tests that external users might have to ensure we have not broken compatibility. For any breaking changes found, determine if they were intentional and properly versioned. Create migration guides for any breaking changes. Test that old usage patterns still work or fail gracefully with helpful error messages. Generate a compatibility matrix showing which versions support which APIs. If critical compatibility issues are found, create compatibility shims. Document all findings in CHANGELOG.md with proper semantic versioning notes.' --iterations 15"
```

**Benefits**:
- Prevents accidental breaking changes
- Ensures proper semantic versioning
- Helps users migrate between versions
- Maintains API trust and stability

### 12. Hourly Health Check with Auto-Remediation
**Schedule**: Every hour  
**Iterations**: 3  
**Purpose**: Keep system healthy with automatic fixes

```bash
calmhive schedule create "every hour" \
  "calmhive afk 'Perform system health check and auto-remediate common issues. Check: 1) Disk space usage in .claude/calmhive directory, 2) Session database integrity, 3) Orphaned AFk processes, 4) Corrupted schedule files, 5) Lock file staleness. For disk space issues: identify sessions older than 30 days and archive them, clean up log files larger than 100MB, remove duplicate backup files. For database issues: run integrity check, repair corrupted entries, optimize database file. For orphaned processes: identify AFk processes without active sessions, send graceful shutdown signals, force kill if unresponsive after 30 seconds. For corrupted files: attempt recovery from backups, rebuild from partial data if possible. Generate health report with: issues found, auto-remediation actions taken, issues requiring manual intervention. Only take destructive actions if backup exists. Create system snapshot before remediation. Log all actions for audit trail.' --iterations 3"
```

**Benefits**:
- Prevents system degradation
- Catches issues before they become critical
- Automatic cleanup saves manual work
- Detailed audit trail for debugging

### 13. Daily Development Environment Optimizer
**Schedule**: Daily at 3am  
**Iterations**: 6  
**Purpose**: Keep development environment fast and clean

```bash
calmhive schedule create "daily at 3am" \
  "calmhive afk 'Optimize the development environment for maximum productivity. First, analyze git repository for: uncommitted changes older than 7 days, branches that have been merged but not deleted, large files that should be in .gitignore. Clean up: remove merged branches locally and remotely, suggest commits for old uncommitted work, add common build artifacts to .gitignore. Next, optimize node_modules: remove duplicate packages, run npm dedupe, identify and remove unused dependencies from package.json. Then, analyze TypeScript/JavaScript imports: find and fix circular dependencies, optimize import order for faster compilation, convert require() to ES6 imports where beneficial. Also check for: outdated VS Code settings, missing helpful extensions, suboptimal linter rules. Generate environment health score and improvement recommendations. Apply safe optimizations automatically, list risky ones for manual review. Measure and report startup time improvements.' --iterations 6"
```

**Benefits**:
- Keeps dev environment fast
- Prevents git branch clutter
- Optimizes build times
- Suggests productivity improvements

Remember: These are real tasks that solve real problems. Adapt them to your specific needs!