/**
 * Project History Tree Data Provider
 * Shows recent projects with resume capability in the sidebar
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

// Storage key for project history
const HISTORY_KEY = 'codesentinel.projectHistory';
const MAX_HISTORY = 20;

/**
 * Tree Item representing a project in history
 */
class ProjectTreeItem extends vscode.TreeItem {
  constructor(project, collapsibleState) {
    super(project.name, collapsibleState);
    
    this.project = project;
    this.tooltip = `${project.path}\nLast modified: ${new Date(project.lastModified).toLocaleString()}`;
    this.description = this.getStatusDescription(project);
    this.contextValue = 'project';
    
    // Set icon based on status
    this.iconPath = this.getStatusIcon(project);
    
    // Click to resume
    this.command = {
      command: 'codeSentinel.resumeProject',
      title: 'Resume Project',
      arguments: [project]
    };
  }
  
  getStatusDescription(project) {
    if (project.status === 'complete') return '✅ Complete';
    if (project.status === 'in-progress') {
      const step = project.currentStep || 'scaffold';
      return `🔄 ${step}`;
    }
    return '⚪ Not started';
  }
  
  getStatusIcon(project) {
    if (project.status === 'complete') {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    }
    if (project.status === 'in-progress') {
      return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
    }
    return new vscode.ThemeIcon('folder');
  }
}

/**
 * Tree Item representing a step within a project
 */
class StepTreeItem extends vscode.TreeItem {
  constructor(stepName, isComplete, projectPath) {
    super(stepName, vscode.TreeItemCollapsibleState.None);
    
    this.description = isComplete ? '✅' : '⬜';
    this.tooltip = isComplete ? `${stepName}: Completed` : `${stepName}: Pending`;
    this.contextValue = 'step';
    this.iconPath = isComplete 
      ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'))
      : new vscode.ThemeIcon('circle-outline');
  }
}

/**
 * Tree Data Provider for Project History
 */
class ProjectHistoryProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.projects = [];
    
    // Load history on init
    this.loadHistory();
  }
  
  /**
   * Refresh the tree view
   */
  refresh() {
    this.loadHistory();
    this._onDidChangeTreeData.fire();
  }
  
  /**
   * Load project history from global storage
   */
  loadHistory() {
    try {
      const history = this.context.globalState.get(HISTORY_KEY, []);
      this.projects = history;
      logger.debug(`Loaded ${this.projects.length} projects from history`);
    } catch (error) {
      logger.error('Failed to load project history:', error.message);
      this.projects = [];
    }
  }
  
  /**
   * Add or update a project in history
   */
  async addProject(projectPath, manifest) {
    try {
      const history = this.context.globalState.get(HISTORY_KEY, []);
      
      // Check if project already exists
      const existingIndex = history.findIndex(p => p.path === projectPath);
      
      const projectEntry = {
        name: manifest?.projectPlan?.projectName || path.basename(projectPath),
        path: projectPath,
        lastModified: Date.now(),
        status: this.determineStatus(manifest),
        currentStep: this.getCurrentStep(manifest),
        completedSteps: manifest?.completedSteps || [],
        pagesGenerated: manifest?.pagesGenerated || []
      };
      
      if (existingIndex >= 0) {
        // Update existing
        history[existingIndex] = projectEntry;
      } else {
        // Add new at beginning
        history.unshift(projectEntry);
      }
      
      // Limit history size
      const trimmedHistory = history.slice(0, MAX_HISTORY);
      await this.context.globalState.update(HISTORY_KEY, trimmedHistory);
      
      this.refresh();
      logger.info(`📚 Added project to history: ${projectEntry.name}`);
    } catch (error) {
      logger.error('Failed to add project to history:', error.message);
    }
  }
  
  /**
   * Determine project status from manifest
   */
  determineStatus(manifest) {
    if (!manifest) return 'not-started';
    
    const steps = ['scaffold', 'theme', 'components', 'pages'];
    const completed = manifest.completedSteps || [];
    
    if (steps.every(s => completed.includes(s))) {
      return 'complete';
    }
    
    if (completed.length > 0) {
      return 'in-progress';
    }
    
    return 'not-started';
  }
  
  /**
   * Get current step from manifest
   */
  getCurrentStep(manifest) {
    if (!manifest) return null;
    
    const steps = ['scaffold', 'theme', 'components', 'pages'];
    const completed = manifest.completedSteps || [];
    
    for (const step of steps) {
      if (!completed.includes(step)) {
        return step;
      }
    }
    
    return 'complete';
  }
  
  /**
   * Remove a project from history
   */
  async removeProject(projectPath) {
    try {
      const history = this.context.globalState.get(HISTORY_KEY, []);
      const filtered = history.filter(p => p.path !== projectPath);
      await this.context.globalState.update(HISTORY_KEY, filtered);
      this.refresh();
    } catch (error) {
      logger.error('Failed to remove project from history:', error.message);
    }
  }
  
  /**
   * Clear all history
   */
  async clearHistory() {
    await this.context.globalState.update(HISTORY_KEY, []);
    this.refresh();
  }
  
  /**
   * TreeDataProvider: Get tree item
   */
  getTreeItem(element) {
    return element;
  }
  
  /**
   * TreeDataProvider: Get children
   */
  async getChildren(element) {
    if (!element) {
      // Root level - show projects
      if (this.projects.length === 0) {
        return [new vscode.TreeItem('No projects yet. Use "Build Project" to start.')];
      }
      
      return this.projects.map(project => 
        new ProjectTreeItem(project, vscode.TreeItemCollapsibleState.Collapsed)
      );
    }
    
    // Project level - show steps
    if (element instanceof ProjectTreeItem) {
      const steps = ['scaffold', 'theme', 'components', 'pages'];
      const completed = element.project.completedSteps || [];
      
      return steps.map(step => 
        new StepTreeItem(
          this.formatStepName(step),
          completed.includes(step),
          element.project.path
        )
      );
    }
    
    return [];
  }
  
  /**
   * Format step name for display
   */
  formatStepName(step) {
    const names = {
      'scaffold': '📦 Scaffold Project',
      'theme': '🎨 Generate Theme',
      'components': '🧩 Install Components',
      'pages': '📄 Generate Pages'
    };
    return names[step] || step;
  }
  
  /**
   * Load manifest from project path
   */
  async loadManifest(projectPath) {
    try {
      const manifestPath = path.join(projectPath, '.codesentinel', 'manifest.json');
      const content = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

module.exports = ProjectHistoryProvider;
