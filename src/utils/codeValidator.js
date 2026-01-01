/**
 * Code Validator & Sanitizer
 * Validates AI-generated code before writing to files
 */

const { logger } = require('./logger');
const path = require('path');
const fs = require('fs').promises;

class CodeValidator {
  /**
   * Banned imports for client-side code
   */
  static BANNED_CLIENT_IMPORTS = [
    'fs', 'path', 'child_process', 'os', 'net', 'http', 'https',
    'tailwindcss', 'postcss', 'webpack', 'next/config'
  ];

  /**
   * Extract clean code from AI response
   */
  static extractCode(aiResponse) {
    logger.debug('Extracting code from AI response...');

    const codeBlockRegex = /```(?:typescript|tsx|javascript|jsx)?\s*\n([\s\S]*?)```/g;
    const matches = [];
    let match;

    while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length === 0) {
      logger.warn('No code blocks found, using raw response');
      return aiResponse.trim();
    }

    const largestBlock = matches.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    );

    logger.debug(`Extracted code block (${largestBlock.length} chars)`);
    return largestBlock.trim();
  }

  /**
   * Extract imports from code
   */
  static extractImports(code) {
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const imports = [];
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Check if component file exists
   */
  static async verifyComponentPaths(code, projectPath) {
    const imports = this.extractImports(code);
    const missingComponents = [];

    for (const importPath of imports) {
      // Only check local imports starting with @/
      if (importPath.startsWith('@/')) {
        const relativePath = importPath.replace('@/', '');
        
        // Try common extensions
        const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css'];
        let found = false;

        for (const ext of extensions) {
          const fullPath = path.join(projectPath, relativePath + ext);
          try {
            await fs.access(fullPath);
            found = true;
            break;
          } catch {
            // File doesn't exist, try next extension
          }
        }

        if (!found) {
          missingComponents.push(importPath);
        }
      }
    }

    return missingComponents;
  }

  /**
   * Validate TypeScript/JSX syntax
   */
  static validateSyntax(code, filename = 'component.tsx') {
    const errors = [];

    try {
      // 1. Check for "use client" directive
      const hasUseClient = /['"]use client['"]/.test(code);

      // 2. Check for banned imports in client components
      if (hasUseClient) {
        const bannedImportsFound = this.BANNED_CLIENT_IMPORTS.filter(pkg => {
          const importRegex = new RegExp(`from\\s+['"]${pkg}['"]`, 'i');
          const requireRegex = new RegExp(`require\\s*\\(['"]${pkg}['"]\\)`, 'i');
          return importRegex.test(code) || requireRegex.test(code);
        });

        if (bannedImportsFound.length > 0) {
          errors.push({
            type: 'ENVIRONMENT_LEAK',
            message: `Client component imports server-only modules: ${bannedImportsFound.join(', ')}`,
            severity: 'error'
          });
        }
      }

      // 3. Count JSX tags (rough validation)
      const openTags = (code.match(/<\w+[^/>]*>/g) || []).length;
      const closeTags = (code.match(/<\/\w+>/g) || []).length;
      const selfClosing = (code.match(/<\w+[^>]*\/>/g) || []).length;

      if (openTags !== closeTags + selfClosing) {
        errors.push({
          type: 'JSX_ERROR',
          message: `Unmatched JSX tags: ${openTags} opening, ${closeTags} closing, ${selfClosing} self-closing`,
          severity: 'warning'
        });
      }

      // 4. Auto-fix common errors
      let fixedCode = code;
      
      // Fix missing semicolons
      fixedCode = fixedCode.replace(/(const\s+\w+\s+=\s+{[\s\S]*?})\s*(?=\n\s*(?:const|let|var|function|export|import))/gm, '$1;');
      
      // Fix empty imports
      fixedCode = fixedCode.replace(/import\s+{\s*}\s+from\s+['""][^'"]+['"]\s*;?\s*/g, '');

      return {
        valid: errors.filter(e => e.severity === 'error').length === 0,
        errors,
        fixed: fixedCode,
        warnings: errors.filter(e => e.severity === 'warning').length
      };

    } catch (error) {
      logger.error('Syntax validation failed:', error);
      return {
        valid: false,
        errors: [{
          type: 'VALIDATION_FAILED',
          message: error.message,
          severity: 'error'
        }],
        fixed: code,
        warnings: 0
      };
    }
  }

  /**
   * Remove non-existent component imports
   */
  static removeNonExistentImports(code, missingComponents) {
    let fixedCode = code;

    for (const missing of missingComponents) {
      // Remove the entire import line
      const importRegex = new RegExp(`import\\s+.*?\\s+from\\s+['"]${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"];?\\s*\n?`, 'gm');
      fixedCode = fixedCode.replace(importRegex, '');
    }

    return fixedCode;
  }

  /**
   * Comprehensive validation pipeline
   */
  static async validate(aiResponse, componentName, filename, projectPath = null) {
    logger.info(`🔍 Validating generated code for ${componentName}...`);

    // Step 1: Extract code
    const extracted = this.extractCode(aiResponse);
    if (!extracted) {
      return {
        success: false,
        error: 'Could not extract code from AI response'
      };
    }

    // Step 2: Check for missing components (if projectPath provided)
    let missingComponents = [];
    if (projectPath) {
      missingComponents = await this.verifyComponentPaths(extracted, projectPath);
      
      if (missingComponents.length > 0) {
        logger.warn(`⚠️  Found ${missingComponents.length} missing component(s):`);
        missingComponents.forEach(comp => logger.warn(`   - ${comp}`));
      }
    }

    // Step 3: Syntax validation
    const validation = this.validateSyntax(extracted, filename);
    
    // Step 4: Remove non-existent imports
    let finalCode = validation.fixed;
    if (missingComponents.length > 0) {
      finalCode = this.removeNonExistentImports(finalCode, missingComponents);
      logger.info(`🔧 Removed ${missingComponents.length} non-existent import(s)`);
    }

    // Step 5: Log results
    if (validation.errors.length > 0) {
      logger.warn(`Found ${validation.errors.length} issues:`);
      validation.errors.forEach(err => {
        logger.warn(`  [${err.severity.toUpperCase()}] ${err.type}: ${err.message}`);
      });
    }

    if (!validation.valid) {
      return {
        success: false,
        error: 'Code contains critical errors',
        details: validation.errors.filter(e => e.severity === 'error')
      };
    }

    logger.info(`✅ Code validation passed (${validation.warnings} warnings)`);

    return {
      success: true,
      code: finalCode,
      warnings: validation.errors.filter(e => e.severity === 'warning'),
      lineCount: finalCode.split('\n').length,
      removedImports: missingComponents
    };
  }
}

module.exports = CodeValidator;
