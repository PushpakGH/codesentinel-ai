/**
 * Command Validator - Production-Grade Security
 * Prevents execution of dangerous commands
 */

const { logger } = require('./logger');

// Comprehensive blacklist of dangerous patterns
const DANGEROUS_PATTERNS = [
  // Destructive file operations
  /rm\s+-[rf]+/i,              // rm -rf, rm -fr
  /rm\s+--recursive/i,         // rm --recursive
  /rmdir\s+\/s/i,              // Windows rmdir /s
  /del\s+\/[fs]/i,             // Windows del /f /s
  /format\s+[a-z]:/i,          // Windows format C:
  
  // Command chaining (can bypass other checks)
  /[;&|`]/,                    // ; & | ` for chaining
  /\$\(/,                      // $(command)
  /\|\|/,                      // || logical OR
  /&&/,                        // && logical AND
  
  // Remote execution
  /curl.*\|.*bash/i,           // curl | bash
  /wget.*\|.*sh/i,             // wget | sh
  /powershell/i,               // PowerShell
  /pwsh/i,                     // PowerShell Core
  
  // System modification
  /sudo/i,                     // sudo elevation
  /chmod\s+777/i,              // Dangerous permissions
  /chown\s+root/i,             // Change to root
  
  // Process manipulation
  /kill\s+-9/i,                // Force kill
  /pkill/i,                    // Kill by name
  /taskkill/i,                 // Windows task kill
  
  // Network/Download
  /nc\s+-/i,                   // netcat
  /ncat/i,                     // ncat
  /\/dev\/tcp/i,               // TCP redirection
  
  // File system traversal
  /\.\.\//,                    // Directory traversal
  /~\//                        // Home directory access
];

// Whitelist of allowed command prefixes
const ALLOWED_COMMANDS = [
  'npm',
  'npx',
  'node',
  'git',
  'yarn',
  'pnpm'
];

/**
 * Validate command safety
 * @param {string} command - Command to validate
 * @returns {Object} { safe: boolean, reason?: string }
 */
function validateCommand(command) {
  // 1. Check for empty or suspicious commands
  if (!command || typeof command !== 'string') {
    return { safe: false, reason: 'Invalid command format' };
  }

  const trimmedCommand = command.trim();
  
  if (trimmedCommand.length === 0) {
    return { safe: false, reason: 'Empty command' };
  }

  // 2. Check against dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmedCommand)) {
      logger.warn(`🚨 BLOCKED DANGEROUS COMMAND: ${trimmedCommand}`);
      return { 
        safe: false, 
        reason: `Blocked: matches dangerous pattern ${pattern}` 
      };
    }
  }

  // 3. Verify command starts with allowed prefix
  const commandPrefix = trimmedCommand.split(' ')[0].toLowerCase();
  const isAllowed = ALLOWED_COMMANDS.some(allowed => 
    commandPrefix === allowed || commandPrefix.startsWith(allowed + '@')
  );

  if (!isAllowed) {
    logger.warn(`⚠️ BLOCKED UNKNOWN COMMAND: ${commandPrefix}`);
    return { 
      safe: false, 
      reason: `Command '${commandPrefix}' not in whitelist` 
    };
  }

  // 4. Additional validation for npm/npx commands
  if (commandPrefix === 'npm' || commandPrefix === 'npx') {
    // Block npm scripts that might contain dangerous code
    if (trimmedCommand.includes('preinstall') || 
        trimmedCommand.includes('postinstall')) {
      return { 
        safe: false, 
        reason: 'npm lifecycle scripts blocked for security' 
      };
    }
  }

  // 5. Check for excessive length (potential buffer overflow)
  if (trimmedCommand.length > 2000) {
    return { 
      safe: false, 
      reason: 'Command exceeds maximum length' 
    };
  }

  // ✅ Command passed all checks
  logger.debug(`✅ Command validated: ${trimmedCommand.substring(0, 100)}...`);
  return { safe: true };
}

/**
 * Sanitize user input for use in commands
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  // Remove dangerous characters
  return input
    .replace(/[;&|`$(){}[\]<>]/g, '')  // Command injection chars
    .replace(/\.\.\//g, '')             // Path traversal
    .trim();
}

module.exports = {
  validateCommand,
  sanitizeInput,
  ALLOWED_COMMANDS,
  DANGEROUS_PATTERNS
};
