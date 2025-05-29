# Contributing to Calmhive CLI

Thank you for your interest in contributing to Calmhive! We welcome contributions of all kinds.

## 🐝 Quick Start

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Run tests: `npm test`
5. Make your changes
6. Test your changes
7. Submit a pull request

## 📋 Development Setup

```bash
# Clone your fork
git clone https://github.com/joryeugene/calmhive-cli.git
cd calmhive-cli/v3

# Install dependencies
npm install

# Link for local testing
npm link

# Try commands locally
calmhive chat "hello"
calmhive run "create hello.txt"
```

## 🧪 Testing

Always run tests before submitting:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Manual testing
calmhive chat --help
calmhive run --help
calmhive afk --help
```

## 📝 Code Style

- Use ES6+ features
- Follow existing patterns in the codebase
- Add JSDoc comments for new functions
- Keep functions focused and small
- Handle errors gracefully

## 🏗️ Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed information about:
- Command structure
- Adding new commands
- Tool integration
- Database schema

## 🚀 Adding a New Command

1. Create directory: `commands/yourcommand/`
2. Add `index.js` with command logic
3. Create alias symlink if needed
4. Add tests in `test/` directory
5. Update documentation
6. Run tests

Example structure:
```javascript
#!/usr/bin/env node
// commands/yourcommand/index.js

const { spawn } = require('child_process');
const path = require('path');

function showHelp() {
  console.log(`
🐝 Calmhive YourCommand

Usage: calmhive yourcommand [options]

Options:
  -h, --help     Show this help message
`);
}

// Command logic here
```

## 🔧 Adding MCP Tools

1. Ensure tool is safe (read-only preferred)
2. Add to `config/allowed-tools.json`
3. Document usage
4. Verify functionality

## 📚 Documentation

- Update README.md for user-facing changes
- Update ARCHITECTURE.md for technical changes
- Use clear examples
- Keep it concise

## 🐛 Reporting Issues

1. Check existing issues first
2. Include reproduction steps
3. Provide system information
4. Share relevant logs

## 💡 Feature Requests

1. Open an issue with `[Feature]` prefix
2. Describe the use case
3. Provide examples
4. Explain why it's valuable

## 🤝 Pull Request Process

1. Create descriptive branch name
2. Write clear commit messages
3. Update documentation
4. Ensure all tests pass
5. Request review

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Questions?** Open an issue or reach out to the maintainers.

**lets bee friends** 🐝