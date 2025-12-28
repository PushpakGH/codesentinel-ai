/**
 * Explain Issue Command
 * Provides detailed explanation of specific code patterns or issues
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');

/**
 * Explain selected code or specific issue
 */
async function explainIssueCommand() {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showErrorMessage('❌ No active editor found');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    vscode.window.showWarningMessage('⚠️ Please select code to explain');
    return;
  }

  const language = editor.document.languageId;

  // Ask user what they want to know
  const explanationType = await vscode.window.showQuickPick([
    {
      label: '$(question) What does this code do?',
      description: 'Explain the purpose and logic',
      value: 'purpose'
    },
    {
      label: '$(bug) Why is this code problematic?',
      description: 'Identify issues and risks',
      value: 'problems'
    },
    {
      label: '$(lightbulb) How can I improve this?',
      description: 'Suggest better approaches',
      value: 'improvements'
    },
    {
      label: '$(shield) What are the security implications?',
      description: 'Analyze security risks',
      value: 'security'
    },
    {
      label: '$(rocket) How does this perform?',
      description: 'Performance analysis',
      value: 'performance'
    }
  ], {
    placeHolder: 'What would you like to know about this code?'
  });

  if (!explanationType) {
    return; // User cancelled
  }

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'CodeSentinel: Analyzing code...',
    cancellable: false
  }, async (progress) => {
    try {
      progress.report({ message: 'Generating explanation...', increment: 50 });
      logger.info('Explanation requested', { type: explanationType.value, language });

      await aiClient.initialize();

      const systemPrompt = getSystemPrompt(explanationType.value);
      const prompt = `${language} code to analyze:\n\`\`\`${language}\n${selectedText}\n\`\`\``;

      const explanation = await aiClient.generate(prompt, { 
        systemPrompt,
        maxTokens: 2000
      });

      progress.report({ increment: 50 });

      // Create explanation document
      const markdown = formatExplanation(explanationType.label, explanation, selectedText, language);
      
      const doc = await vscode.workspace.openTextDocument({
        content: markdown,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

      logger.info('Explanation generated successfully');

    } catch (error) {
      logger.error('Explanation generation failed:', error);
      vscode.window.showErrorMessage(
        `❌ Failed to generate explanation: ${error.message}`,
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
 * Get specialized system prompt based on explanation type
 * @private
 */
function getSystemPrompt(type) {
  const prompts = {
    purpose: `You are a patient teacher explaining code to a junior developer.

Explain:
1. **What this code does** (high-level purpose)
2. **How it works** (step-by-step breakdown)
3. **Key concepts used** (language features, patterns)
4. **Expected inputs and outputs**

Use simple language with examples.`,

    problems: `You are a senior code reviewer identifying issues.

Analyze:
1. **Bugs and logical errors**
2. **Edge cases not handled**
3. **Potential runtime errors**
4. **Code smells and anti-patterns**

Explain WHY each issue is problematic with examples.`,

    improvements: `You are an expert developer suggesting improvements.

Provide:
1. **Better algorithms or approaches**
2. **Modern language features to use**
3. **Design patterns that fit**
4. **Refactoring suggestions**

Show code examples of improvements.`,

    security: `You are a security expert analyzing threats.

Identify:
1. **Injection vulnerabilities** (SQL, XSS, Command)
2. **Authentication/authorization flaws**
3. **Data exposure risks**
4. **Cryptographic weaknesses**

Explain exploitation scenarios and fixes.`,

    performance: `You are a performance optimization expert.

Analyze:
1. **Time complexity** (Big O notation)
2. **Space complexity** (memory usage)
3. **Bottlenecks and inefficiencies**
4. **Optimization opportunities**

Provide specific improvements with benchmarks.`
  };

  return prompts[type] || prompts.purpose;
}

/**
 * Format explanation into readable markdown
 * @private
 */
function formatExplanation(title, explanation, code, language) {
  const provider = aiClient.getCurrentProvider() || 'AI';
  
  return `# ${title}

## 📝 Original Code

\`\`\`${language}
${code}
\`\`\`

---

## 🔍 Analysis

${explanation}

---

## 💡 Quick Actions

- **Fix this code**: Select the code and run \`CodeSentinel: Apply AI Fix\`
- **Full review**: Run \`CodeSentinel: Review Selected Code\`
- **Toggle debug mode**: Press \`Ctrl+Shift+P\` → \`CodeSentinel: Toggle Debug Mode\`

---

*Generated by CodeSentinel AI*  
*Provider: ${provider}*  
*Timestamp: ${new Date().toISOString()}*
`;
}

module.exports = { explainIssueCommand };
