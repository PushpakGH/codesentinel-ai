/**
 * Chat Panel - Interactive AI Assistant
 * Supports natural language commands for code review
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const path = require('path');

class ChatPanelManager {
  constructor() {
    this.panel = null;
    this.chatHistory = [];
  }

  /**
   * Create or show chat panel
   */
  createOrShow(context) {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'codesentinelChat',
      '💬 CodeSentinel Chat',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    this.panel.webview.html = this.getHtmlContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'sendMessage':
            await this.handleUserMessage(message.text);
            break;
          case 'clearChat':
            this.chatHistory = [];
            this.panel.webview.postMessage({ command: 'chatCleared' });
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    this.panel.onDidDispose(() => {
      this.panel = null;
    });

    logger.info('Chat panel created');
  }

  /**
   * Handle user message and execute commands
   */
  async handleUserMessage(userMessage) {
    logger.info('Chat message received:', { message: userMessage });

    // Add user message to history
    this.addMessage('user', userMessage);

    // Show typing indicator
    this.panel.webview.postMessage({ command: 'showTyping' });

    try {
      // Parse intent and execute
      const response = await this.processCommand(userMessage);
      
      // Add AI response to history
      this.addMessage('assistant', response);

    } catch (error) {
      logger.error('Chat command failed:', error);
      this.addMessage('assistant', `❌ Error: ${error.message}`);
    }

    // Hide typing indicator
    this.panel.webview.postMessage({ command: 'hideTyping' });
  }

  /**
   * Process natural language command
   */
  async processCommand(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Command: Review specific file
    if (lowerMessage.match(/review\s+(.+?\.(js|ts|py|java|cpp|cs|go|rb|php|jsx|tsx))/i)) {
      const match = lowerMessage.match(/review\s+(.+?\.(js|ts|py|java|cpp|cs|go|rb|php|jsx|tsx))/i);
      const fileName = match[1];
      return await this.reviewFileByName(fileName);
    }

    // Command: Review folder
    if (lowerMessage.match(/review\s+(folder|directory)\s+(.+)/i)) {
      const match = lowerMessage.match(/review\s+(?:folder|directory)\s+(.+)/i);
      const folderPath = match[1];
      return await this.reviewFolder(folderPath);
    }

    // Command: Review current file
    if (lowerMessage.includes('review current file') || lowerMessage.includes('review this file')) {
      return await this.reviewCurrentFile();
    }

    // Command: Review all files in workspace
    if (lowerMessage.includes('review all') || lowerMessage.includes('review workspace')) {
      return await this.reviewWorkspace();
    }

    // Command: Explain code
    if (lowerMessage.includes('explain')) {
      return `To explain code:\n1. Select the code in the editor\n2. Right-click → CodeSentinel: Explain Issue\n3. Choose what you want to know\n\nOr paste code here and I'll explain it!`;
    }

    // Command: Fix code
    if (lowerMessage.includes('fix')) {
      return `To fix code:\n1. Select problematic code\n2. Right-click → CodeSentinel: Apply Smart Fix\n\nI'll analyze and fix all issues automatically!`;
    }

    // Command: Help
    if (lowerMessage.includes('help') || lowerMessage === '?') {
      return this.getHelpMessage();
    }

    // Default: Treat as general question
    return await this.handleGeneralQuestion(message);
  }

  /**
   * Review file by name (searches workspace)
   */
  async reviewFileByName(fileName) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return '❌ No workspace folder open. Please open a project first.';
    }

    // Find file
    const files = await vscode.workspace.findFiles(`**/${fileName}`, '**/node_modules/**');
    
    if (files.length === 0) {
      return `❌ File "${fileName}" not found in workspace.`;
    }

    if (files.length > 1) {
      const fileList = files.map((f, idx) => `${idx + 1}. ${vscode.workspace.asRelativePath(f)}`).join('\n');
      return `❓ Multiple files found:\n${fileList}\n\nPlease specify the full path.`;
    }

    // Review the file
    const fileUri = files[0];
    const document = await vscode.workspace.openTextDocument(fileUri);
    const code = document.getText();
    const language = document.languageId;

    // Trigger review
    const { reviewCodeForChat } = require('../commands/reviewCode');
    const result = await reviewCodeForChat(code, language, fileName);

    return this.formatReviewResult(result, fileName);
  }

  /**
   * Review folder recursively
   */
  async reviewFolder(folderPath) {
    try {
      const { reviewFolderCommand } = require('../commands/reviewFolder');
      const result = await reviewFolderCommand(folderPath, true); // fromChat = true
      
      return `✅ Reviewed folder: ${folderPath}\n\n${this.formatFolderSummary(result.summary)}\n\nOpen the full report for details.`;
    } catch (error) {
      return `❌ Failed to review folder: ${error.message}`;
    }
  }

  /**
   * Review currently open file
   */
  async reviewCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return '❌ No file currently open in the editor.';
    }

    const code = editor.document.getText();
    const language = editor.document.languageId;
    const fileName = path.basename(editor.document.fileName);

    const { reviewCodeForChat } = require('../commands/reviewCode');
    const result = await reviewCodeForChat(code, language, fileName);

    return this.formatReviewResult(result, fileName);
  }

  /**
   * Review entire workspace
   */
  async reviewWorkspace() {
    const { reviewWorkspaceCommand } = require('../commands/reviewFolder');
    const result = await reviewWorkspaceCommand(true); // fromChat = true
    
    return `✅ Workspace review complete!\n\n${this.formatFolderSummary(result.summary)}\n\nCheck the Review Panel for full details.`;
  }

  /**
   * Handle general questions with AI
   */
  async handleGeneralQuestion(question) {
    const aiClient = require('../services/aiClient');
    await aiClient.initialize();

    const systemPrompt = `You are CodeSentinel AI, a helpful code review assistant. Answer questions about code quality, security, and best practices. Be concise and helpful.`;
    
    const response = await aiClient.generate(question, { systemPrompt, maxTokens: 500 });
    return response;
  }

  /**
   * Format review result for chat display
   */
  formatReviewResult(result, fileName) {
    const { summary, issues } = result;
    
    let response = `✅ **Review Complete: ${fileName}**\n\n`;
    response += `📊 **Summary:**\n`;
    response += `- Total Issues: ${summary.totalIssues}\n`;
    response += `- Critical: ${summary.critical}\n`;
    response += `- High: ${summary.high}\n`;
    response += `- Medium: ${summary.medium}\n`;
    response += `- Low: ${summary.low}\n`;
    response += `- Risk Score: ${summary.riskScore}/100\n\n`;

    if (issues.length > 0) {
      response += `🔍 **Top Issues:**\n`;
      issues.slice(0, 3).forEach((issue, idx) => {
        response += `${idx + 1}. **[${issue.severity.toUpperCase()}]** ${issue.title || issue.description}\n`;
      });
      
      if (issues.length > 3) {
        response += `\n...and ${issues.length - 3} more issue(s)\n`;
      }
    }

    response += `\n📄 Full report opened in webview panel.`;
    return response;
  }

  /**
   * Format folder summary
   */
  formatFolderSummary(summary) {
    return `📊 **Summary:**
- Files Analyzed: ${summary.totalFiles}
- Total Issues: ${summary.totalIssues}
- Total LOC: ${summary.totalLOC.toLocaleString()}
- Critical: ${summary.critical}
- High: ${summary.high}
- Medium: ${summary.medium}
- Low: ${summary.low}`;
  }

  /**
   * Get help message
   */
  getHelpMessage() {
    return `**CodeSentinel Chat Commands:**

📝 **File Review:**
- "review test.js" - Review specific file
- "review current file" - Review open file
- "review all" - Review entire workspace

📁 **Folder Review:**
- "review folder src" - Review folder
- "review directory tests" - Review directory

🔧 **Actions:**
- "explain [code]" - Explain code
- "fix [issue]" - Get fix suggestions
- "help" - Show this message

💡 **Tips:**
- You can paste code directly for analysis
- Ask general coding questions
- All reviews appear in the side panel`;
  }

  /**
   * Add message to chat
   */
  addMessage(role, content) {
    const message = { role, content, timestamp: new Date().toISOString() };
    this.chatHistory.push(message);

    this.panel.webview.postMessage({
      command: 'addMessage',
      message
    });
  }

  /**
   * Generate HTML for chat panel
   */
  getHtmlContent() {
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
        }

        .chat-header {
            padding: 15px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .chat-header h2 {
            font-size: 18px;
            color: var(--vscode-textLink-foreground);
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .message {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 8px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .message.user {
            align-self: flex-end;
            background: var(--vscode-textLink-foreground);
            color: white;
        }

        .message.assistant {
            align-self: flex-start;
            background: var(--vscode-editor-inactiveSelectionBackground);
        }

        .typing-indicator {
            display: none;
            align-self: flex-start;
            padding: 12px 16px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
        }

        .typing-indicator span {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-foreground);
            opacity: 0.4;
            animation: typing 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typing {
            0%, 60%, 100% { opacity: 0.4; }
            30% { opacity: 1; }
        }

        .chat-input-container {
            padding: 15px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
        }

        #chatInput {
            flex: 1;
            padding: 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: 14px;
        }

        #chatInput:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .empty-state {
            text-align: center;
            padding: 50px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="chat-header">
        <h2>💬 CodeSentinel AI Assistant</h2>
        <p style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Type "help" for available commands</p>
    </div>

    <div class="chat-messages" id="chatMessages">
        <div class="empty-state">
            <div class="empty-state-icon">🤖</div>
            <h3>Welcome to CodeSentinel Chat!</h3>
            <p>Ask me to review files, explain code, or get help.</p>
            <p style="margin-top: 10px; font-size: 12px;">Try: "review test.js" or "help"</p>
        </div>
        <div class="typing-indicator" id="typingIndicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    </div>

    <div class="chat-input-container">
        <input type="text" id="chatInput" placeholder="Type a command or question..." />
        <button onclick="sendMessage()">Send</button>
        <button onclick="clearChat()" style="background: var(--vscode-button-secondaryBackground);">Clear</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const typingIndicator = document.getElementById('typingIndicator');

        // Handle Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        function sendMessage() {
            const text = chatInput.value.trim();
            if (!text) return;

            vscode.postMessage({
                command: 'sendMessage',
                text: text
            });

            chatInput.value = '';
        }

        function clearChat() {
            vscode.postMessage({ command: 'clearChat' });
            const emptyState = document.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            chatMessages.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤖</div><h3>Chat cleared!</h3></div><div class="typing-indicator" id="typingIndicator"><span></span><span></span><span></span></div>';
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'addMessage':
                    addMessageToUI(message.message);
                    break;
                case 'showTyping':
                    typingIndicator.style.display = 'block';
                    scrollToBottom();
                    break;
                case 'hideTyping':
                    typingIndicator.style.display = 'none';
                    break;
                case 'chatCleared':
                    // Already handled
                    break;
            }
        });

        function addMessageToUI(message) {
            // Remove empty state if exists
            const emptyState = document.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${message.role}\`;
            messageDiv.textContent = message.content;

            chatMessages.insertBefore(messageDiv, typingIndicator);
            scrollToBottom();
        }

        function scrollToBottom() {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    </script>
</body>
</html>`;
  }
}

// Export singleton
const chatPanelManager = new ChatPanelManager();
module.exports = { chatPanelManager };
