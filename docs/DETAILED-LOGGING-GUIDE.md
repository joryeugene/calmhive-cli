# Detailed Logging System - Complete Guide

## Overview

The Calmhive v11.0.0 detailed logging system provides comprehensive, production-ready logging capabilities designed specifically for AFk background processes and interactive sessions. This system evolved through three iterations to provide enterprise-grade logging with real-time monitoring, automatic rotation, and advanced analytics.

## Architecture

### Core Components

1. **DetailedLogger** (`test/detailed-logging-test.js`) - Basic implementation with test framework
2. **EnhancedLogger** (`lib/enhanced-logger.js`) - Advanced features with streaming and metrics
3. **ProductionLogger** (`lib/production-logger.js`) - Production-optimized with error handling

### Feature Matrix

| Feature | DetailedLogger | EnhancedLogger | ProductionLogger |
|---------|----------------|----------------|------------------|
| Multi-level logging | ✅ | ✅ | ✅ |
| File rotation | ❌ | ✅ | ✅ |
| Real-time streaming | ❌ | ✅ | ✅ |
| Performance benchmarking | ✅ | ✅ | ✅ |
| Memory tracking | ✅ | ✅ | ✅ |
| Error handling | Basic | Advanced | Enterprise |
| Graceful degradation | ❌ | ❌ | ✅ |
| Async batch writing | ❌ | ❌ | ✅ |
| Production defaults | ❌ | ❌ | ✅ |

## Quick Start

### Basic Usage

```javascript
const ProductionLogger = require('./lib/production-logger');

// Initialize with default settings
const logger = new ProductionLogger({
  logFile: './logs/app.log',
  logLevel: 'INFO'
});

// Basic logging
logger.info('Application started', { version: '1.0.0' });
logger.warn('High memory usage detected', { usage: '85%' });
logger.error('Database connection failed', { error: 'ECONNREFUSED' });

// With context
logger.info('User action', { userId: 'user123' }, { module: 'auth' });
```

### AFk Integration

```javascript
const ProductionLogger = require('./lib/production-logger');
const path = require('path');

// AFk-compatible setup
const sessionId = 'afk-session-12345';
const afkRegistryDir = path.join(process.env.HOME, '.claude', 'afk_registry', sessionId);
const logFile = path.join(afkRegistryDir, 'worker.log');

const logger = new ProductionLogger({
  logFile,
  enableStreaming: true,
  performanceMode: 'balanced'
});

// Monitor critical events
logger.on('log', (logEntry) => {
  if (logEntry.level === 'ERROR') {
    // Handle critical events
    console.log('🚨 Critical event detected');
  }
});

// AFk iteration logging
logger.info('AFk iteration started', { 
  iteration: 1, 
  task: 'Implement feature X',
  sessionId 
});
```

## Configuration Options

### Production Logger Options

```javascript
const logger = new ProductionLogger({
  // File settings
  logFile: './logs/app.log',
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10,
  
  // Performance settings
  performanceMode: 'balanced', // 'fast', 'balanced', 'safe'
  asyncWrites: true,
  batchSize: 50,
  flushInterval: 5000, // 5 seconds
  
  // Error handling
  enableGracefulDegradation: true,
  errorThreshold: 100,
  
  // Monitoring
  enableStreaming: true,
  enableMetrics: true,
  bufferSize: 1000,
  
  // Log filtering
  logLevel: 'INFO' // 'DEBUG', 'INFO', 'WARN', 'ERROR'
});
```

### Performance Modes

#### Fast Mode
- Optimized for maximum throughput
- Minimal error checking
- Larger batch sizes
- Best for high-volume logging

```javascript
performanceMode: 'fast',
batchSize: 100,
flushInterval: 10000,
enableGracefulDegradation: false
```

#### Balanced Mode (Default)
- Good balance of performance and reliability
- Moderate error checking
- Standard batch sizes
- Recommended for most applications

```javascript
performanceMode: 'balanced',
batchSize: 50,
flushInterval: 5000,
enableGracefulDegradation: true
```

#### Safe Mode
- Maximum reliability and error handling
- Synchronous writes
- Immediate flushing
- Best for critical applications

```javascript
performanceMode: 'safe',
asyncWrites: false,
batchSize: 1,
flushInterval: 1000,
enableGracefulDegradation: true
```

## Advanced Features

### Real-time Streaming

```javascript
// Set up real-time monitoring
logger.on('log', (logEntry) => {
  if (logEntry.level === 'ERROR') {
    // Send alert to monitoring system
    alertSystem.send(`Error: ${logEntry.message}`);
  }
});

logger.on('metrics', (metrics) => {
  // Update dashboard with current metrics
  dashboard.update(metrics);
});

logger.on('degraded', (event) => {
  // Handle degraded mode
  console.warn('Logger degraded:', event.reason);
});
```

### Log Search and Filtering

```javascript
// Search logs in memory buffer
const results = logger.searchLogs('error', {
  level: 'ERROR',
  timeRange: {
    start: '2025-06-25T00:00:00Z',
    end: '2025-06-25T23:59:59Z'
  },
  limit: 50
});

console.log(`Found ${results.length} error logs`);
```

### Performance Benchmarking

```javascript
// Benchmark critical operations
const result = await logger.benchmark(
  'Database Query Performance',
  async (iteration) => {
    return await database.query('SELECT * FROM users LIMIT 100');
  },
  1000 // iterations
);

console.log(`Average query time: ${result.avgDuration}ms`);
console.log(`Throughput: ${result.throughput}`);
```

### Log Rotation Management

```javascript
// Automatic rotation when file exceeds maxFileSize
// Manual rotation trigger
await logger.rotateLogFile();

// Check current file size
const metrics = logger.getMetrics();
console.log(`Current log file size: ${metrics.currentFileSize} bytes`);
```

## AFk Integration Patterns

### Context Monitoring

```javascript
// Create AFk-compatible context monitoring
const contextFile = path.join(afkRegistryDir, 'context-monitor.log');

logger.on('log', (logEntry) => {
  if (logEntry.level === 'ERROR') {
    const alert = `CRITICAL: ${logEntry.timestamp} - ${logEntry.message}\n`;
    fs.appendFileSync(contextFile, alert);
  }
});
```

### Progress Tracking

```javascript
// Update progress reports for AFk monitoring
logger.on('log', (logEntry) => {
  if (logEntry.message.includes('progress')) {
    const report = {
      sessionId,
      lastUpdate: logEntry.timestamp,
      progress: logEntry.data,
      status: 'active'
    };
    
    const reportFile = path.join(afkRegistryDir, 'context-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  }
});
```

### Session Lifecycle

```javascript
// AFk session start
logger.info('AFk session started', {
  sessionId,
  task: 'Implement comprehensive feature',
  expectedIterations: 5
});

// Iteration logging
for (let i = 1; i <= 5; i++) {
  logger.info(`AFk iteration ${i} started`, { iteration: i });
  
  // Phase logging
  logger.debug('Analysis phase', { phase: 'analysis', iteration: i });
  logger.debug('Implementation phase', { phase: 'implementation', iteration: i });
  logger.debug('Verification phase', { phase: 'verification', iteration: i });
  
  logger.info(`AFk iteration ${i} completed`, { 
    iteration: i, 
    duration: '2.5s',
    success: true 
  });
}

// Session completion
logger.info('AFk session completed', {
  sessionId,
  totalIterations: 5,
  status: 'success'
});
```

## Error Handling and Degradation

### Graceful Degradation

The production logger automatically handles various error scenarios:

1. **File System Errors**: Continues with console-only logging
2. **Permission Issues**: Attempts alternative log locations
3. **Disk Space**: Reduces buffer size and increases rotation frequency
4. **Memory Pressure**: Flushes buffers more aggressively

```javascript
// Monitor degradation events
logger.on('degraded', (event) => {
  console.warn(`Logger degraded: ${event.reason}`);
  
  // Implement fallback logging strategy
  if (event.reason.includes('disk')) {
    // Switch to remote logging
    remoteLogger.init();
  }
});
```

### Error Recovery

```javascript
// Check if logger is in degraded mode
const metrics = logger.getMetrics();
if (metrics.degradedMode) {
  console.log('Logger is in degraded mode');
  
  // Attempt recovery
  try {
    await logger.flush();
    logger.info('Attempting recovery from degraded mode');
  } catch (error) {
    console.error('Recovery failed:', error);
  }
}
```

## Performance Optimization

### Memory Management

```javascript
// Monitor memory usage
logger.on('metrics', (metrics) => {
  const memoryMB = metrics.memory.heapUsed / 1024 / 1024;
  
  if (memoryMB > 100) {
    // Reduce buffer size dynamically
    logger.options.bufferSize = Math.max(100, logger.options.bufferSize * 0.8);
    logger.warn('Reducing buffer size due to memory pressure', { 
      newBufferSize: logger.options.bufferSize 
    });
  }
});
```

### Disk I/O Optimization

```javascript
// Optimize for high-throughput scenarios
const highThroughputLogger = new ProductionLogger({
  logFile: './logs/high-volume.log',
  performanceMode: 'fast',
  batchSize: 200,
  flushInterval: 10000,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  asyncWrites: true
});
```

## Testing and Validation

### Comprehensive Test Suite

Run the complete test suite to validate functionality:

```bash
# Basic functionality test
node test/detailed-logging-test.js

# Advanced features test
node test/streaming-logger-test.js

# AFk integration test
node test/afk-integration-test.js
```

### Performance Testing

```javascript
// Stress test the logger
const stressTest = async () => {
  const logger = new ProductionLogger({
    logFile: './logs/stress-test.log',
    performanceMode: 'fast'
  });
  
  const startTime = Date.now();
  const logCount = 10000;
  
  for (let i = 0; i < logCount; i++) {
    logger.info(`Stress test log ${i}`, { 
      iteration: i, 
      timestamp: Date.now() 
    });
  }
  
  await logger.flush();
  const duration = Date.now() - startTime;
  
  console.log(`Logged ${logCount} messages in ${duration}ms`);
  console.log(`Throughput: ${(logCount / duration * 1000).toFixed(2)} logs/sec`);
  
  await logger.destroy();
};
```

## Best Practices

### 1. Log Level Management

```javascript
// Use appropriate log levels
logger.debug('Detailed debugging info'); // Development only
logger.info('Normal application flow'); // General information
logger.warn('Something unusual happened'); // Potential issues
logger.error('Something failed'); // Actual errors
```

### 2. Structured Logging

```javascript
// Good: Structured data
logger.info('User login', { 
  userId: 'user123', 
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...' 
});

// Better: With context
logger.info('User login', 
  { userId: 'user123', success: true },
  { module: 'auth', action: 'login' }
);
```

### 3. Error Context

```javascript
// Include full error context
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    operation: 'riskyOperation',
    retryAttempt: 1
  });
}
```

### 4. Performance Monitoring

```javascript
// Log performance metrics
const startTime = Date.now();
await longRunningOperation();
const duration = Date.now() - startTime;

logger.info('Operation completed', {
  operation: 'longRunningOperation',
  duration: `${duration}ms`,
  performance: duration < 1000 ? 'good' : 'slow'
});
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce buffer size
   - Increase flush frequency
   - Check for log level misconfiguration

2. **Slow Performance**
   - Enable async writes
   - Increase batch size
   - Use 'fast' performance mode

3. **File Permission Errors**
   - Enable graceful degradation
   - Check log directory permissions
   - Use alternative log location

4. **Log Rotation Issues**
   - Verify disk space
   - Check file permissions
   - Monitor rotation frequency

### Debug Mode

```javascript
// Enable debug logging
const logger = new ProductionLogger({
  logLevel: 'DEBUG',
  enableMetrics: true
});

// Monitor internal logger events
logger.on('degraded', console.warn);
logger.on('metrics', (m) => console.log('Metrics:', m.logs));
```

## Deployment Guide

### Production Deployment

```javascript
// Production configuration
const productionLogger = new ProductionLogger({
  logFile: '/var/log/calmhive/app.log',
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 20,
  logLevel: 'INFO',
  performanceMode: 'balanced',
  enableGracefulDegradation: true,
  enableMetrics: true,
  asyncWrites: true
});

// Set up monitoring
productionLogger.on('degraded', (event) => {
  alertingSystem.send(`Logger degraded: ${event.reason}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await productionLogger.flush();
  await productionLogger.destroy();
  process.exit(0);
});
```

### Docker Integration

```dockerfile
# Create log directory
RUN mkdir -p /var/log/calmhive

# Set proper permissions
RUN chown -R node:node /var/log/calmhive

# Volume for persistent logs
VOLUME ["/var/log/calmhive"]
```

### Monitoring Integration

```javascript
// Integration with monitoring systems
logger.on('metrics', (metrics) => {
  // Prometheus metrics
  prometheus.gauge('logger_total_logs').set(metrics.logs.totalLogs);
  prometheus.gauge('logger_error_count').set(metrics.logs.logsByLevel.ERROR);
  prometheus.gauge('logger_memory_usage').set(metrics.memory.heapUsed);
  
  // Custom monitoring
  if (metrics.degradedMode) {
    monitoring.alert('logger_degraded', 'Logger entered degraded mode');
  }
});
```

This comprehensive logging system provides enterprise-grade capabilities suitable for production AFk deployments while maintaining the flexibility needed for development and testing environments.