/**
 * Review Code Command - Multi-Agent Orchestrator
 * Coordinates PrimaryAgent, SecurityAgent, and ValidatorAgent
 * Implements the production-grade review pipeline
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const primaryAgent = require('../agents/primaryAgent');
const securityAgent = require('../agents/securityAgent');
const validatorAgent = require('../agents/validatorAgent');
const configManager = require('../services/configManager');
const { showReviewResults } = require('../webview/reviewPanel');

/**
 * Main review command - orchestrates multi-agent analysis
 */
async function reviewCodeCommand() {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showErrorMessage('❌ No active editor found');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    vscode.window.showWarningMessage('⚠️ Please select code to review');
    return;
  }

  const language = editor.document.languageId;
  const startTime = Date.now();

  // Reset validator counter for new session
  validatorAgent.resetCounter();

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "CodeSentinel AI",
    cancellable: true
  }, async (progress, token) => {
    try {
      logger.info('='.repeat(60));
      logger.info('🚀 Starting Multi-Agent Code Review');
      logger.info(`Language: ${language}, Lines: ${selectedText.split('\n').length}`);
      logger.info('='.repeat(60));

      // Stage 1: Initialize AI Client
      progress.report({ message: 'Initializing AI client...', increment: 10 });
      await aiClient.initialize();
      logger.info('✅ AI Client initialized');

      if (token.isCancellationRequested) {
        logger.info('Review cancelled by user');
        return;
      }

      // Stage 2: Primary Agent - General Review
      progress.report({ message: 'Running Primary Agent (bugs, performance)...', increment: 20 });
      logger.info('🔍 Primary Agent starting...');
      
      const primaryResults = await primaryAgent.analyze(selectedText, language);
      logger.info(`✅ Primary Agent completed: ${primaryResults.issues.length} issues found (confidence: ${primaryResults.confidence}%)`);

      if (token.isCancellationRequested) {
        logger.info('Review cancelled by user');
        return;
      }

      // Stage 3: Security Agent - Vulnerability Scan
      progress.report({ message: 'Running Security Agent (OWASP Top 10)...', increment: 30 });
      logger.info('🛡️ Security Agent starting...');
      
      const securityResults = await securityAgent.analyze(selectedText, language);
      logger.info(`✅ Security Agent completed: ${securityResults.issues.length} vulnerabilities found`);

      if (token.isCancellationRequested) {
        logger.info('Review cancelled by user');
        return;
      }

      // Stage 4: Validator Agent - Self-Correction Loop
      progress.report({ message: 'Running Validator Agent (self-correction)...', increment: 20 });
      logger.info('🔄 Validator Agent starting...');
      
      const validatedResults = await validatorAgent.validate(
        primaryResults,
        securityResults,
        selectedText,
        language
      );

      if (validatedResults.selfCorrectionApplied) {
        logger.info(`🔄 Self-correction applied (${validatedResults.iterations} iteration(s))`);
      }

      logger.info(`✅ Validator Agent completed: Final confidence ${validatedResults.confidence}%`);

      if (token.isCancellationRequested) {
        logger.info('Review cancelled by user');
        return;
      }

      // Stage 5: Generate Report
      progress.report({ message: 'Generating report...', increment: 20 });
      
      const totalLatency = Date.now() - startTime;
      const report = await generateReport(
        validatedResults,
        selectedText,
        language,
        totalLatency
      );

      logger.info('='.repeat(60));
      logger.info('✅ Review Complete');
      logger.info(`Total time: ${totalLatency}ms`);
      logger.info(`Issues found: ${validatedResults.issues.length}`);
      logger.info(`Final confidence: ${validatedResults.confidence}%`);
      logger.info('='.repeat(60));

      // Stage 6: Display Results
      await displayResults(report, validatedResults);

      // Show success message
      const criticalCount = validatedResults.issues.filter(i => i.severity === 'critical').length;
      const highCount = validatedResults.issues.filter(i => i.severity === 'high').length;

      let message = '✅ Code review complete! ';
      if (criticalCount > 0) {
        message += `Found ${criticalCount} critical issue(s).`;
      } else if (highCount > 0) {
        message += `Found ${highCount} high priority issue(s).`;
      } else if (validatedResults.issues.length > 0) {
        message += `Found ${validatedResults.issues.length} issue(s).`;
      } else {
        message += 'No issues found. Code looks good! 🎉';
      }

      vscode.window.showInformationMessage(message);

    } catch (error) {
      logger.error('Review failed:', error);
      
      vscode.window.showErrorMessage(
        `❌ Review failed: ${error.message}`,
        'View Logs'
      ).then(action => {
        if (action === 'View Logs') {
          logger.show();
        }
      });
    }
  });
}

/**
 * Review code for chat (returns data instead of showing UI)
 * @param {string} code 
 * @param {string} language 
 * @param {string} fileName 
 * @returns {Promise<object>}
 */
async function reviewCodeForChat(code, language, fileName) {
  const startTime = Date.now();
  
  logger.info(`Chat-initiated review: ${fileName}`);

  try {
    // Initialize
    await aiClient.initialize();

    // Run agents
    const primaryResults = await primaryAgent.analyze(code, language);
    const securityResults = await securityAgent.analyze(code, language);
    const validatedResults = await validatorAgent.validate(
      primaryResults,
      securityResults,
      code,
      language
    );

    // Generate report
    const totalLatency = Date.now() - startTime;
    const report = await generateReport(
      validatedResults,
      code,
      language,
      totalLatency
    );

    // Update tree view (if available)
    if (global.treeDataProvider) {
      global.treeDataProvider.addResult(fileName, report);
    }

    // Show in webview
    const webviewManager = require('../services/webviewManager');
    const context = global.extensionContext;
    if (context) {
      const panel = webviewManager.getPanel(context);
      webviewManager.updateContent(report);
    }

    logger.info(`Chat review complete: ${fileName}`);

    return report;

  } catch (error) {
    logger.error('Chat review failed:', error);
    throw error;
  }
}

/**
 * Generate comprehensive review report
 * @private
 */
async function generateReport(results, code, language, latency) {
  const provider = aiClient.getCurrentProvider() || 'AI';
  const timestamp = new Date().toISOString();
  
  // Group issues by severity
  const critical = results.issues.filter(i => i.severity === 'critical');
  const high = results.issues.filter(i => i.severity === 'high');
  const medium = results.issues.filter(i => i.severity === 'medium');
  const low = results.issues.filter(i => i.severity === 'low');

  // Calculate risk score
  const riskScore = calculateRiskScore(critical.length, high.length, medium.length, low.length);

  return {
    metadata: {
      timestamp,
      language,
      provider,
      latency,
      codeLines: code.split('\n').length,
      codeLength: code.length,
      confidence: results.confidence,
      selfCorrectionApplied: results.selfCorrectionApplied || false,
      iterations: results.iterations || 1
    },
    summary: {
      totalIssues: results.issues.length,
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      low: low.length,
      riskScore
    },
    issues: results.issues,
    validationNotes: results.validationNotes || results.summary,
    originalCode: code
  };
}

/**
 * Calculate overall risk score (0-100)
 * @private
 */
function calculateRiskScore(critical, high, medium, low) {
  const weights = {
    critical: 40,
    high: 25,
    medium: 10,
    low: 5
  };

  const rawScore = 
    (critical * weights.critical) +
    (high * weights.high) +
    (medium * weights.medium) +
    (low * weights.low);

  // Cap at 100
  return Math.min(100, rawScore);
}

/**
 * Display results in appropriate format
 * @private
 */
async function displayResults(report, results) {
  const displayMode = vscode.workspace.getConfiguration('codeSentinel').get('displayMode', 'webview');

  // Update tree view
  if (global.treeDataProvider) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      global.treeDataProvider.addResult(editor.document.fileName, report);
      logger.debug('Added result to tree view');
    }
  }

  if (displayMode === 'webview') {
    // Use webview panel (better UI)
    try {
      await showReviewResults(report);
    } catch (error) {
      logger.warn('Webview failed, falling back to markdown:', error);
      await displayAsMarkdown(report);
    }
  } else {
    // Fallback to markdown document
    await displayAsMarkdown(report);
  }
}

/**
 * Display results as markdown document (fallback)
 * @private
 */
async function displayAsMarkdown(report) {
  const markdown = formatAsMarkdown(report);
  
  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
    language: 'markdown'
  });

  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}

/**
 * Format report as markdown
 * @private
 */
function formatAsMarkdown(report) {
  const { metadata, summary, issues } = report;

  let md = `# 🛡️ CodeSentinel AI - Code Review Report

## 📊 Summary

| Metric | Value |
|--------|-------|
| **Language** | ${metadata.language} |
| **Lines of Code** | ${metadata.codeLines} |
| **Provider** | ${metadata.provider} |
| **Analysis Time** | ${metadata.latency}ms |
| **Confidence** | ${metadata.confidence}% |
| **Risk Score** | ${summary.riskScore}/100 ${getRiskEmoji(summary.riskScore)} |
${metadata.selfCorrectionApplied ? `| **Self-Correction** | ✓ Applied (${metadata.iterations} iteration(s)) |\n` : ''}

## 🔍 Issues Found: ${summary.totalIssues}

`;

  if (summary.critical > 0) {
    md += `- 🔴 **Critical**: ${summary.critical}\n`;
  }
  if (summary.high > 0) {
    md += `- 🟠 **High**: ${summary.high}\n`;
  }
  if (summary.medium > 0) {
    md += `- 🟡 **Medium**: ${summary.medium}\n`;
  }
  if (summary.low > 0) {
    md += `- 🟢 **Low**: ${summary.low}\n`;
  }

  md += '\n---\n\n';

  // Group and display issues by severity
  const severities = ['critical', 'high', 'medium', 'low'];
  
  severities.forEach(severity => {
    const severityIssues = issues.filter(i => i.severity === severity);
    
    if (severityIssues.length > 0) {
      md += `## ${getSeverityEmoji(severity)} ${severity.toUpperCase()} Issues\n\n`;
      
      severityIssues.forEach((issue, index) => {
        md += `### ${index + 1}. ${issue.title || issue.description}\n\n`;
        
        if (issue.line) {
          md += `**Line:** ${issue.line}\n\n`;
        }
        
        md += `**Description:**\n${issue.description}\n\n`;
        
        if (issue.suggestion || issue.fix) {
          md += `**Fix:**\n${issue.suggestion || issue.fix}\n\n`;
        }

        if (issue.exploit) {
          md += `**Exploit Scenario:**\n${issue.exploit}\n\n`;
        }

        if (issue.verified !== undefined) {
          md += `*${issue.verified ? '✓ Verified in second pass' : '⚠ Needs manual verification'}*\n\n`;
        }

        md += '---\n\n';
      });
    }
  });

  // Add original code reference
  md += `## 📝 Analyzed Code\n\n\`\`\`${metadata.language}\n${report.originalCode}\n\`\`\`\n\n`;

  // Footer
  md += `---\n\n`;
  md += `*Generated by CodeSentinel AI*\n`;
  md += `*Timestamp: ${metadata.timestamp}*\n`;
  md += `*Provider: ${metadata.provider}*\n`;

  return md;
}

/**
 * Get emoji for risk score
 * @private
 */
function getRiskEmoji(score) {
  if (score >= 80) return '🔴';
  if (score >= 50) return '🟠';
  if (score >= 20) return '🟡';
  return '🟢';
}

/**
 * Get emoji for severity
 * @private
 */
function getSeverityEmoji(severity) {
  const emojis = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };
  return emojis[severity] || '⚪';
}

module.exports = { 
  reviewCodeCommand,
  reviewCodeForChat
};
