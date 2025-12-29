/**
 * Configuration Manager - Production-Grade Version
 * Handles secure API key management with BYOK (Bring Your Own Key) fallback logic
 * Priority: User Key > System Key > Ollama Fallback
 * 
 * FIXES APPLIED:
 * - Defensive initialization checks on all methods
 * - Lazy configuration loading (no constructor side-effects)
 * - Separated migration from validation (explicit migration method)
 * - Clear error messages when not initialized
 */

const vscode = require('vscode');


class ConfigManager {
  constructor() {
    this.secretStorage = null;
    this.context = null;
    this.initialized = false;
    this.outputChannel = null;
  }

  /**
   * Initialize with VS Code's SecretStorage for secure API key management
   * MUST be called during extension activation before any other methods
   * @param {vscode.ExtensionContext} context 
   */
  async initialize(context) {
    if (!context) {
      throw new Error('ConfigManager.initialize() requires a valid ExtensionContext');
    }

    this.secretStorage = context.secrets;
    this.context = context;
    this.initialized = true;
    
    // Create dedicated output channel for logging
    this.outputChannel = vscode.window.createOutputChannel('CodeSentinel AI');
    
    this.log('✅ ConfigManager initialized successfully', 'info');
  }

  /**
   * Verify initialization before operations requiring SecretStorage
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized || !this.secretStorage) {
      throw new Error('ConfigManager not initialized. Call initialize(context) during extension activation.');
    }
  }

  /**
   * Get workspace configuration (lazy loaded, no constructor dependencies)
   * @returns {vscode.WorkspaceConfiguration}
   * @private
   */
  _getConfig() {
    return vscode.workspace.getConfiguration('codeSentinel');
  }

  /**
   * Get API Key with BYOK fallback logic (READ-ONLY, no side effects)
   * Priority: 1) User's saved key (SecretStorage) 2) System .env key
   * NOTE: No longer migrates settings automatically - use migrateSettings() explicitly
   * @returns {Promise<string|null>}
   */
  async getApiKey() {
    this._ensureInitialized();
    
    try {
      // Priority 1: Check VS Code Secret Storage (most secure)
      const secretKey = await this.secretStorage.get('codeSentinel.apiKey');
      if (secretKey && secretKey.trim()) {
        this.log('Using API key from SecretStorage (User Key)', 'info');
        return secretKey.trim();
      }

      // Priority 2: Check plain-text settings (legacy, will prompt migration)
      const settingsKey = this._getConfig().get('apiKey', '');
      if (settingsKey && settingsKey.trim()) {
        this.log('⚠️ API key found in plain settings. Run "CodeSentinel: Migrate Settings" to secure it.', 'warn');
        return settingsKey.trim();
      }

      // Priority 3: System fallback key from .env
      const systemKey = process.env.SYSTEM_GEMINI_API_KEY;
      if (systemKey && systemKey.trim()) {
        this.log('Using System API Key (Fallback from .env)', 'info');
        return systemKey.trim();
      }

      this.log('No API key found. Will attempt Ollama fallback.', 'warn');
      return null;
    } catch (error) {
      this.log(`Error retrieving API key: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Migrate API key from settings to SecretStorage (explicit, not automatic)
   * Call this via a dedicated command or during first-run setup
   * @returns {Promise<boolean>} True if migration happened, false if nothing to migrate
   */
  async migrateSettingsToSecretStorage() {
    this._ensureInitialized();

    const settingsKey = this._getConfig().get('apiKey', '');
    if (!settingsKey || !settingsKey.trim()) {
      this.log('No settings key to migrate', 'info');
      return false;
    }

    try {
      // Save to SecretStorage
      await this.secretStorage.store('codeSentinel.apiKey', settingsKey.trim());
      
      // Clear from settings
      await this._getConfig().update('apiKey', '', vscode.ConfigurationTarget.Global);
      
      this.log('✅ Successfully migrated API key from settings to SecretStorage', 'info');
      vscode.window.showInformationMessage('🔒 API Key migrated to secure storage');
      return true;
    } catch (error) {
      this.log(`Migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Save user's API key securely to SecretStorage
   * @param {string} apiKey 
   */
  async saveApiKey(apiKey) {
    this._ensureInitialized();

    if (!apiKey || !apiKey.trim()) {
      throw new Error('API key cannot be empty');
    }

    // Basic validation for Gemini API key format
    if (!apiKey.startsWith('AIza') && !apiKey.startsWith('sk-')) {
      const proceed = await vscode.window.showWarningMessage(
        '⚠️ API key format looks unusual. Continue anyway?',
        'Yes', 'Cancel'
      );
      if (proceed !== 'Yes') {
        throw new Error('API key save cancelled by user');
      }
    }

    await this.secretStorage.store('codeSentinel.apiKey', apiKey.trim());
    this.log('✅ API key saved successfully to SecretStorage', 'info');
    vscode.window.showInformationMessage('✅ API Key saved securely');
  }

  /**
   * Delete stored API key
   */
  async clearApiKey() {
    this._ensureInitialized();
    await this.secretStorage.delete('codeSentinel.apiKey');
    this.log('🗑️ API key cleared from SecretStorage', 'info');
    vscode.window.showInformationMessage('🗑️ API Key removed');
  }

  /**
   * Delete stored API key (alias for clearApiKey for consistency)
   */
  async deleteApiKey() {
    return this.clearApiKey();
  }

  /**
   * Get current model provider (gemini/ollama)
   * @returns {string}
   */
  getModelProvider() {
    return this._getConfig().get('modelProvider', 'gemini');
  }

  /**
   * Get Gemini model name
   * @returns {string}
   */
  getGeminiModel() {
    return this._getConfig().get('geminiModel', 'gemini-2.0-flash-exp');
  }

  /**
   * Get Ollama configuration (updated with user's available models)
   * @returns {{model: string, endpoint: string}}
   */
  getOllamaConfig() {
    return {
      model: this._getConfig().get('ollamaModel', 'deepseek-r1:7b'),
      endpoint: this._getConfig().get('ollamaEndpoint', 'http://localhost:11434')
    };
  }

  /**
   * Check if security agent is enabled
   * @returns {boolean}
   */
  isSecurityAgentEnabled() {
    return this._getConfig().get('enableSecurityAgent', true);
  }

  /**
   * Check if validator agent is enabled
   * @returns {boolean}
   */
  isValidatorAgentEnabled() {
    return this._getConfig().get('enableValidatorAgent', true);
  }

  /**
   * Get confidence threshold for self-correction loops
   * @returns {number}
   */
  getConfidenceThreshold() {
    return this._getConfig().get('confidenceThreshold', 85);
  }

  /**
   * Check if streaming is enabled
   * @returns {boolean}
   */
  isStreamingEnabled() {
    return this._getConfig().get('streamingEnabled', true);
  }

  /**
   * Check if debug mode is active
   * @returns {boolean}
   */
  isDebugMode() {
    return this._getConfig().get('debugMode', false);
  }

  /**
   * Get maximum tokens for generation
   * @returns {number}
   */
  getMaxTokens() {
    return this._getConfig().get('maxTokens', 4096);
  }
/**
 * Get chat history limit (number of messages to remember)
 * @returns {number}
 */
getChatHistoryLimit() {
  return this._getConfig().get('chatHistoryLimit', 50);
}
// =========================================

  /**
   * Logging utility with output channel support
   * @param {string} message 
   * @param {string} level - 'info' | 'warn' | 'error'
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[ConfigManager ${level.toUpperCase()}] ${timestamp}: ${message}`;
    
    if (this.isDebugMode() && this.outputChannel) {
      this.outputChannel.appendLine(logMessage);
    }
    
    // Always log errors to console
    if (level === 'error') {
      console.error(logMessage);
    }
  }

  /**
   * Validate configuration completeness (READ-ONLY, no side effects)
   * @returns {{valid: boolean, errors: string[], warnings: string[]}}
   */
  async validateConfig() {
    const errors = [];
    const warnings = [];
    const provider = this.getModelProvider();

    if (provider === 'gemini') {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        errors.push('Gemini API key not configured. Please add your API key in settings or switch to Ollama.');
      }

      // Check for legacy plain-text key
      const settingsKey = this._getConfig().get('apiKey', '');
      if (settingsKey) {
        warnings.push('API key stored in plain settings. Consider running migration for better security.');
      }
    }

    if (provider === 'ollama') {
      const { endpoint, model } = this.getOllamaConfig();
      if (!endpoint) {
        errors.push('Ollama endpoint not configured.');
      }
      if (!model) {
        warnings.push('Ollama model not specified. Will use default: deepseek-r1:7b');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  /**
 * Get custom system prompt (if user provided one)
 * @returns {string}
 */
getCustomSystemPrompt() {
  return this._getConfig().get('customSystemPrompt', '');
}

/**
 * Get file exclusion patterns
 * @returns {string[]}
 */
getExcludePatterns() {
  return this._getConfig().get('excludePatterns', ['**/node_modules/**', '**/dist/**', '**/.git/**']);
}

/**
 * Check if auto-review on save is enabled
 * @returns {boolean}
 */
isAutoReviewEnabled() {
  return this._getConfig().get('autoReviewOnSave', false);
}
  
}



// Export singleton instance
module.exports = new ConfigManager();
