/**
 * Progress Tracker
 * Manages real-time progress updates in chat panel
 */

const { logger } = require('../utils/logger');

class ProgressTracker {
  constructor(chatPanel) {
    this.chatPanel = chatPanel;
    this.activeTasks = new Map();
  }

  /**
   * Start tracking a new task
   */
  startTask(taskId, taskName, estimatedSteps = 5) {
    const task = {
      id: taskId,
      name: taskName,
      startedAt: Date.now(),
      currentStep: 0,
      totalSteps: estimatedSteps,
      currentPhase: 'initializing',
      percent: 0,
      status: 'in_progress'
    };

    this.activeTasks.set(taskId, task);
    
    // Send initial progress to chat panel
    this._updateUI(task);
    
    logger.info(`Started tracking task: ${taskId} - ${taskName}`);
  }

  /**
   * Update task progress
   */
  updateProgress(taskId, phase, percent) {
    const task = this.activeTasks.get(taskId);
    
    if (!task) {
      logger.warn(`Task not found: ${taskId}`);
      return;
    }

    task.currentPhase = phase;
    task.percent = Math.min(percent, 100);
    task.currentStep = Math.floor((percent / 100) * task.totalSteps);

    this._updateUI(task);
  }

  /**
   * Update current step/phase
   */
  updatePhase(taskId, phase, stepNumber = null) {
    const task = this.activeTasks.get(taskId);
    
    if (!task) {
      return;
    }

    task.currentPhase = phase;
    
    if (stepNumber !== null) {
      task.currentStep = stepNumber;
      task.percent = Math.floor((stepNumber / task.totalSteps) * 100);
    }

    this._updateUI(task);
  }

  /**
   * Show file creation notification
   */
  notifyFileCreated(taskId, filePath) {
    if (this.chatPanel && this.chatPanel.webview) {
      this.chatPanel.webview.postMessage({
        type: 'file_created',
        taskId,
        filePath,
        timestamp: Date.now()
      });
    }

    logger.debug(`File created: ${filePath}`);
  }

  /**
   * Complete a task
   */
  completeTask(taskId, result = null) {
    const task = this.activeTasks.get(taskId);
    
    if (!task) {
      return;
    }

    task.status = 'complete';
    task.percent = 100;
    task.completedAt = Date.now();
    task.duration = task.completedAt - task.startedAt;
    task.result = result;

    this._updateUI(task);
    
    // Remove from active tasks after 5 seconds
    setTimeout(() => {
      this.activeTasks.delete(taskId);
    }, 5000);

    logger.info(`Task completed: ${taskId} (${task.duration}ms)`);
  }

  /**
   * Fail a task
   */
  failTask(taskId, error) {
    const task = this.activeTasks.get(taskId);
    
    if (!task) {
      return;
    }

    task.status = 'failed';
    task.error = error;
    task.completedAt = Date.now();
    task.duration = task.completedAt - task.startedAt;

    this._updateUI(task);
    
    logger.error(`Task failed: ${taskId} - ${error}`);
  }

  /**
   * Get active tasks
   */
  getActiveTasks() {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Clear completed tasks
   */
  clearCompleted() {
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.status === 'complete' || task.status === 'failed') {
        this.activeTasks.delete(taskId);
      }
    }
  }

  /**
   * Update chat panel UI
   */
  _updateUI(task) {
    if (!this.chatPanel || !this.chatPanel.webview) {
      return;
    }

    this.chatPanel.webview.postMessage({
      type: 'progress_update',
      task: {
        id: task.id,
        name: task.name,
        phase: task.currentPhase,
        percent: task.percent,
        step: task.currentStep,
        totalSteps: task.totalSteps,
        status: task.status,
        error: task.error,
        result: task.result
      },
      timestamp: Date.now()
    });
  }

  /**
   * Show streaming message in chat
   */
  streamMessage(message, isComplete = false) {
    if (!this.chatPanel || !this.chatPanel.webview) {
      return;
    }

    this.chatPanel.webview.postMessage({
      type: 'stream_message',
      message,
      isComplete,
      timestamp: Date.now()
    });
  }
}

module.exports = ProgressTracker;
