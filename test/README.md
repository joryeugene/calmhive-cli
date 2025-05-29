# Calmhive V3 Test Suite

## Overview
- **Pass Rate**: 100% ✅ (All tests passing)
- **Test Coverage**: ~30% (Room for improvement)
- **Test Types**: Unit, Integration, E2E

## Running Tests

```bash
# Quick tests (default) - fast verification
npm test

# Full test suite - comprehensive testing  
npm run test:full

# Specific test types
npm run test:unit
npm run test:integration  
npm run test:e2e
```

## Test Structure

```
test/
├── quick-test.js              # Fast command verification (6 tests)
├── run-tests.js              # Full test runner
├── coverage-report.md        # Coverage analysis
├── unit/                     # Unit tests (2 files)
│   ├── session-database.test.js
│   └── process-manager.test.js
├── integration/              # Integration tests (1 file)
│   └── commands.test.sh
└── e2e/                      # End-to-end tests (1 file)
    └── voice-system.test.sh
```

## Current Coverage

### ✅ Well Tested
- All 5 commands (help, structure, aliases)
- Session database (full CRUD operations)
- Process manager (basic functionality)

### ⚠️ Needs Testing
- Adaptive retry logic
- Tool management
- TUI components
- Advanced voice features
- Complex workflows

## Contributing Tests

1. Add unit tests for new modules in `test/unit/`
2. Add integration tests for command interactions in `test/integration/`
3. Add end-to-end tests for complete workflows in `test/e2e/`
4. Update this README with new test information
5. Run `npm test` to verify all tests pass

## Test Principles

- **Fast**: Quick tests should run in < 10 seconds
- **Reliable**: Tests should pass consistently
- **Isolated**: Tests shouldn't depend on external services
- **Clear**: Test failures should clearly indicate the problem
- **Comprehensive**: Cover critical paths and edge cases