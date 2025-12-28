/**
 * Auto-Fix Command
 * Applies AI-suggested fixes directly to code
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const configManager = require('../services/configManager');

async function autoFixCommand() {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showErrorMessage('❌ No active editor found');
    return;
  }

  // Check if auto-fix is enabled
  const isEnabled = vscode.workspace.getConfiguration('codeSentinel').get('enableAutoFix', true);
  if (!isEnabled) {
    vscode.window.showWarningMessage('⚠️ Auto-fix is disabled in settings. Enable it to use this feature.');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    vscode.window.showWarningMessage('⚠️ Please select code to fix');
    return;
  }

  const language = editor.document.languageId;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'CodeSentinel: Generating fix...',
    cancellable: false
  }, async (progress) => {
    try {
      progress.report({ message: 'Analyzing issue...', increment: 25 });
      logger.info('Auto-fix started', { language, codeLength: selectedText.length });

      // Initialize AI client
      await aiClient.initialize();

      progress.report({ message: 'Generating corrected code...', increment: 25 });

      const systemPrompt = `You are a code fix generator. Given buggy or problematic code, provide ONLY the corrected version.

Rules:
1. Return ONLY valid ${language} code
2. Fix all bugs, vulnerabilities, and code quality issues
3. Preserve the original functionality
4. Use best practices and modern syntax
5. Do NOT add explanations or comments outside the code

Format: Return code in a markdown code block.`;
      
      const prompt = `Fix this ${language} code:\n\`\`\`${language}\n${selectedText}\n\`\`\``;

      const response = await aiClient.generate(prompt, { 
        systemPrompt,
        maxTokens: 1000
      });

      // Extract code from response
      const fixedCode = _extractCode(response, language);

      if (!fixedCode || fixedCode.trim().length === 0) {
        throw new Error('AI failed to generate a valid fix');
      }

      progress.report({ message: 'Applying fix...', increment: 25 });

      logger.debug('Generated fix', { originalLength: selectedText.length, fixedLength: fixedCode.length });

      // ========== DIRECT FIX (as user requested) ==========
      const applyDirectly = vscode.workspace.getConfiguration('codeSentinel').get('applyFixesDirectly', false);

      // Helper function to safely apply edit
      const applyEdit = async (targetEditor, targetSelection, code) => {
        // Verify editor is still valid
        if (!targetEditor || targetEditor.document.isClosed) {
          // Try to find the document in open editors
          const allEditors = vscode.window.visibleTextEditors;
          const foundEditor = allEditors.find(e => e.document.uri.toString() === editor.document.uri.toString());
          
          if (!foundEditor) {
            // Document is closed, try to reopen it
            try {
              const doc = await vscode.workspace.openTextDocument(editor.document.uri);
              const reopenedEditor = await vscode.window.showTextDocument(doc);
              return reopenedEditor.edit(editBuilder => {
                editBuilder.replace(targetSelection, code);
              });
            } catch (reopenError) {
              throw new Error('The file was closed. Please reopen it and try again.');
            }
          }
          
          return foundEditor.edit(editBuilder => {
            editBuilder.replace(targetSelection, code);
          });
        }
        
        return targetEditor.edit(editBuilder => {
          editBuilder.replace(targetSelection, code);
        });
      };

      if (applyDirectly) {
        // Apply immediately without confirmation
        const success = await applyEdit(editor, selection, fixedCode);
        
        if (!success) {
          throw new Error('Failed to apply edit. The document may have been modified.');
        }
        
        vscode.window.showInformationMessage('✅ Fix applied!', 'Undo').then(action => {
          if (action === 'Undo') {
            vscode.commands.executeCommand('undo');
          }
        });
        
        logger.info('Auto-fix applied directly');
      } else {
        // Show confirmation dialog (default behavior)
        const action = await vscode.window.showInformationMessage(
          'Review the fix before applying?',
          'Show Diff',
          'Apply Now',
          'Cancel'
        );

        if (action === 'Show Diff') {
          // Open diff view
          const originalDoc = await vscode.workspace.openTextDocument({
            content: selectedText,
            language
          });
          const fixedDoc = await vscode.workspace.openTextDocument({
            content: fixedCode,
            language
          });
          
          await vscode.commands.executeCommand('vscode.diff',
            originalDoc.uri,
            fixedDoc.uri,
            '← Original | AI Fix →'
          );

          // Ask again after showing diff
          const applyAfterDiff = await vscode.window.showInformationMessage(
            'Apply this fix?',
            'Yes',
            'No'
          );

          if (applyAfterDiff === 'Yes') {
            const success = await applyEdit(editor, selection, fixedCode);
            
            if (!success) {
              throw new Error('Failed to apply edit. The document may have been modified.');
            }
            
            vscode.window.showInformationMessage('✅ Fix applied!');
            logger.info('Auto-fix applied after diff review');
          }

        } else if (action === 'Apply Now') {
          const success = await applyEdit(editor, selection, fixedCode);
          
          if (!success) {
            throw new Error('Failed to apply edit. The document may have been modified.');
          }
          
          vscode.window.showInformationMessage('✅ Fix applied!', 'Undo').then(undoAction => {
            if (undoAction === 'Undo') {
              vscode.commands.executeCommand('undo');
            }
          });
          
          logger.info('Auto-fix applied immediately');
        }
      }

    } catch (error) {
      logger.error('Auto-fix failed:', error);
      vscode.window.showErrorMessage(
        `❌ Failed to generate fix: ${error.message}`,
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
 * Extract code from AI response
 * @private
 */
function _extractCode(response, language) {
  // Try to extract from markdown code block
  const codeBlockRegex = new RegExp(`\`\`\`(?:${language})?\\n([\\s\\S]*?)\\n\`\`\``, 'i');
  const match = response.match(codeBlockRegex);
  
  if (match && match[1]) {
    return match[1].trim();
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

module.exports = { autoFixCommand };
