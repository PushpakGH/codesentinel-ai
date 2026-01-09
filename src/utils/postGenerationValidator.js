const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Post-Generation Validator
 * Checks generated project for common issues before declaring success
 */
class PostGenerationValidator {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  /**
   * Run all validation checks
   */
  async validateProject() {
    const errors = [];
    
    try {
      // 1. Check for duplicate default exports
      const duplicateExports = await this.checkDuplicateExports();
      errors.push(...duplicateExports);
      
      // 2. Check for placeholder code
      const placeholders = await this.checkForPlaceholders();
      errors.push(...placeholders);
      
      // 3. Check for incomplete files
      const incompleteFiles = await this.checkIncompleteFiles();
      errors.push(...incompleteFiles);
      
    } catch (error) {
      logger.error('Validation error:', error.message);
      errors.push(`Validation failed: ${error.message}`);
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Helper: Recursive file finder (replaces glob)
   */
  async findFiles(dir, pattern) {
    let results = [];
    try {
      const list = await fs.readdir(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat && stat.isDirectory()) {
          if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
            results = results.concat(await this.findFiles(filePath, pattern));
          }
        } else {
          // Simple extension check
          if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            // Check if file is in app folder if needed
            if (filePath.includes('app')) {
                results.push(filePath);
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors for non-existent dirs
    }
    return results;
  }

  /**
   * Check for duplicate default exports
   */
  async checkDuplicateExports() {
    const errors = [];
    
    try {
      const files = await this.findFiles(this.projectPath);
      
      for (const file of files) {
        const code = await fs.readFile(file, 'utf-8');
        const exportMatches = code.match(/export\s+default/g) || [];
        
        if (exportMatches.length > 1) {
          errors.push(`❌ ${path.relative(this.projectPath, file)}: Has ${exportMatches.length} default exports!`);
        }
      }
    } catch (error) {
      logger.warn('Could not check duplicate exports:', error.message);
    }
    
    return errors;
  }

  /**
   * Check for placeholder code
   */
  async checkForPlaceholders() {
    const errors = [];
    
    try {
      const files = await this.findFiles(this.projectPath);
      
      const placeholderPatterns = [
        /Placeholder\s+for/i,
        /TODO:/,
        /<div>Coming soon<\/div>/i,
        /return\s+null;\s*}\s*$/  // Empty component returning null
      ];
      
      for (const file of files) {
        const code = await fs.readFile(file, 'utf-8');
        
        for (const pattern of placeholderPatterns) {
          if (pattern.test(code)) {
            errors.push(`❌ ${path.relative(this.projectPath, file)}: Contains placeholder code!`);
            break;
          }
        }
      }
    } catch (error) {
      logger.warn('Could not check placeholders:', error.message);
    }
    
    return errors;
  }

  /**
   * Check for incomplete/truncated files
   */
  async checkIncompleteFiles() {
    const errors = [];
    
    try {
      const files = await this.findFiles(this.projectPath);
      
      for (const file of files) {
        const code = await fs.readFile(file, 'utf-8');
        
        // Check for unbalanced braces
        const openBraces = (code.match(/\{/g) || []).length;
        const closeBraces = (code.match(/\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
          errors.push(`❌ ${path.relative(this.projectPath, file)}: Unbalanced braces (${openBraces} open, ${closeBraces} close)`);
        }
        
        // Check for files ending mid-statement
        if (code.trim().endsWith(',') || code.trim().endsWith('+')) {
          errors.push(`❌ ${path.relative(this.projectPath, file)}: File appears truncated (ends with incomplete statement)`);
        }
      }
    } catch (error) {
      logger.warn('Could not check incomplete files:', error.message);
    }
    
    return errors;
  }
}

module.exports = PostGenerationValidator;
