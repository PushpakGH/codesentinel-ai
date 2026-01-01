/**
 * File System Manager
 * Secure file operations with path traversal prevention
 * Follows VS Code extension best practices
 */

const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

// Dangerous operations that are NEVER allowed
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /rmdir\s+\/s/i,
  /del\s+\/s/i,
  /format\s+c:/i,
  /dd\s+if=/i,
  /:\(\)\{.*\|.*&\}/, // Fork bomb
  />\s*\/dev\/(sda|hda|null)/i,
  /curl.*\|\s*sh/i,
  /wget.*\|\s*sh/i
];

// Allowed file extensions for project files
const ALLOWED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx',
  '.json', '.html', '.css', '.scss',
  '.md', '.txt', '.env.example',
  '.gitignore', '.prettierrc', '.eslintrc'
];

// Blacklisted paths (never write here)
const BLACKLISTED_PATHS = [
  'node_modules',
  '.git',
  '.vscode/settings.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

/**
 * Validate and sanitize file path
 * Prevents path traversal attacks
 */
function sanitizePath(basePath, userPath) {
  const cleaned = userPath.replace(/\0/g, '');
  const fullPath = path.resolve(basePath, cleaned);

  if (!fullPath.startsWith(basePath)) {
    throw new Error(`Path traversal detected: ${userPath}`);
  }

  const relativePath = path.relative(basePath, fullPath);
  for (const blacklisted of BLACKLISTED_PATHS) {
    if (relativePath.startsWith(blacklisted)) {
      throw new Error(`Access denied to protected path: ${blacklisted}`);
    }
  }

  return fullPath;
}

/**
 * Validate file content for dangerous commands
 */
function validateContent(content, filePath) {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      logger.error(`Dangerous pattern detected in ${filePath}:`, pattern);
      throw new Error('Security violation: Dangerous command pattern detected');
    }
  }

  const ext = path.extname(filePath);
  if (!ALLOWED_EXTENSIONS.includes(ext) && ext !== '') {
    logger.warn(`Unusual file extension: ${ext}`);
  }

  return true;
}

/**
 * Safely create directory (recursive)
 */
async function createDirectory(basePath, dirPath) {
  try {
    const safePath = sanitizePath(basePath, dirPath);

    logger.debug(`Creating directory: ${safePath}`);

    await fs.mkdir(safePath, { recursive: true });

    logger.info(`✅ Created directory: ${path.relative(basePath, safePath)}`);

    return safePath;
  } catch (error) {
    logger.error(`Failed to create directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Safely write file
 */
async function writeFile(basePath, filePath, content) {
  try {
    const safePath = sanitizePath(basePath, filePath);

    validateContent(content, safePath);

    const dir = path.dirname(safePath);
    await fs.mkdir(dir, { recursive: true });

    logger.debug(`Writing file: ${safePath}`);

    await fs.writeFile(safePath, content, 'utf-8');

    logger.info(`✅ Created file: ${path.relative(basePath, safePath)}`);

    return safePath;
  } catch (error) {
    logger.error(`Failed to write file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Safely read file
 */
async function readFile(basePath, filePath) {
  try {
    const safePath = sanitizePath(basePath, filePath);

    logger.debug(`Reading file: ${safePath}`);

    const content = await fs.readFile(safePath, 'utf-8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn(`File not found: ${filePath}`);
      return null;
    }
    logger.error(`Failed to read file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Check if file/directory exists
 */
async function exists(basePath, targetPath) {
  try {
    const safePath = sanitizePath(basePath, targetPath);
    await fs.access(safePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files in directory
 */
async function listFiles(basePath, dirPath = '.') {
  try {
    const safePath = sanitizePath(basePath, dirPath);

    const entries = await fs.readdir(safePath, { withFileTypes: true });

    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      path: path.join(dirPath, entry.name)
    }));
  } catch (error) {
    logger.error(`Failed to list files in ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Batch write multiple files
 */
async function writeFiles(basePath, files) {
  const results = {
    success: [],
    failed: [],
    total: files.length
  };

  for (const file of files) {
    try {
      await writeFile(basePath, file.path, file.content);
      results.success.push(file.path);
    } catch (error) {
      results.failed.push({
        path: file.path,
        error: error.message
      });
    }
  }

  logger.info(
    `Batch write complete: ${results.success.length}/${results.total} succeeded`
  );

  return results;
}

/**
 * Copy file
 */
async function copyFile(basePath, sourcePath, destPath) {
  try {
    const safeSrc = sanitizePath(basePath, sourcePath);
    const safeDest = sanitizePath(basePath, destPath);

    logger.debug(`Copying ${sourcePath} to ${destPath}`);

    await fs.copyFile(safeSrc, safeDest);

    logger.info(`✅ Copied: ${path.relative(basePath, safeDest)}`);

    return safeDest;
  } catch (error) {
    logger.error('Failed to copy file:', error);
    throw error;
  }
}

/**
 * Get project workspace folder
 */
function getWorkspaceFolder() {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder open. Please open a folder first.');
  }

  return workspaceFolders[0].uri.fsPath;
}

/**
 * Validate project path is safe
 */
function validateProjectPath(projectPath) {
  if (!path.isAbsolute(projectPath)) {
    throw new Error('Project path must be absolute');
  }

  const workspacePath = getWorkspaceFolder();
  const homePath = require('os').homedir();

  if (
    !projectPath.startsWith(workspacePath) &&
    !projectPath.startsWith(homePath)
  ) {
    throw new Error('Project path must be within workspace or home directory');
  }

  return true;
}

module.exports = {
  sanitizePath,
  validateContent,
  createDirectory,
  writeFile,
  readFile,
  exists,
  listFiles,
  writeFiles,
  copyFile,
  getWorkspaceFolder,
  validateProjectPath
};
