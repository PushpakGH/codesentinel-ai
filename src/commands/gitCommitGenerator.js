/**
 * Git Commit Message Generator
 * Analyzes staged changes and generates conventional commit messages
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const gitService = require('../services/gitService');
const { getCommitMessagePrompt, getCommitBodyPrompt } = require('../prompts/commitPrompts');
const configManager = require('../services/configManager');

/**
 * Main command - Generate commit message from staged changes
 */
async function generateCommitMessageCommand() {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "CodeSentinel",
    cancellable: true
  }, async (progress, token) => {
    try {
      // Step 1: Check if Git repository exists
      progress.report({ message: 'Checking Git repository...', increment: 10 });
      
      const isGitRepo = await gitService.isGitRepository();
      if (!isGitRepo) {
        vscode.window.showErrorMessage('❌ No Git repository found. Initialize Git first.');
        return;
      }

      if (token.isCancellationRequested) return;

      // Step 2: Get staged changes
      progress.report({ message: 'Reading staged changes...', increment: 20 });
      logger.info('Fetching staged diff...');

      let diff, stagedFiles;
      try {
        diff = await gitService.getStagedDiff();
        stagedFiles = await gitService.getStagedFiles();
      } catch (error) {
        if (error.message.includes('No staged changes')) {
          const action = await vscode.window.showWarningMessage(
            '⚠️ No staged changes found. Stage files first with "git add".',
            'Open Source Control'
          );
          
          if (action === 'Open Source Control') {
            vscode.commands.executeCommand('workbench.view.scm');
          }
          return;
        }
        throw error;
      }

      logger.info(`Found ${stagedFiles.length} staged file(s)`);

      if (token.isCancellationRequested) return;

      // Step 3: Parse diff metadata
      progress.report({ message: 'Analyzing changes...', increment: 20 });
      
      const metadata = gitService.parseDiff(diff);
      const inferredScope = gitService.inferScope(stagedFiles);
      
      logger.debug('Diff metadata:', metadata);
      logger.debug('Inferred scope:', inferredScope);

      if (token.isCancellationRequested) return;

      // Step 4: Generate commit message with AI
      progress.report({ message: 'Generating commit message...', increment: 30 });
      logger.info('Calling AI to generate commit message...');

      await aiClient.initialize();

      const prompt = getCommitMessagePrompt(diff, metadata);
      const commitMessage = await aiClient.generate(prompt, {
        systemPrompt: 'You are a Git commit message expert. Generate concise conventional commit messages.',
        maxTokens: 150
      });

      const cleanMessage = commitMessage.trim().replace(/```/g, '`\n`');logger.info('Generated commit message:', cleanMessage);

      if (token.isCancellationRequested) return;

      // Step 5: Prefill SCM input box
      progress.report({ message: 'Setting commit message...', increment: 20 });
      
      await gitService.setCommitMessage(cleanMessage);

      // Step 6: Show success message with options
      const action = await vscode.window.showInformationMessage(
        '✅ Commit message generated!',
        'Open Source Control',
        'Generate Detailed Body',
        'Regenerate'
      );

      if (action === 'Open Source Control') {
        vscode.commands.executeCommand('workbench.view.scm');
      } else if (action === 'Generate Detailed Body') {
        await generateDetailedBody(diff, cleanMessage);
      } else if (action === 'Regenerate') {
        await generateCommitMessageCommand();
      }

      logger.info('✅ Commit message generation complete');

    } catch (error) {
      logger.error('Failed to generate commit message:', error);
      
      vscode.window.showErrorMessage(
        `❌ Failed: ${error.message}`,
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
 * Generate detailed commit body (optional)
 * @private
 */
async function generateDetailedBody(diff, shortMessage) {
  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating detailed commit body...',
      cancellable: false
    }, async () => {
      await aiClient.initialize();

      const bodyPrompt = getCommitBodyPrompt(diff, shortMessage);
      const body = await aiClient.generate(bodyPrompt, {
        systemPrompt: 'Generate concise commit body bullet points.',
        maxTokens: 200
      });

      const fullMessage = `${shortMessage}\n\n${body.trim()}`;
      await gitService.setCommitMessage(fullMessage);

      vscode.window.showInformationMessage('✅ Detailed body added!', 'Open Source Control')
        .then(action => {
          if (action === 'Open Source Control') {
            vscode.commands.executeCommand('workbench.view.scm');
          }
        });
    });
  } catch (error) {
    logger.error('Failed to generate commit body:', error);
    vscode.window.showErrorMessage(`Failed to generate body: ${error.message}`);
  }
}

module.exports = { generateCommitMessageCommand };
