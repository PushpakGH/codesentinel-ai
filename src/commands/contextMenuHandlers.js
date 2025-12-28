/**
 * Context Menu Handlers
 * Handles right-click actions on files and folders
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');

/**
 * Handle folder right-click review
 * @param {vscode.Uri} uri - Folder URI from context menu
 */
async function handleFolderReview(uri) {
  if (!uri || !uri.fsPath) {
    vscode.window.showErrorMessage('❌ Invalid folder selection');
    return;
  }

  const folderPath = uri.fsPath;
  logger.info(`Context menu folder review: ${folderPath}`);

  const { reviewFolderCommand } = require('./reviewFolder');
  await reviewFolderCommand(folderPath, false);
}

/**
 * Handle file right-click review
 * @param {vscode.Uri} uri - File URI from context menu
 */
async function handleFileReview(uri) {
  if (!uri || !uri.fsPath) {
    vscode.window.showErrorMessage('❌ Invalid file selection');
    return;
  }

  const filePath = uri.fsPath;
  logger.info(`Context menu file review: ${filePath}`);

  try {
    // Open file and review
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    // Trigger review
    vscode.commands.executeCommand('codeSentinel.reviewCode');

  } catch (error) {
    logger.error('File review failed:', error);
    vscode.window.showErrorMessage(`❌ Failed to review file: ${error.message}`);
  }
}

module.exports = {
  handleFolderReview,
  handleFileReview
};
