/**
 * Centralized Error Handler - Production-Grade Version
 * Provides robust error handling with separation of concerns
 * 
 * FIXES APPLIED:
 * - Split into pure analyzer (analyzeError) and UI presenter (handleApiError)
 * - Configurable retry behavior
 * - Better testability (no hardcoded UI in core logic)
 */

const vscode = require('vscode');

class ErrorHandler {
  /**
   * Analyze API error and return structured information (PURE FUNCTION, no UI)
   * @param {Error} error 
   * @param {string} context - Where the error occurred
   * @returns {{shouldRetry: boolean, fallbackToOllama: boolean, userMessage: string, technicalDetails: string, errorType: string}}
   */
  static analyzeError(error, context = 'API Call') {
    const errorInfo = {
      shouldRetry: false,
      fallbackToOllama: false,
      userMessage: '',
      technicalDetails: error.message || 'Unknown error',
      errorType: 'unknown'
    };

    const errorMessage = (error.message || '').toLowerCase();
    const errorCode = error.code || '';
    const statusCode = error.response?.status || 0;

    // Rate Limit Error (429)
    if (statusCode === 429 || errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      errorInfo.errorType = 'rate_limit';
      errorInfo.userMessage = '⏱️ API rate limit reached. Switching to local Ollama model...';
      errorInfo.fallbackToOllama = true;
      errorInfo.shouldRetry = false;
    }
    // Network Error
    else if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED' || errorMessage.includes('network') || errorMessage.includes('econnrefused')) {
      errorInfo.errorType = 'network';
      errorInfo.userMessage = '🌐 Network connection failed. Switching to offline Ollama model...';
      errorInfo.fallbackToOllama = true;
      errorInfo.shouldRetry = false;
    }
    // Invalid API Key (401/403)
    else if (statusCode === 401 || statusCode === 403 || errorMessage.includes('invalid api key') || errorMessage.includes('unauthorized')) {
      errorInfo.errorType = 'auth';
      errorInfo.userMessage = '🔑 Invalid API Key. Please check your Gemini API key in settings.';
      errorInfo.shouldRetry = false;
      errorInfo.fallbackToOllama = true;
    }
    // Empty Response
    else if (errorMessage.includes('empty response') || errorMessage.includes('no content') || statusCode === 204) {
      errorInfo.errorType = 'empty_response';
      errorInfo.userMessage = '⚠️ AI returned empty response. Retrying with adjusted parameters...';
      errorInfo.shouldRetry = true;
      errorInfo.fallbackToOllama = false;
    }
    // Timeout
    else if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
      errorInfo.errorType = 'timeout';
      errorInfo.userMessage = '⏰ Request timed out. Retrying...';
      errorInfo.shouldRetry = true;
      errorInfo.fallbackToOllama = false;
    }
    // Generic Error
    else {
      errorInfo.errorType = 'unknown';
      errorInfo.userMessage = `❌ Analysis failed: ${error.message}. Attempting Ollama fallback...`;
      errorInfo.fallbackToOllama = true;
      errorInfo.shouldRetry = false;
    }

    // Log error details in debug mode
    if (vscode.workspace.getConfiguration('codeSentinel').get('debugMode', false)) {
      console.error(`[ErrorHandler] ${context}:`, {
        errorType: errorInfo.errorType,
        message: error.message,
        stack: error.stack,
        code: errorCode,
        statusCode,
        response: error.response?.data
      });
    }

    return errorInfo;
  }

  /**
   * Handle API error with UI prompts (calls analyzeError internally)
   * @param {Error} error 
   * @param {string} context 
   * @returns {{shouldRetry: boolean, fallbackToOllama: boolean, userMessage: string}}
   */
  static handleApiError(error, context = 'API Call') {
    const errorInfo = this.analyzeError(error, context);

    // Show appropriate UI based on error type
    switch (errorInfo.errorType) {
      case 'rate_limit':
        vscode.window.showWarningMessage(
          errorInfo.userMessage,
          'Switch to Ollama Permanently',
          'Retry in 60s'
        ).then(selection => {
          if (selection === 'Switch to Ollama Permanently') {
            vscode.workspace.getConfiguration('codeSentinel').update('modelProvider', 'ollama', vscode.ConfigurationTarget.Global);
          }
        });
        break;

      case 'auth':
        vscode.window.showErrorMessage(
          errorInfo.userMessage,
          'Open Settings',
          'Get API Key'
        ).then(selection => {
          if (selection === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'codeSentinel.apiKey');
          } else if (selection === 'Get API Key') {
            vscode.env.openExternal(vscode.Uri.parse('https://aistudio.google.com/app/apikey'));
          }
        });
        break;

      case 'network':
        vscode.window.showWarningMessage(errorInfo.userMessage, 'Check Ollama Status').then(selection => {
          if (selection === 'Check Ollama Status') {
            vscode.commands.executeCommand('codeSentinel.checkOllamaStatus');
          }
        });
        break;

      case 'empty_response':
      case 'timeout':
        vscode.window.showInformationMessage(errorInfo.userMessage);
        break;

      default:
        vscode.window.showErrorMessage(errorInfo.userMessage);
    }

    return errorInfo;
  }

  /**
   * Retry logic with exponential backoff (configurable)
   * @param {Function} fn - Async function to retry
   * @param {Object} options - Retry configuration
   * @param {number} options.maxRetries - Maximum retry attempts
   * @param {number} options.initialDelay - Initial delay in ms
   * @param {Array<string>} options.retryableErrors - Error types that trigger retry
   * @returns {Promise<any>}
   */
  static async retryWithBackoff(fn, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      retryableErrors = ['empty_response', 'timeout']
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const errorInfo = this.analyzeError(error, `Retry Attempt ${attempt + 1}`);
        
        // Only retry if error type is in retryable list
        if (!retryableErrors.includes(errorInfo.errorType)) {
          throw error;
        }
        
        // Don't delay on last attempt
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          vscode.window.showInformationMessage(`🔄 Retrying... (Attempt ${attempt + 2}/${maxRetries})`);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Show user-friendly error notification
   * @param {string} message 
   * @param {boolean} showDebugOption 
   */
  static showError(message, showDebugOption = true) {
    const actions = showDebugOption ? ['Open Debug Log', 'Dismiss'] : ['Dismiss'];
    
    vscode.window.showErrorMessage(message, ...actions).then(selection => {
      if (selection === 'Open Debug Log') {
        vscode.commands.executeCommand('codeSentinel.toggleDebug');
      }
    });
  }
}

module.exports = ErrorHandler;
    