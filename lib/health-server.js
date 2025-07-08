/**
 * HealthServer - HTTP endpoint for health checks and monitoring
 * 
 * Provides REST endpoints for:
 * - /health - Basic health check
 * - /health/detailed - Detailed health status
 * - /metrics - Performance metrics
 * - /status - System status summary
 */

const http = require('http');
const url = require('url');
const HealthMonitor = require('./health-monitor');
const { ErrorHandler } = require('./errors/error-framework');

class HealthServer {
  constructor(options = {}) {
    this.port = options.port || 8080;
    this.host = options.host || 'localhost';
    this.healthMonitor = options.healthMonitor || new HealthMonitor();
    this.errorHandler = new ErrorHandler({ logger: console });
    this.server = null;
    this.isRunning = false;
  }

  /**
   * Start the health server
   */
  start() {
    if (this.isRunning) {
      console.warn('Health server is already running');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        this.server.listen(this.port, this.host, () => {
          this.isRunning = true;
          console.log(`🏥 Health server running on http://${this.host}:${this.port}`);
          
          // Start health monitoring
          this.healthMonitor.start();
          
          resolve();
        });

        this.server.on('error', (error) => {
          const serverError = this.errorHandler.handle(error, {
            component: 'health-server',
            operation: 'start'
          });
          reject(serverError);
        });

      } catch (error) {
        const startError = this.errorHandler.handle(error, {
          component: 'health-server',
          operation: 'start'
        });
        reject(startError);
      }
    });
  }

  /**
   * Stop the health server
   */
  stop() {
    if (!this.isRunning) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.healthMonitor.stop();
      
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          console.log('🏥 Health server stopped');
          resolve();
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  async handleRequest(req, res) {
    const startTime = Date.now();
    
    try {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Only allow GET requests
      if (req.method !== 'GET') {
        this.sendError(res, 405, 'Method Not Allowed');
        return;
      }

      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;

      let response;

      switch (pathname) {
        case '/':
        case '/health':
          response = await this.getBasicHealth();
          break;
          
        case '/health/detailed':
          response = await this.getDetailedHealth();
          break;
          
        case '/metrics':
          response = await this.getMetrics();
          break;
          
        case '/status':
          response = await this.getStatus();
          break;
          
        default:
          this.sendError(res, 404, 'Not Found');
          return;
      }

      // Record response time
      const responseTime = Date.now() - startTime;
      this.healthMonitor.recordMetric('api', {
        endpoint: pathname,
        responseTime,
        status: 200
      });

      this.sendJSON(res, response);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const apiError = this.errorHandler.handle(error, {
        component: 'health-server',
        operation: 'handleRequest',
        url: req.url,
        method: req.method,
        responseTime
      });

      this.healthMonitor.recordError(apiError);
      this.sendError(res, 500, 'Internal Server Error', {
        error: apiError.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get basic health status
   */
  async getBasicHealth() {
    const health = this.healthMonitor.getHealthSummary();
    
    return {
      status: health.status,
      timestamp: health.timestamp,
      uptime: health.uptime,
      version: this.getVersion()
    };
  }

  /**
   * Get detailed health status
   */
  async getDetailedHealth() {
    const health = this.healthMonitor.getHealthStatus();
    
    return {
      status: health.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      uptime: health.uptime,
      startTime: health.startTime,
      lastCheck: health.lastCheck,
      version: this.getVersion(),
      environment: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
        cwd: process.cwd()
      }
    };
  }

  /**
   * Get performance metrics
   */
  async getMetrics() {
    const metrics = this.healthMonitor.getMetrics();
    
    return {
      timestamp: Date.now(),
      metrics,
      collections: {
        system: this.healthMonitor.metrics.system.length,
        database: this.healthMonitor.metrics.database.length,
        errors: this.healthMonitor.metrics.errors.length,
        performance: this.healthMonitor.metrics.performance.length
      }
    };
  }

  /**
   * Get system status summary
   */
  async getStatus() {
    const health = this.healthMonitor.getHealthSummary();
    const metrics = this.healthMonitor.getMetrics();
    
    return {
      service: 'calmhive-v3',
      version: this.getVersion(),
      status: health.status,
      timestamp: Date.now(),
      uptime: health.uptime,
      components: health.components,
      issues: health.issues,
      systemMetrics: {
        memory: metrics.system.memory,
        loadAverage: metrics.system.loadAverage
      },
      errorSummary: metrics.errors
    };
  }

  /**
   * Get application version
   */
  getVersion() {
    try {
      const packagePath = require.resolve('../package.json');
      const pkg = require(packagePath);
      return pkg.version;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Send JSON response
   */
  sendJSON(res, data) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Send error response
   */
  sendError(res, statusCode, message, details = null) {
    const error = {
      error: message,
      statusCode,
      timestamp: Date.now()
    };

    if (details) {
      error.details = details;
    }

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify(error, null, 2));
  }

  /**
   * Get server status
   */
  getServerStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      host: this.host,
      url: this.isRunning ? `http://${this.host}:${this.port}` : null
    };
  }
}

module.exports = HealthServer;