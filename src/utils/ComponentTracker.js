/**
 * ComponentTracker.js - Component Registration and Conflict Prevention
 * =====================================================================
 * 
 * This utility class tracks all component imports and local definitions
 * to prevent the #1 cause of build failures: duplicate identifier errors.
 * 
 * Key Features:
 * - Import-Definition Mutex: Prevents importing AND defining same component
 * - Cross-file dependency tracking
 * - Automatic conflict resolution
 * - Component source decisions (import vs define)
 * 
 * @version 1.0.0
 * @author CodeSentinel AI
 */

const { logger } = require('./logger');

// Known UI library components that should ALWAYS be imported, never defined
const SHADCN_COMPONENTS = new Set([
  'Accordion', 'AccordionContent', 'AccordionItem', 'AccordionTrigger',
  'Alert', 'AlertDescription', 'AlertTitle',
  'AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent',
  'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader',
  'AlertDialogTitle', 'AlertDialogTrigger',
  'AspectRatio', 'Avatar', 'AvatarFallback', 'AvatarImage',
  'Badge', 'Button',
  'Calendar', 'Card', 'CardContent', 'CardDescription', 'CardFooter',
  'CardHeader', 'CardTitle', 'Carousel', 'CarouselContent', 'CarouselItem',
  'Checkbox', 'Collapsible', 'Command', 'CommandDialog', 'CommandEmpty',
  'CommandGroup', 'CommandInput', 'CommandItem', 'CommandList',
  'ContextMenu', 'ContextMenuContent', 'ContextMenuItem', 'ContextMenuTrigger',
  'Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter',
  'DialogHeader', 'DialogTitle', 'DialogTrigger',
  'Drawer', 'DrawerClose', 'DrawerContent', 'DrawerDescription',
  'DrawerFooter', 'DrawerHeader', 'DrawerTitle', 'DrawerTrigger',
  'DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem',
  'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuTrigger',
  'Form', 'FormControl', 'FormDescription', 'FormField', 'FormItem',
  'FormLabel', 'FormMessage',
  'HoverCard', 'HoverCardContent', 'HoverCardTrigger',
  'Input', 'InputOTP', 'Label',
  'Menubar', 'MenubarContent', 'MenubarItem', 'MenubarMenu', 'MenubarTrigger',
  'NavigationMenu', 'NavigationMenuContent', 'NavigationMenuItem',
  'NavigationMenuLink', 'NavigationMenuList', 'NavigationMenuTrigger',
  'Pagination', 'Popover', 'PopoverContent', 'PopoverTrigger',
  'Progress', 'RadioGroup', 'RadioGroupItem',
  'ResizableHandle', 'ResizablePanel', 'ResizablePanelGroup',
  'ScrollArea', 'ScrollBar', 'Select', 'SelectContent', 'SelectGroup',
  'SelectItem', 'SelectLabel', 'SelectTrigger', 'SelectValue',
  'Separator', 'Sheet', 'SheetClose', 'SheetContent', 'SheetDescription',
  'SheetFooter', 'SheetHeader', 'SheetTitle', 'SheetTrigger',
  'Skeleton', 'Slider', 'Sonner', 'Switch',
  'Table', 'TableBody', 'TableCaption', 'TableCell', 'TableFooter',
  'TableHead', 'TableHeader', 'TableRow',
  'Tabs', 'TabsContent', 'TabsList', 'TabsTrigger',
  'Textarea', 'Toast', 'Toaster', 'Toggle', 'ToggleGroup', 'ToggleGroupItem',
  'Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger'
]);

// Components that should use specific external packages
const EXTERNAL_COMPONENTS = new Map([
  ['Editor', '@monaco-editor/react'],
  ['MonacoEditor', '@monaco-editor/react'],
  ['Panel', 'react-resizable-panels'],
  ['PanelGroup', 'react-resizable-panels'],
  ['PanelResizeHandle', 'react-resizable-panels'],
  ['ReactMarkdown', 'react-markdown'],
  ['SyntaxHighlighter', 'react-syntax-highlighter'],
  ['Terminal', '@xterm/xterm']
]);

/**
 * Source types for components
 * @enum {string}
 */
const ComponentSource = {
  SHADCN_UI: 'shadcn-ui',
  EXTERNAL_PACKAGE: 'external-package',
  LOCAL_DEFINITION: 'local-definition',
  SHARED_COMPONENT: 'shared-component',
  LUCIDE_ICON: 'lucide-icon'
};

/**
 * Tracks component registrations and prevents conflicts
 */
class ComponentTracker {
  constructor() {
    /**
     * Map of file path -> component registry for that file
     * @type {Map<string, FileComponentRegistry>}
     */
    this.fileRegistries = new Map();
    
    /**
     * Global component usage count
     * @type {Map<string, number>}
     */
    this.globalUsage = new Map();
    
    /**
     * Conflicts detected during tracking
     * @type {Array<ConflictInfo>}
     */
    this.conflicts = [];
  }
  
  /**
   * Get or create a file registry
   * @param {string} filePath - Absolute path to the file
   * @returns {FileComponentRegistry}
   */
  getFileRegistry(filePath) {
    if (!this.fileRegistries.has(filePath)) {
      this.fileRegistries.set(filePath, {
        imports: new Map(),      // componentName -> { source, path }
        definitions: new Set(),   // locally defined component names
        usages: new Set()         // components used (referenced) in JSX
      });
    }
    return this.fileRegistries.get(filePath);
  }
  
  /**
   * Register an import for a file
   * @param {string} filePath - File path
   * @param {string} componentName - Name of the imported component
   * @param {string} importPath - Import path (e.g., "@/components/ui/card")
   * @returns {{ allowed: boolean, conflict?: string }}
   */
  registerImport(filePath, componentName, importPath) {
    const registry = this.getFileRegistry(filePath);
    
    // Check if already defined locally in this file
    if (registry.definitions.has(componentName)) {
      const conflict = {
        type: 'IMPORT_AFTER_DEFINITION',
        file: filePath,
        component: componentName,
        message: `Cannot import '${componentName}' - already defined locally in this file`
      };
      this.conflicts.push(conflict);
      logger.warn(`ComponentTracker: ${conflict.message}`);
      return { allowed: false, conflict: conflict.message };
    }
    
    // Register the import
    registry.imports.set(componentName, {
      source: this.determineSource(componentName, importPath),
      path: importPath
    });
    
    // Increment global usage
    this.globalUsage.set(componentName, (this.globalUsage.get(componentName) || 0) + 1);
    
    return { allowed: true };
  }
  
  /**
   * Register a local definition for a file
   * @param {string} filePath - File path
   * @param {string} componentName - Name of the component being defined
   * @returns {{ allowed: boolean, conflict?: string, shouldRemoveImport?: boolean }}
   */
  registerDefinition(filePath, componentName) {
    const registry = this.getFileRegistry(filePath);
    
    // Check if already imported in this file
    if (registry.imports.has(componentName)) {
      const importInfo = registry.imports.get(componentName);
      
      // If it's a shadcn or external component, we should use the import, not define locally
      if (SHADCN_COMPONENTS.has(componentName) || EXTERNAL_COMPONENTS.has(componentName)) {
        const conflict = {
          type: 'DEFINITION_SHADOWS_IMPORT',
          file: filePath,
          component: componentName,
          message: `Cannot define '${componentName}' locally - use the imported version from '${importInfo.path}'`
        };
        this.conflicts.push(conflict);
        logger.warn(`ComponentTracker: ${conflict.message}`);
        return { allowed: false, conflict: conflict.message };
      }
      
      // For other imports, remove the import and allow local definition
      registry.imports.delete(componentName);
      logger.info(`ComponentTracker: Removed import of '${componentName}' in favor of local definition`);
      return { allowed: true, shouldRemoveImport: true };
    }
    
    // Check if this is a well-known component that should be imported
    if (SHADCN_COMPONENTS.has(componentName)) {
      logger.warn(`ComponentTracker: '${componentName}' is a shadcn component - consider importing from @/components/ui/`);
    }
    
    registry.definitions.add(componentName);
    return { allowed: true };
  }
  
  /**
   * Check if a component can be used (imported or defined) in a file
   * @param {string} filePath - File path
   * @param {string} componentName - Component name
   * @returns {{ available: boolean, source?: string, importPath?: string }}
   */
  checkAvailability(filePath, componentName) {
    const registry = this.getFileRegistry(filePath);
    
    if (registry.imports.has(componentName)) {
      const info = registry.imports.get(componentName);
      return { available: true, source: 'import', importPath: info.path };
    }
    
    if (registry.definitions.has(componentName)) {
      return { available: true, source: 'local' };
    }
    
    return { available: false };
  }
  
  /**
   * Determine the best source for a component
   * @param {string} componentName - Component name
   * @param {string} importPath - Optional import path hint
   * @returns {string} ComponentSource value
   */
  determineSource(componentName, importPath) {
    if (importPath && importPath.includes('lucide-react')) {
      return ComponentSource.LUCIDE_ICON;
    }
    
    if (EXTERNAL_COMPONENTS.has(componentName)) {
      return ComponentSource.EXTERNAL_PACKAGE;
    }
    
    if (SHADCN_COMPONENTS.has(componentName)) {
      return ComponentSource.SHADCN_UI;
    }
    
    if (importPath && importPath.startsWith('@/components/')) {
      return ComponentSource.SHARED_COMPONENT;
    }
    
    return ComponentSource.LOCAL_DEFINITION;
  }
  
  /**
   * Decide whether to import or define a component
   * @param {string} componentName - Name of the component
   * @param {Object} context - Context information
   * @returns {{ action: 'import' | 'define', path?: string, reason: string }}
   */
  decideComponentSource(componentName, context = {}) {
    const { projectHasComponent, isComplexComponent, multipleUsages } = context;
    
    // Rule 1: Known shadcn components -> Import
    if (SHADCN_COMPONENTS.has(componentName)) {
      const kebabName = componentName.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1);
      return {
        action: 'import',
        path: `@/components/ui/${kebabName}`,
        reason: 'Shadcn UI component - always import'
      };
    }
    
    // Rule 2: External package components -> Import
    if (EXTERNAL_COMPONENTS.has(componentName)) {
      return {
        action: 'import',
        path: EXTERNAL_COMPONENTS.get(componentName),
        reason: 'External package component'
      };
    }
    
    // Rule 3: Components used in multiple files -> Create shared
    if (multipleUsages) {
      return {
        action: 'import',
        path: `@/components/shared/${componentName.toLowerCase()}`,
        reason: 'Used in multiple files - should be shared'
      };
    }
    
    // Rule 4: Complex components -> Create shared for maintainability
    if (isComplexComponent) {
      return {
        action: 'import',
        path: `@/components/features/${componentName.toLowerCase()}`,
        reason: 'Complex component - should be in features'
      };
    }
    
    // Rule 5: Simple, single-use -> Define locally
    return {
      action: 'define',
      reason: 'Simple, single-use component - define locally'
    };
  }
  
  /**
   * Get all conflicts detected
   * @returns {Array<ConflictInfo>}
   */
  getConflicts() {
    return [...this.conflicts];
  }
  
  /**
   * Check if there are any conflicts
   * @returns {boolean}
   */
  hasConflicts() {
    return this.conflicts.length > 0;
  }
  
  /**
   * Clear all tracked data (reset for new project)
   */
  reset() {
    this.fileRegistries.clear();
    this.globalUsage.clear();
    this.conflicts = [];
    logger.info('ComponentTracker: Reset all tracking data');
  }
  
  /**
   * Generate import statements for a file based on what's registered
   * @param {string} filePath - File path
   * @returns {string[]} Array of import statements
   */
  generateImports(filePath) {
    const registry = this.getFileRegistry(filePath);
    const imports = [];
    const groupedImports = new Map();
    
    for (const [componentName, info] of registry.imports) {
      if (!groupedImports.has(info.path)) {
        groupedImports.set(info.path, []);
      }
      groupedImports.get(info.path).push(componentName);
    }
    
    for (const [path, components] of groupedImports) {
      // Sort components alphabetically
      components.sort();
      
      // Handle default exports (like Monaco Editor)
      if (components.length === 1 && path === '@monaco-editor/react') {
        imports.push(`import Editor from "${path}";`);
      } else {
        imports.push(`import { ${components.join(', ')} } from "${path}";`);
      }
    }
    
    return imports;
  }
  
  /**
   * Validate code for duplicate identifiers
   * @param {string} code - Code to validate
   * @param {string} filePath - File path for context
   * @returns {{ valid: boolean, duplicates: string[] }}
   */
  validateCode(code, filePath) {
    const duplicates = [];
    const identifiers = new Set();
    
    // Simple regex-based detection (AST-based would be more accurate)
    // Match import { X } patterns
    const importPattern = /import\s*\{([^}]+)\}\s*from/g;
    let match;
    
    while ((match = importPattern.exec(code)) !== null) {
      const names = match[1].split(',').map(s => s.trim().split(' as ')[0].trim());
      for (const name of names) {
        if (name && identifiers.has(name)) {
          duplicates.push(name);
        }
        identifiers.add(name);
      }
    }
    
    // Match default imports
    const defaultImportPattern = /import\s+(\w+)\s+from/g;
    while ((match = defaultImportPattern.exec(code)) !== null) {
      const name = match[1];
      if (identifiers.has(name)) {
        duplicates.push(name);
      }
      identifiers.add(name);
    }
    
    // Match local definitions: const X = or function X
    const defPattern = /(?:const|let|var|function)\s+([A-Z][a-zA-Z0-9]*)\s*[=(:]/g;
    while ((match = defPattern.exec(code)) !== null) {
      const name = match[1];
      if (identifiers.has(name)) {
        duplicates.push(name);
      }
      identifiers.add(name);
    }
    
    return {
      valid: duplicates.length === 0,
      duplicates: [...new Set(duplicates)]
    };
  }
  
  /**
   * Get a summary of tracked components
   * @returns {Object} Summary object
   */
  getSummary() {
    let totalImports = 0;
    let totalDefinitions = 0;
    
    for (const registry of this.fileRegistries.values()) {
      totalImports += registry.imports.size;
      totalDefinitions += registry.definitions.size;
    }
    
    return {
      filesTracked: this.fileRegistries.size,
      totalImports,
      totalDefinitions,
      conflictsDetected: this.conflicts.length,
      globalComponentsUsed: this.globalUsage.size
    };
  }
}

// Export singleton instance and class
const componentTracker = new ComponentTracker();

module.exports = {
  ComponentTracker,
  componentTracker,
  ComponentSource,
  SHADCN_COMPONENTS,
  EXTERNAL_COMPONENTS
};
