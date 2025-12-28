/**
 * Diagnostic Provider - Real-time Issue Highlighting
 * Shows issues as VS Code diagnostics (squiggly lines)
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const primaryAgent = require('../agents/primaryAgent');
const securityAgent = require('../agents/securityAgent');

class DiagnosticProvider {
  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codesentinel');
    this.isEnabled = false; // Disabled by default (can be heavy)
  }

  /**
   * Analyze document and create diagnostics
   * @param {vscode.TextDocument} document 
   */
  async analyzeDo(document) {
    if (!this.isEnabled) {
      return;
    }

    try {
      logger.debug(`Analyzing ${document.fileName} for diagnostics...`);

      const code = document.getText();
      const language = document.languageId;

      // Quick analysis (lightweight)
      const [primaryResults, securityResults] = await Promise.all([
        primaryAgent.analyze(code, language).catch(err => ({ issues: [] })),
        securityAgent.analyze(code, language).catch(err => ({ issues: [] }))
      ]);

      const allIssues = [...primaryResults.issues, ...securityResults.issues];

      // Convert issues to diagnostics
      const diagnostics = allIssues.map(issue => this._createDiagnostic(issue, document));

      this.diagnosticCollection.set(document.uri, diagnostics);
      logger.debug(`Created ${diagnostics.length} diagnostics`);

    } catch (error) {
      logger.error('Diagnostic analysis failed:', error);
    }
  }

  /**
   * Create VS Code diagnostic from issue
   * @private
   */
  _createDiagnostic(issue, document) {
    // Determine line range
    const line = issue.line ? Math.max(0, issue.line - 1) : 0;
    const lineText = document.lineAt(line).text;
    const range = new vscode.Range(
      line,
      0,
      line,
      lineText.length
    );

    // Map severity
    const severityMap = {
      critical: vscode.DiagnosticSeverity.Error,
      high: vscode.DiagnosticSeverity.Error,
      medium: vscode.DiagnosticSeverity.Warning,
      low: vscode.DiagnosticSeverity.Information
    };

    const diagnostic = new vscode.Diagnostic(
      range,
      issue.description || issue.title,
      severityMap[issue.severity] || vscode.DiagnosticSeverity.Warning
    );

    diagnostic.source = 'CodeSentinel AI';
    diagnostic.code = issue.type || 'code-review';

    return diagnostic;
  }

  /**
   * Clear all diagnostics
   */
  clear() {
    this.diagnosticCollection.clear();
  }

  /**
   * Enable/disable provider
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clear();
    }
    logger.info(`Diagnostic provider ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Dispose provider
   */
  dispose() {
    this.diagnosticCollection.dispose();
  }
}

/**
 * Register diagnostic provider
 * @param {vscode.ExtensionContext} context 
 */
function registerDiagnosticProvider(context) {
  const provider = new DiagnosticProvider();

  // Listen to document changes (debounced)
  let timeout;
  const onChange = vscode.workspace.onDidChangeTextDocument(event => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      provider.analyzeDocument(event.document);
    }, 2000); // Wait 2s after user stops typing
  });

  // Analyze on save
  const onSave = vscode.workspace.onDidSaveTextDocument(document => {
    provider.analyzeDocument(document);
  });

  context.subscriptions.push(provider.diagnosticCollection, onChange, onSave);
  logger.info('✅ Diagnostic provider registered');

  return provider;
}

module.exports = { registerDiagnosticProvider };
