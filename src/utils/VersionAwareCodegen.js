/**
 * VersionAwareCodegen.js - Version-Aware Code Generation
 * =======================================================
 * 
 * Handles API breaking changes across package versions.
 * Generates code compatible with actually installed versions.
 * 
 * @version 1.0.0
 */

const { logger } = require('./logger');

/**
 * API mappings for packages with breaking changes between versions
 */
const API_MAPPINGS = {
  'react-resizable-panels': {
    '4': {
      exports: {
        'PanelGroup': 'PanelGroup',      // v4 kept PanelGroup
        'PanelResizeHandle': 'PanelResizeHandle',  // v4 kept this
        'Panel': 'Panel'
      },
      importStyle: 'named',
      example: `import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

<PanelGroup direction="horizontal" className="min-h-[400px]">
  <Panel defaultSize={50} minSize={20}>
    <div className="h-full p-4">Left Panel</div>
  </Panel>
  <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20 transition-colors" />
  <Panel defaultSize={50} minSize={20}>
    <div className="h-full p-4">Right Panel</div>
  </Panel>
</PanelGroup>`
    },
    '2': {
      exports: {
        'PanelGroup': 'PanelGroup',
        'PanelResizeHandle': 'PanelResizeHandle',
        'Panel': 'Panel'
      },
      importStyle: 'namespace',
      example: `import * as ResizablePrimitive from "react-resizable-panels";`
    }
  },
  
  '@monaco-editor/react': {
    '4': {
      exports: { 'Editor': 'default' },
      importStyle: 'default',
      example: `import Editor from "@monaco-editor/react";

<Editor
  height="400px"
  language="javascript"
  theme="vs-dark"
  value={code}
  onChange={(value) => setCode(value || "")}
  options={{
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    automaticLayout: true,
  }}
/>`
    }
  },
  
  'tailwindcss': {
    '4': {
      configFormat: 'css-based',
      darkMode: '["class", ".dark"]',
      note: 'Tailwind v4 uses CSS-based config'
    },
    '3': {
      configFormat: 'js-based',
      darkMode: '"class"',
      note: 'Tailwind v3 uses JS config'
    }
  }
};

/**
 * Known breaking changes registry
 */
const BREAKING_CHANGES = {
  'react-resizable-panels': {
    '4.0.0': [
      { type: 'note', message: 'v4 maintains named exports but with updated types' }
    ]
  },
  'tailwindcss': {
    '4.0.0': [
      { type: 'config-format', note: 'CSS-based config, darkMode tuple format' }
    ]
  }
};

/**
 * Version-aware code generator
 */
class VersionAwareCodeGenerator {
  constructor(packageJsonDeps = {}) {
    this.dependencies = packageJsonDeps;
  }
  
  /**
   * Get major version number from semver string
   */
  getMajorVersion(pkgName) {
    const version = this.dependencies[pkgName];
    if (!version) return null;
    
    // Handle ^4.0.0, ~4.0.0, 4.0.0, etc.
    const match = version.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
  
  /**
   * Get API mapping for a specific package
   */
  getApiMapping(pkgName) {
    const majorVersion = this.getMajorVersion(pkgName);
    const mappings = API_MAPPINGS[pkgName];
    
    if (!mappings) return null;
    
    // Find the appropriate version mapping
    const versionKey = String(majorVersion);
    return mappings[versionKey] || mappings[Object.keys(mappings)[0]];
  }
  
  /**
   * Get the correct import statement for a package
   */
  getImportStatement(pkgName, components = []) {
    const mapping = this.getApiMapping(pkgName);
    if (!mapping) {
      return `import { ${components.join(', ')} } from "${pkgName}";`;
    }
    
    if (mapping.importStyle === 'default') {
      return `import ${components[0] || 'Component'} from "${pkgName}";`;
    }
    
    if (mapping.importStyle === 'namespace') {
      const alias = pkgName.replace(/[^a-zA-Z]/g, '');
      return `import * as ${alias} from "${pkgName}";`;
    }
    
    // named imports
    return `import { ${components.join(', ')} } from "${pkgName}";`;
  }
  
  /**
   * Get usage example for a package
   */
  getExample(pkgName) {
    const mapping = this.getApiMapping(pkgName);
    return mapping?.example || null;
  }
  
  /**
   * Check if package has breaking changes for installed version
   */
  hasBreakingChanges(pkgName) {
    const version = this.dependencies[pkgName];
    if (!version) return false;
    
    const changes = BREAKING_CHANGES[pkgName];
    if (!changes) return false;
    
    // Check if any breaking change version is <= installed version
    for (const breakingVersion of Object.keys(changes)) {
      if (this.isVersionGreaterOrEqual(version, breakingVersion)) {
        return true;
      }
    }
    return false;
  }
  
  isVersionGreaterOrEqual(installed, breaking) {
    const installedMajor = parseInt(installed.match(/(\d+)/)?.[1] || '0');
    const breakingMajor = parseInt(breaking.match(/(\d+)/)?.[1] || '0');
    return installedMajor >= breakingMajor;
  }
  
  /**
   * Get Tailwind dark mode configuration based on version
   */
  getTailwindDarkMode() {
    const version = this.getMajorVersion('tailwindcss');
    if (version >= 4) {
      return '["class", ".dark"]';
    }
    return '"class"';
  }
}

/**
 * Error pattern recognition for self-healing
 */
const ERROR_PATTERNS = [
  {
    pattern: /Import declaration conflicts with local declaration of '(\w+)'/,
    type: 'DUPLICATE_IDENTIFIER',
    fix: (match) => ({
      action: 'REMOVE_LOCAL_DEFINITION',
      identifier: match[1],
      description: `Remove local definition of '${match[1]}' - already imported`
    })
  },
  {
    pattern: /Module not found: Can't resolve '([^']+)'/,
    type: 'MISSING_DEPENDENCY',
    fix: (match) => ({
      action: 'INSTALL_PACKAGE',
      package: match[1],
      description: `Install missing package: ${match[1]}`
    })
  },
  {
    pattern: /Export (\w+) doesn't exist in target module/,
    type: 'INVALID_EXPORT',
    fix: (match) => ({
      action: 'CHECK_PACKAGE_VERSION',
      exportName: match[1],
      description: `Export '${match[1]}' not found - check package version`
    })
  },
  {
    pattern: /Cannot find namespace 'JSX'/,
    type: 'MISSING_JSX_NAMESPACE',
    fix: () => ({
      action: 'ADD_REACT_IMPORT',
      import: "import * as React from 'react';",
      description: 'Add React namespace import for JSX types'
    })
  },
  {
    pattern: /Property '(\w+)' does not exist on type/,
    type: 'INVALID_PROP',
    fix: (match) => ({
      action: 'CHECK_PROP_API',
      prop: match[1],
      description: `Property '${match[1]}' may have been renamed in newer version`
    })
  },
  {
    pattern: /Type '\["class"\]' is not assignable to type 'DarkModeStrategy/,
    type: 'TAILWIND_V4_DARKMODE',
    fix: () => ({
      action: 'FIX_DARKMODE_CONFIG',
      fix: 'darkMode: ["class", ".dark"]',
      description: 'Tailwind v4 requires tuple with selector'
    })
  }
];

/**
 * Analyze build errors and suggest fixes
 */
class ErrorAnalyzer {
  analyze(errorOutput) {
    const fixes = [];
    
    for (const { pattern, type, fix } of ERROR_PATTERNS) {
      const regex = new RegExp(pattern, 'g');
      let match;
      
      while ((match = regex.exec(errorOutput)) !== null) {
        fixes.push({
          type,
          ...fix(match)
        });
      }
    }
    
    // Deduplicate fixes
    const seen = new Set();
    return fixes.filter(f => {
      const key = `${f.type}-${f.identifier || f.package || f.prop || 'general'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Apply auto-fixes to code
   */
  applyFixes(code, fixes) {
    let fixedCode = code;
    
    for (const fix of fixes) {
      switch (fix.action) {
        case 'ADD_REACT_IMPORT':
          if (!fixedCode.includes("import * as React") && !fixedCode.includes("import React from")) {
            fixedCode = fix.import + '\n' + fixedCode;
            logger.info(`Applied fix: ${fix.description}`);
          }
          break;
          
        case 'REMOVE_LOCAL_DEFINITION':
          // Remove const X = ... definitions that conflict with imports
          const defPattern = new RegExp(
            `(const|let|var)\\s+${fix.identifier}\\s*[:=][^;]+;\\s*\\n?`,
            'g'
          );
          fixedCode = fixedCode.replace(defPattern, `// Removed: ${fix.identifier} (already imported)\n`);
          logger.info(`Applied fix: ${fix.description}`);
          break;
      }
    }
    
    return fixedCode;
  }
}

module.exports = {
  VersionAwareCodeGenerator,
  ErrorAnalyzer,
  API_MAPPINGS,
  ERROR_PATTERNS
};
