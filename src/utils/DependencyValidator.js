/**
 * DependencyValidator.js - Validate and Auto-Install Missing Dependencies
 * ========================================================================
 * 
 * Ensures all require() and import statements reference installed packages.
 * Auto-installs missing dependencies before build.
 * 
 * Based on Issue #2 from user feedback:
 * - Config files referencing packages not in package.json
 * - tailwindcss-animate and other plugins not installed
 * 
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

/**
 * Built-in Node.js modules that don't need installation
 */
const BUILTIN_MODULES = new Set([
  'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util',
  'stream', 'events', 'buffer', 'child_process', 'cluster',
  'dns', 'net', 'readline', 'tls', 'dgram', 'vm', 'zlib',
  'assert', 'querystring', 'string_decoder', 'timers', 'tty'
]);

/**
 * Packages that are implicitly available in Next.js projects
 */
const IMPLICIT_PACKAGES = new Set([
  'react', 'react-dom', 'next', 'typescript', 'eslint',
  'postcss', 'autoprefixer'
]);

/**
 * Config files that should be validated for dependencies
 */
const CONFIG_FILES = [
  'tailwind.config.ts',
  'tailwind.config.js', 
  'next.config.js',
  'next.config.ts',
  'postcss.config.js',
  'postcss.config.mjs'
];

/**
 * Validates and fixes missing dependencies
 */
class DependencyValidator {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.installedDeps = new Set();
    this.packageJsonPath = path.join(projectPath, 'package.json');
  }
  
  /**
   * Initialize by reading package.json
   */
  async initialize() {
    try {
      const content = await fs.readFile(this.packageJsonPath, 'utf8');
      const packageJson = JSON.parse(content);
      
      const deps = Object.keys(packageJson.dependencies || {});
      const devDeps = Object.keys(packageJson.devDependencies || {});
      
      this.installedDeps = new Set([...deps, ...devDeps]);
      logger.info(`DependencyValidator: Found ${this.installedDeps.size} installed packages`);
      
      return true;
    } catch (error) {
      logger.warn('DependencyValidator: Could not read package.json', error.message);
      return false;
    }
  }
  
  /**
   * Extract package name from import path
   * Handles: 'package', '@scope/package', 'package/subpath'
   */
  extractPackageName(importPath) {
    if (!importPath || typeof importPath !== 'string') return null;
    
    // Skip local paths
    if (importPath.startsWith('.') || importPath.startsWith('@/') || importPath.startsWith('~/')) {
      return null;
    }
    
    // Handle scoped packages (@scope/package)
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      if (parts.length >= 2) {
        return parts.slice(0, 2).join('/');
      }
      return importPath;
    }
    
    // Regular package (take first part before /)
    return importPath.split('/')[0];
  }
  
  /**
   * Check if a package is installed
   */
  isInstalled(pkgName) {
    if (!pkgName) return true;
    return (
      this.installedDeps.has(pkgName) ||
      BUILTIN_MODULES.has(pkgName) ||
      IMPLICIT_PACKAGES.has(pkgName)
    );
  }
  
  /**
   * Find require() and import statements in file content
   */
  findDependencies(fileContent) {
    const deps = new Set();
    
    // Match require('package') and require("package")
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    
    while ((match = requirePattern.exec(fileContent)) !== null) {
      const pkgName = this.extractPackageName(match[1]);
      if (pkgName) deps.add(pkgName);
    }
    
    // Match import ... from 'package'
    const importPattern = /from\s+['"]([^'"]+)['"]/g;
    while ((match = importPattern.exec(fileContent)) !== null) {
      const pkgName = this.extractPackageName(match[1]);
      if (pkgName) deps.add(pkgName);
    }
    
    // Match import 'package' (side-effect imports)
    const sideEffectPattern = /import\s+['"]([^'"]+)['"]/g;
    while ((match = sideEffectPattern.exec(fileContent)) !== null) {
      const pkgName = this.extractPackageName(match[1]);
      if (pkgName) deps.add(pkgName);
    }
    
    return Array.from(deps);
  }
  
  /**
   * Validate a file and return missing dependencies
   */
  async validateFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const deps = this.findDependencies(content);
      
      const missing = deps.filter(dep => !this.isInstalled(dep));
      
      if (missing.length > 0) {
        logger.warn(`DependencyValidator: Missing in ${path.basename(filePath)}: ${missing.join(', ')}`);
      }
      
      return missing;
    } catch (error) {
      // File doesn't exist, skip
      return [];
    }
  }
  
  /**
   * Validate all config files in the project
   */
  async validateConfigFiles() {
    const allMissing = [];
    
    for (const configFile of CONFIG_FILES) {
      const filePath = path.join(this.projectPath, configFile);
      const missing = await this.validateFile(filePath);
      allMissing.push(...missing);
    }
    
    // Deduplicate
    return [...new Set(allMissing)];
  }
  
  /**
   * Validate a code file (page, component)
   */
  async validateCodeFile(filePath) {
    return this.validateFile(filePath);
  }
  
  /**
   * Get install command for missing packages
   */
  getInstallCommand(missingPackages) {
    if (missingPackages.length === 0) return null;
    return `npm install ${missingPackages.join(' ')}`;
  }
}

/**
 * Validate and fix dependencies for a project
 * @param {string} projectPath - Path to the project
 * @param {Function} runCommand - Function to run shell commands
 * @returns {Promise<{success: boolean, installed: string[]}>}
 */
async function validateAndFixDependencies(projectPath, runCommand) {
  const validator = new DependencyValidator(projectPath);
  const initialized = await validator.initialize();
  
  if (!initialized) {
    return { success: false, installed: [] };
  }
  
  const missing = await validator.validateConfigFiles();
  
  if (missing.length > 0) {
    logger.info(`Installing missing dependencies: ${missing.join(', ')}`);
    const cmd = validator.getInstallCommand(missing);
    
    if (runCommand) {
      const result = await runCommand(cmd, projectPath, 'Installing missing deps');
      return { success: result.success, installed: missing };
    }
  }
  
  return { success: true, installed: [] };
}

module.exports = {
  DependencyValidator,
  validateAndFixDependencies,
  BUILTIN_MODULES,
  IMPLICIT_PACKAGES,
  CONFIG_FILES
};
