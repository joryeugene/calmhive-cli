/**
 * ProcessMonitor - Handles process tracking and health monitoring
 * 
 * Manages active process tracking, PID validation, orphan detection,
 * and process cleanup operations. Extracted from ProcessManager to provide
 * focused responsibility for process monitoring and health management.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProcessMonitor {
  constructor() {
    this.activeProcesses = new Map();
    this.setupCleanup();
  }

  /**
   * Sets up graceful cleanup handlers for process termination
   */
  setupCleanup() {
    process.setMaxListeners(20);

    const cleanup = async () => {
      console.log('🧹 ProcessMonitor cleanup initiated...');
      await this.cleanupAllActiveProcesses();
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  /**
   * Register an active process for monitoring
   */
  registerProcess(sessionId, processInfo) {
    this.activeProcesses.set(sessionId, {
      ...processInfo,
      registeredAt: Date.now()
    });
    
    console.log(`👁️ Registered process for session ${sessionId} (PID: ${processInfo.pid})`);
  }

  /**
   * Unregister a process from monitoring
   */
  unregisterProcess(sessionId) {
    const processInfo = this.activeProcesses.get(sessionId);
    if (processInfo) {
      this.activeProcesses.delete(sessionId);
      console.log(`👋 Unregistered process for session ${sessionId}`);
      return processInfo;
    }
    return null;
  }

  /**
   * Check if a process is registered and active
   */
  isProcessActive(sessionId) {
    return this.activeProcesses.has(sessionId);
  }

  /**
   * Get process information for a session
   */
  getProcessInfo(sessionId) {
    return this.activeProcesses.get(sessionId) || null;
  }

  /**
   * Get all active process information
   */
  getAllActiveProcesses() {
    return Array.from(this.activeProcesses.entries()).map(([sessionId, processInfo]) => ({
      sessionId,
      ...processInfo
    }));
  }

  /**
   * Check if a PID is still alive
   */
  async isPidAlive(pid) {
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check session activity via AFk registry context monitor logs
   */
  async isSessionActiveViaLogs(sessionId) {
    const afkRegistryPath = path.join(process.env.HOME, '.claude', 'afk_registry', sessionId);
    const contextLogPath = path.join(afkRegistryPath, 'context-monitor.log');
    
    try {
      const stats = fs.statSync(contextLogPath);
      const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
      
      // Consider active if log updated within last 15 minutes
      return ageMinutes < 15;
    } catch (error) {
      // Log file doesn't exist or can't be accessed
      return false;
    }
  }

  /**
   * Check if Claude process is running with AFk patterns
   */
  async hasActiveClaudeProcess() {
    return new Promise((resolve) => {
      const ps = spawn('ps', ['aux'], { stdio: ['ignore', 'pipe', 'ignore'] });
      let output = '';

      ps.stdout.on('data', (data) => {
        output += data.toString();
      });

      ps.on('close', () => {
        const hasClaudeProcess = output.includes('claude -c -p') ||
                                output.includes('claude -p') ||
                                output.includes('afk-');
        resolve(hasClaudeProcess);
      });

      ps.on('error', () => resolve(false));
    });
  }

  /**
   * Validate if a session is truly active
   */
  async validateSessionActivity(sessionId, pid = null) {
    // Check 1: Is it in our active process registry?
    const isRegistered = this.isProcessActive(sessionId);
    
    // Check 2: If we have a PID, is it still alive?
    let pidAlive = false;
    if (pid) {
      pidAlive = await this.isPidAlive(pid);
    }
    
    // Check 3: Are there recent log updates?
    const logActivity = await this.isSessionActiveViaLogs(sessionId);
    
    // Check 4: Is there a Claude process running?
    const claudeProcess = await this.hasActiveClaudeProcess();
    
    return {
      isRegistered,
      pidAlive,
      logActivity,
      claudeProcess,
      isActive: isRegistered || pidAlive || logActivity || claudeProcess
    };
  }

  /**
   * Find orphaned Claude processes that aren't tracked
   */
  async findOrphanProcesses() {
    return new Promise((resolve) => {
      const ps = spawn('ps', ['aux'], { stdio: ['ignore', 'pipe', 'ignore'] });
      let output = '';

      ps.stdout.on('data', (data) => {
        output += data.toString();
      });

      ps.on('close', () => {
        const lines = output.split('\n');
        const orphans = [];
        
        for (const line of lines) {
          if (line.includes('claude') && (line.includes('-c -p') || line.includes('afk-'))) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[1]);
            const command = parts.slice(10).join(' ');
            
            // Check if this PID is tracked by any active session
            const isTracked = Array.from(this.activeProcesses.values())
              .some(p => p.pid === pid || p.caffeinatePid === pid);
            
            if (!isTracked) {
              orphans.push({ pid, command });
            }
          }
        }
        
        resolve(orphans);
      });

      ps.on('error', () => resolve([]));
    });
  }

  /**
   * Kill orphaned processes
   */
  async killOrphanProcesses() {
    const orphans = await this.findOrphanProcesses();
    let killedCount = 0;
    
    console.log(`🔍 Found ${orphans.length} orphaned Claude processes`);
    
    for (const orphan of orphans) {
      try {
        console.log(`💀 Killing orphaned process: PID ${orphan.pid} - ${orphan.command}`);
        process.kill(orphan.pid, 'SIGTERM');
        
        // Wait 5 seconds then force kill if still alive
        setTimeout(async () => {
          if (await this.isPidAlive(orphan.pid)) {
            console.log(`💀 Force killing stubborn process: PID ${orphan.pid}`);
            try {
              process.kill(orphan.pid, 'SIGKILL');
            } catch (e) {
              // Process might have died
            }
          }
        }, 5000);
        
        killedCount++;
      } catch (error) {
        console.error(`⚠️ Failed to kill orphaned process ${orphan.pid}:`, error.message);
      }
    }
    
    return killedCount;
  }

  /**
   * Clean up all active processes
   */
  async cleanupAllActiveProcesses() {
    const processCount = this.activeProcesses.size;
    console.log(`🧹 Cleaning up ${processCount} active processes...`);
    
    for (const [sessionId, processInfo] of this.activeProcesses.entries()) {
      try {
        console.log(`💀 Terminating session ${sessionId} (PID: ${processInfo.pid})`);
        
        // Kill main process
        if (processInfo.process && typeof processInfo.process.kill === 'function') {
          processInfo.process.kill('SIGTERM');
        } else if (processInfo.pid) {
          process.kill(processInfo.pid, 'SIGTERM');
        }
        
        // Kill caffeinate if present
        if (processInfo.caffeinatePid) {
          try {
            process.kill(processInfo.caffeinatePid, 'SIGTERM');
            console.log(`☕ Killed caffeinate process: ${processInfo.caffeinatePid}`);
          } catch (e) {
            // Caffeinate might already be dead
          }
        }
        
      } catch (error) {
        console.error(`⚠️ Error cleaning up session ${sessionId}:`, error.message);
      }
    }
    
    this.activeProcesses.clear();
    console.log(`✅ Process cleanup complete`);
  }

  /**
   * Stop a specific session's processes
   */
  async stopSession(sessionId) {
    const processInfo = this.getProcessInfo(sessionId);
    
    if (!processInfo) {
      console.log(`⚠️ No active process found for session: ${sessionId}`);
      return false;
    }

    try {
      console.log(`🛑 Stopping session: ${sessionId}`);
      
      // Send SIGTERM to main process
      if (processInfo.process && typeof processInfo.process.kill === 'function') {
        processInfo.process.kill('SIGTERM');
        console.log(`📡 Sent SIGTERM to main process`);
      } else if (processInfo.pid) {
        process.kill(processInfo.pid, 'SIGTERM');
        console.log(`📡 Sent SIGTERM to PID ${processInfo.pid}`);
      }
      
      // Kill caffeinate if present
      if (processInfo.caffeinatePid) {
        try {
          process.kill(processInfo.caffeinatePid, 'SIGTERM');
          console.log(`☕ Killed caffeinate process: ${processInfo.caffeinatePid}`);
        } catch (e) {
          console.log(`☕ Caffeinate process ${processInfo.caffeinatePid} already terminated`);
        }
      }
      
      // Wait for graceful shutdown, then force kill if needed
      setTimeout(async () => {
        if (processInfo.pid && await this.isPidAlive(processInfo.pid)) {
          try {
            process.kill(processInfo.pid, 'SIGKILL');
            console.log(`💀 Force killed stubborn process: ${processInfo.pid}`);
          } catch (e) {
            // Process died
          }
        }
        
        this.unregisterProcess(sessionId);
      }, 5000);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Error stopping session ${sessionId}:`, error.message);
      this.unregisterProcess(sessionId);
      return false;
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats() {
    const activeCount = this.activeProcesses.size;
    const processes = this.getAllActiveProcesses();
    
    const stats = {
      activeProcessCount: activeCount,
      oldestProcess: null,
      averageAge: 0,
      processMemoryUsage: process.memoryUsage()
    };

    if (processes.length > 0) {
      const ages = processes.map(p => Date.now() - p.registeredAt);
      stats.oldestProcess = Math.max(...ages);
      stats.averageAge = ages.reduce((a, b) => a + b, 0) / ages.length;
    }

    return stats;
  }
}

module.exports = ProcessMonitor;