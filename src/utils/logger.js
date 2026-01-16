/**
 * Production Logger with Output Channel
 * Supports debug mode and severity levels
 */

let vscode;
try {
  vscode = require('vscode');
} catch (e) {
  vscode = null;
}

class Logger {
  constructor() {
    if (vscode) {
      this.outputChannel = vscode.window.createOutputChannel('CodeSentinel AI');
    }
    this.debugMode = false;
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled 
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.info(enabled ? '🐛 Debug mode enabled' : '✅ Debug mode disabled');
  }

  /**
   * Log info message
   * @param {string} message 
   * @param {any} data 
   */
  info(message, data = null) {
    this._log('INFO', message, data);
  }

  /**
   * Log warning message
   * @param {string} message 
   * @param {any} data 
   */
  warn(message, data = null) {
    this._log('WARN', message, data);
  }

  /**
   * Log error message
   * @param {string} message 
   * @param {any} data 
   */
  error(message, data = null) {
    this._log('ERROR', message, data);
    // Always show errors in console
    console.error(`[CodeSentinel ERROR] ${message}`, data || '');
  }

  /**
   * Log debug message (only if debug mode enabled)
   * @param {string} message 
   * @param {any} data 
   */
  debug(message, data = null) {
    if (this.debugMode) {
      this._log('DEBUG', message, data);
    }
  }

  /**
   * Log with metrics (for performance tracking)
   * @param {string} operation 
   * @param {number} latency 
   * @param {object} metrics 
   */
  metrics(operation, latency, metrics = {}) {
    if (this.debugMode) {
      const message = `📊 ${operation} completed in ${latency}ms`;
      this._log('METRICS', message, metrics);
    }
  }

  /**
   * Show output channel to user
   */
  show() {
    if (this.outputChannel) this.outputChannel.show();
  }

  /**
   * Clear all logs
   */
  clear() {
    if (this.outputChannel) this.outputChannel.clear();
  }

  /**
   * Internal logging method
   * @private
   */
  _log(level, message, data) {
    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      logLine += `\n${JSON.stringify(data, null, 2)}`;
    }

    if (this.outputChannel) {
      this.outputChannel.appendLine(logLine);
    } else {
        // Fallback for CLI/Standalone
        console.log(logLine);
    }
  }
}

// Export singleton
const logger = new Logger();
module.exports = { logger };
