/**
 * Completion Provider - AI-Powered Auto-complete
 * Suggests code completions based on context
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const configManager = require('../services/configManager');

class CodeSentinelCompletionProvider {
  constructor() {
    this.isEnabled = true;
  }

  /**
   * Provide completion items
   * @param {vscode.TextDocument} document 
   * @param {vscode.Position} position 
   * @param {vscode.CancellationToken} token 
   * @returns {Promise<vscode.CompletionItem[]>}
   */
  async provideCompletionItems(document, position, token) {
    if (!this.isEnabled) {
      return [];
    }

    try {
      // Get context (current line + previous 3 lines)
      const lineCount = Math.max(0, position.line - 3);
      const contextRange = new vscode.Range(
        new vscode.Position(lineCount, 0),
        position
      );
      const context = document.getText(contextRange);

      // Don't trigger for very short context
      if (context.trim().length < 10) {
        return [];
      }

      logger.debug('Generating code completion...', { position: position.line });

      const language = document.languageId;
      const systemPrompt = `You are a code completion assistant. Given context, suggest ONLY the next logical line of code. No explanations.`;
      
      const prompt = `Complete this ${language} code:\n\`\`\`${language}\n${context}`;

      await aiClient.initialize();
      const completion = await aiClient.generate(prompt, { 
        systemPrompt,
        maxTokens: 1000
      });

      // Extract code from response
      const completionText = this._extractCode(completion);

      if (!completionText || completionText.length === 0) {
        return [];
      }

      // Create completion item
      const item = new vscode.CompletionItem(
        completionText,
        vscode.CompletionItemKind.Snippet
      );
      
      item.detail = 'CodeSentinel AI Suggestion';
      item.documentation = new vscode.MarkdownString(`Suggested by CodeSentinel AI\n\nProvider: ${aiClient.getCurrentProvider()}`);
      item.insertText = completionText;

      return [item];

    } catch (error) {
      logger.error('Completion failed:', error);
      return [];
    }
  }

  /**
   * Extract code from AI response
   * @private
   */
  _extractCode(response) {
    // Try to extract from code block
    const codeMatch = response.match(/``````/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }

    // Return first line only
    return response.split('\n')[0].trim();
  }

  /**
   * Enable/disable provider
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    logger.debug(`Completion provider ${enabled ? 'enabled' : 'disabled'}`);
  }
}

/**
 * Register completion provider
 * @param {vscode.ExtensionContext} context 
 */
function registerCompletionProvider(context) {
  const provider = new CodeSentinelCompletionProvider();

  // Register for all languages
  const disposable = vscode.languages.registerCompletionItemProvider(
    { scheme: 'file' },
    provider,
    '\n', '.', ' ' // Trigger characters
  );

  context.subscriptions.push(disposable);
  logger.info('✅ Completion provider registered');

  return provider;
}

module.exports = { registerCompletionProvider };
