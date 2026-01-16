let vscode;
try {
  vscode = require('vscode');
} catch (e) {
  vscode = {
     workspace: { getConfiguration: () => ({ get: () => '' }) }
  };
}
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

const SECRET_KEY_API_TOKEN = 'codeSentinel.apiKey';

class ConfigManager {
  constructor() {
    this.context = null;
    this.initialized = false;
  }

  /**
   * Initialize with extension context for SecretStorage access
   * @param {vscode.ExtensionContext} context 
   */
  async initialize(context) {
    this.context = context;
    this.initialized = true;
    logger.debug('ConfigManager initialized');
  }

  /**
   * Get secure API key
   */
  async getApiKey() {
    if (!this.initialized) throw new Error('ConfigManager not initialized');
    return await this.context.secrets.get(SECRET_KEY_API_TOKEN);
  }

  /**
   * Save API key securely
   */
  async saveApiKey(key) {
    if (!this.initialized) throw new Error('ConfigManager not initialized');
    await this.context.secrets.store(SECRET_KEY_API_TOKEN, key);
  }

  /**
   * Delete stored API key
   */
  async deleteApiKey() {
    if (!this.initialized) throw new Error('ConfigManager not initialized');
    await this.context.secrets.delete(SECRET_KEY_API_TOKEN);
  }

  /**
   * Migrate legacy settings key to SecretStorage
   */
  async migrateSettingsToSecretStorage() {
    const config = vscode.workspace.getConfiguration('codeSentinel');
    const legacyKey = config.get('apiKey');

    if (legacyKey && legacyKey.trim()) {
      await this.saveApiKey(legacyKey);
      await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
      return true;
    }
    return false;
  }

  /**
   * Check if running in debug/demo mode
   */
  isDebugMode() {
    return vscode.workspace.getConfiguration('codeSentinel').get('debugMode', false);
  }

  /**
   * Get selected model provider (gemini, ollama, etc)
   */
  getModelProvider() {
    return vscode.workspace.getConfiguration('codeSentinel').get('modelProvider', 'gemini');
  }

  /**
   * Validate current configuration
   */
  async validateConfig() {
    const errors = [];
    const warnings = [];
    const provider = this.getModelProvider();

    if (provider === 'gemini') {
      const key = await this.getApiKey();
      if (!key) {
        errors.push('Gemini API Key is missing');
      }
    } else if (provider === 'ollama') {
      // Check if Ollama ID/URL is set?
      // For now assume default
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Add image domains to next.config.ts/mjs/js
   * (NEW FEATURE)
   */
  async addImageDomains(projectPath, domains = ['images.unsplash.com', 'assets.aceternity.com', 'aceternity.com', 'pbs.twimg.com', 'media.licdn.com']) {
    logger.info('🔧 ConfigManager: Updating image domains...');
    
    // 1. Detect Config File
    const configFiles = ['next.config.ts', 'next.config.mjs', 'next.config.js'];
    let configFile = null;
    
    for (const f of configFiles) {
        try {
            await fs.access(path.join(projectPath, f));
            configFile = f;
            break;
        } catch {}
    }
    
    if (!configFile) {
        logger.warn('ConfigManager: No next.config file found.');
        return;
    }
    
    const configPath = path.join(projectPath, configFile);
    let content = await fs.readFile(configPath, 'utf-8');
    
    // 2. Prepare Remote Patterns
    const patterns = domains.map(d => `      { protocol: 'https', hostname: '${d}' }`).join(',\n');
    
    // 3. Inject into Config
    // Regex matches: const nextConfig = { ... } or const nextConfig: NextConfig = { ... }
    const configRegex = /(const nextConfig.*=.*{)/s;
    
    if (content.includes('remotePatterns')) {
        logger.info('ConfigManager: remotePatterns already exists, skipping auto-injection.');
        return;
    }
    
    if (content.match(configRegex)) {
        const insertion = `
  images: {
    remotePatterns: [
${patterns}
    ],
  },`;
        content = content.replace(configRegex, `$1${insertion}`);
        await fs.writeFile(configPath, content);
        logger.info(`✅ Updated ${configFile} with image domains.`);
    } else {
        logger.warn(`ConfigManager: Could not parse ${configFile} structure.`);
    }
  }

  // --- AI Configuration Methods (Restored) ---

  getGeminiModel() {
    return vscode.workspace.getConfiguration('codeSentinel').get('geminiModel', 'gemini-pro');
  }

  isStreamingEnabled() {
    return vscode.workspace.getConfiguration('codeSentinel').get('enableStreaming', true);
  }

  getMaxTokens() {
    return vscode.workspace.getConfiguration('codeSentinel').get('maxTokens', 8192);
  }

  getOllamaConfig() {
     const config = vscode.workspace.getConfiguration('codeSentinel');
     return {
        endpoint: config.get('ollamaEndpoint', 'http://127.0.0.1:11434'),
        model: config.get('ollamaModel', 'llama3')
     };
  }
}

// Export Singleton Instance
module.exports = new ConfigManager();
