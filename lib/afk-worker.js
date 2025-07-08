#!/usr/bin/env node

/**
 * AFk Worker Process
 * This runs as a detached background process to handle AFk iterations
 */

const ProcessManager = require('./process-manager');
const fs = require('fs');
const path = require('path');

// Module-level cleanup function reference
let cleanup = null;

// Get arguments from command line
const [,, sessionConfig] = process.argv;

if (!sessionConfig) {
  console.error('❌ No session configuration provided');
  process.exit(1);
}

async function runWorker() {
  try {
    const config = JSON.parse(sessionConfig);
    const pm = new ProcessManager();

    // Set up log file redirection to AFk registry
    const afkRegistryDir = path.join(process.env.HOME, '.claude', 'afk_registry', config.sessionId);
    const logFile = path.join(afkRegistryDir, 'worker.log');

    // Ensure AFk registry directory exists
    if (!fs.existsSync(afkRegistryDir)) {
      fs.mkdirSync(afkRegistryDir, { recursive: true });
    }

    // Create proper log stream redirection
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // Store original streams for cleanup
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;

    // Create safe logging function
    const safeLog = (message) => {
      const timestamp = new Date().toISOString();
      logStream.write(`[${timestamp}] ${message}\n`);
    };

    // Replace console methods instead of overwriting streams
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
      safeLog(message);
    };

    console.error = (...args) => {
      const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
      safeLog(`ERROR: ${message}`);
    };

    // Cleanup function to restore original streams
    cleanup = () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      if (logStream) {
        logStream.end();
      }
    };

    console.log(`[${new Date().toISOString()}] AFk worker started for session ${config.sessionId}`);
    console.log(`[${new Date().toISOString()}] Task: ${config.task}`);
    console.log(`[${new Date().toISOString()}] Working directory: ${config.workingDirectory}`);

    // Detach from parent
    if (process.disconnect) {
      process.disconnect();
    }

    // Change to the correct working directory
    process.chdir(config.workingDirectory);

    // Get the existing session and run iterations directly
    const session = await pm.db.getSession(config.sessionId);
    if (!session) {
      throw new Error(`Session ${config.sessionId} not found`);
    }

    // Run the session iterations directly in this worker
    await pm.runAfkIterations(session, config.options);

    console.log('AFk worker completed successfully');
    if (typeof cleanup === 'function') {cleanup();}
    process.exit(0);
  } catch (error) {
    console.error('❌ AFk worker error:', error);
    if (typeof cleanup === 'function') {cleanup();}
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('\n🛑 AFk worker received SIGTERM');
  if (typeof cleanup === 'function') {cleanup();}
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 AFk worker received SIGINT');
  if (typeof cleanup === 'function') {cleanup();}
  process.exit(0);
});

// Ignore SIGHUP to stay alive when terminal closes
process.on('SIGHUP', () => {
  console.log('AFk worker ignoring SIGHUP');
});

// Run the worker
runWorker().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
