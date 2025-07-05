#!/usr/bin/env node
/**
 * Enhanced AFk Progress Tracker - v14.0.0
 * Provides detailed progress monitoring with iteration summaries
 */

const fs = require('fs').promises;
const path = require('path');

class ProgressTracker {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.dataDir = options.dataDir || path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'calmhive', 'progress');
    this.progressFile = path.join(this.dataDir, `${sessionId}-progress.json`);
    this.initialized = false;

    this.progress = {
      sessionId,
      startTime: new Date().toISOString(),
      currentIteration: 0,
      totalIterations: options.totalIterations || 1,
      status: 'initializing',
      iterations: [],
      milestones: [],
      overallSummary: '',
      lastUpdate: new Date().toISOString()
    };
  }

  async init() {
    if (this.initialized) {return;}

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      console.error(`Failed to initialize progress tracker: ${error.message}`);
    }
  }

  /**
   * Start a new iteration
   * @param {number} iterationNumber - 1-based iteration number
   * @param {string} goal - What this iteration aims to accomplish
   */
  async startIteration(iterationNumber, goal = '') {
    await this.init();

    const iteration = {
      number: iterationNumber,
      goal,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'running',
      actions: [],
      summary: '',
      achievements: [],
      challenges: [],
      nextSteps: [],
      duration: 0
    };

    this.progress.currentIteration = iterationNumber;
    this.progress.iterations.push(iteration);
    this.progress.status = 'running';

    await this.save();

    console.log(`🚀 Starting iteration ${iterationNumber}/${this.progress.totalIterations}`);
    if (goal) {
      console.log(`   Goal: ${goal}`);
    }
  }

  /**
   * Log an action within the current iteration
   * @param {string} action - Description of the action taken
   * @param {string} result - Result or outcome of the action
   * @param {string} type - Type of action (code, test, debug, research, etc.)
   */
  async logAction(action, result = '', type = 'general') {
    await this.init();

    const currentIteration = this.getCurrentIteration();
    if (!currentIteration) {
      console.warn('No active iteration for logging action');
      return;
    }

    const actionEntry = {
      timestamp: new Date().toISOString(),
      type,
      action,
      result,
      success: !result.toLowerCase().includes('error') && !result.toLowerCase().includes('failed')
    };

    currentIteration.actions.push(actionEntry);
    await this.save();

    const status = actionEntry.success ? '✅' : '❌';
    console.log(`   ${status} ${action}`);
    if (result) {
      console.log(`      → ${result}`);
    }
  }

  /**
   * Add a milestone achievement
   * @param {string} milestone - Description of the milestone
   * @param {string} impact - Impact or significance of this milestone
   */
  async addMilestone(milestone, impact = '') {
    await this.init();

    const milestoneEntry = {
      timestamp: new Date().toISOString(),
      iteration: this.progress.currentIteration,
      milestone,
      impact
    };

    this.progress.milestones.push(milestoneEntry);
    await this.save();

    console.log(`🎯 Milestone: ${milestone}`);
    if (impact) {
      console.log(`   Impact: ${impact}`);
    }
  }

  /**
   * Complete the current iteration
   * @param {string} summary - Summary of what was accomplished
   * @param {Array} achievements - List of key achievements
   * @param {Array} challenges - List of challenges encountered
   * @param {Array} nextSteps - Recommended next steps
   */
  async completeIteration(summary = '', achievements = [], challenges = [], nextSteps = []) {
    await this.init();

    const currentIteration = this.getCurrentIteration();
    if (!currentIteration) {
      console.warn('No active iteration to complete');
      return;
    }

    currentIteration.endTime = new Date().toISOString();
    currentIteration.status = 'completed';
    currentIteration.summary = summary;
    currentIteration.achievements = achievements;
    currentIteration.challenges = challenges;
    currentIteration.nextSteps = nextSteps;

    // Calculate duration
    const startTime = new Date(currentIteration.startTime);
    const endTime = new Date(currentIteration.endTime);
    currentIteration.duration = Math.round((endTime - startTime) / 1000); // seconds

    await this.save();

    console.log(`✅ Completed iteration ${currentIteration.number}/${this.progress.totalIterations}`);
    console.log(`   Duration: ${this.formatDuration(currentIteration.duration)}`);
    console.log(`   Actions: ${currentIteration.actions.length}`);

    if (achievements.length > 0) {
      console.log('   Achievements:');
      achievements.forEach(achievement => console.log(`     • ${achievement}`));
    }

    if (challenges.length > 0) {
      console.log('   Challenges:');
      challenges.forEach(challenge => console.log(`     ⚠️ ${challenge}`));
    }

    if (nextSteps.length > 0) {
      console.log('   Next Steps:');
      nextSteps.forEach(step => console.log(`     → ${step}`));
    }
  }

  /**
   * Complete the entire session
   * @param {string} overallSummary - Summary of the entire session
   * @param {string} finalStatus - Final status (completed, failed, stopped)
   */
  async completeSession(overallSummary = '', finalStatus = 'completed') {
    await this.init();

    this.progress.status = finalStatus;
    this.progress.overallSummary = overallSummary;
    this.progress.endTime = new Date().toISOString();

    // Calculate total duration
    const startTime = new Date(this.progress.startTime);
    const endTime = new Date(this.progress.endTime);
    this.progress.totalDuration = Math.round((endTime - startTime) / 1000); // seconds

    await this.save();

    console.log(`🏁 Session completed: ${finalStatus.toUpperCase()}`);
    console.log(`   Total Duration: ${this.formatDuration(this.progress.totalDuration)}`);
    console.log(`   Iterations: ${this.progress.iterations.length}/${this.progress.totalIterations}`);
    console.log(`   Milestones: ${this.progress.milestones.length}`);

    if (overallSummary) {
      console.log(`   Summary: ${overallSummary}`);
    }
  }

  /**
   * Get current iteration object
   */
  getCurrentIteration() {
    return this.progress.iterations.find(iter => iter.status === 'running');
  }

  /**
   * Get progress summary for display
   */
  getProgressSummary() {
    const totalActions = this.progress.iterations.reduce((sum, iter) => sum + iter.actions.length, 0);
    const successfulActions = this.progress.iterations.reduce((sum, iter) =>
      sum + iter.actions.filter(action => action.success).length, 0);

    return {
      sessionId: this.progress.sessionId,
      status: this.progress.status,
      currentIteration: this.progress.currentIteration,
      totalIterations: this.progress.totalIterations,
      completedIterations: this.progress.iterations.filter(iter => iter.status === 'completed').length,
      totalActions: totalActions,
      successfulActions: successfulActions,
      successRate: totalActions > 0 ? Math.round((successfulActions / totalActions) * 100) : 0,
      milestones: this.progress.milestones.length,
      duration: this.getTotalDuration()
    };
  }

  /**
   * Get detailed progress report
   */
  getDetailedReport() {
    const summary = this.getProgressSummary();

    return {
      ...summary,
      iterations: this.progress.iterations.map(iter => ({
        number: iter.number,
        goal: iter.goal,
        status: iter.status,
        duration: iter.duration || 0,
        actionsCount: iter.actions.length,
        achievementsCount: iter.achievements.length,
        challengesCount: iter.challenges.length,
        summary: iter.summary
      })),
      recentMilestones: this.progress.milestones.slice(-5),
      overallSummary: this.progress.overallSummary
    };
  }

  /**
   * Save progress to file
   */
  async save() {
    if (!this.initialized) {return;}

    try {
      this.progress.lastUpdate = new Date().toISOString();
      await fs.writeFile(this.progressFile, JSON.stringify(this.progress, null, 2));
    } catch (error) {
      console.error(`Failed to save progress: ${error.message}`);
    }
  }

  /**
   * Load progress from file
   */
  async load() {
    await this.init();

    try {
      const data = await fs.readFile(this.progressFile, 'utf8');
      this.progress = { ...this.progress, ...JSON.parse(data) };
    } catch (error) {
      // File doesn't exist or is invalid, use defaults
    }
  }

  /**
   * Get total duration in seconds
   */
  getTotalDuration() {
    if (this.progress.endTime) {
      const startTime = new Date(this.progress.startTime);
      const endTime = new Date(this.progress.endTime);
      return Math.round((endTime - startTime) / 1000);
    } else {
      const startTime = new Date(this.progress.startTime);
      const now = new Date();
      return Math.round((now - startTime) / 1000);
    }
  }

  /**
   * Format duration in human readable format
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get progress file path for external access
   */
  getProgressFilePath() {
    return this.progressFile;
  }

  /**
   * Clean up old progress files
   */
  static async cleanup(olderThanDays = 30) {
    const progressDir = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'calmhive', 'progress');

    try {
      const files = await fs.readdir(progressDir);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (file.endsWith('-progress.json')) {
          const filePath = path.join(progressDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            console.log(`🧹 Cleaned up old progress file: ${file}`);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or no access
    }
  }
}

module.exports = ProgressTracker;
