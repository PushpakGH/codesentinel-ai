/**
 * Open Settings Command
 * Opens CodeSentinel settings panel
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');

/**
 * Open CodeSentinel settings in VS Code settings UI
 */
async function openSettingsCommand() {
  try {
    // Open settings filtered to CodeSentinel
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      '@ext:codesentinel.codesentinel-ai'
    );

    logger.debug('Settings panel opened');
  } catch (error) {
    logger.error('Failed to open settings:', error);
    
    // Fallback: Open general settings search
    vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'codeSentinel'
    );
  }
}

module.exports = { openSettingsCommand };
