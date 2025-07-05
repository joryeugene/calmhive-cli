module.exports = {
  env: {
    browser: false,
    node: true,
    es2022: true,
    mocha: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Possible Errors
    'no-console': 'off', // We use console for CLI output
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    
    // Best Practices
    'curly': 'warn',
    'eqeqeq': 'warn',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-wrappers': 'warn',
    'no-throw-literal': 'warn',
    'no-empty': 'warn',
    'no-dupe-keys': 'error',
    'no-dupe-class-members': 'error',
    'no-prototype-builtins': 'warn',
    'no-case-declarations': 'warn',
    
    // Style (relaxed for legacy codebase)
    'indent': ['warn', 2],
    'quotes': ['warn', 'single'],
    'semi': ['warn', 'always'],
    'comma-dangle': ['warn', 'never'],
    'no-trailing-spaces': 'warn',
    'eol-last': 'warn',
    
    // Node.js specific
    'no-process-exit': 'off' // CLI tools need process.exit
  },
  globals: {
    // Test globals from test-setup.js
    'expect': 'readonly',
    'sinon': 'readonly',
    'TestProjectFactory': 'readonly',
    'MockManagers': 'readonly',
    'TestUtils': 'readonly',
    'testCleanup': 'readonly'
  }
};