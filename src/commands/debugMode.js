/**
 * Debug Mode Command
 * Toggles debug logging and shows real-time metrics
 * Perfect for demos and hackathon judging
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const configManager = require('../services/configManager');
const aiClient = require('../services/aiClient');

/**
 * Toggle debug mode with detailed status display
 */
async function toggleDebugCommand() {
  const currentState = configManager.isDebugMode();
  const newState = !currentState;

  try {
    // Update configuration
    await vscode.workspace.getConfiguration('codeSentinel')
      .update('debugMode', newState, vscode.ConfigurationTarget.Global);

    // Update logger
    logger.setDebugMode(newState);

    if (newState) {
      // Debug mode enabled - show comprehensive status
      await showDebugStatus();
      
      vscode.window.showInformationMessage(
        '🐛 Debug Mode: ON - Check Output Panel for detailed logs',
        'Show Output'
      ).then(action => {
        if (action === 'Show Output') {
          logger.show();
        }
      });
    } else {
      // Debug mode disabled
      vscode.window.showInformationMessage('✅ Debug Mode: OFF');
    }

    logger.info(`Debug mode ${newState ? 'enabled' : 'disabled'}`);

  } catch (error) {
    logger.error('Failed to toggle debug mode:', error);
    vscode.window.showErrorMessage(`Failed to toggle debug mode: ${error.message}`);
  }
}

/**
 * Display comprehensive debug status
 * @private
 */
async function showDebugStatus() {
  try {
    // Gather system information
    const config = vscode.workspace.getConfiguration('codeSentinel');
    const provider = config.get('modelProvider', 'unknown');
    const geminiModel = config.get('geminiModel', 'unknown');
    const ollamaModel = config.get('ollamaModel', 'unknown');
    const ollamaUrl = config.get('ollamaBaseUrl', 'unknown');
    const apiKeyConfigured = (await configManager.getApiKey()) ? '✓' : '✗';
    
    const stats = aiClient.getStats();

    // Format status message
    const statusMessage = `
╔════════════════════════════════════════════╗
║       CodeSentinel AI - Debug Status       ║
╚════════════════════════════════════════════╝

🤖 MODEL CONFIGURATION:
  Provider:        ${provider}
  Gemini Model:    ${geminiModel}
  Ollama Model:    ${ollamaModel}
  Ollama URL:      ${ollamaUrl}
  API Key:         ${apiKeyConfigured}

📊 RUNTIME STATISTICS:
  Requests Made:   ${stats.requestCount}
  Current Provider: ${stats.currentProvider || 'None'}
  Uptime:          ${Math.floor(stats.uptime / 1000)}s

⚙️ FEATURE FLAGS:
  Streaming:       ${config.get('enableStreaming') ? '✓' : '✗'}
  Auto-Fix:        ${config.get('enableAutoFix') ? '✓' : '✗'}
  Security Agent:  ${config.get('enableSecurityAgent') ? '✓' : '✗'}
  Confidence Threshold: ${config.get('confidenceThreshold')}%
  Max Retries:     ${config.get('maxRetries')}

🔍 EXTENSIONS:
  VS Code Version: ${vscode.version}
  Extension Version: 1.0.0

💡 TIP: All API calls will now be logged to Output Panel
    View → Output → Select "CodeSentinel AI"
`;

    // Log to output channel
    logger.info('='.repeat(50));
    logger.info(statusMessage);
    logger.info('='.repeat(50));

    // Show in information message
    const action = await vscode.window.showInformationMessage(
      'Debug status logged to Output Panel',
      'View Output',
      'Copy Status'
    );

    if (action === 'View Output') {
      logger.show();
    } else if (action === 'Copy Status') {
      await vscode.env.clipboard.writeText(statusMessage);
      vscode.window.showInformationMessage('✓ Debug status copied to clipboard');
    }

  } catch (error) {
    logger.error('Failed to generate debug status:', error);
  }
}

/**
 * Export debug information to file (for bug reports)
 */
async function exportDebugInfo() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `codesentinel-debug-${timestamp}.txt`;

    const debugInfo = await collectDebugInfo();

    const doc = await vscode.workspace.openTextDocument({
      content: debugInfo,
      language: 'plaintext'
    });

    await vscode.window.showTextDocument(doc);
    
    vscode.window.showInformationMessage(
      `Debug info ready. Save as "${filename}"`,
      'Save'
    ).then(action => {
      if (action === 'Save') {
        vscode.commands.executeCommand('workbench.action.files.save');
      }
    });

  } catch (error) {
    logger.error('Failed to export debug info:', error);
  }
}

/**
 * Collect comprehensive debug information
 * @private
 */
async function collectDebugInfo() {
  const config = vscode.workspace.getConfiguration('codeSentinel');
  const stats = aiClient.getStats();

  return `CodeSentinel AI - Debug Export
Generated: ${new Date().toISOString()}

=== CONFIGURATION ===
${JSON.stringify(config, null, 2)}

=== RUNTIME STATS ===
${JSON.stringify(stats, null, 2)}

=== SYSTEM INFO ===
VS Code Version: ${vscode.version}
Platform: ${process.platform}
Node Version: ${process.version}
Architecture: ${process.arch}

=== ENVIRONMENT ===
Workspace: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'None'}
Active Language: ${vscode.window.activeTextEditor?.document.languageId || 'None'}

=== EXTENSION STATE ===
${logger.outputChannel ? 'Logger: Active' : 'Logger: Inactive'}
AI Client: ${stats.currentProvider || 'Not initialized'}
`;
}

module.exports = { 
  toggleDebugCommand,
  exportDebugInfo 
};
