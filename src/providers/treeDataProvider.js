/**
 * Tree Data Provider - File Analysis Tree View
 * Shows code quality metrics in sidebar
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');

class CodeSentinelTreeDataProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.analysisResults = new Map();
  }

  /**
   * Get tree item
   * @param {TreeItem} element 
   */
  getTreeItem(element) {
    return element;
  }

  /**
   * Get children
   * @param {TreeItem} element 
   */
  async getChildren(element) {
    if (!element) {
      // Root level - show analyzed files
      if (this.analysisResults.size === 0) {
        return [this._createInfoItem('No files analyzed yet', 'Run a code review to see results')];
      }

      const items = [];
      for (const [filePath, result] of this.analysisResults.entries()) {
        items.push(this._createFileItem(filePath, result));
      }
      return items;
    }

    // Child level - show issues for file
    if (element.contextValue === 'file') {
      const result = this.analysisResults.get(element.filePath);
      if (!result || !result.issues) {
        return [];
      }

      return result.issues.map(issue => this._createIssueItem(issue));
    }

    return [];
  }

  /**
   * Add analysis result
   * @param {string} filePath 
   * @param {object} result 
   */
  addResult(filePath, result) {
    this.analysisResults.set(filePath, result);
    this._onDidChangeTreeData.fire();
    logger.debug(`Added analysis for ${filePath}`);
  }

  /**
   * Clear all results
   */
  clearResults() {
    this.analysisResults.clear();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Create file tree item
   * @private
   */
  _createFileItem(filePath, result) {
    const fileName = filePath.split(/[/\\]/).pop();
    const issueCount = result.issues?.length || 0;
    
    const item = new vscode.TreeItem(
      fileName,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    item.description = `${issueCount} issue(s)`;
    item.tooltip = `${filePath}\nConfidence: ${result.confidence}%`;
    item.contextValue = 'file';
    item.filePath = filePath;
    
    // Icon based on risk score
    const riskScore = result.summary?.riskScore || 0;
    item.iconPath = new vscode.ThemeIcon(
      riskScore >= 80 ? 'error' :
      riskScore >= 50 ? 'warning' :
      'check',
      new vscode.ThemeColor(
        riskScore >= 80 ? 'errorForeground' :
        riskScore >= 50 ? 'warningForeground' :
        'charts.green'
      )
    );

    return item;
  }

  /**
   * Create issue tree item
   * @private
   */
  _createIssueItem(issue) {
    const item = new vscode.TreeItem(
      issue.title || issue.description.substring(0, 50),
      vscode.TreeItemCollapsibleState.None
    );

    item.description = issue.severity;
    item.tooltip = issue.description;
    item.contextValue = 'issue';
    
    // Icon based on severity
    item.iconPath = new vscode.ThemeIcon(
      issue.severity === 'critical' || issue.severity === 'high' ? 'error' :
      issue.severity === 'medium' ? 'warning' :
      'info'
    );

    return item;
  }

  /**
   * Create info item
   * @private
   */
  _createInfoItem(label, description) {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = description;
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
  }
}

/**
 * Register tree data provider
 * @param {vscode.ExtensionContext} context 
 */
function registerTreeDataProvider(context) {
  const provider = new CodeSentinelTreeDataProvider();

  const treeView = vscode.window.createTreeView('codesentinel.reviewPanel', {
    treeDataProvider: provider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);
  logger.info('✅ Tree data provider registered');

  return provider;
}

module.exports = { registerTreeDataProvider };
