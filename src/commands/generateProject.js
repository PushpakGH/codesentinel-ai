const vscode = require('vscode');
const path = require('path');
const { logger } = require('../utils/logger');
const ProjectBuilderAgent = require('../agents/projectBuilder');

/**
 * Command: Generate Project
 * Builds a complete project from user description using AI
 */
async function generateProject() {
  try {
    logger.info('🚀 Project Builder started');

    // Step 1: Get user's project description
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
      logger.info('User cancelled project generation');
      return;
    }

    // Step 2: Get project location
    const folderUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Project Location'
    });

    if (!folderUris || folderUris.length === 0) {
      logger.info('User cancelled folder selection');
      return;
    }

    const parentPath = folderUris[0].fsPath;

    // Step 3: Get project name
    const projectName = await vscode.window.showInputBox({
      prompt: 'Enter project name',
      placeHolder: 'my-awesome-project',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project name cannot be empty';
        }
        if (!/^[a-z0-9-_]+$/i.test(value)) {
          return 'Project name can only contain letters, numbers, dashes, and underscores';
        }
        return null;
      }
    });

    if (!projectName) {
      logger.info('User cancelled project name input');
      return;
    }

    const projectPath = path.join(parentPath, projectName);

    // Step 4: Build the project using the NEW ProjectBuilderAgent
    logger.info('Starting project build with ProjectBuilderAgent...');
    
    const agent = new ProjectBuilderAgent();
    const result = await agent.buildProject(userPrompt, projectPath);

    if (result.success) {
      logger.info('✅ Project generated successfully!');
      
      vscode.window.showInformationMessage(
        `✅ Project "${projectName}" created successfully!`,
        'Open Project',
        'Open in Terminal'
      ).then(action => {
        if (action === 'Open Project') {
          vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
        } else if (action === 'Open in Terminal') {
          const terminal = vscode.window.createTerminal({
            name: projectName,
            cwd: projectPath
          });
          terminal.show();
          terminal.sendText('npm run dev');
        }
      });
    } else {
      logger.error('Project generation failed:', result.error);
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
      `❌ Failed to generate project: ${error.message}`,
      'View Logs'
    ).then(action => {
      if (action === 'View Logs') {
        logger.show();
      }
    });
  }
}

module.exports = generateProject;
