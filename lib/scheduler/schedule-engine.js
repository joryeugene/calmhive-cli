#!/usr/bin/env node
/**
 * Calmhive Schedule Engine - Manages persistent scheduled tasks
 * Integrates Claude Code natural language parsing with node-cron execution
 */

const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const ClaudeCronParser = require('./claude-cron-parser');
const { v4: uuidv4 } = require('uuid');

class ScheduleEngine {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'calmhive', 'schedules');
    this.schedulesFile = path.join(this.dataDir, 'schedules.json');
    this.activeTasks = new Map(); // taskId -> cron task instance
    this.parser = new ClaudeCronParser(options.parserOptions);

    // Ensure data directory exists
    this.initializeDataDir();
  }

  async initializeDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });

      // Create empty schedules file if it doesn't exist
      try {
        await fs.access(this.schedulesFile);
      } catch (error) {
        await fs.writeFile(this.schedulesFile, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error(`Failed to initialize schedule data directory: ${error.message}`);
    }
  }

  /**
   * Create a new scheduled task from natural language
   * @param {string} naturalLanguage - Natural language time expression
   * @param {string} command - Calmhive command to execute
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Created schedule object
   */
  async createSchedule(naturalLanguage, command, options = {}) {
    const schedule = {
      id: uuidv4(),
      naturalLanguage,
      command,
      created: new Date().toISOString(),
      enabled: true,
      timezone: options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      lastRun: null,
      nextRun: null,
      runCount: 0,
      ...options,
      // Set name after spreading options to prevent undefined override
      name: options.name || `Schedule for "${naturalLanguage}"`
    };

    try {
      // Parse natural language to cron
      const cronResult = await this.parser.parseNaturalLanguage(naturalLanguage);
      schedule.cron = cronResult.cron;
      schedule.type = cronResult.type;
      schedule.explanation = cronResult.explanation;
      schedule.parsedAt = new Date().toISOString();

      // Validate cron expression works with node-cron
      if (!cron.validate(schedule.cron)) {
        throw new Error(`Invalid cron expression: "${schedule.cron}"`);
      }

      // Calculate next run time
      schedule.nextRun = this.calculateNextRun(schedule.cron, schedule.timezone);

      // Save to persistent storage
      await this.saveSchedule(schedule);

      // Start the task if enabled
      if (schedule.enabled) {
        await this.startTask(schedule);
      }

      console.log(`✅ Created schedule: "${schedule.name}"`);
      console.log(`   Natural Language: "${naturalLanguage}"`);
      console.log(`   Cron Expression: "${schedule.cron}"`);
      console.log(`   Explanation: ${schedule.explanation}`);
      console.log(`   Next Run: ${schedule.nextRun}`);

      return schedule;

    } catch (error) {
      throw new Error(`Failed to create schedule: ${error.message}`);
    }
  }

  /**
   * Start a scheduled task with node-cron
   * @param {Object} schedule - Schedule object
   */
  async startTask(schedule) {
    if (this.activeTasks.has(schedule.id)) {
      throw new Error(`Task ${schedule.id} is already running`);
    }

    const task = cron.schedule(schedule.cron, async () => {
      console.log(`🚀 Executing scheduled task: ${schedule.name}`);
      await this.executeTask(schedule);
    }, {
      scheduled: false,
      timezone: schedule.timezone
    });

    // Store the task and start it
    this.activeTasks.set(schedule.id, task);
    task.start();

    console.log(`▶️ Started task: ${schedule.name} (${schedule.cron})`);
    return task;
  }

  /**
   * Execute the actual calmhive command
   * @param {Object} schedule - Schedule object
   */
  async executeTask(schedule) {
    const { execSync } = require('child_process');
    const startTime = Date.now();

    try {

      // Update run statistics
      schedule.lastRun = new Date().toISOString();
      schedule.runCount++;
      schedule.nextRun = this.calculateNextRun(schedule.cron, schedule.timezone);

      console.log(`📋 Executing: ${schedule.command}`);

      // Execute the command
      const output = execSync(schedule.command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const duration = Date.now() - startTime;

      // Log execution result
      schedule.lastResult = {
        success: true,
        output: output.trim(),
        duration,
        timestamp: schedule.lastRun
      };

      console.log(`✅ Task completed in ${duration}ms`);

      // Save updated schedule
      await this.updateSchedule(schedule);

    } catch (error) {
      const duration = Date.now() - startTime;

      schedule.lastResult = {
        success: false,
        error: error.message,
        duration,
        timestamp: schedule.lastRun
      };

      console.error(`❌ Task failed: ${error.message}`);

      // Save error result
      await this.updateSchedule(schedule);
    }
  }

  /**
   * Calculate next run time for a cron expression
   * @param {string} cronExpression - Cron expression
   * @param {string} timezone - Timezone string
   * @returns {string} - ISO timestamp of next run
   */
  calculateNextRun(_cronExpression, _timezone) {
    // Parameters kept for future enhancement with proper cron library
    // TODO: Use cronExpression and timezone for accurate calculation
    const now = new Date();
    const nextMinute = new Date(now.getTime() + 60000);
    return nextMinute.toISOString();
  }

  /**
   * Load all schedules from persistent storage
   * @returns {Promise<Array>} - Array of schedule objects
   */
  async loadSchedules() {
    try {
      const data = await fs.readFile(this.schedulesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Failed to load schedules: ${error.message}`);
      return [];
    }
  }

  /**
   * Save schedule to persistent storage
   * @param {Object} schedule - Schedule object to save
   */
  async saveSchedule(schedule) {
    const schedules = await this.loadSchedules();
    schedules.push(schedule);
    await fs.writeFile(this.schedulesFile, JSON.stringify(schedules, null, 2));
  }

  /**
   * Update existing schedule in persistent storage
   * @param {Object} updatedSchedule - Updated schedule object
   */
  async updateSchedule(updatedSchedule) {
    const schedules = await this.loadSchedules();
    const index = schedules.findIndex(s => s.id === updatedSchedule.id);

    if (index !== -1) {
      schedules[index] = updatedSchedule;
      await fs.writeFile(this.schedulesFile, JSON.stringify(schedules, null, 2));
    }
  }

  /**
   * List all schedules with their status
   * @returns {Promise<Array>} - Array of schedules with runtime info
   */
  async listSchedules() {
    const schedules = await this.loadSchedules();

    return schedules.map(schedule => ({
      ...schedule,
      isActive: this.activeTasks.has(schedule.id),
      status: schedule.enabled ?
        (this.activeTasks.has(schedule.id) ? 'running' : 'stopped') :
        'disabled'
    }));
  }

  /**
   * Stop a scheduled task
   * @param {string} scheduleId - Schedule ID to stop
   */
  async stopTask(scheduleId) {
    const task = this.activeTasks.get(scheduleId);
    if (task) {
      task.stop();
      this.activeTasks.delete(scheduleId);
      console.log(`⏹️ Stopped task: ${scheduleId}`);
    }
  }

  /**
   * Delete a schedule permanently
   * @param {string} scheduleId - Schedule ID to delete
   */
  async deleteSchedule(scheduleId) {
    // Stop the task if running
    await this.stopTask(scheduleId);

    // Remove from persistent storage
    const schedules = await this.loadSchedules();
    const filtered = schedules.filter(s => s.id !== scheduleId);
    await fs.writeFile(this.schedulesFile, JSON.stringify(filtered, null, 2));

    console.log(`🗑️ Deleted schedule: ${scheduleId}`);
  }

  /**
   * Restore all enabled schedules on startup
   */
  async restoreSchedules() {
    const schedules = await this.loadSchedules();
    const enabled = schedules.filter(s => s.enabled);

    console.log(`🔄 Restoring ${enabled.length} enabled schedules...`);

    for (const schedule of enabled) {
      try {
        await this.startTask(schedule);
      } catch (error) {
        console.error(`Failed to restore schedule ${schedule.id}: ${error.message}`);
      }
    }

    console.log(`✅ Restored ${this.activeTasks.size} active schedules`);
  }

  /**
   * Stop all active tasks (for shutdown)
   */
  async shutdown() {
    console.log(`🛑 Shutting down ${this.activeTasks.size} active tasks...`);

    for (const [scheduleId, task] of this.activeTasks) {
      task.stop();
      console.log(`   Stopped: ${scheduleId}`);
    }

    this.activeTasks.clear();
    console.log('✅ Schedule engine shutdown complete');
  }

  /**
   * Get detailed status of the schedule engine
   * @returns {Object} - Engine status information
   */
  getStatus() {
    return {
      activeTasks: this.activeTasks.size,
      dataDir: this.dataDir,
      schedulesFile: this.schedulesFile,
      parserAvailable: this.parser !== null,
      uptime: process.uptime()
    };
  }
}

module.exports = ScheduleEngine;
