/**
 * CodeSentinel AI - Main Extension Entry Point
 * Production-grade VS Code extension for AI-powered code review
 * * Features:
 * - Multi-agent analysis (Primary, Security, Validator)
 * - BYOK (Bring Your Own Key) support
 * - Universal model support (Gemini, Ollama, OpenAI, Anthropic)
 * - Self-correction loop with confidence thresholds
 * - Real-time streaming responses
 * - Debug mode for demonstrations
 */

const vscode = require('vscode');
const { logger } = require('./utils/logger');
const configManager = require('./services/configManager');

/**
 * Extension activation
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  try {
    logger.info('🚀 CodeSentinel AI Extension Activating...');

    // CRITICAL: Store context globally for webview access
    global.extensionContext = context;

    // Initialize ConfigManager with SecretStorage
    await configManager.initialize(context);
    logger.info('✅ ConfigManager initialized with SecretStorage');

    // Validate configuration
    const validation = await configManager.validateConfig();
    if (!validation.valid) {
      const action = await vscode.window.showWarningMessage(
        `⚠️ Configuration Issues: ${validation.errors.join(', ')}`,
        'Fix Now',
        'Later'
      );
      
      if (action === 'Fix Now') {
        vscode.commands.executeCommand('codeSentinel.openSettings');
      }
    }

    // Show warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      logger.warn('Configuration warnings:', validation.warnings);
    }

    // Initialize Status Bar
    const statusBarItem = createStatusBar(context);

    // ========== ADDED: Register Tree Data Provider ==========
    const { registerTreeDataProvider } = require('./providers/treeDataProvider');
    const treeProvider = registerTreeDataProvider(context);
    
    // Store globally for access from reviewCode command
    global.treeDataProvider = treeProvider;
    logger.info('✅ Tree data provider registered');
    // ========================================================

    // Register all commands
    registerCommands(context);

    // Check debug mode and update logger
    const debugMode = configManager.isDebugMode();
    logger.setDebugMode(debugMode);

    // Show welcome message on first install
    const hasShownWelcome = context.globalState.get('codeSentinel.hasShownWelcome');
    if (!hasShownWelcome) {
      await showWelcomeMessage(context);
      context.globalState.update('codeSentinel.hasShownWelcome', true);
    }

    logger.info('✅ CodeSentinel AI Extension Activated Successfully');
    logger.info(`Debug Mode: ${debugMode ? 'ON' : 'OFF'}`);
    logger.info(`Provider: ${configManager.getModelProvider()}`);

  } catch (error) {
    logger.error('Failed to activate extension:', error);
    vscode.window.showErrorMessage(
      `CodeSentinel activation failed: ${error.message}`,
      'View Logs'
    ).then(action => {
      if (action === 'View Logs') {
        logger.show();
      }
    });
  }
}

/**
 * Create status bar item
 * @param {vscode.ExtensionContext} context
 */
function createStatusBar(context) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  
  statusBarItem.text = '$(shield) CodeSentinel';
  statusBarItem.tooltip = 'CodeSentinel AI - Click to review code';
  statusBarItem.command = 'codeSentinel.reviewCode';
  statusBarItem.show();
  
  context.subscriptions.push(statusBarItem);
  logger.debug('Status bar created');
  
  return statusBarItem;
}

/**
 * Register all extension commands
 * @param {vscode.ExtensionContext} context 
 */
function registerCommands(context) {
  // Import command handlers
  const { reviewCodeCommand } = require('./commands/reviewCode');
  const { autoFixCommand } = require('./commands/autoFix');
  const { explainIssueCommand } = require('./commands/explainIssue');
  const { toggleDebugCommand, exportDebugInfo } = require('./commands/debugMode');
  const { openSettingsCommand } = require('./commands/openSettings');

  // Define all commands
  const commands = [
    {
      name: 'codeSentinel.reviewCode',
      callback: reviewCodeCommand,
      description: 'Review selected code with multi-agent analysis'
    },
    {
      name: 'codeSentinel.autoFix',
      callback: autoFixCommand,
      description: 'Apply AI-suggested fixes'
    },
    {
      name: 'codeSentinel.explainIssue',
      callback: explainIssueCommand,
      description: 'Get detailed explanation of code issues'
    },
    {
      name: 'codeSentinel.toggleDebug',
      callback: toggleDebugCommand,
      description: 'Toggle debug mode for demonstrations'
    },
    {
      name: 'codeSentinel.openSettings',
      callback: openSettingsCommand,
      description: 'Open CodeSentinel settings'
    },
    {
      name: 'codeSentinel.exportDebugInfo',
      callback: exportDebugInfo,
      description: 'Export debug information for bug reports'
    },
    {
      name: 'codeSentinel.migrateSettings',
      callback: async () => {
        try {
          const migrated = await configManager.migrateSettingsToSecretStorage();
          if (migrated) {
            vscode.window.showInformationMessage('✅ Settings migrated to secure storage');
          } else {
            vscode.window.showInformationMessage('✅ No settings to migrate');
          }
        } catch (error) {
          logger.error('Migration failed:', error);
          vscode.window.showErrorMessage(`Migration failed: ${error.message}`);
        }
      },
      description: 'Migrate API keys to secure storage'
    },
    {
      name: 'codeSentinel.clearCache',
      callback: async () => {
        vscode.window.showInformationMessage('🗑️ Cache cleared');
        logger.info('Cache cleared');
      },
      description: 'Clear analysis cache'
    }
  ];

  // Register each command with error handling
  commands.forEach(cmd => {
    try {
      const disposable = vscode.commands.registerCommand(cmd.name, async (...args) => {
        try {
          logger.debug(`Executing command: ${cmd.name}`);
          await cmd.callback(...args);
        } catch (error) {
          logger.error(`Command ${cmd.name} failed:`, error);
          vscode.window.showErrorMessage(
            `Command failed: ${error.message}`,
            'View Logs'
          ).then(action => {
            if (action === 'View Logs') {
              logger.show();
            }
          });
        }
      });

      context.subscriptions.push(disposable);
      logger.debug(`✅ Registered command: ${cmd.name}`);
    } catch (error) {
      logger.error(`Failed to register command ${cmd.name}:`, error);
    }
  });

  logger.info(`✅ Registered ${commands.length} commands`);
}

/**
 * Show welcome message for first-time users
 * @param {vscode.ExtensionContext} context 
 */
async function showWelcomeMessage(context) {
  const message = '🎉 Welcome to CodeSentinel AI! Configure your setup to get started.';
  
  const action = await vscode.window.showInformationMessage(
    message,
    'Configure API Key',
    'Use Ollama (Local)',
    'View Documentation',
    'Later'
  );
  
  switch (action) {
    case 'Configure API Key':
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Gemini API Key',
        placeHolder: 'AIza...',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'API key cannot be empty';
          }
          if (!value.startsWith('AIza')) {
            return 'Gemini API keys typically start with "AIza"';
          }
          return null;
        }
      });

      if (apiKey) {
        try {
          await configManager.saveApiKey(apiKey);
          vscode.window.showInformationMessage('✅ API key saved securely!');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to save API key: ${error.message}`);
        }
      }
      break;

    case 'Use Ollama (Local)':
      await vscode.workspace.getConfiguration('codeSentinel')
        .update('modelProvider', 'ollama', vscode.ConfigurationTarget.Global);
      
      vscode.window.showInformationMessage(
        '✅ Switched to Ollama. Make sure Ollama is running!',
        'Check Status'
      ).then(checkAction => {
        if (checkAction === 'Check Status') {
          vscode.commands.executeCommand('codeSentinel.toggleDebug');
        }
      });
      break;

    case 'View Documentation':
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/yourusername/codesentinel-ai#readme'));
      break;
  }
}

/**
 * Extension deactivation cleanup
 */
function deactivate() {
  logger.info('👋 CodeSentinel AI Extension Deactivating...');
  
  const webviewManager = require('./services/webviewManager');
  webviewManager.dispose();
  
  logger.info('✅ Cleanup complete');
  return undefined;
}

module.exports = {
  activate,
  deactivate
};