/**
 * Git Service - Git Operations Handler
 * Handles git diff parsing and SCM integration
 */

let vscode;
try {
  vscode = require('vscode');
} catch (e) {
  vscode = null;
}
const { exec } = require('child_process');
const { promisify } = require('util');
const { logger } = require('../utils/logger');
const path = require('path');

const execAsync = promisify(exec);

class GitService {
  constructor() {
    this.gitExtension = null;
  }

  /**
   * Initialize Git extension API
   * @private
   */
  _initializeGitExtension() {
    if (this.gitExtension) {
      return this.gitExtension;
    }

    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension) {
        throw new Error('Git extension not found');
      }

      if (!gitExtension.isActive) {
        throw new Error('Git extension not activated');
      }

      this.gitExtension = gitExtension.exports.getAPI(1);
      return this.gitExtension;
    } catch (error) {
      logger.error('Failed to initialize Git extension:', error);
      throw error;
    }
  }

  /**
   * Get the first repository from workspace
   * @returns {Promise<object|null>}
   */
  async getRepository() {
    try {
      const git = this._initializeGitExtension();
      
      if (!git || git.repositories.length === 0) {
        throw new Error('No Git repository found. Initialize a repository first.');
      }

      return git.repositories[0];
    } catch (error) {
      logger.error('Failed to get repository:', error);
      throw error;
    }
  }

  /**
   * Get staged changes diff
   * @returns {Promise<string>}
   */
  async getStagedDiff() {
    try {
      const repo = await this.getRepository();
      const workspaceRoot = repo.rootUri.fsPath;

      // Get staged changes using git command
      const { stdout, stderr } = await execAsync('git diff --cached', {
        cwd: workspaceRoot,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      if (stderr) {
        logger.warn('Git diff stderr:', stderr);
      }

      if (!stdout || stdout.trim().length === 0) {
        throw new Error('No staged changes found. Stage files with "git add" first.');
      }

      return stdout;
    } catch (error) {
      if (error.message.includes('No staged changes')) {
        throw error;
      }
      logger.error('Failed to get staged diff:', error);
      throw new Error(`Git diff failed: ${error.message}`);
    }
  }

  /**
   * Get list of staged files
   * @returns {Promise<string[]>}
   */
  async getStagedFiles() {
    try {
      const repo = await this.getRepository();
      const workspaceRoot = repo.rootUri.fsPath;

      const { stdout } = await execAsync('git diff --cached --name-only', {
        cwd: workspaceRoot
      });

      return stdout.trim().split('\n').filter(f => f.length > 0);
    } catch (error) {
      logger.error('Failed to get staged files:', error);
      return [];
    }
  }

  /**
   * Set commit message in SCM input box
   * @param {string} message - Commit message to set
   */
  async setCommitMessage(message) {
    try {
      const repo = await this.getRepository();
      
      // Set the input box value
      repo.inputBox.value = message;
      
      logger.info('Commit message set in SCM input box');
    } catch (error) {
      logger.error('Failed to set commit message:', error);
      throw new Error(`Failed to prefill commit message: ${error.message}`);
    }
  }

  /**
   * Parse diff to extract meaningful changes
   * @param {string} diff - Git diff output
   * @returns {object}
   */
  parseDiff(diff) {
    const lines = diff.split('\n');
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    const changedFiles = [];
    let currentFile = null;

    for (const line of lines) {
      // Track files
      if (line.startsWith('diff --git')) {
        filesChanged++;
        const match = line.match(/b\/(.+)$/);
        if (match) {
          currentFile = match[1];
          changedFiles.push(currentFile);
        }
      }

      // Track insertions/deletions
      if (line.startsWith('+') && !line.startsWith('+++')) {
        insertions++;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return {
      filesChanged,
      insertions,
      deletions,
      changedFiles,
      totalChanges: insertions + deletions
    };
  }

  /**
   * Get common folder/scope from changed files
   * @param {string[]} files
   * @returns {string}
   */
  inferScope(files) {
    if (!files || files.length === 0) {
      return '';
    }

    // Extract first directory from each file
    const dirs = files.map(f => {
      const parts = f.split('/');
      return parts.length > 1 ? parts[0] : path.basename(f, path.extname(f));
    });

    // Find most common directory
    const dirCounts = {};
    dirs.forEach(dir => {
      dirCounts[dir] = (dirCounts[dir] || 0) + 1;
    });

    const mostCommon = Object.keys(dirCounts).sort((a, b) => dirCounts[b] - dirCounts[a])[0];
    return mostCommon || '';
  }

  /**
   * Check if Git is initialized in workspace
   * @returns {Promise<boolean>}
   */
  async isGitRepository() {
    try {
      await this.getRepository();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton
module.exports = new GitService();
