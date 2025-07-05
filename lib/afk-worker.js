#!/usr/bin/env node

/**
 * AFk Worker Process
 * This runs as a detached background process to handle AFk iterations
 */

const ProcessManager = require('./process-manager');
const fs = require('fs');
const path = require('path');

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

    // Redirect stdout and stderr to log file
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    process.stdout.write = process.stderr.write = logStream.write.bind(logStream);

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

    console.log(`[${new Date().toISOString()}] AFk worker completed successfully`);
    logStream.end();
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ AFk worker error:`, error);
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('\n🛑 AFk worker received SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 AFk worker received SIGINT');
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
