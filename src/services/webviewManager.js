/**
 * Webview Manager
 * Handles webview panel lifecycle and prevents buffering issues
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');

class WebviewManager {
  constructor() {
    this.currentPanel = null;
  }

  /**
   * Get or create webview panel
   * @param {vscode.ExtensionContext} context 
   * @returns {vscode.WebviewPanel}
   */
  getPanel(context) {
    if (this.currentPanel) {
      // Reuse existing panel
      this.currentPanel.reveal(vscode.ViewColumn.Two);
      return this.currentPanel;
    }

    // Create new panel
    this.currentPanel = vscode.window.createWebviewPanel(
      'codesentinelReview',
      'CodeSentinel Review',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true, // Prevents buffering issue
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.joinPath(context.extensionUri, 'webview')
        ]
      }
    );

    // Handle panel disposal
    this.currentPanel.onDidDispose(() => {
      this.currentPanel = null;
      logger.debug('Webview panel disposed');
    });

    logger.debug('Created new webview panel');
    return this.currentPanel;
  }

  /**
   * Update webview content
   * @param {object} report 
   */
  updateContent(report) {
    if (!this.currentPanel) {
      logger.warn('No panel to update');
      return;
    }

    const html = this.generateHTML(report);
    this.currentPanel.webview.html = html;
    
    logger.debug('Webview content updated');
  }

  /**
   * Generate HTML content for webview
   * @private
   */
  generateHTML(report) {
    const { metadata, summary, issues } = report;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeSentinel Review</title>
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
            padding: 20px;
            line-height: 1.6;
        }

        .header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        h1 {
            color: var(--vscode-textLink-foreground);
            font-size: 28px;
            margin-bottom: 10px;
        }

        .metadata {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .metadata-item {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }

        .metadata-label {
            font-size: 12px;
            text-transform: uppercase;
            opacity: 0.7;
            margin-bottom: 5px;
        }

        .metadata-value {
            font-size: 18px;
            font-weight: bold;
        }

        .summary {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .severity-badge {
            padding: 10px;
            border-radius: 5px;
            text-align: center;
        }

        .severity-critical { background: #dc3545; color: white; }
        .severity-high { background: #fd7e14; color: white; }
        .severity-medium { background: #ffc107; color: black; }
        .severity-low { background: #28a745; color: white; }

        .risk-score {
            font-size: 48px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
        }

        .risk-high { color: #dc3545; }
        .risk-medium { color: #ffc107; }
        .risk-low { color: #28a745; }

        .issues-container {
            margin-top: 30px;
        }

        .issue {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-left: 4px solid;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 5px;
        }

        .issue.critical { border-color: #dc3545; }
        .issue.high { border-color: #fd7e14; }
        .issue.medium { border-color: #ffc107; }
        .issue.low { border-color: #28a745; }

        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .issue-title {
            font-size: 18px;
            font-weight: bold;
        }

        .issue-badge {
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .issue-description {
            margin-bottom: 15px;
            line-height: 1.8;
        }

        .issue-fix {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 15px;
            border-radius: 3px;
            margin-top: 15px;
        }

        .fix-label {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 10px;
        }

        code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }

        .loading {
            text-align: center;
            padding: 50px;
            font-size: 18px;
        }

        .empty-state {
            text-align: center;
            padding: 50px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .issue {
            animation: fadeIn 0.3s ease-out forwards;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ CodeSentinel AI - Review Report</h1>
    </div>

    <div class="metadata">
        <div class="metadata-item">
            <div class="metadata-label">Language</div>
            <div class="metadata-value">${metadata.language}</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">Lines of Code</div>
            <div class="metadata-value">${metadata.codeLines}</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">Analysis Time</div>
            <div class="metadata-value">${metadata.latency}ms</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">Provider</div>
            <div class="metadata-value">${metadata.provider}</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">Confidence</div>
            <div class="metadata-value">${metadata.confidence}%</div>
        </div>
        ${metadata.selfCorrectionApplied ? `
        <div class="metadata-item">
            <div class="metadata-label">Self-Correction</div>
            <div class="metadata-value">✓ Applied (${metadata.iterations}x)</div>
        </div>
        ` : ''}
    </div>

    <div class="summary">
        <h2>Risk Score</h2>
        <div class="risk-score ${summary.riskScore >= 80 ? 'risk-high' : summary.riskScore >= 50 ? 'risk-medium' : 'risk-low'}">
            ${summary.riskScore}/100
        </div>
        
        <h3>Issues Breakdown</h3>
        <div class="summary-grid">
            <div class="severity-badge severity-critical">
                <div style="font-size: 24px;">${summary.critical}</div>
                <div>Critical</div>
            </div>
            <div class="severity-badge severity-high">
                <div style="font-size: 24px;">${summary.high}</div>
                <div>High</div>
            </div>
            <div class="severity-badge severity-medium">
                <div style="font-size: 24px;">${summary.medium}</div>
                <div>Medium</div>
            </div>
            <div class="severity-badge severity-low">
                <div style="font-size: 24px;">${summary.low}</div>
                <div>Low</div>
            </div>
        </div>
    </div>

    <div class="issues-container">
        <h2>Detailed Issues (${summary.totalIssues})</h2>
        
        ${issues.length === 0 ? `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <h3>No Issues Found!</h3>
                <p>Your code looks good. Great job!</p>
            </div>
        ` : issues.map((issue, index) => `
            <div class="issue ${issue.severity}" style="animation-delay: ${index * 0.1}s;">
                <div class="issue-header">
                    <div class="issue-title">${issue.title || issue.description.split('.')[0]}</div>
                    <div class="issue-badge severity-${issue.severity}">${issue.severity}</div>
                </div>
                
                ${issue.line ? `<div><strong>Line:</strong> ${issue.line}</div>` : ''}
                
                <div class="issue-description">
                    ${issue.description}
                </div>

                ${issue.exploit ? `
                    <div class="issue-fix">
                        <div class="fix-label">🎯 Exploit Scenario:</div>
                        ${issue.exploit}
                    </div>
                ` : ''}

                ${issue.suggestion || issue.fix ? `
                    <div class="issue-fix">
                        <div class="fix-label">💡 How to Fix:</div>
                        ${issue.suggestion || issue.fix}
                    </div>
                ` : ''}

                ${issue.verified !== undefined ? `
                    <div style="margin-top: 10px; font-style: italic; opacity: 0.8;">
                        ${issue.verified ? '✓ Verified in validation pass' : '⚠ Requires manual verification'}
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>

    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid var(--vscode-panel-border); text-align: center; opacity: 0.7; font-size: 12px;">
        Generated by CodeSentinel AI • ${new Date(metadata.timestamp).toLocaleString()}
    </div>
</body>
</html>`;
  }

  /**
   * Close current panel
   */
  dispose() {
    if (this.currentPanel) {
      this.currentPanel.dispose();
      this.currentPanel = null;
    }
  }
}

// Export singleton
module.exports = new WebviewManager();
