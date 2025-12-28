/**
 * Review Panel Controller
 * Manages the review results webview
 */

const vscode = require('vscode');
const webviewManager = require('../services/webviewManager');
const { logger } = require('../utils/logger');

/**
 * Show review results in webview
 * @param {object} report - Review report data
 */
async function showReviewResults(report) {
  try {
    // Get extension context from global state
    const context = global.extensionContext;
    
    if (!context) {
      logger.error('Extension context not available, falling back to markdown');
      throw new Error('Context not available');
    }

    // Get or create webview panel
    const panel = webviewManager.getPanel(context);
    
    // Update content
    webviewManager.updateContent(report);

    // Handle messages from webview (if needed for interactivity)
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'applyFix':
            vscode.commands.executeCommand('codeSentinel.autoFix');
            break;
          case 'explainIssue':
            vscode.commands.executeCommand('codeSentinel.explainIssue');
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    logger.info('Review results displayed in webview');
  } catch (error) {
    logger.error('Failed to show webview:', error);
    throw error;
  }
}

module.exports = { showReviewResults };
