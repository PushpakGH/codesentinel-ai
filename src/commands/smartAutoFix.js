/**
 * Smart Auto-Fix Command
 * Intelligent fix: Reviews code first, then fixes all issues
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const primaryAgent = require('../agents/primaryAgent');
const securityAgent = require('../agents/securityAgent');
const validatorAgent = require('../agents/validatorAgent');

/**
 * Smart auto-fix: Analyze first, then fix comprehensively
 */
async function smartAutoFixCommand() {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showErrorMessage('❌ No active editor found');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    vscode.window.showWarningMessage('⚠️ Please select code to fix');
    return;
  }

  const language = editor.document.languageId;
  const startTime = Date.now();

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "CodeSentinel Smart Fix",
    cancellable: false
  }, async (progress) => {
    try {
      // ========== PHASE 1: COMPREHENSIVE ANALYSIS ==========
      progress.report({ message: 'Step 1/4: Analyzing code for issues...', increment: 10 });
      logger.info('🧠 Smart Auto-Fix: Starting comprehensive analysis...');

      await aiClient.initialize();

      // Run all agents to find ALL issues
      progress.report({ message: 'Running Primary Agent...', increment: 10 });
      const primaryResults = await primaryAgent.analyze(selectedText, language);
      logger.info(`Primary: ${primaryResults.issues.length} issues found`);

      progress.report({ message: 'Running Security Agent...', increment: 10 });
      const securityResults = await securityAgent.analyze(selectedText, language);
      logger.info(`Security: ${securityResults.issues.length} vulnerabilities found`);

      progress.report({ message: 'Validating findings...', increment: 10 });
      const validatedResults = await validatorAgent.validate(
        primaryResults,
        securityResults,
        selectedText,
        language
      );

      const allIssues = validatedResults.issues;
      logger.info(`✅ Analysis complete: ${allIssues.length} total issues found`);

      if (allIssues.length === 0) {
        vscode.window.showInformationMessage('✨ No issues found! Code looks good.');
        return;
      }

      // ========== PHASE 2: GENERATE COMPREHENSIVE FIX ==========
      progress.report({ message: `Step 2/4: Generating fix for ${allIssues.length} issue(s)...`, increment: 20 });
      logger.info('🔧 Generating comprehensive fix...');

      const fixedCode = await generateComprehensiveFix(
        selectedText,
        language,
        allIssues,
        validatedResults.confidence
      );

      if (!fixedCode || fixedCode.trim().length === 0) {
        throw new Error('Failed to generate fix');
      }

      // ========== PHASE 3: SHOW DIFF & EXPLANATION ==========
      progress.report({ message: 'Step 3/4: Preparing diff view...', increment: 20 });

      const fixSummary = generateFixSummary(allIssues);
      
      // Create documents for diff view
      const originalDoc = await vscode.workspace.openTextDocument({
        content: selectedText,
        language
      });
      
      const fixedDoc = await vscode.workspace.openTextDocument({
        content: fixedCode,
        language
      });

      // Show diff
      await vscode.commands.executeCommand('vscode.diff',
        originalDoc.uri,
        fixedDoc.uri,
        `CodeSentinel Smart Fix: ${allIssues.length} issue(s) fixed`
      );

      // ========== PHASE 4: APPLY FIX ==========
      progress.report({ message: 'Step 4/4: Waiting for confirmation...', increment: 20 });

      const action = await vscode.window.showInformationMessage(
        `🔧 Smart Fix Ready!\n\n${fixSummary}\n\nApply these changes?`,
        { modal: true },
        'Apply All Fixes',
        'Cancel'
      );

      if (action === 'Apply All Fixes') {
        await editor.edit(editBuilder => {
          editBuilder.replace(selection, fixedCode);
        });

        const latency = Date.now() - startTime;
        
        vscode.window.showInformationMessage(
          `✅ Fixed ${allIssues.length} issue(s) in ${Math.round(latency / 1000)}s`,
          'Undo'
        ).then(undoAction => {
          if (undoAction === 'Undo') {
            vscode.commands.executeCommand('undo');
          }
        });

        logger.info(`Smart fix applied successfully (${latency}ms)`);
      } else {
        logger.info('User cancelled smart fix');
      }

    } catch (error) {
      logger.error('Smart auto-fix failed:', error);
      vscode.window.showErrorMessage(
        `❌ Smart fix failed: ${error.message}`,
        'Try Simple Fix',
        'View Logs'
      ).then(action => {
        if (action === 'Try Simple Fix') {
          vscode.commands.executeCommand('codeSentinel.autoFix');
        } else if (action === 'View Logs') {
          logger.show();
        }
      });
    }
  });
}

/**
 * Generate comprehensive fix based on all identified issues
 * @private
 */
async function generateComprehensiveFix(code, language, issues, confidence) {
  // Build detailed issue list for AI
  const issueDescriptions = issues.map((issue, idx) => 
    `${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.title || issue.description}\n   ${issue.suggestion || issue.fix || ''}`
  ).join('\n\n');

  const systemPrompt = `You are an expert code refactoring assistant. Given code with identified issues, provide a COMPLETE, CORRECTED version.

**Critical Rules:**
1. Fix ALL ${issues.length} issues listed below
2. Return ONLY the corrected ${language} code
3. Preserve ALL original functionality
4. Use modern best practices
5. Add brief inline comments for major changes
6. NO explanations outside the code block

**Issues to Fix:**
${issueDescriptions}

**Quality Standards:**
- Security: Fix all vulnerabilities (SQL injection, XSS, hardcoded secrets, eval)
- Performance: Optimize inefficient code
- Maintainability: Clean, readable code
- Error Handling: Add try-catch where needed
- Type Safety: Use proper typing (if applicable)

Return format: Markdown code block with ${language} syntax.`;

  const prompt = `Fix this ${language} code by addressing all ${issues.length} identified issues:\n\`\`\`${language}\n${code}\n\`\`\``;

  try {
    const response = await aiClient.generate(prompt, {
      systemPrompt,
      maxTokens: 2000
    });

    return extractCode(response, language);
  } catch (error) {
    logger.error('Fix generation failed:', error);
    throw error;
  }
}

/**
 * Generate human-readable fix summary
 * @private
 */
function generateFixSummary(issues) {
  const critical = issues.filter(i => i.severity === 'critical').length;
  const high = issues.filter(i => i.severity === 'high').length;
  const medium = issues.filter(i => i.severity === 'medium').length;
  const low = issues.filter(i => i.severity === 'low').length;

  let summary = `Fixes applied:\n`;
  if (critical > 0) summary += `🔴 ${critical} critical issue(s)\n`;
  if (high > 0) summary += `🟠 ${high} high priority issue(s)\n`;
  if (medium > 0) summary += `🟡 ${medium} medium issue(s)\n`;
  if (low > 0) summary += `🟢 ${low} low priority issue(s)\n`;

  return summary.trim();
}

/**
 * Extract code from AI response
 */
function extractCode(response, language) {
  // Try language-specific code block
  const langRegex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'i');
  const langMatch = response.match(langRegex);
  if (langMatch && langMatch[1]) {
    return langMatch[1].trim();
  }

  // Try generic code block
  const genericMatch = response.match(/``````/);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1].trim();
  }

  // Fallback: return entire response if it looks like code
  const trimmed = response.trim();
  if (trimmed.includes('{') || trimmed.includes('function') || trimmed.includes('def ')) {
    return trimmed;
  }

  return '';
}

module.exports = { smartAutoFixCommand };
