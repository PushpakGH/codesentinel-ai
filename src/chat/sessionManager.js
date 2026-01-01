/**
 * Session Manager
 * Manages conversation context, project state, and user preferences
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');

class SessionManager {
  constructor(extensionContext) {
    this.context = extensionContext;
    this.currentSession = null;
    this.sessionId = null;
  }

  /**
   * Initialize or restore session
   */
  async initialize() {
    logger.info('Initializing session manager...');
    
    try {
      // Try to restore previous session
      const savedSession = this.context.globalState.get('codesentinel.lastSession');
      
      if (savedSession) {
        this.currentSession = savedSession;
        this.sessionId = savedSession.sessionId;
        logger.info(`Restored session: ${this.sessionId}`);
      } else {
        // Create new session
        await this.createNewSession();
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize session:', error);
      // Create new session as fallback
      await this.createNewSession();
      return false;
    }
  }

  /**
   * Create a new session
   */
  async createNewSession() {
    this.sessionId = this._generateSessionId();
    
    this.currentSession = {
      sessionId: this.sessionId,
      startedAt: new Date().toISOString(),
      projectContext: null,
      conversationHistory: [],
      activeTasks: [],
      userPreferences: {
        preferredFramework: null,
        preferredRegistry: 'shadcn'
      }
    };
    
    await this.saveSession();
    logger.info(`Created new session: ${this.sessionId}`);
  }

  /**
   * Save current session to extension state
   */
  async saveSession() {
    try {
      await this.context.globalState.update('codesentinel.lastSession', this.currentSession);
      logger.debug('Session saved');
    } catch (error) {
      logger.error('Failed to save session:', error);
    }
  }

  /**
   * Add message to conversation history
   */
  async addMessage(role, content) {
    if (!this.currentSession) {
      await this.initialize();
    }

    const message = {
      role,
      content,
      timestamp: new Date().toISOString()
    };

    this.currentSession.conversationHistory.push(message);
    
    // Keep only last 100 messages to prevent memory issues
    if (this.currentSession.conversationHistory.length > 100) {
      this.currentSession.conversationHistory = this.currentSession.conversationHistory.slice(-100);
    }

    await this.saveSession();
  }

  /**
   * Update project context
   */
  async updateProjectContext(projectData) {
    if (!this.currentSession) {
      await this.initialize();
    }

    this.currentSession.projectContext = {
      ...this.currentSession.projectContext,
      ...projectData,
      updatedAt: new Date().toISOString()
    };

    await this.saveSession();
    logger.info('Project context updated');
  }

  /**
   * Get relevant context for AI prompt
   */
  getRelevantContext(userQuery) {
    if (!this.currentSession) {
      return null;
    }

    const context = {
      hasProject: !!this.currentSession.projectContext,
      projectInfo: this.currentSession.projectContext,
      recentMessages: this.currentSession.conversationHistory.slice(-10), // Last 10 messages
      activeTasks: this.currentSession.activeTasks,
      preferences: this.currentSession.userPreferences
    };

    return context;
  }

  /**
   * Search conversation history
   */
  searchHistory(query) {
    if (!this.currentSession || !this.currentSession.conversationHistory) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    
    return this.currentSession.conversationHistory.filter(msg => 
      msg.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Add active task
   */
  async addTask(taskId, taskType, description) {
    if (!this.currentSession) {
      await this.initialize();
    }

    const task = {
      id: taskId,
      type: taskType,
      description,
      status: 'in_progress',
      progress: 0,
      startedAt: new Date().toISOString()
    };

    this.currentSession.activeTasks.push(task);
    await this.saveSession();
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(taskId, progress, status = 'in_progress') {
    if (!this.currentSession) {
      return;
    }

    const task = this.currentSession.activeTasks.find(t => t.id === taskId);
    
    if (task) {
      task.progress = progress;
      task.status = status;
      task.updatedAt = new Date().toISOString();
      
      if (status === 'complete' || status === 'failed') {
        task.completedAt = new Date().toISOString();
      }
      
      await this.saveSession();
    }
  }

  /**
   * Complete task
   */
  async completeTask(taskId, result = null) {
    await this.updateTaskProgress(taskId, 100, 'complete');
    
    if (result && this.currentSession) {
      const task = this.currentSession.activeTasks.find(t => t.id === taskId);
      if (task) {
        task.result = result;
        await this.saveSession();
      }
    }
  }

  /**
   * Clear completed tasks
   */
  async clearCompletedTasks() {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.activeTasks = this.currentSession.activeTasks.filter(
      task => task.status === 'in_progress'
    );
    
    await this.saveSession();
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences) {
    if (!this.currentSession) {
      await this.initialize();
    }

    this.currentSession.userPreferences = {
      ...this.currentSession.userPreferences,
      ...preferences
    };

    await this.saveSession();
  }

  /**
   * Clear current session
   */
  async clearSession() {
    await this.createNewSession();
    logger.info('Session cleared');
  }

  /**
   * Get session summary for display
   */
  getSessionSummary() {
    if (!this.currentSession) {
      return {
        hasSession: false,
        message: 'No active session'
      };
    }

    return {
      hasSession: true,
      sessionId: this.sessionId,
      startedAt: this.currentSession.startedAt,
      messageCount: this.currentSession.conversationHistory.length,
      hasProject: !!this.currentSession.projectContext,
      projectPath: this.currentSession.projectContext?.path,
      activeTasks: this.currentSession.activeTasks.length
    };
  }

  /**
   * Generate unique session ID
   */
  _generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = SessionManager;
