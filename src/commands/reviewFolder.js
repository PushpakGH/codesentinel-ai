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
 * Review single file
 */
async function reviewSingleFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Skip empty files
    if (!content || content.trim().length === 0) {
      return {
        issues: [],
        linesOfCode: 0,
        confidence: 100
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

    return {
      issues: allIssues,
      linesOfCode: content.split('\n').length,
      confidence: Math.round((primaryResults.confidence + securityResults.confidence) / 2)
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
 * Show folder review report
 */
async function showFolderReviewReport(report) {
  try {
    // Create markdown report
    const markdown = formatFolderReportAsMarkdown(report);

    const doc = await vscode.workspace.openTextDocument({
      content: markdown,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  } catch (error) {
    logger.error('Failed to show folder report:', error);
    throw error;
  }
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

module.exports = { 
  reviewFolderCommand,
  reviewWorkspaceCommand
};
