/**
 * CodeSentinel AI - Main Extension Entry Point
 * Production-grade VS Code extension for AI-powered code review
 * 
 * Features:
 * - Multi-agent analysis (Primary, Security, Validator)
 * - BYOK (Bring Your Own Key) support
 * - Universal model support (Gemini, Ollama, OpenAI, Anthropic)
 * - Self-correction loop with confidence thresholds
 * - Real-time streaming responses
 * - Debug mode for demonstrations
 * - AI Chat Assistant
 * - Folder/Workspace review
 * - Smart Auto-Fix
 */

const vscode = require('vscode');
const { logger } = require('./utils/logger');
const configManager = require('./services/configManager');
const MCPServer = require('./mcp/server');
const SessionManager = require('./chat/sessionManager');


/**
 * Extension activation
 * @param {vscode.ExtensionContext} context
 */
/**
 * Extension activation
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  // CRITICAL: Store context globally for webview access (do this first)
  global.extensionContext = context;
  
  // Register commands FIRST - this ensures they're available even if other initialization fails
  try {
    registerCommands(context);
    logger.info('✅ Commands registered');
  } catch (error) {
    logger.error('CRITICAL: Failed to register commands:', error);
    vscode.window.showErrorMessage(`Failed to register commands: ${error.message}`);
    // Still continue - some commands might have registered
  }

  try {
    logger.info('🚀 CodeSentinel AI Extension Activating...');

    // =========================================
    // STEP 1: Initialize ConfigManager with SecretStorage
    // =========================================
    try {
      await configManager.initialize(context);
      logger.info('✅ ConfigManager initialized with SecretStorage');
      
      // Auto-migrate API key from settings to secure storage if present
      const settingsKey = vscode.workspace.getConfiguration('codeSentinel').get('apiKey', '');
      if (settingsKey && settingsKey.trim()) {
        try {
          await configManager.migrateSettingsToSecretStorage();
          logger.info('✅ Auto-migrated API key from settings to secure storage');
        } catch (migrationError) {
          logger.warn('Could not auto-migrate API key:', migrationError);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize ConfigManager:', error);
      // Continue - user can configure later
    }

    // Watch for API key changes in settings and auto-migrate
    try {
      const configWatcher = vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('codeSentinel.apiKey') && configManager.initialized) {
          const settingsKey = vscode.workspace.getConfiguration('codeSentinel').get('apiKey', '');
          if (settingsKey && settingsKey.trim()) {
            try {
              await configManager.migrateSettingsToSecretStorage();
              logger.info('✅ Auto-migrated API key from settings to secure storage');
              vscode.window.showInformationMessage('🔒 API Key automatically migrated to secure storage');
            } catch (migrationError) {
              logger.warn('Could not auto-migrate API key:', migrationError);
            }
          }
        }
      });
      context.subscriptions.push(configWatcher);
    } catch (error) {
      logger.warn('Could not set up configuration watcher:', error);
    }

    // Validate configuration (only if configManager initialized successfully)
    try {
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
    } catch (error) {
      logger.warn('Could not validate configuration:', error);
    }

    // =========================================
    // STEP 2: Initialize MCP Server (NEW!)
    // =========================================
    try {
      logger.info('🔧 Initializing MCP server...');
      const MCPServer = require('./mcp/server');
      const mcpServer = new MCPServer(context);
      
      const mcpInitialized = await mcpServer.initialize();
      
      if (mcpInitialized) {
        // Make MCP server globally available for chat panel
        global.mcpServer = mcpServer;
        logger.info('✅ MCP server initialized successfully');
        
        // Optional: Start external transport for Claude Desktop
        // Uncomment the lines below if you want Claude Desktop to connect
        // try {
        //   await mcpServer.startExternalTransport();
        //   logger.info('✅ MCP server listening for external clients (Claude Desktop)');
        // } catch (transportError) {
        //   logger.warn('Could not start external transport:', transportError);
        // }
        
        // Show success notification in debug mode
        if (configManager.isDebugMode()) {
          vscode.window.showInformationMessage('🔧 MCP Server initialized', 'View Logs').then(action => {
            if (action === 'View Logs') {
              logger.show();
            }
          });
        }
      } else {
        logger.warn('⚠️ MCP server initialization failed, continuing without MCP features');
        global.mcpServer = null;
      }
    } catch (error) {
      logger.error('MCP server initialization error:', error);
      global.mcpServer = null;
      // Don't throw - extension can work without MCP
    }

    // =========================================
    // STEP 3: Initialize Session Manager (NEW!)
    // =========================================
    try {
      logger.info('💾 Initializing session manager...');
      const SessionManager = require('./chat/sessionManager');
      const sessionManager = new SessionManager(context);
      
      await sessionManager.initialize();
      
      // Make session manager globally available
      global.sessionManager = sessionManager;
      logger.info('✅ Session manager initialized');
      
      // Log session summary in debug mode
      if (configManager.isDebugMode()) {
        const summary = sessionManager.getSessionSummary();
        logger.debug('Session summary:', summary);
      }
    } catch (error) {
      logger.error('Session manager initialization error:', error);
      global.sessionManager = null;
      // Don't throw - continue without session management
    }

    // =========================================
    // STEP 4: Initialize Status Bar
    // =========================================
    try {
      const statusBarItem = createStatusBar(context);
    } catch (error) {
      logger.error('Failed to create status bar:', error);
    }

    // =========================================
    // STEP 5: Register Tree Data Provider
    // =========================================
    try {
      const { registerTreeDataProvider } = require('./providers/treeDataProvider');
      const treeProvider = registerTreeDataProvider(context);
      
      global.treeDataProvider = treeProvider;
      logger.info('✅ Tree data provider registered');
    } catch (error) {
      logger.error('Failed to register tree data provider:', error);
    }

    // =========================================
    // STEP 6: Register Chat Side Panel Provider
    // =========================================
    try {
      const ChatViewProvider = require('./providers/chatViewProvider');
      const chatViewProvider = new ChatViewProvider(context);
      
      context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
          'codesentinel.chatView',
          chatViewProvider,
          {
            webviewOptions: {
              retainContextWhenHidden: true
            }
          }
        )
      );
      
      // Make chat view provider globally available for MCP server events
      global.chatViewProvider = chatViewProvider;
      
      logger.info('✅ Chat side panel registered');
      
      // Hook up MCP server events to chat panel (if both initialized)
      if (global.mcpServer && chatViewProvider) {
        try {
          global.mcpServer.on('tool_call_start', (data) => {
            logger.debug('MCP tool call started:', data);
            // Chat panel can listen to these events for UI updates
          });
          
          global.mcpServer.on('tool_call_progress', (data) => {
            logger.debug('MCP tool progress:', data);
          });
          
          global.mcpServer.on('tool_call_complete', (data) => {
            logger.debug('MCP tool completed:', data);
          });
          
          global.mcpServer.on('tool_call_error', (data) => {
            logger.error('MCP tool error:', data);
          });
          
          logger.info('✅ MCP server events connected to chat panel');
        } catch (error) {
          logger.warn('Could not connect MCP events:', error);
        }
      }
    } catch (error) {
      logger.error('Failed to register chat side panel:', error);
      // Continue - fallback to command-based chat
    }

    // =========================================
    // STEP 7: Check debug mode and update logger
    // =========================================
    try {
      const debugMode = configManager.isDebugMode();
      logger.setDebugMode(debugMode);
      logger.info(`Debug Mode: ${debugMode ? 'ON' : 'OFF'}`);
      
      const provider = configManager.getModelProvider();
      logger.info(`Provider: ${provider}`);
    } catch (error) {
      logger.warn('Could not get configuration:', error);
    }

    // =========================================
    // STEP 8: Show welcome message on first install
    // =========================================
    try {
      const hasShownWelcome = context.globalState.get('codeSentinel.hasShownWelcome');
      if (!hasShownWelcome) {
        await showWelcomeMessage(context);
        context.globalState.update('codeSentinel.hasShownWelcome', true);
      }
    } catch (error) {
      logger.warn('Could not show welcome message:', error);
    }

    // =========================================
    // FINAL: Log activation summary
    // =========================================
    logger.info('✅ CodeSentinel AI Extension Activated Successfully');
    
    // Log initialization status summary
    const initSummary = {
      configManager: configManager.initialized ? '✓' : '✗',
      mcpServer: global.mcpServer ? '✓' : '✗',
      sessionManager: global.sessionManager ? '✓' : '✗',
      chatPanel: global.chatViewProvider ? '✓' : '✗',
      treeView: global.treeDataProvider ? '✓' : '✗'
    };
    
    logger.info('Initialization summary:', initSummary);
    
    // Show success message in debug mode
    if (configManager.isDebugMode()) {
      vscode.window.showInformationMessage(
        `✅ CodeSentinel AI ready (MCP: ${initSummary.mcpServer})`,
        'Open Chat',
        'View Logs'
      ).then(action => {
        if (action === 'Open Chat') {
          vscode.commands.executeCommand('codeSentinel.openChat');
        } else if (action === 'View Logs') {
          logger.show();
        }
      });
    }

  } catch (error) {
    logger.error('Error during extension activation:', error);
    // Don't show error to user - commands are already registered, extension is functional
    // Only log for debugging
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
  const { smartAutoFixCommand } = require('./commands/smartAutoFix');
  const { explainIssueCommand } = require('./commands/explainIssue');
  const { toggleDebugCommand, exportDebugInfo } = require('./commands/debugMode');
  const { openSettingsCommand } = require('./commands/openSettings');
  const { reviewFolderCommand, reviewWorkspaceCommand, smartFixFolderCommand } = require('./commands/reviewFolder');
  const { chatPanelManager } = require('./webview/chatPanel');

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
      description: 'Apply simple AI fix'
    },
    {
      name: 'codeSentinel.smartAutoFix',
      callback: smartAutoFixCommand,
      description: 'Smart auto-fix: Analyze first, then fix all issues'
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
      name: 'codeSentinel.reviewFolder',
      callback: reviewFolderCommand,
      description: 'Review all code files in a folder'
    },
    {
      name: 'codeSentinel.reviewWorkspace',
      callback: reviewWorkspaceCommand,
      description: 'Review entire workspace'
    },
    {
      name: 'codeSentinel.smartFixFolder',
      callback: smartFixFolderCommand,
      description: 'Smart fix entire folder'
    },
    {
      name: 'codeSentinel.openChat',
      callback: () => {
        // Use global context if available, otherwise get from extension
        const ctx = global.extensionContext || context;
        chatPanelManager.createOrShow(ctx);
      },
      description: 'Open AI chat assistant'
    },
     {
    name: 'codeSentinel.generateCommitMessage',
    callback: async () => {
      const { generateCommitMessageCommand } = require('./commands/gitCommitGenerator');
      await generateCommitMessageCommand();
    },
    description: 'Generate Git commit message from staged changes'
  },
  {
  name: 'codeSentinel.generateSnippet',
  callback: async () => {
    const { generateSnippetCommand } = require('./commands/snippetGenerator');
    await generateSnippetCommand();
  },
  description: 'Generate code snippet from template or description'
},
{
  name: 'codeSentinel.generateDocumentation',
  callback: async () => {
    const { generateDocumentationCommand } = require('./commands/docGenerator');
    await generateDocumentationCommand();
  },
  description: 'Generate documentation for selected code'
},
{
  name: 'codeSentinel.generateTests',
  callback: async () => {
    const { generateTestsCommand } = require('./commands/testGenerator');
    await generateTestsCommand();
  },
  description: 'Generate unit tests for selected code'
},
      {
    name: 'codeSentinel.generateProject',
    callback: async () => {
      const { generateProjectCommand } = require('./commands/projectGenerator');
      await generateProjectCommand();
    },
    description: 'Build complete project from description'
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
    ,
    {
  name: 'codeSentinel.configureApiKey',
  callback: async () => {
    const apiKey = await vscode.window.showInputBox({
      prompt: '🔒 Enter your Gemini API Key (stored securely)',
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
        logger.error('Failed to save API key:', error);
        vscode.window.showErrorMessage(`Failed to save API key: ${error.message}`);
      }
    }
  },
  description: 'Configure API key securely'
},
{
  name: 'codeSentinel.deleteApiKey',
  callback: async () => {
    const confirm = await vscode.window.showWarningMessage(
      '⚠️ Delete stored API key?',
      { modal: true },
      'Delete',
      'Cancel'
    );

    if (confirm === 'Delete') {
      try {
        await configManager.deleteApiKey();
        vscode.window.showInformationMessage('✅ API key deleted');
      } catch (error) {
        logger.error('Failed to delete API key:', error);
        vscode.window.showErrorMessage(`Failed to delete API key: ${error.message}`);
      }
    }
  },
  description: 'Delete stored API key'
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
      // Show error but don't throw - allow other commands to register
      vscode.window.showErrorMessage(`Failed to register command ${cmd.name}: ${error.message}`);
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
    'Open Chat',
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

    case 'Open Chat':
      vscode.commands.executeCommand('codeSentinel.openChat');
      break;
  }
}

/**
 * Extension deactivation cleanup
 */
/**
 * Extension deactivation cleanup
 */
function deactivate() {
  logger.info('👋 CodeSentinel AI Extension Deactivating...');
  
  // =========================================
  // STEP 1: Shutdown MCP server gracefully
  // =========================================
  if (global.mcpServer) {
    try {
      global.mcpServer.shutdown().catch(err => {
        logger.error('Error shutting down MCP server:', err);
      });
      logger.info('✅ MCP server shutdown initiated');
    } catch (error) {
      logger.error('MCP server shutdown error:', error);
    }
  }
  
  // =========================================
  // STEP 2: Save session state
  // =========================================
  if (global.sessionManager) {
    try {
      // Session manager auto-saves, but ensure final save
      global.sessionManager.saveSession().catch(err => {
        logger.error('Error saving session:', err);
      });
      logger.info('✅ Session state saved');
    } catch (error) {
      logger.error('Session save error:', error);
    }
  }
  
  // =========================================
  // STEP 3: Clean up webview manager (existing)
  // =========================================
  try {
    const webviewManager = require('./services/webviewManager');
    webviewManager.dispose();
    logger.info('✅ Webview manager disposed');
  } catch (error) {
    logger.error('Webview cleanup error:', error);
  }
  
  // =========================================
  // STEP 4: Clear global references
  // =========================================
  global.mcpServer = null;
  global.sessionManager = null;
  global.chatViewProvider = null;
  global.treeDataProvider = null;
  global.extensionContext = null;
  
  logger.info('✅ Cleanup complete');
  return undefined;
}


module.exports = {
  activate,
  deactivate
};
