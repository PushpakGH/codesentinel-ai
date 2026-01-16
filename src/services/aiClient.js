/**
 * Universal AI Client - Production-Grade
 * Handles both Gemini API and Ollama with automatic fallback
 * Supports BYOK (Bring Your Own Key) and streaming responses
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Ollama } = require('ollama');
const configManager = require('./configManager');
const ErrorHandler = require('./utils/errorHandler');

class AIClient {
  constructor() {
    this.geminiClient = null;
    this.ollamaClient = null;
    this.currentProvider = null;
    this.requestCount = 0;
    this.startTime = Date.now();
  }

  /**
   * Initialize AI clients based on configuration
   * @returns {Promise<void>}
   */
  async initialize() {
    const provider = configManager.getModelProvider();
    
    try {
      if (provider === 'gemini' || provider === 'auto') {
        await this._initializeGemini();
      }
      
      if (provider === 'ollama' || provider === 'auto') {
        await this._initializeOllama();
      }

      this._log(`✅ AI Client initialized (Provider: ${provider})`, 'info');
    } catch (error) {
      this._log(`⚠️ Initialization warning: ${error.message}`, 'warn');
      throw error;
    }
  }

  /**
   * Initialize Gemini client
   * @private
   */
  async _initializeGemini() {
    const apiKey = await configManager.getApiKey();
    
    if (!apiKey) {
      this._log('No Gemini API key found, skipping Gemini initialization', 'warn');
      return;
    }

    this.geminiClient = new GoogleGenerativeAI(apiKey);
    this._log('✅ Gemini client initialized', 'info');
  }

  /**
   * Initialize Ollama client
   * @private
   */
  async _initializeOllama() {
    const { endpoint } = configManager.getOllamaConfig();
    
    this.ollamaClient = new Ollama({
      host: endpoint
    });

    // Test connection
    try {
      await this.ollamaClient.list();
      this._log('✅ Ollama client initialized and connected', 'info');
    } catch (error) {
      this._log(`⚠️ Ollama not available: ${error.message}`, 'warn');
      this.ollamaClient = null;
    }
  }

  /**
   * Generate AI response with automatic fallback
   * @param {string} prompt - The prompt to send to AI
   * @param {Object} options - Generation options
   * @param {string} options.systemPrompt - System instructions
   * @param {number} options.maxTokens - Max tokens to generate
   * @param {boolean} options.stream - Enable streaming
   * @param {Function} options.onChunk - Streaming callback
   * @returns {Promise<string>}
   */
  async generate(prompt, options = {}) {
    const startTime = Date.now();
    this.requestCount++;
    
    const {
      systemPrompt = '',
      maxTokens = configManager.getMaxTokens(),
      stream = configManager.isStreamingEnabled(),
      onChunk = null
    } = options;

    const provider = configManager.getModelProvider();
    
    try {
      let response;

      // Try primary provider
      if (provider === 'gemini' || provider === 'auto') {
        this._log('🚀 Attempting Gemini...', 'info');
        response = await this._generateWithGemini(prompt, systemPrompt, maxTokens, stream, onChunk);
        this.currentProvider = 'gemini';
      } else if (provider === 'ollama') {
        this._log('🤖 Using Ollama...', 'info');
        response = await this._generateWithOllama(prompt, systemPrompt, maxTokens, stream, onChunk);
        this.currentProvider = 'ollama';
      }

      const latency = Date.now() - startTime;
      this._log(`✅ Response generated in ${latency}ms (Provider: ${this.currentProvider})`, 'info');
      
      return response;

    } catch (error) {
      this._log(`❌ Primary provider failed: ${error.message}`, 'error');

      // Auto-fallback logic
      if (provider === 'auto' && this.currentProvider !== 'ollama') {
        this._log('🔄 Attempting Ollama fallback...', 'info');
        
        try {
          const response = await this._generateWithOllama(prompt, systemPrompt, maxTokens, stream, onChunk);
          this.currentProvider = 'ollama';
          
          const latency = Date.now() - startTime;
          this._log(`✅ Fallback successful in ${latency}ms`, 'info');
          
          return response;
        } catch (fallbackError) {
          this._log(`❌ Fallback also failed: ${fallbackError.message}`, 'error');
          throw new Error('Both Gemini and Ollama failed. Check configuration.');
        }
      }

      // No fallback available
      ErrorHandler.handleApiError(error, 'AI Generation');
      throw error;
    }
  }

  /**
   * Generate response using Gemini
   * @private
   */
  async _generateWithGemini(prompt, systemPrompt, maxTokens, stream, onChunk) {
    if (!this.geminiClient) {
      await this._initializeGemini();
    }

    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized (API key missing?)');
    }

    const modelName = configManager.getGeminiModel();
    this._log(`Using Gemini model: ${modelName}`, 'info');

    const model = this.geminiClient.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt || 'You are an expert code reviewer assistant.'
    });

    const generationConfig = {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    };

    if (stream && onChunk) {
      // Streaming mode
      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });

      let fullText = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        onChunk(chunkText);
      }

      return fullText;
    } else {
      // Non-streaming mode
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });

      const response = result.response;
      return response.text();
    }
  }

  /**
   * Generate response using Ollama
   * @private
   */
  async _generateWithOllama(prompt, systemPrompt, maxTokens, stream, onChunk) {
    if (!this.ollamaClient) {
      await this._initializeOllama();
    }

    if (!this.ollamaClient) {
      throw new Error('Ollama client not initialized (Is Ollama running?)');
    }

    const { model } = configManager.getOllamaConfig();
    this._log(`Using Ollama model: ${model}`, 'info');

    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    if (stream && onChunk) {
      // Streaming mode
      const response = await this.ollamaClient.generate({
        model: model,
        prompt: fullPrompt,
        stream: true,
        options: {
          num_predict: maxTokens,
          temperature: 0.7
        }
      });

      let fullText = '';
      for await (const chunk of response) {
        const chunkText = chunk.response;
        fullText += chunkText;
        onChunk(chunkText);
      }

      return fullText;
    } else {
      // Non-streaming mode
      const response = await this.ollamaClient.generate({
        model: model,
        prompt: fullPrompt,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature: 0.7
        }
      });

      return response.response;
    }
  }

  /**
   * Get current provider being used
   * @returns {string|null}
   */
  getCurrentProvider() {
    return this.currentProvider;
  }

  /**
   * Get usage statistics
   * @returns {{requestCount: number, uptime: number}}
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      uptime: Date.now() - this.startTime,
      currentProvider: this.currentProvider
    };
  }

  /**
   * Logging utility
   * @private
   */
  _log(message, level = 'info') {
    if (configManager.isDebugMode()) {
      const timestamp = new Date().toISOString();
      console.log(`[AIClient ${level.toUpperCase()}] ${timestamp}: ${message}`);
    }
  }

  /**
   * Generate vector embedding for text
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Array of floating point numbers
   */
  async embed(text) {
    if (!text || typeof text !== 'string') return [];

    try {
      // 1. Try Gemini Embedding
      if (this.geminiClient) {
        const model = this.geminiClient.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;
      }
      
      // 2. Try Ollama Embedding
      if (this.ollamaClient) {
        const response = await this.ollamaClient.embeddings({
          model: 'all-minilm', // Standard lightweight model
          prompt: text
        });
        return response.embedding;
      }
      
      throw new Error('No embedding provider available');
    } catch (error) {
      this._log(`⚠️ Embedding failed: ${error.message}`, 'error');
      // Return zero vector or empty as fallback
      return [];
    }
  }
}

// Export singleton instance
module.exports = new AIClient();
