const vscode = require('vscode');
const path = require('path');
const { logger } = require('../utils/logger');
const ProjectBuilderAgent = require('../agents/projectBuilder');

/**
 * Generate Project Command  projectGenerator.js
 * Entry point for "CodeSentinel: Build Project" command
 */
async function generateProjectCommand() {
  try {
    logger.info('🚀 Generate Project command started');

    // Step 1: Get user prompt
    const userPrompt = await vscode.window.showInputBox({
      prompt: 'Describe your project (e.g., "Build a todo app with dark mode")',
      placeHolder: 'Enter your project description...',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length < 10) {
          return 'Please provide a detailed description (at least 10 characters)';
        }
        return null;
      }
    });

    if (!userPrompt) {
      logger.info('User cancelled project description');
      return;
    }

    // Step 2: Select folder location
    const folderUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Project Location',
      title: 'Where should we create your project?'
    });

    if (!folderUris || folderUris.length === 0) {
      logger.info('User cancelled folder selection');
      return;
    }

    const parentPath = folderUris[0].fsPath;

    // Step 3: Get project name
    const projectName = await vscode.window.showInputBox({
      prompt: 'Enter project folder name',
      placeHolder: 'my-awesome-project',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project name cannot be empty';
        }
        if (!/^[a-z0-9-_]+$/i.test(value)) {
          return 'Only letters, numbers, dashes, and underscores allowed';
        }
        return null;
      }
    });

    if (!projectName) {
      logger.info('User cancelled project name input');
      return;
    }

    const projectPath = path.join(parentPath, projectName);

    // Step 4: Build the project using ProjectBuilderAgent
    logger.info('Creating ProjectBuilderAgent instance...');
    const agent = new ProjectBuilderAgent();
    
    logger.info('Calling agent.buildProject()...');
    const result = await agent.buildProject(userPrompt, projectPath);

    if (result.success) {
      vscode.window.showInformationMessage(
        `✅ Project "${projectName}" created successfully!`,
        'Open Folder',
        'Open Terminal'
      ).then(action => {
        if (action === 'Open Folder') {
          vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), true);
        } else if (action === 'Open Terminal') {
          const terminal = vscode.window.createTerminal({
            name: projectName,
            cwd: projectPath
          });
          terminal.show();
          terminal.sendText('npm run dev');
        }
      });
    } else {
      vscode.window.showErrorMessage(
        `❌ Project generation failed: ${result.error}`,
        'View Logs'
      ).then(action => {
        if (action === 'View Logs') {
          logger.show();
        }
      });
    }

  } catch (error) {
    logger.error('Generate project command failed:', error);
    vscode.window.showErrorMessage(
      `❌ Command failed: ${error.message}`,
      'View Logs'
    ).then(action => {
      if (action === 'View Logs') {
        logger.show();
      }
    });
  }
}

module.exports = { generateProjectCommand };
