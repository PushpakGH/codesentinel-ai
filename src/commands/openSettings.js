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
    // Extension ID format: publisher.name
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      '@ext:PushpakBadgujar1.codesentinel-ai'
    );

    logger.debug('Settings panel opened');
  } catch (error) {
    logger.error('Failed to open settings:', error);
    
    // Fallback: Open general settings search
    try {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'codeSentinel'
      );
    } catch (fallbackError) {
      logger.error('Fallback settings open also failed:', fallbackError);
      vscode.window.showErrorMessage('Failed to open settings. Please use Command Palette → Preferences: Open Settings (UI) and search for "codeSentinel"');
    }
  }
}

module.exports = { openSettingsCommand };
