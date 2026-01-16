/**
 * Promisified exec utility for running shell commands
 */

const { exec } = require('child_process');
const util = require('util');

/**
 * Execute a command asynchronously
 * @param {string} command - The command to run
 * @param {Object} options - Options (cwd, timeout, etc.)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
const execAsync = util.promisify(exec);

module.exports = { execAsync };
