/**
 * Command Runner Utility
 * Shared logic for executing shell commands validation and safety checks.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { logger } = require('./logger');

/**
 * Run shell command with error handling and safety checks
 * @param {string} command - The command to run
 * @param {string} cwd - Current working directory
 * @param {string} description - Description for logging
 * @returns {Promise<{success: boolean, stdout: string, stderr: string, error?: any}>}
 */
async function runCommand(command, cwd, description) {
  logger.info(`Running: ${description}`);
  logger.debug(`Command: ${command}`);

  // Basic Safety Check
  if (/\brm\s+-rf\b/i.test(command)) {
    throw new Error(`Blocked potentially unsafe command: ${command}`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 180000, // 3 minutes timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: { ...process.env, FORCE_COLOR: '0' } // Ensure no color codes in output parsing
    });

    if (stderr && !stderr.includes('npm notice') && !stderr.includes('deprecated')) {
      logger.warn(`stderr: ${stderr}`);
    }

    return { success: true, stdout, stderr };
  } catch (error) {
    logger.error(`${description} failed:`, {
      code: error.code,
      killed: error.killed,
      signal: error.signal,
      cmd: error.cmd,
      stdout: error.stdout,
      stderr: error.stderr,
    });
    return { success: false, error };
  }
}

module.exports = { runCommand };
