# Calmhive v14.4.0 Claude Code Templates

## Overview
Calmhive v14.4.0 includes curated Claude Code command templates that enhance your development workflow. These templates provide structured approaches to common engineering tasks with production-ready quality, clean architecture principles, and advanced todo-Task parallelization features for beautiful batch execution.

## Template Categories

### Core Workflow Templates
- **bug-hunting.md** - Systematic bug detection and resolution framework
- **documentation.md** - Comprehensive technical documentation generation
- **refactoring.md** - Code improvement and architectural enhancement patterns
- **test-generation.md** - Test suite creation methodology with coverage analysis

### Expert Engineering Personas
- **expert-frontend-engineer.md** - Modern web development with React, TypeScript, performance optimization
- **expert-backend-engineer.md** - Server architecture, APIs, database design, and scalability
- **expert-devops.md** - Infrastructure automation, CI/CD pipelines, and deployment strategies

## Usage with Claude Code

### Direct Template Usage
Templates work seamlessly with Claude Code's file reading capabilities:
```bash
# Claude Code automatically reads .md files in your commands directory
claude "Use the bug-hunting template to debug our authentication system"
```

### Integration with Calmhive Config
```bash
# Copy templates to your Claude Code commands directory (manual method)
cp -r "$(npm root -g)/@calmhive/calmhive-cli/commands/"*.md ~/.claude/commands/

# Or copy individual templates
cp "$(npm root -g)/@calmhive/calmhive-cli/commands/bug-hunting.md" ~/.claude/commands/
cp "$(npm root -g)/@calmhive/calmhive-cli/commands/expert-frontend-engineer.md" ~/.claude/commands/
```

## Claude Code CLI Commands
Based on official documentation and testing:

### Basic Commands
```bash
claude                          # Start interactive session
claude "your prompt"            # Start with initial prompt
claude -p "query"              # Print response and exit (non-interactive)
claude -c                      # Continue most recent conversation
claude --model sonnet          # Start with specific model
```

### Configuration
```bash
claude config                  # Manage Claude Code configuration
claude mcp                     # Configure Model Context Protocol servers
claude update                  # Update to latest version
claude doctor                  # Health check for auto-updater
```

### Advanced Usage
```bash
# Add working directories
claude --add-dir /path/to/project

# Control tool permissions
claude --allowedTools "Bash Edit Read"
claude --disallowedTools "WebFetch"

# Output formatting
claude -p "query" --output-format json
```

## Template Structure
Each template follows the CALMHIVE v14.4.0 protocol:
- Systematic approach with multiple tool invocations
- Comprehensive context gathering before action
- Verification-driven methodology
- Anti-fabrication safeguards
- Production hygiene and clean architecture principles

## Integration Examples

### Bug Hunting Workflow
```bash
# Use bug-hunting template for systematic debugging
claude "Apply bug-hunting methodology to investigate memory leaks in our Node.js application"
```

### Expert Consultation
```bash
# Engage frontend engineering expertise
claude "Act as expert-frontend-engineer to optimize our React component performance"
```

### Documentation Generation
```bash
# Create comprehensive API documentation
claude "Use documentation template to create API docs for our GraphQL schema"
```

## Distribution and Sharing

### NPM Package
Templates are included in `@calmhive/calmhive-cli` package:
```bash
npm install -g @calmhive/calmhive-cli
calmhive config install
```

### Manual Installation
```bash
# Copy templates to Claude Code commands directory
cp -r calmhive/v3/commands/*.md ~/.claude/commands/
```

## Template Effectiveness
- **Verified Workflows** - All templates tested in real development scenarios
- **Anti-Fabrication** - Built-in verification mandates prevent false information
- **Systematic Approach** - Structured methodology for consistent results
- **Expert Knowledge** - Distilled experience from senior engineering roles

## Support
- Templates work with Claude Code CLI and Desktop applications
- Compatible with MCP tool ecosystem
- Integrates with existing development workflows
- Supports team collaboration through shared configurations

**Note**: This documentation covers only verified, tested features. All CLI commands and functionality have been confirmed through actual usage and official documentation.

lets bee friends
