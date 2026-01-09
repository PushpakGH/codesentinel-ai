const fs = require('fs').promises;
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const { logger } = require('../utils/logger');

/**
 * Component Catalog Service
 * Reads installed component files and extracts TypeScript interfaces
 * to provide accurate prop information to the code generator
 */
class ComponentCatalog {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.catalog = {};
  }

  /**
   * Build catalog from installed components
   * @param {Object} installedComponents - Map of registry -> component names
   * @returns {Promise<Object>} Catalog with component metadata
   */
  async buildCatalog(installedComponents) {
    logger.info('📚 Building Component Catalog...');
    
    for (const [registry, components] of Object.entries(installedComponents)) {
      if (!Array.isArray(components)) continue;
      
      for (const comp of components) {
        const componentName = typeof comp === 'string' ? comp : comp.name;
        
        try {
          const metadata = await this.extractComponentMetadata(componentName);
          
          if (metadata) {
            const key = `${registry}/${componentName}`;
            this.catalog[key] = {
              name: componentName,
              registry,
              path: metadata.importPath,
              props: metadata.props,
              exports: metadata.exports,
              example: this.generateExample(componentName, metadata.props)
            };
            
            logger.debug(`✅ Cataloged: ${key}`);
          }
        } catch (error) {
          logger.warn(`Failed to catalog ${componentName}:`, error.message);
        }
      }
    }
    
    logger.info(`📚 Catalog complete: ${Object.keys(this.catalog).length} components`);
    return this.catalog;
  }

  /**
   * Extract metadata from a component file
   * @param {string} componentName 
   * @returns {Promise<Object>}
   */
  async extractComponentMetadata(componentName) {
    const componentPath = this.resolveComponentPath(componentName);
    
    if (!componentPath) {
      logger.debug(`Component file not found: ${componentName}`);
      return null;
    }
    
    const code = await fs.readFile(componentPath, 'utf-8');
    const ast = this.parseComponent(code);
    
    if (!ast) return null;
    
    const metadata = {
      importPath: '@/components/ui/' + path.basename(componentPath, path.extname(componentPath)),
      props: {},
      exports: [],
      defaultExport: null,
      namedExports: []
    };
    
    // Extract TypeScript interface/type definitions AND exports
    traverse(ast, {
      TSInterfaceDeclaration: (path) => {
        const interfaceName = path.node.id.name;
        
        // Look for Props interfaces (e.g., ButtonProps, InputProps)
        if (interfaceName.toLowerCase().includes('prop')) {
          metadata.props = this.extractPropsFromInterface(path.node);
        }
      },
      
      TSTypeAliasDeclaration: (path) => {
        const typeName = path.node.id.name;
        
        if (typeName.toLowerCase().includes('prop')) {
          metadata.props = this.extractPropsFromType(path.node);
        }
      },
      
      // CRITICAL FIX: Extract ACTUAL export names
      ExportDefaultDeclaration: (path) => {
        // Case 1: export default function ComponentName() {}
        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          metadata.defaultExport = path.node.declaration.id.name;
        }
        // Case 2: export default ComponentName
        else if (t.isIdentifier(path.node.declaration)) {
          metadata.defaultExport = path.node.declaration.name;
        }
        // Case 3: export default forwardRef<...>((props) => {...})
        // Use filename → PascalCase as fallback
        else {
          metadata.defaultExport = this.filenameToPascalCase(componentName);
        }
      },
      
      ExportNamedDeclaration: (path) => {
        // Case 1: export function ComponentName() {}
        if (path.node.declaration) {
          if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
            metadata.namedExports.push(path.node.declaration.id.name);
          }
          // export const ComponentName = ...
          else if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach(decl => {
              if (t.isIdentifier(decl.id)) {
                metadata.namedExports.push(decl.id.name);
              }
            });
          }
        }
        // Case 2: export { Component1, Component2 }
        else if (path.node.specifiers) {
          path.node.specifiers.forEach(spec => {
            if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
              metadata.namedExports.push(spec.exported.name);
            }
          });
        }
      }
    });
    
    // Build exports list (prioritize default, then named)
    if (metadata.defaultExport) {
      metadata.exports.push(metadata.defaultExport);
    }
    metadata.exports.push(...metadata.namedExports);
    
    return metadata;
  }

  /**
   * Convert kebab-case filename to PascalCase
   * @param {string} filename 
   * @returns {string}
   */
  filenameToPascalCase(filename) {
    return filename
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Resolve component file path
   * @param {string} componentName 
   * @returns {string|null}
   */
  resolveComponentPath(componentName) {
    const basePath = path.join(this.projectPath, 'components', 'ui');
    const possiblePaths = [
      path.join(basePath, `${componentName}.tsx`),
      path.join(basePath, `${componentName}.ts`),
      path.join(basePath, componentName, 'index.tsx'),
      path.join(basePath, componentName, 'index.ts')
    ];
    
    for (const p of possiblePaths) {
      try {
        if (require('fs').existsSync(p)) return p;
      } catch {}
    }
    
    return null;
  }

  /**
   * Parse component file to AST
   * @param {string} code 
   * @returns {Object|null}
   */
  parseComponent(code) {
    try {
      return parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
    } catch (error) {
      logger.warn('Failed to parse component:', error.message);
      return null;
    }
  }

  /**
   * Extract props from TypeScript interface
   * @param {Object} node 
   * @returns {Object}
   */
  extractPropsFromInterface(node) {
    const props = {};
    
    if (node.body && node.body.body) {
      for (const prop of node.body.body) {
        if (t.isTSPropertySignature(prop) && t.isIdentifier(prop.key)) {
          const propName = prop.key.name;
          const isOptional = prop.optional || false;
          const propType = this.extractTypeName(prop.typeAnnotation);
          
          props[propName] = {
            type: propType,
            required: !isOptional
          };
        }
      }
    }
    
    return props;
  }

  /**
   * Extract props from TypeScript type alias
   * @param {Object} node 
   * @returns {Object}
   */
  extractPropsFromType(node) {
    // Simplified - handle object types
    if (t.isTSTypeLiteral(node.typeAnnotation)) {
      return this.extractPropsFromInterface({ body: node.typeAnnotation });
    }
    return {};
  }

  /**
   * Extract type name from type annotation
   * @param {Object} typeAnnotation 
   * @returns {string}
   */
  extractTypeName(typeAnnotation) {
    if (!typeAnnotation) return 'any';
    
    const annotation = typeAnnotation.typeAnnotation;
    
    if (t.isTSStringKeyword(annotation)) return 'string';
    if (t.isTSNumberKeyword(annotation)) return 'number';
    if (t.isTSBooleanKeyword(annotation)) return 'boolean';
    if (t.isTSAnyKeyword(annotation)) return 'any';
    if (t.isTSTypeReference(annotation) && t.isIdentifier(annotation.typeName)) {
      return annotation.typeName.name;
    }
    if (t.isTSUnionType(annotation)) {
      return annotation.types.map(t => this.extractTypeName({ typeAnnotation: t })).join(' | ');
    }
    
    return 'unknown';
  }

  /**
   * Generate usage example from props
   * @param {string} componentName 
   * @param {Object} props 
   * @returns {string}
   */
  generateExample(componentName, props) {
    const requiredProps = Object.entries(props)
      .filter(([_, meta]) => meta.required)
      .map(([name, meta]) => {
        // Generate placeholder based on type
        let value = '""';
        if (meta.type === 'number') value = '0';
        if (meta.type === 'boolean') value = 'false';
        
        return `${name}={${value}}`;
      })
      .join(' ');
    
    const hasChildren = Object.keys(props).includes('children');
    
    if (hasChildren) {
      return `<${componentName} ${requiredProps}>Content</${componentName}>`;
    } else {
      return `<${componentName} ${requiredProps} />`;
    }
  }

  /**
   * Get catalog entry for a component
   * @param {string} registry 
   * @param {string} componentName 
   * @returns {Object|null}
   */
  getComponent(registry, componentName) {
    return this.catalog[`${registry}/${componentName}`] || null;
  }

  /**
   * Get all cataloged components
   * @returns {Object}
   */
  getCatalog() {
    return this.catalog;
  }
}

module.exports = ComponentCatalog;
