# Calmhive v14.0.0 Changelog
*From Experimental CLI to Production AI Development Platform*

## [14.2.8] - 2025-07-06

### 🐛 Bug Fixes
- **Fixed injection spam during typing** - Smart detection prevents #2-29 injection spam when typing rapidly
- **Fixed AFk rule drift** - Rules now re-injected at each iteration to maintain CLAUDE.md adherence
- **Fixed conversation tracking** - Single messages properly generate session IDs for deduplication

### 🚀 Improvements
- **Typing pattern detection** - Prevents mid-word injections for cleaner conversations
- **AFk rule persistence** - Long-running sessions maintain rules throughout all iterations
- **Better tool differentiation** - Distinguishes between tool requests and tool results
- **Session ID generation** - Fixed bug where single messages returned null session IDs

### 📊 Technical Details
- Enhanced `chat-interceptor.js` with `isTypingContinuation()` function
- Modified `process-manager.js` to re-inject rules in `runSingleIteration`
- Added comprehensive test coverage for injection behavior
- Network interceptor confirmed working in interactive mode

## [14.0.0] - 2025-07-05

### 🎉 **Major Feature Release**

This release delivers five major features that transform Calmhive into a comprehensive AI automation platform:

#### 📅 **Natural Language Scheduling**
- Schedule tasks using natural language like "daily at 9am" or "every Monday"
- Powered by Claude Code CLI integration for accurate parsing
- **NEW: Seamless scheduler service** - Just works, no daemon management needed
- **NEW: Update command** - Modify existing schedules without recreating
- **NEW: Timezone auto-detection** - No more Pacific time surprises
- Persistent schedules with automatic restoration
- Simple lifecycle: create, restore, update, stop, delete
- Command: `calmhive schedule` (alias: `s`)

#### 📋 **Task Templates System**
- 5 built-in templates for common workflows:
  - `bug-fix`: Systematic bug investigation (8 iterations)
  - `feature-development`: End-to-end implementation (12 iterations)
  - `refactoring`: Safe code refactoring (10 iterations)
  - `testing-setup`: Test infrastructure (6 iterations)
  - `performance-optimization`: Performance tuning (8 iterations)
- Variable substitution for customization
- Export templates to markdown
- Command: `calmhive template` (alias: `tmp`)

#### 📈 **Enhanced Progress Tracking**
- Real-time progress monitoring for AFk sessions
- **NEW: Iteration summaries** - See what happened in each iteration
- Track iterations, milestones, achievements, and challenges
- Progress notifications in AFk logs
- Detailed analytics and summaries
- Command: `calmhive progress` (alias: `p`)

#### 🧪 **Test Infrastructure Overhaul**
- Migrated from Node.js assert to Mocha/Chai/Sinon
- 54+ comprehensive tests with real code evaluation
- NYC coverage reporting with progressive thresholds
- Unified test runner with category support
- Pre-commit hooks for quality gates

#### 🔧 **Code Quality Improvements**
- Fixed all critical ESLint errors (5 → 0)  
- Reduced ESLint warnings (94 → 80)
- Enhanced AFk integration with progress tracking
- Improved command aliases and shortcuts

### 🐛 **Bug Fixes & Improvements** (Latest Session)
- **FIXED: Version Consistency** - Eliminated hardcoded v9.0.0 references across all commands
- **FIXED: Timezone Calculations** - Relative times like "in 1 minute" now use system timezone
- **FIXED: Claude CLI Integration** - Updated to use JSON output format and increased timeouts
- **VERIFIED: AFk Performance** - Confirmed AFk sessions work correctly, progress tracking functional
- **VERIFIED: Scheduler Integration** - End-to-end scheduler → AFk workflow tested and working
- **DOCUMENTATION: Version Clarity** - README updated to clarify v13.0.5 (published) vs v14.0.0 (development)
- Better error handling and recovery

### 📊 **By The Numbers**
- **0** critical ESLint errors (down from 5)
- **54+** comprehensive tests
- **5** built-in task templates
- **8** schedule management commands
- **3** new command aliases (s, tmp, p)

### 🐛 **Bug Fixes**
- Fixed schedule name generation showing "undefined"
- Fixed template variable substitution
- Fixed various scope and unused variable issues
- Fixed async promise executor patterns

### 📚 **Documentation**
- Updated README with v14 features and examples
- Added comprehensive workflow examples
- Enhanced command documentation
- Added automated workflow patterns

### 💔 **Breaking Changes**
None - v14 is fully backward compatible.

## [14.0.0-alpha.1] - 2025-07-04

### 🎯 **Vision**
Transform calmhive from experimental CLI wrapper into the premier platform for autonomous AI development workflows, with unique AFk (Away From Keyboard) capabilities that no competitor offers.

### 📋 **Planning Phase Complete**
- [x] Comprehensive market research and competitive analysis
- [x] Technical architecture deep-dive
- [x] Three-pillar v14.0.0 strategy defined
- [x] 7-week implementation timeline established

### 📚 **Documentation Foundation**
- [x] **ROADMAP-v14.md** - Comprehensive feature specifications and timeline
- [x] **Package.json** - Version bump to 14.0.0-alpha.1 with test infrastructure
- [x] **Test Scripts** - Complete npm script suite for quality assurance
- [ ] **DELTA.md** - Updated with v14.0.0 vision
- [ ] **TESTING-STRATEGY.md** - Quality goals and metrics
- [ ] **AFk-BEST-PRACTICES.md** - Advanced usage patterns
- [ ] **API-REFERENCE.md** - Extension developer guide

### 🔧 **Technical Infrastructure**
- [x] **Version Management** - Alpha versioning strategy
- [x] **Dev Dependencies** - ESLint, NYC, Sinon for quality tools
- [x] **Build Pipeline** - Comprehensive test and lint scripts
- [ ] **Test Infrastructure** - Basic test framework implementation
- [ ] **CI/CD Pipeline** - GitHub Actions workflow
- [ ] **Coverage Targets** - 80%+ test coverage goal

### 🚀 **Upcoming Milestones**

#### **Alpha Phase (Weeks 1-2): Quality Foundation**
**Target**: Test coverage from 14% to 80%+, CI/CD pipeline, error recovery

Priority Tasks:
1. **Test Infrastructure Overhaul**
   - Implement npm test script functionality
   - Create comprehensive test suites
   - Set up GitHub Actions CI/CD
   - Add coverage reporting and badges

2. **Error Recovery System**
   - Graceful degradation mechanisms
   - State persistence every 30 seconds
   - Auto-resume interrupted AFk sessions
   - Manual intervention prompts

3. **Quality Metrics**
   - Performance monitoring
   - Success rate tracking
   - Resource usage analytics

#### **Beta Phase (Weeks 3-5): AFk Evolution**
**Target**: Advanced scheduling, templates, cloud sync, performance analytics

Key Features:
1. **AFk Scheduler with Cron Support**
   ```bash
   calmhive schedule "review code" --cron "0 2 * * *" --iterations 10
   ```

2. **Task Template System**
   ```yaml
   # .calmhive/templates/security-audit.yaml
   name: security-audit
   model: opus
   iterations: 15
   ```

3. **Cloud Sync & Mobile Monitoring**
   - Real-time AFk status sync
   - WebSocket live updates
   - React Native companion app

4. **Performance Analytics Dashboard**
   - Success/failure rates
   - Token usage tracking
   - Error frequency analysis

#### **RC Phase (Weeks 6-7): Ecosystem Integration**
**Target**: VS Code extension prep, Docker support, MCP expansion

Integration Points:
1. **VS Code Extension Groundwork**
   - Language Server Protocol (LSP)
   - Status bar AFk indicators
   - Command palette integration

2. **Docker & Isolation**
   - Production Dockerfile
   - Docker Compose support
   - Isolated execution environments

3. **MCP Tool Expansion**
   - Calmhive MCP server
   - Claude Code integration
   - Tool marketplace preparation

### 📊 **Success Metrics Targets**

#### Technical Excellence
- [x] Test coverage: Currently 14% → Target 80%+
- [ ] AFk success rate: Target 95%+
- [ ] Response time: Target <100ms average
- [ ] Memory usage: Target <150MB
- [ ] Zero critical security vulnerabilities

#### Community Growth  
- [ ] GitHub stars: 1000+ (from current ~100)
- [ ] npm weekly downloads: 5000+
- [ ] Active contributors: 50+
- [ ] Template marketplace: 100+ templates
- [ ] Discord community: 500+ members

#### Business Impact
- [ ] Enterprise pilot programs: 5+
- [ ] Case studies published: 10+
- [ ] Conference talks delivered: 3+
- [ ] Blog post series completed
- [ ] Documentation satisfaction: 90%+

### 🔍 **Market Positioning Insights**

#### Competitive Advantages Identified
- **Unique AFk Processing**: No competitor offers "away from keyboard" autonomous task completion
- **Claude Code Integration**: While others build parallel tools, we enhance the official CLI
- **Background Execution**: Competitors focus on IDE integration; we enable true automation

#### Market Gaps We Fill
- **Long-running Tasks**: Developers need AI that works while they sleep
- **Autonomous Workflows**: Beyond assisted coding to truly independent execution
- **Production Reliability**: Enterprise-grade background processing

### 🐛 **Known Issues to Address**
- Test coverage critically low (14%)
- No CI/CD pipeline
- Missing error recovery mechanisms
- Limited documentation for advanced features
- No template system for common workflows

### 🎉 **Community Feedback Integration**
- Discord discussions on AFk scheduling requirements
- GitHub issues prioritized for v14.0.0
- User survey results on desired template types
- Enterprise pilot feedback on reliability needs

---

## Upcoming Releases

### [14.0.0-beta.1] - Planned 2025-07-18
- AFk Scheduler with cron syntax
- Task template system
- Basic cloud sync API
- Performance analytics dashboard

### [14.0.0-rc.1] - Planned 2025-08-01  
- VS Code extension groundwork
- Docker support
- MCP server implementation
- Interactive onboarding

### [14.0.0] - Planned 2025-08-15
- Production release
- Full documentation
- Template marketplace
- Community launch

---

## Development Notes

### Implementation Strategy
We're following a three-pillar approach:
1. **Quality First**: Fix the foundation before building
2. **AFk Evolution**: Double down on our unique differentiator  
3. **Ecosystem Prep**: Build bridges to the broader development ecosystem

### Community Engagement
- Weekly progress updates on Discord
- Bi-weekly community calls for feedback
- Open source contributions welcomed
- Template marketplace community-driven

### Risk Mitigation
- Extensive beta testing program
- Cross-platform CI testing
- Backwards compatibility guarantees
- Migration guides and tooling

---

*This changelog will be updated with each milestone completion.*

**Last Updated**: 2025-07-04  
**Next Update**: After alpha implementation phase  
**Feedback**: GitHub Issues or Discord #v14-changelog