/**
 * ComponentRegistry - Single Source of Truth for Project Components
 * 
 * Tracks:
 * 1. Existing components (scanned from filesystem)
 * 2. Component usage (where they are used)
 * 3. Component Source (shadcn, local, external)
 */
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

class ComponentRegistry {
  constructor(projectPath) {
    this.projectPath = projectPath;
    // Map<ComponentName, { path: string, type: 'ui'|'layout'|'feature', source: 'shadcn'|'local' }>
    this.components = new Map();
    this.initialized = false;
  }

  /**
   * Initialize registry by scanning common component directories
   */
  async initialize() {
    if (this.initialized) return;
    
    logger.info('📚 ComponentRegistry: Scanning project for components...');
    this.components.clear();

    await this.scanDirectory('components/ui', 'ui', 'shadcn'); // Assuming ui folder is mostly shadcn/primitives
    await this.scanDirectory('components', 'feature', 'local'); // Root components

    this.initialized = true;
    logger.info(`📚 ComponentRegistry: Found ${this.components.size} existing components.`);
  }

  /**
   * Scan a specific directory and register components found
   */
  async scanDirectory(relPath, type, defaultSource) {
    const fullPath = path.join(this.projectPath, relPath);
    try {
      // Check if dir exists
      try {
        await fs.access(fullPath);
      } catch {
        return; // Directory doesn't exist yet
      }

      const files = await fs.readdir(fullPath);
      for (const file of files) {
        if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
          const name = this.formatComponentName(file);
          const importPath = `@/${relPath}/${file.replace(/\.(tsx|jsx)$/, '')}`;
          
          this.register({
            name,
            path: importPath,
            type,
            source: defaultSource,
            absolutePath: path.join(fullPath, file)
          });
        }
      }
    } catch (error) {
      logger.warn(`ComponentRegistry scan failed for ${relPath}: ${error.message}`);
    }
  }

  /**
   * Register a component manually
   */
  register(component) {
    // component: { name, path, type, source }
    if (!component.name) return;
    
    this.components.set(component.name, component);
    
    // Also register PascalCase version if name is kebab-case
    // or vice versa, to handle "button" vs "Button"
    if (component.name.includes('-')) {
        const pascal = component.name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
        this.components.set(pascal, component);
    }
  }

  /**
   * Check if component exists
   */
  get(name) {
    return this.components.get(name) || this.components.get(this.formatComponentName(name));
  }

  has(name) {
    return !!this.get(name);
  }

  /**
   * Get all available components for prompt context
   */
  getAllComponents() {
    return Array.from(this.components.values());
  }

  /**
   * Helper to format filename to ComponentName (button.tsx -> Button)
   */
  formatComponentName(filename) {
    const name = path.basename(filename, path.extname(filename));
    // kebab-case to PascalCase
    return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  }
  
  /**
   * Returns a prompt-ready list of available components
   */
  getPromptContext() {
      const uiComponents = [];
      const featureComponents = [];
      
      for (const [name, comp] of this.components) {
          if (comp.type === 'ui') uiComponents.push(name);
          else featureComponents.push(name);
      }
      
      // return unique sets
      return `
AVAILABLE UI COMPONENTS (Do NOT redefine, import from @/components/ui/):
${[...new Set(uiComponents)].join(', ')}

AVAILABLE FEATURE COMPONENTS (Import from @/components/):
${[...new Set(featureComponents)].join(', ')}
      `;
  }
}

module.exports = ComponentRegistry;
