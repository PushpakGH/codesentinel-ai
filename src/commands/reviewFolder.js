/**
 * Folder Review Command
 * Recursively reviews all code files in a folder
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const primaryAgent = require('../agents/primaryAgent');
const securityAgent = require('../agents/securityAgent');
const aiClient = require('../services/aiClient');

/**
 * Review entire folder
 */
async function reviewFolderCommand(folderPath = null, fromChat = false) {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('❌ No workspace folder open');
      return null;
    }

    // FIX: Handle invalid folderPath argument (could be event object or undefined)
    if (folderPath && typeof folderPath !== 'string') {
      logger.warn('Invalid folderPath type received:', typeof folderPath);
      folderPath = null;
    }

    // If no folder specified, ask user
    if (!folderPath || folderPath.trim() === '') {
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Folder to Review',
        defaultUri: workspaceFolders[0].uri
      });

      if (!folderUri || folderUri.length === 0) {
        logger.info('Folder review cancelled by user');
        return null;
      }

      folderPath = folderUri[0].fsPath;
    } else {
      // Resolve relative path
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      
      // FIX: Ensure folderPath is a string before resolving
      if (!path.isAbsolute(folderPath)) {
        folderPath = path.resolve(workspaceRoot, folderPath);
      }
    }

    logger.info(`Starting folder review: ${folderPath}`);

    const startTime = Date.now();
    const results = [];

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Reviewing folder: ${path.basename(folderPath)}`,
      cancellable: true
    }, async (progress, token) => {
      try {
        // Initialize AI client
        await aiClient.initialize();

        // Find all code files
        const files = await findCodeFiles(folderPath);
        logger.info(`Found ${files.length} code files in ${folderPath}`);

        if (files.length === 0) {
          vscode.window.showWarningMessage('⚠️ No code files found in folder');
          return null;
        }

        if (files.length > 50) {
          const proceed = await vscode.window.showWarningMessage(
            `⚠️ Found ${files.length} files. This may take a while. Continue?`,
            'Yes',
            'No'
          );
          
          if (proceed !== 'Yes') {
            logger.info('User cancelled large folder review');
            return null;
          }
        }

        let processed = 0;

        for (const file of files) {
          if (token.isCancellationRequested) {
            logger.info('Folder review cancelled by user');
            break;
          }

          const relativePath = path.relative(folderPath, file);
          progress.report({ 
            message: `[${processed + 1}/${files.length}] ${relativePath}`,
            increment: (1 / files.length) * 100
          });

          try {
            const result = await reviewSingleFile(file);
            results.push({
              file: relativePath,
              fullPath: file,
              ...result
            });
            logger.debug(`Reviewed: ${relativePath} - ${result.issues?.length || 0} issues`);
          } catch (error) {
            logger.error(`Failed to review ${file}:`, error);
            results.push({
              file: relativePath,
              fullPath: file,
              error: error.message,
              issues: [],
              linesOfCode: 0
            });
          }

          processed++;
        }

        const latency = Date.now() - startTime;
        
        // Generate aggregate report
        const aggregateReport = generateAggregateReport(results, folderPath, latency);

        if (fromChat) {
          // Return summary for chat
          return aggregateReport;
        } else {
          // Show full report in webview
          await showFolderReviewReport(aggregateReport);
          
          // Show completion message
          const totalIssues = aggregateReport.summary.totalIssues;
          vscode.window.showInformationMessage(
            `✅ Reviewed ${files.length} files in ${Math.round(latency / 1000)}s. Found ${totalIssues} issue(s).`,
            'View Report'
          );
        }

      } catch (error) {
        logger.error('Folder review failed:', error);
        vscode.window.showErrorMessage(`❌ Folder review failed: ${error.message}`);
        throw error;
      }
    });

    return results.length > 0 ? generateAggregateReport(results, folderPath, Date.now() - startTime) : null;

  } catch (error) {
    logger.error('reviewFolderCommand failed:', error);
    vscode.window.showErrorMessage(`❌ Folder review failed: ${error.message}`);
    return null;
  }
}

/**
 * Find all code files recursively
 */
async function findCodeFiles(dirPath) {
  const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.rs'];
  const ignorePatterns = ['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.next', 'out', 'target', 'venv'];

  const files = [];

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip hidden files/folders
        if (entry.name.startsWith('.') && entry.name !== '.') {
          continue;
        }

        if (entry.isDirectory()) {
          if (!ignorePatterns.includes(entry.name)) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (codeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan directory ${dir}:`, error.message);
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Review single file (enhanced version)
 */
async function reviewSingleFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    if (!content || content.trim().length === 0) {
      return {
        issues: [],
        linesOfCode: 0,
        confidence: 100,
        language: 'plaintext'
      };
    }

    const language = getLanguageFromExtension(path.extname(filePath));

    const [primaryResults, securityResults] = await Promise.all([
      primaryAgent.analyze(content, language).catch((err) => {
        logger.warn(`Primary agent failed for ${filePath}:`, err.message);
        return { issues: [], confidence: 0 };
      }),
      securityAgent.analyze(content, language).catch((err) => {
        logger.warn(`Security agent failed for ${filePath}:`, err.message);
        return { issues: [], confidence: 0 };
      })
    ]);

    const allIssues = [...primaryResults.issues, ...securityResults.issues];

    // Add line numbers and context to issues
    const issuesWithContext = allIssues.map(issue => ({
      ...issue,
      file: path.basename(filePath),
      filePath: filePath,
      language: language
    }));

    return {
      issues: issuesWithContext,
      linesOfCode: content.split('\n').length,
      confidence: Math.round((primaryResults.confidence + securityResults.confidence) / 2),
      language: language
    };
  } catch (error) {
    logger.error(`Failed to review file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Generate aggregate report
 */
function generateAggregateReport(results, folderPath, latency) {
  const totalFiles = results.length;
  const totalIssues = results.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
  const totalLOC = results.reduce((sum, r) => sum + (r.linesOfCode || 0), 0);

  const filesByRisk = results
    .filter(r => r.issues && r.issues.length > 0)
    .map(r => ({
      file: r.file,
      fullPath: r.fullPath,
      issues: r.issues?.length || 0,
      critical: r.issues?.filter(i => i.severity === 'critical').length || 0,
      high: r.issues?.filter(i => i.severity === 'high').length || 0,
      medium: r.issues?.filter(i => i.severity === 'medium').length || 0,
      low: r.issues?.filter(i => i.severity === 'low').length || 0
    }))
    .sort((a, b) => (b.critical * 10 + b.high * 5 + b.medium) - (a.critical * 10 + a.high * 5 + a.medium));

  return {
    summary: {
      folderPath,
      totalFiles,
      totalIssues,
      totalLOC,
      latency,
      critical: results.reduce((sum, r) => sum + (r.issues?.filter(i => i.severity === 'critical').length || 0), 0),
      high: results.reduce((sum, r) => sum + (r.issues?.filter(i => i.severity === 'high').length || 0), 0),
      medium: results.reduce((sum, r) => sum + (r.issues?.filter(i => i.severity === 'medium').length || 0), 0),
      low: results.reduce((sum, r) => sum + (r.issues?.filter(i => i.severity === 'low').length || 0), 0)
    },
    filesByRisk,
    allResults: results
  };
}

/**
 * Show folder review report in webview
 */
async function showFolderReviewReport(report) {
  try {
    const webviewManager = require('../services/webviewManager');
    const aiClient = require('../services/aiClient');
    const context = global.extensionContext;
    
    if (!context) {
      throw new Error('Extension context not available');
    }
    
    // Calculate risk score
    const riskScore = calculateFolderRiskScore(report);
    
    // Aggregate all issues
    const allIssues = aggregateIssuesFromFiles(report);
    
    // Convert folder report to webview format (matching file review format)
    const webviewData = {
      metadata: {
        timestamp: new Date().toISOString(),
        language: 'multiple', // Folder contains multiple languages
        provider: aiClient.getCurrentProvider ? aiClient.getCurrentProvider() : 'AI',
        latency: report.summary.latency,
        codeLines: report.summary.totalLOC,
        codeLength: 0, // Not applicable for folders
        confidence: 85, // Default confidence for folder reviews
        selfCorrectionApplied: false,
        iterations: 1
      },
      summary: {
        totalIssues: report.summary.totalIssues,
        critical: report.summary.critical,
        high: report.summary.high,
        medium: report.summary.medium,
        low: report.summary.low,
        riskScore: riskScore
      },
      issues: allIssues,
      folderInfo: {
        folderPath: report.summary.folderPath,
        totalFiles: report.summary.totalFiles,
        filesByRisk: report.filesByRisk,
        recommendations: generateFolderRecommendations(report)
      }
    };

    // Show in webview (same as file review)
    const panel = webviewManager.getPanel(context);
    webviewManager.updateContent(webviewData);
    
    logger.info('Folder review displayed in webview');
  } catch (error) {
    logger.error('Failed to show folder report:', error);
    
    // Fallback to markdown
    const markdown = formatFolderReportAsMarkdown(report);
    const doc = await vscode.workspace.openTextDocument({
      content: markdown,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  }
}

/**
 * Calculate folder risk score (0-100)
 */
function calculateFolderRiskScore(report) {
  const { summary } = report;
  
  if (summary.totalIssues === 0) return 0;
  
  const weights = {
    critical: 10,
    high: 5,
    medium: 2,
    low: 1
  };
  
  const weightedScore = 
    summary.critical * weights.critical +
    summary.high * weights.high +
    summary.medium * weights.medium +
    summary.low * weights.low;
  
  const maxPossible = summary.totalFiles * 50; // Assume max 50 points per file
  const riskScore = Math.min(100, Math.round((weightedScore / maxPossible) * 100));
  
  return riskScore;
}

/**
 * Aggregate all issues from all files
 */
function aggregateIssuesFromFiles(report) {
  const allIssues = [];
  
  report.allResults.forEach(fileResult => {
    if (fileResult.issues && fileResult.issues.length > 0) {
      fileResult.issues.forEach(issue => {
        allIssues.push({
          ...issue,
          file: fileResult.file, // Add file info to issue
          filePath: fileResult.fullPath
        });
      });
    }
  });
  
  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allIssues.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return (b.line || 0) - (a.line || 0);
  });
  
  return allIssues;
}

/**
 * Generate folder-level recommendations
 */
function generateFolderRecommendations(report) {
  const recommendations = [];
  const { summary } = report;
  
  if (summary.critical > 0) {
    recommendations.push({
      severity: 'critical',
      title: `Fix ${summary.critical} Critical Security Issues`,
      description: 'Critical vulnerabilities found across multiple files. These should be addressed immediately.',
      action: 'Review files marked with 🔴 in the report'
    });
  }
  
  if (summary.high > 5) {
    recommendations.push({
      severity: 'high',
      title: 'High Priority Issues Detected',
      description: `${summary.high} high-severity issues found. Consider refactoring affected files.`,
      action: 'Sort files by risk and prioritize top files'
    });
  }
  
  const avgIssuesPerFile = summary.totalIssues / summary.totalFiles;
  if (avgIssuesPerFile > 5) {
    recommendations.push({
      severity: 'medium',
      title: 'Code Quality Concerns',
      description: `Average ${avgIssuesPerFile.toFixed(1)} issues per file. Consider adopting stricter linting rules.`,
      action: 'Add ESLint/Prettier configuration'
    });
  }
  
  if (summary.totalIssues === 0) {
    recommendations.push({
      severity: 'info',
      title: '✨ Excellent Code Quality',
      description: 'No issues detected in this folder. Keep up the good work!',
      action: 'Maintain current practices'
    });
  }
  
  return recommendations;
}

/**
 * Format folder report as markdown
 */
function formatFolderReportAsMarkdown(report) {
  const { summary, filesByRisk } = report;

  let md = `# 📁 Folder Review Report\n\n`;
  md += `**Folder:** ${summary.folderPath}\n`;
  md += `**Analyzed:** ${new Date().toLocaleString()}\n`;
  md += `**Time Taken:** ${Math.round(summary.latency / 1000)}s\n\n`;

  md += `## 📊 Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Files | ${summary.totalFiles} |\n`;
  md += `| Lines of Code | ${summary.totalLOC.toLocaleString()} |\n`;
  md += `| Total Issues | ${summary.totalIssues} |\n`;
  md += `| Critical | ${summary.critical} 🔴 |\n`;
  md += `| High | ${summary.high} 🟠 |\n`;
  md += `| Medium | ${summary.medium} 🟡 |\n`;
  md += `| Low | ${summary.low} 🟢 |\n\n`;

  if (filesByRisk.length > 0) {
    md += `## 🎯 Files by Risk (Top 20)\n\n`;
    md += `| # | File | Issues | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low |\n`;
    md += `|---|------|--------|------------|---------|-----------|--------|\n`;
    
    filesByRisk.slice(0, 20).forEach((file, idx) => {
      md += `| ${idx + 1} | ${file.file} | ${file.issues} | ${file.critical} | ${file.high} | ${file.medium} | ${file.low} |\n`;
    });

    if (filesByRisk.length > 20) {
      md += `\n*...and ${filesByRisk.length - 20} more file(s) with issues*\n`;
    }
  } else {
    md += `## ✨ No Issues Found\n\nAll files look good!\n`;
  }

  md += `\n---\n\n`;
  md += `*Generated by CodeSentinel AI*\n`;
  md += `*Total analysis time: ${Math.round(summary.latency / 1000)} seconds*\n`;

  return md;
}

/**
 * Get language from file extension
 */
function getLanguageFromExtension(ext) {
  const map = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascriptreact',
    '.tsx': 'typescriptreact',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.rs': 'rust'
  };
  return map[ext] || 'plaintext';
}

/**
 * Review entire workspace
 */
async function reviewWorkspaceCommand(fromChat = false) {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('❌ No workspace folder open');
      return null;
    }

    return await reviewFolderCommand(workspaceFolders[0].uri.fsPath, fromChat);
  } catch (error) {
    logger.error('reviewWorkspaceCommand failed:', error);
    return null;
  }
}

/**
 * Smart Fix for entire folder
 */
async function smartFixFolderCommand(folderPath = null) {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('❌ No workspace folder open');
      return;
    }

    // Get folder path
    if (!folderPath || typeof folderPath !== 'string') {
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Folder to Fix',
        defaultUri: workspaceFolders[0].uri
      });

      if (!folderUri || folderUri.length === 0) {
        return;
      }

      folderPath = folderUri[0].fsPath;
    }

    // Review folder first to find issues
    const reviewResult = await reviewFolderCommand(folderPath, true);
    
    if (!reviewResult || reviewResult.summary.totalIssues === 0) {
      vscode.window.showInformationMessage('✅ No issues found to fix!');
      return;
    }

    // Show confirmation
    const proceed = await vscode.window.showWarningMessage(
      `Found ${reviewResult.summary.totalIssues} issues across ${reviewResult.summary.totalFiles} files. Apply fixes?`,
      { modal: true },
      'Fix All',
      'Cancel'
    );

    if (proceed !== 'Fix All') {
      return;
    }

    // Import smart fix module
    const { smartAutoFixCommand } = require('./smartAutoFix');

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Applying fixes to folder...',
      cancellable: true
    }, async (progress, token) => {
      let fixed = 0;
      const filesToFix = reviewResult.filesByRisk.filter(f => f.issues > 0);

      for (const fileInfo of filesToFix) {
        if (token.isCancellationRequested) break;

        progress.report({ 
          message: `Fixing ${fileInfo.file}...`,
          increment: (1 / filesToFix.length) * 100
        });

        try {
          // Open file
          const doc = await vscode.workspace.openTextDocument(fileInfo.fullPath);
          await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });

          // Apply smart fix to entire file
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            // Select all text
            const fullRange = new vscode.Range(
              doc.lineAt(0).range.start,
              doc.lineAt(doc.lineCount - 1).range.end
            );
            editor.selection = new vscode.Selection(fullRange.start, fullRange.end);

            // Apply fix
            await smartAutoFixCommand();
            fixed++;
          }
        } catch (error) {
          logger.error(`Failed to fix ${fileInfo.file}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
      }

      vscode.window.showInformationMessage(
        `✅ Applied fixes to ${fixed}/${filesToFix.length} files`
      );
    });

  } catch (error) {
    logger.error('smartFixFolderCommand failed:', error);
    vscode.window.showErrorMessage(`❌ Folder fix failed: ${error.message}`);
  }
}

module.exports = { 
  reviewFolderCommand,
  reviewWorkspaceCommand,
  smartFixFolderCommand
};
