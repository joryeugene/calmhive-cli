# Claude Code Best Practices & Tips

*Comprehensive guide compiled from official Anthropic documentation and community insights*

## Table of Contents
- [Getting Started](#getting-started)
- [Core Commands & CLI Usage](#core-commands--cli-usage)
- [CLAUDE.md Files & Project Memory](#claudemd-files--project-memory)
- [Advanced Features](#advanced-features)
- [Custom Slash Commands](#custom-slash-commands)
- [Thinking Modes](#thinking-modes)
- [Workflow Strategies](#workflow-strategies)
- [Safety & Permissions](#safety--permissions)
- [Collaboration Tips](#collaboration-tips)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Installation
```bash
npm install -g @anthropic-ai/claude-code
```

### Basic Usage
```bash
# Start interactive REPL
claude

# Start with initial prompt
claude "explain this codebase"

# One-shot query via SDK
claude -p "fix the bug in auth.js"

# Continue most recent conversation
claude -c

# Update to latest version
claude update
```

### Key CLI Flags
- `--add-dir`: Add working directories
- `--print/-p`: Print response without interactive mode
- `--output-format`: Specify format (text, json, stream-json)
- `--verbose`: Enable detailed logging
- `--model`: Set model for session
- `--continue`: Load most recent conversation
- `--resume`: Resume specific session

## Core Commands & CLI Usage

### Essential Commands
```bash
# Basic commands
claude                           # Start REPL
claude "query"                   # Start with prompt
claude -p "query"               # Query and exit
claude -c                       # Continue conversation

# Data input methods
cat file.txt | claude           # Pipe data
claude -p "analyze" < data.csv  # Redirect input

# Session management
claude --resume session_id      # Resume specific session
claude --model claude-3-opus    # Use specific model
```

### Piping and Data Input
Claude Code supports multiple data input methods:
- Copy and paste directly into prompts
- Pipe data: `cat foo.txt | claude`
- Tell Claude to pull data via bash commands
- Ask Claude to read files or fetch URLs
- Use for logs, CSVs, and large datasets

## CLAUDE.md Files & Project Memory

### Purpose
CLAUDE.md files serve as project memory and context for Claude Code. They help maintain consistency across sessions and team members.

### What to Include
```markdown
# Project: MyApp

## Development Commands
- `npm run dev` - Start development server
- `npm test` - Run test suite
- `npm run build` - Build for production

## Code Style
- Use TypeScript for all new files
- Follow ESLint configuration
- Use Prettier for formatting
- 2-space indentation

## Testing Guidelines
- Write unit tests for all utilities
- Integration tests for API endpoints
- Use Jest and React Testing Library

## Repository Structure
- `/src` - Source code
- `/tests` - Test files
- `/docs` - Documentation
- `/scripts` - Build and deployment scripts

## Common Patterns
- Use custom hooks for state management
- Prefer composition over inheritance
- Always handle error states in components
```

### Team Benefits
- Include CLAUDE.md changes in commits
- Share knowledge across team members
- Maintain consistency in coding standards
- Document project-specific commands and patterns

## Advanced Features

### MCP Integration
```bash
# Configure MCP servers
claude mcp add my-server -s project /path/to/server
claude mcp get my-server
claude mcp list
```

### Git Integration
- Search git history
- Resolve merge conflicts
- Create commits and pull requests
- Browse repository context

### Multi-Language Support
- Works with any programming language
- Understands project context automatically
- Adapts to existing code patterns

## Custom Slash Commands

### Creating Custom Commands
Place markdown files in `.claude/commands/` to create custom slash commands:

```markdown
<!-- .claude/commands/fix-github-issue.md -->
# Fix GitHub Issue

1. Use `gh issue view {issue_number}` to get issue details
2. Analyze the problem and identify root cause
3. Implement the fix following project patterns
4. Write or update tests
5. Create descriptive commit message
6. Verify the fix resolves the issue
```

Access with: `/project:fix-github-issue`

### Useful Custom Commands
- `/create-docs` - Generate comprehensive documentation
- `/run-tests` - Execute test suite with reporting
- `/deploy-staging` - Deploy to staging environment
- `/code-review` - Perform code review checklist
- `/refactor-component` - Modernize legacy components

### Command Categories
- **Project-specific**: Commands for your specific codebase
- **Personal**: Commands for your workflow preferences
- **Dynamic**: Commands with arguments and parameters

## Thinking Modes

### Understanding Thinking Modes
Claude Code includes "thinking" modes that allocate additional computation time for complex problems.

### Thinking Levels
```
think < think hard < think harder < ultrathink
```

### Token Allocations
- `think`: ~4,000 tokens
- `think hard`: ~6,000 tokens
- `megathink`: ~10,000 tokens
- `ultrathink`: ~32,000 tokens

### When to Use
- **think**: Standard problem-solving
- **think hard**: Complex debugging or architecture decisions
- **ultrathink**: Extremely complex problems requiring deep analysis

### Usage Examples
```bash
claude "think hard about optimizing this algorithm"
claude "ultrathink the best architecture for this microservice"
```

## Workflow Strategies

### Recommended Workflows

#### 1. Explore, Plan, Code, Commit
```bash
# Explore codebase
claude "give me an overview of this project structure"

# Plan changes
claude "think about the best approach to add user authentication"

# Implement
claude "implement JWT authentication with Express middleware"

# Commit
claude "create a commit with proper message for auth implementation"
```

#### 2. Test-Driven Development
```bash
# Write tests first
claude "write unit tests for user authentication module"

# Implement to pass tests
claude "implement the authentication module to pass these tests"

# Refactor
claude "refactor the auth code for better readability"
```

#### 3. Visual Iteration
- Provide screenshots for UI work
- Use mockups as targets
- Iterate based on visual feedback

#### 4. Bug Fixing Workflow
```bash
# Reproduce issue
claude "help me reproduce this authentication bug"

# Analyze
claude "think hard about what could cause this auth failure"

# Fix
claude "implement a fix for the authentication issue"

# Verify
claude "write tests to ensure this bug doesn't happen again"
```

### Large Task Management
For complex tasks:
- Use Markdown files as checklists
- Break down into smaller subtasks
- Use GitHub issues as working scratchpads
- Create multiple Claude sessions for parallel work

## Safety & Permissions

### Permission Management
```bash
# View current permissions
/permissions

# Modify tool permissions
claude config set toolPermissions.Bash allow
claude config set toolPermissions.Edit prompt
claude config set toolPermissions.Bash deny
```

### Permission Levels
- `allow`: Always allow without prompting
- `prompt`: Ask for permission each time (default)
- `deny`: Never allow tool use

### Best Practices
- Start with prompt permissions for new projects
- Use `allow` for trusted, repetitive tasks
- Be cautious with `--dangerously-skip-permissions`
- Prefer containerized environments for experimentation

### Tool Safety
```bash
# Disable specific tools
claude --disable-tool Bash,Edit

# Safer alternatives
claude config set toolPermissions.FileWrite prompt
```

## Collaboration Tips

### Course Correction
- Correct Claude early and often
- Be specific about what went wrong
- Provide clear examples of desired behavior

### Context Management
```bash
# Clear context when switching tasks
/clear

# Reset conversation
/reset
```

### Team Collaboration
- Share CLAUDE.md files in git repositories
- Document team coding standards
- Include common commands and patterns
- Version control your `.claude/commands/` directory

### Multiple Sessions
```bash
# Use git worktrees for parallel development
git worktree add ../feature-branch feature-branch
cd ../feature-branch
claude "work on the new feature"
```

## Troubleshooting

### Common Issues

#### Context Overload
- Use `/clear` to reset context
- Break large tasks into smaller sessions
- Focus on specific files or components

#### Permission Errors
```bash
# Check permissions
/permissions

# Reset to defaults
claude config reset toolPermissions
```

#### Performance Issues
- Use thinking modes for complex problems
- Provide clear, specific instructions
- Break complex tasks into steps

### Debugging Commands
```bash
# Verbose logging
claude --verbose

# Check configuration
claude config show

# Verify installation
claude --version
```

### Memory Management
- Claude Code automatically manages conversation history
- Use `/clear` to reset context when needed
- Long conversations may need periodic clearing

## Pro Tips

### Optimization Strategies
1. **Be Specific**: Provide clear, detailed instructions
2. **Use Context**: Reference files, functions, and patterns
3. **Iterate**: Make small changes and verify results
4. **Document**: Update CLAUDE.md with successful patterns
5. **Test**: Verify changes work as expected

### Advanced Techniques
- Use subagents for complex multi-step problems
- Combine with other tools (GitHub CLI, Docker, etc.)
- Create project-specific command templates
- Use visual targeting for UI development

### Performance Tips
- Provide target outputs (tests, mockups, specifications)
- Use incremental development approaches
- Leverage Claude's codebase understanding
- Course correct early to avoid wrong directions

### Integration Examples
```bash
# With GitHub CLI
claude "use gh to create a PR for this feature"

# With Docker
claude "containerize this application"

# With testing frameworks
claude "run the test suite and fix any failures"
```

---

## Additional Resources

- [Official Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code Best Practices (Anthropic)](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Community Examples](https://github.com/hesreallyhim/awesome-claude-code)

*This guide is based on official Anthropic documentation and community best practices as of 2025.*
