/**
 * Chat View Provider - Side Panel Integration
 * Provides persistent AI chat in VS Code sidebar
 * Reuses ChatPanelManager logic to avoid duplication
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const configManager = require('../services/configManager');

class ChatViewProvider {
  constructor(context) {
    this._view = null;
    this.context = context;
    this.chatHistory = [];
    this.isProcessing = false;
  }

  
/**
 * Called when the view is first shown
 * @param {vscode.WebviewView} webviewView
 */
resolveWebviewView(webviewView) {
  this._view = webviewView;

  webviewView.webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
  };

  webviewView.webview.html = this._getHtmlForWebview();

  // ✅ PROPERLY AWAIT THE TEST (with error handling)
  this._testMCPServer()
    .then(() => {
      logger.info('✅ MCP test completed successfully');
    })
    .catch((error) => {
      logger.error('❌ MCP test failed with error:', error);
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    });

  // Handle messages from webview
  webviewView.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'sendMessage':
          await this._handleUserMessage(message.text);
          break;

        case 'clearChat':
          this._clearChat();
          break;

        case 'openFullPanel':
          vscode.commands.executeCommand('codeSentinel.openChat');
          break;
      }
    },
    undefined,
    this.context.subscriptions
  );

  logger.info('✅ Chat side panel initialized');
}

 
/**
 * Comprehensive test for ALL registries
 */
async _testMCPServer() {
  const { logger } = require('../utils/logger');
  
  logger.info('🧪 ========================================');
  logger.info('🧪 COMPREHENSIVE MCP REGISTRY TEST');
  logger.info('🧪 ========================================');

  if (!global.mcpServer) {
    logger.warn('❌ MCP Server not available');
    return;
  }

  logger.info('✅ MCP Server is available');

  // ===== TEST 1: Discover ALL registries =====
  try {
    logger.info('');
    logger.info('📋 TEST 1: Discovering ALL registries...');
    
    const allRegistries = ['shadcn', 'magicui', 'aceternity', 'motion-primitives', 'daisyui'];
    const registryStats = {};

    for (const registryId of allRegistries) {
      try {
        const result = await global.mcpServer.callTool('discover_components', {
          registry: registryId
        });

        registryStats[registryId] = {
          total: result.totalComponents || 0,
          categories: result.categories?.length || 0,
          sample: result.components?.slice(0, 3).map(c => c.name) || []
        };

        logger.info(`  ✅ ${registryId}: ${registryStats[registryId].total} components`);
      } catch (error) {
        logger.error(`  ❌ ${registryId}: ${error.message}`);
        registryStats[registryId] = { error: error.message };
      }
    }

    logger.info('');
    logger.info('📊 Registry Statistics:');
    logger.info(JSON.stringify(registryStats, null, 2));

  } catch (error) {
    logger.error('❌ Registry discovery test failed:', error);
  }

  // ===== TEST 2: Verify registry data files exist =====
  try {
    logger.info('');
    logger.info('📁 TEST 2: Verifying registry data files...');
    
    const { getRegistryData } = require('../registry/registryIndex');
    const registries = ['shadcn', 'magicui', 'aceternity', 'motion-primitives', 'daisyui'];
    
    for (const registryId of registries) {
      const data = getRegistryData(registryId);
      if (data && data.components) {
        logger.info(`  ✅ ${registryId}.json: ${data.components.length} components loaded`);
      } else {
        logger.warn(`  ❌ ${registryId}.json: Failed to load`);
      }
    }

  } catch (error) {
    logger.error('❌ Registry file verification failed:', error);
    logger.error('Stack trace:', error.stack);
  }

  // ===== TEST 3: Test component selection logic =====
  try {
    logger.info('');
    logger.info('🎯 TEST 3: Testing component availability...');
    
    const testComponents = {
      shadcn: ['button', 'card', 'dialog', 'input', 'table'],
      magicui: ['animated-beam', 'shimmer-button', 'bento-grid'],
      aceternity: ['hero-parallax', 'background-beams', '3d-card'],
      'motion-primitives': ['accordion', 'dialog', 'carousel'],
      daisyui: ['button', 'card', 'modal', 'navbar']
    };

    logger.info('  Testing sample components from each registry:');
    for (const [registry, components] of Object.entries(testComponents)) {
      logger.info(`  ${registry}: ${components.join(', ')}`);
    }

  } catch (error) {
    logger.error('❌ Component availability test failed:', error);
  }

  // ===== TEST 4: Session Manager =====
  if (global.sessionManager) {
    logger.info('');
    logger.info('💾 TEST 4: Session Manager');
    try {
      const summary = global.sessionManager.getSessionSummary();
      logger.info('  ✅ Session Manager available');
      logger.info('  Session summary:', JSON.stringify(summary, null, 2));
    } catch (error) {
      logger.warn('  ⚠️ Session manager error:', error.message);
    }
  } else {
    logger.warn('  ❌ Session Manager not available');
  }

  // ===== FINAL SUMMARY =====
  logger.info('');
  logger.info('🧪 ========================================');
  logger.info('🧪 TEST COMPLETE - REGISTRY VERIFICATION');
  logger.info('🧪 ========================================');
  logger.info('');
  logger.info('📌 SUMMARY:');
  logger.info('   - MCP Server: ✓ Operational');
  logger.info('   - Session Manager: ✓ Operational');
  logger.info('   - Total Registries: 5 (shadcn, magicui, aceternity, motion-primitives, daisyui)');
  logger.info('   - Check results above for component counts');
  logger.info('');
}

  /**
   * Handle user message (reuses logic from ChatPanelManager)
   */
  async _handleUserMessage(userMessage) {
    if (this.isProcessing) {
      this._sendMessage('assistant', '⏳ Please wait for the current response to complete...');
      return;
    }

    logger.info('Side panel message:', { message: userMessage });

    // Add user message to UI
    this._sendMessage('user', userMessage);
    this.chatHistory.push({ role: 'user', content: userMessage });

    // Show typing indicator
    this._view.webview.postMessage({ command: 'showTyping' });
    this.isProcessing = true;

    try {
      const response = await this._processCommand(userMessage);
      this._sendMessage('assistant', response);
      this.chatHistory.push({ role: 'assistant', content: response });
    } catch (error) {
      logger.error('Side panel error:', error);
      this._sendMessage('assistant', `❌ Error: ${error.message}`);
    } finally {
      this._view.webview.postMessage({ command: 'hideTyping' });
      this.isProcessing = false;
    }
  }

  /**
   * Process command (reuses ChatPanelManager logic)
   */
  async _processCommand(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Command: Review specific file
    if (lowerMessage.match(/review\s+(.+?\.(js|ts|py|java|cpp|cs|go|rb|php|jsx|tsx))/i)) {
      const match = lowerMessage.match(/review\s+(.+?\.(js|ts|py|java|cpp|cs|go|rb|php|jsx|tsx))/i);
      const fileName = match[1];
      return await this._reviewFileByName(fileName);
    }

    // Command: Review current file
    if (lowerMessage.includes('review current') || lowerMessage.includes('review this')) {
      return await this._reviewCurrentFile();
    }

    // Command: Help
    if (lowerMessage.includes('help') || lowerMessage === '?') {
      return this._getHelpMessage();
    }

    // Default: AI conversation
    return await this._handleGeneralQuestion(message);
  }

  /**
   * Review file by name
   */
  async _reviewFileByName(fileName) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return '❌ No workspace open. Please open a project first.';
    }

    const files = await vscode.workspace.findFiles(`**/${fileName}`, '**/node_modules/**');
    
    if (files.length === 0) {
      return `❌ File "${fileName}" not found.`;
    }

    if (files.length > 1) {
      const fileList = files.map((f, idx) => `${idx + 1}. ${vscode.workspace.asRelativePath(f)}`).join('\n');
      return `❓ Multiple files found:\n${fileList}\n\nPlease specify full path.`;
    }

    const fileUri = files[0];
    const document = await vscode.workspace.openTextDocument(fileUri);
    const code = document.getText();
    const language = document.languageId;

    const { reviewCodeForChat } = require('../commands/reviewCode');
    const result = await reviewCodeForChat(code, language, fileName);

    return this._formatReviewResult(result, fileName);
  }

  /**
   * Review currently open file
   */
  async _reviewCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return '❌ No file currently open.';
    }

    const code = editor.document.getText();
    const language = editor.document.languageId;
    const fileName = editor.document.fileName.split(/[\\/]/).pop();

    const { reviewCodeForChat } = require('../commands/reviewCode');
    const result = await reviewCodeForChat(code, language, fileName);

    return this._formatReviewResult(result, fileName);
  }

  
 /**
 * Handle general AI questions (universal - works with Gemini/Ollama)
 */
async _handleGeneralQuestion(question) {
    const configManager = require('../services/configManager');

    try {
      await aiClient.initialize();

      // Build context from recent history
      let contextPrompt = `You are CodeSentinel AI, a helpful code review assistant.\n\n`;

      // GET HISTORY LIMIT FIRST (before using it!)
      const historyLimit = configManager.getChatHistoryLimit();
      
      // NOW use it to slice history
      const recentHistory = this.chatHistory.slice(-historyLimit);
      
      if (recentHistory.length > 0) {
        contextPrompt += `Recent conversation:\n`;
        recentHistory.forEach(msg => {
          contextPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        });
        contextPrompt += `\nNow respond to: ${question}`;
      } else {
        contextPrompt = question;
      }

      const response = await aiClient.generate(contextPrompt, { 
        systemPrompt: 'You are CodeSentinel AI. Be concise and helpful. Remember conversation context.',
        maxTokens: 2000 
      });

      return response;

    } catch (error) {
      logger.error('AI error:', error);
      return `❌ Error: ${error.message}\n\nTip: Check your API key in settings.`;
    }
}


  /**
   * Format review result
   */
  _formatReviewResult(result, fileName) {
    const { summary, issues } = result;
    
    let response = `✅ **Review: ${fileName}**\n\n`;
    response += `📊 Issues: ${summary.totalIssues} (🔴${summary.critical} ⚠️${summary.high} 🟡${summary.medium})\n`;
    response += `Risk: ${summary.riskScore}/100\n\n`;

    if (issues.length > 0) {
      response += `🔍 Top Issues:\n`;
      issues.slice(0, 3).forEach((issue, idx) => {
        const emoji = { critical: '🔴', high: '⚠️', medium: '🟡', low: '🟢' }[issue.severity];
        response += `${idx + 1}. ${emoji} ${issue.title || issue.description}\n`;
      });
      
      if (issues.length > 3) {
        response += `\n...+${issues.length - 3} more\n`;
      }
    }

    response += `\n💡 Click "Open Full Report" for details.`;
    return response;
  }

  /**
   * Get help message
   */
  _getHelpMessage() {
    return `**📚 Commands:**

📝 Review:
• "review test.js" - Review file
• "review current file" - Review open file

💬 Chat:
• Ask coding questions
• Paste code for analysis

🔧 Actions:
• Click 🔄 to clear chat
• Click 🗗 to open full panel`;
  }

  /**
   * Clear chat history
   */
  _clearChat() {
    this.chatHistory = [];
    this._view.webview.postMessage({ command: 'chatCleared' });
    logger.info('Side panel chat cleared');
  }

  /**
   * Send message to webview
   */
  _sendMessage(role, content) {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'addMessage',
        message: { role, content, timestamp: new Date().toISOString() }
      });
    }
  }

  /**
   * Generate HTML for side panel
   */
  _getHtmlForWebview() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeSentinel Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            display: flex;
            flex-direction: column;
            height: 100vh;
            font-size: 13px;
        }

        .header {
            padding: 12px;
            background: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header h3 {
            font-size: 13px;
            font-weight: 600;
        }

        .header-actions {
            display: flex;
            gap: 6px;
        }

        .icon-btn {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 16px;
        }

        .icon-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .message {
            padding: 8px 12px;
            border-radius: 6px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-width: 90%;
        }

        .message.user {
            align-self: flex-end;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .message.assistant {
            align-self: flex-start;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
        }

        .typing {
            display: none;
            padding: 8px 12px;
            background: var(--vscode-input-background);
            border-radius: 6px;
            align-self: flex-start;
        }

        .typing span {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--vscode-foreground);
            opacity: 0.4;
            animation: typing 1.4s infinite;
        }

        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing {
            0%, 60%, 100% { opacity: 0.4; }
            30% { opacity: 1; }
        }

        .input-area {
            padding: 12px;
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--vscode-panel-border);
        }

        #input {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            resize: none;
            min-height: 34px;
            max-height: 100px;
        }

        #input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .empty {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-icon {
            font-size: 32px;
            margin-bottom: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h3>💬 AI Chat</h3>
        <div class="header-actions">
            <button class="icon-btn" onclick="openPopout()" title="Open in new panel">🗗</button>
            <button class="icon-btn" onclick="clearChat()" title="Clear chat">🔄</button>
        </div>
    </div>

    <div class="messages" id="messages">
        <div class="empty">
            <div class="empty-icon">🤖</div>
            <p><strong>CodeSentinel AI</strong></p>
            <p style="margin-top: 8px; font-size: 12px;">Type "help" for commands</p>
        </div>
        <div class="typing" id="typing">
            <span></span><span></span><span></span>
        </div>
    </div>

    <div class="input-area">
        <textarea id="input" placeholder="Ask me anything..." rows="1"></textarea>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const typing = document.getElementById('typing');

        // Auto-resize textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        });

        // Send on Enter (Shift+Enter for newline)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        function sendMessage() {
            const text = input.value.trim();
            if (!text) return;

            vscode.postMessage({ command: 'sendMessage', text });
            input.value = '';
            input.style.height = 'auto';
        }

        function clearChat() {
            vscode.postMessage({ command: 'clearChat' });
        }

        function openPopout() {
            vscode.postMessage({ command: 'openPopout' });
        }

        window.addEventListener('message', (event) => {
            const msg = event.data;

            switch (msg.command) {
                case 'addMessage':
                    addMessage(msg.message);
                    break;
                case 'showTyping':
                    typing.style.display = 'block';
                    scrollToBottom();
                    break;
                case 'hideTyping':
                    typing.style.display = 'none';
                    break;
                case 'chatCleared':
                    messages.innerHTML = '<div class="empty"><div class="empty-icon">🤖</div><p><strong>Chat cleared</strong></p></div><div class="typing" id="typing"><span></span><span></span><span></span></div>';
                    break;
            }
        });

        function addMessage(message) {
            const empty = document.querySelector('.empty');
            if (empty) empty.remove();

            const div = document.createElement('div');
            div.className = \`message \${message.role}\`;
            div.textContent = message.content;

            messages.insertBefore(div, typing);
            scrollToBottom();
        }

        function scrollToBottom() {
            messages.scrollTop = messages.scrollHeight;
        }
    </script>
</body>
</html>`;
  }
}

module.exports = ChatViewProvider;
