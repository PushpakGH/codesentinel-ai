/**
 * Project Builder Agent - PRODUCTION READY WITH ALL FIXES
 * ✅ Fixed: Route sanitization, component names, "use client", JSX validation, TypeScript enforcement
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const fileSystem = require('../services/fileSystemManager');
const registryTools = require('../registry/registryTools');
const builderConfig = require('./projectBuilderConfig');
const designSystem = require('./designSystemContext');
const PromptEngineerAgent = require('./promptEngineer');
const { validateCommand } = require('../utils/commandValidator');
const CodeValidator = require('../utils/codeValidator');
const ASTValidator = require('../utils/ASTValidator'); 
const StateManager = require('../services/stateManager');

// ============================
// ✅ NEW: CRITICAL HELPER FUNCTIONS
// ============================

/**
 * ✅ FIX #1: Sanitize route names for Next.js (remove regex special chars)
 * Prevents "Invalid regular expression" errors
 */
function sanitizeRouteName(name) {
  if (name === '/') return '/';
  
  return name
    .toLowerCase()
    .replace(/[()[\]{}+*?^$|\\]/g, '')  // Remove regex special chars
    .replace(/\s+/g, '-')                // Spaces to dashes
    .replace(/[^a-z0-9-_]/g, '-')        // Only alphanumeric, dash, underscore
    .replace(/-+/g, '-')                 // Collapse multiple dashes
    .replace(/^-|-$/g, '');              // Trim dashes from ends
}

/**
 * ✅ FIX #2: Sanitize component names for JavaScript identifiers
 * Prevents syntax errors from invalid function names
 */
function sanitizeComponentName(name) {
  let componentName = name
    .replace(/\s+/g, '')                    // Remove spaces
    .replace(/[()[\]{}+*?^$|\\\/-]/g, '')  // Remove special chars
    .replace(/[^a-zA-Z0-9_]/g, '');        // Only alphanumeric and underscore
  
  // Ensure it starts with a letter
  if (!/^[a-zA-Z]/.test(componentName)) {
    componentName = 'Page' + componentName;
  }
  
  // Ensure it ends with "Page" for consistency
  if (!componentName.endsWith('Page')) {
    componentName += 'Page';
  }
  
  return componentName || 'GeneratedPage';
}

/**
 * ✅ FIX #3: Validate and fix JSX code
 * Catches common JSX errors like semicolons in props
 */
function validateJSXCode(code) {
  let fixed = code;
  
  // Fix semicolons in JSX props
  fixed = fixed.replace(/(<\w+[^>]*?);(\s*\w+=)/g, '$1$2');
  
  // Check for unclosed Link tags (common issue)
  const linkOpenCount = (fixed.match(/<Link[^>]*>/g) || []).length;
  const linkCloseCount = (fixed.match(/<\/Link>/g) || []).length;
  
  if (linkOpenCount !== linkCloseCount) {
    logger.warn(`⚠️  Mismatched Link tags: ${linkOpenCount} open, ${linkCloseCount} close`);
  }
  
  return fixed;
}

// ============================
// EXISTING HELPER FUNCTIONS
// ============================

/**
 * Run shell command with error handling
 */
async function runCommand(command, cwd, description) {
  logger.info(`Running: ${description}`);
  logger.debug(`Command: ${command}`);

  if (/\brm\s+-rf\b/i.test(command)) {
    throw new Error(`Blocked potentially unsafe command: ${command}`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
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




/**
 * Convert Next.js route to file path (kept for compatibility)
 */
function routeToNextAppPath(route) {
  if (!route || route === '/') {
    return path.join('app', 'page.tsx');
  }

  const clean = route.replace(/^\/|\/$/g, '');
  const segments = clean.split('/');
  return path.join('app', ...segments, 'page.tsx');
}

/**
 * Analyze project type from user prompt
 */
async function analyzeProjectType(userPrompt) {
  const analysisPrompt = `Analyze: "${userPrompt}"
Return ONLY JSON:
{
  "projectType": "vite-react" | "nextjs",
  "language": "javascript" | "typescript",
  "framework": "react" | "next",
  "reasoning": "brief explanation"
}

Rules:
- SEO/Blog/Ecommerce → nextjs + typescript
- Simple app/Dashboard → vite-react + javascript
Return ONLY JSON.`;

  try {
    const response = await aiClient.generate(analysisPrompt, {
      systemPrompt: 'You are a tech stack expert.',
      maxTokens: 3000,
      temperature: 0.3,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { projectType: 'vite-react', language: 'javascript', framework: 'react', reasoning: 'Default' };
  } catch (error) {
    logger.error('Analysis failed, using defaults:', error);
    return { projectType: 'vite-react', language: 'javascript', framework: 'react', reasoning: 'Fallback' };
  }
}

/**
 * Create project plan from user prompt
 */
async function createProjectPlan(userPrompt, projectAnalysis) {
  const planPrompt = `Create project plan for: "${userPrompt}"
Tech: ${projectAnalysis.projectType} + ${projectAnalysis.language}
Return ONLY JSON:
{
  "projectName": "MyApp",
  "description": "Brief description",
  "pages": [
    { "name": "HomePage", "route": "/", "description": "Main landing page", "features": ["Hero section", "CTA buttons"] }
  ],
  "componentNeeds": {
    "forms": ["input", "button"],
    "dataDisplay": ["card"]
  }
}

Rules:
- Component names: lowercase (input, button, card)
- Max 3 pages for MVP
- componentNeeds is an object with categories as keys
Return ONLY JSON.`;

  try {
    const response = await aiClient.generate(planPrompt, {
      systemPrompt: 'You are a project architect. Return valid JSON only.',
      maxTokens: 10000,
      temperature: 0.4,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const plan = JSON.parse(jsonMatch[0]);

    if (!plan.pages || !Array.isArray(plan.pages) || plan.pages.length === 0) {
      plan.pages = [{ name: 'HomePage', route: '/', description: 'Main page', features: ['Content display'] }];
    }

    if (!plan.componentNeeds || typeof plan.componentNeeds !== 'object') {
      plan.componentNeeds = { forms: ['input', 'button'], dataDisplay: ['card'] };
    }

    logger.info('Project plan created:', JSON.stringify(plan, null, 2));
    return plan;
  } catch (error) {
    logger.error('Planning failed, using fallback:', error);
    return {
      projectName: 'MyApp',
      description: 'Generated application',
      pages: [{ name: 'HomePage', route: '/', description: 'Main page', features: ['Content'] }],
      componentNeeds: { forms: ['input', 'button'], dataDisplay: ['card'] },
    };
  }
}

/**
 * Refine component needs with registry intelligence
 */
async function refineComponentNeedsWithRegistry(plan) {
  const refined = { ...plan.componentNeeds };
  const intentMap = {
    tabs: ['tabs'],
    table: ['table'],
    chart: ['chart'],
    modal: ['dialog'],
    drawer: ['sheet'],
    tooltip: ['tooltip'],
    toast: ['sonner', 'toast'],
    navbar: ['navigation-menu'],
    sidebar: ['sidebar'],
    pagination: ['pagination'],
  };

  for (const page of plan.pages) {
    const text = `${page.name} ${page.description}`.toLowerCase();
    for (const [intent, comps] of Object.entries(intentMap)) {
      if (text.includes(intent)) {
        if (!refined.dataDisplay) refined.dataDisplay = [];
        for (const c of comps) {
          if (!refined.dataDisplay.includes(c)) {
            refined.dataDisplay.push(c);
          }
        }
      }
    }
  }

  return { ...plan, componentNeeds: refined };
}

/**
 * Discover components from registry
 */
async function discoverComponents(componentNeeds) {
  logger.info('🔍 Discovering components using registry metadata...');

  const shadcnList = await registryTools.listComponents('shadcn');
  const daisyList = await registryTools.listComponents('daisyui');
  const magicuiList = await registryTools.listComponents('magicui');
  const aceternityList = await registryTools.listComponents('aceternity');
  const motionList = await registryTools.listComponents('motion-primitives');

  const byRegistry = {
    shadcn: new Set(shadcnList.components.map((c) => c.name)),
    daisyui: new Set(daisyList.components.map((c) => c.name)),
    magicui: new Set(magicuiList.components.map((c) => c.name)),
    aceternity: new Set(aceternityList.components.map((c) => c.name)),
    'motion-primitives': new Set(motionList.components.map((c) => c.name)),
  };

  const invalidComponents = ['markdown', 'navbar', 'link', 'monacoeditor', 'monaco', 'code-editor', 'loginform', 'registerform', 'form', 'spinner', 'check-icon', 'delete-icon', 'list', 'list-item', 'delete', 'trash', 'remove'];
  const normalize = (name) => name.toLowerCase().trim();
  const selectedComponents = {};

  for (const [category, needed] of Object.entries(componentNeeds)) {
    if (!Array.isArray(needed) || needed.length === 0) continue;

    logger.info(`Discovering components for category "${category}":`, needed);

    const targetRegistry = builderConfig.registryForCategory(category) || 'shadcn';
    const validSet = byRegistry[targetRegistry];

    if (!validSet) {
      logger.warn(`No registry set found for ${targetRegistry}, skipping`);
      continue;
    }

    if (!selectedComponents[targetRegistry]) {
      selectedComponents[targetRegistry] = [];
    }

    for (const rawName of needed) {
      const name = normalize(rawName);

      if (invalidComponents.includes(name)) {
        logger.info(`Skipping invalid requested component: ${rawName}`);
        continue;
      }

      if (validSet.has(name)) {
        selectedComponents[targetRegistry].push(name);
        continue;
      }

      const fallbackMap = {
        navbar: 'navigation-menu',
        menu: 'navigation-menu',
        modal: 'dialog',
        toast: 'sonner',
        spinner: 'skeleton',
        loading: 'skeleton',
        card: 'card',
        button: 'button',
      };

      const fallback = fallbackMap[name];
      if (fallback && validSet.has(fallback)) {
        logger.info(`Mapped requested ${rawName} → ${fallback} in ${targetRegistry}`);
        selectedComponents[targetRegistry].push(fallback);
      } else {
        logger.warn(`No match for requested component "${rawName}" in ${targetRegistry}`);
      }
    }
  }

  for (const registryId of Object.keys(selectedComponents)) {
    selectedComponents[registryId] = [...new Set(selectedComponents[registryId])];
  }

  const baseline = builderConfig.shadcnBaselineComponents;
  if (!selectedComponents.shadcn || selectedComponents.shadcn.length === 0) {
    selectedComponents.shadcn = baseline.filter((name) => byRegistry.shadcn.has(name));
  } else {
    for (const base of baseline) {
      if (byRegistry.shadcn.has(base) && !selectedComponents.shadcn.includes(base)) {
        selectedComponents.shadcn.push(base);
      }
    }
  }

  logger.info('🎯 Selected components per registry:', selectedComponents);
  return selectedComponents;
}

/**
 * Install components with fallback
 */
/**
 * ✅ PRODUCTION READY: Install components with state tracking and deduplication
 */
async function installComponentsWithFallback(selectedComponents, projectPath, stateManager) {
  logger.info('📦 Installing components...');

  const installedComponents = {};
  const failedComponents = [];
  let skippedCount = 0;

  for (const [registryId, components] of Object.entries(selectedComponents)) {
    if (!components || components.length === 0) continue;

    // ================================================================
    // ✅ NEW: Filter out already installed components
    // ================================================================
    const componentsToInstall = stateManager 
      ? components.filter(comp => !stateManager.isComponentInstalled(registryId, comp))
      : components;

    if (componentsToInstall.length === 0) {
      skippedCount += components.length;
      logger.info(`⏭️ All ${registryId} components already installed (${components.length}), skipping...`);
      
      // Still add to installedComponents for tracking
      installedComponents[registryId] = components;
      continue;
    }

    if (componentsToInstall.length < components.length) {
      const alreadyInstalled = components.length - componentsToInstall.length;
      skippedCount += alreadyInstalled;
      logger.info(`⏭️ Skipping ${alreadyInstalled} already installed ${registryId} component(s)`);
    }
    // ================================================================

    logger.info(`Installing from ${registryId}:`, componentsToInstall);
    const result = await registryTools.installComponents(registryId, componentsToInstall, projectPath);

    if (result.installed && result.installed.length > 0) {
      installedComponents[registryId] = result.installed;
      
      // ================================================================
      // ✅ NEW: Track installed components in state
      // ================================================================
      if (stateManager) {
        for (const comp of result.installed) {
          await stateManager.addComponent(registryId, comp);
        }
      }
      // ================================================================
      
      logger.info(`✅ Installed ${result.installed.length} from ${registryId}`);
    }

    if (result.failed && result.failed.length > 0) {
      failedComponents.push(...result.failed.map((name) => ({ registry: registryId, component: name })));
    }
  }

  // Handle failed components with fallbacks
  if (failedComponents.length > 0) {
    logger.warn(`${failedComponents.length} components failed, trying fallbacks...`);
    const fallbackMap = {
      list: 'card',
      'list-item': 'card',
      navbar: 'button',
      menu: 'dropdown-menu',
      toast: 'alert',
      spinner: 'button',
      loading: 'skeleton',
    };

    for (const { component } of failedComponents) {
      const fallback = fallbackMap[component];
      if (fallback) {
        // ✅ Check if fallback is already installed
        if (stateManager && stateManager.isComponentInstalled('shadcn', fallback)) {
          logger.info(`⏭️ Fallback ${fallback} already installed, skipping...`);
          continue;
        }

        logger.info(`Fallback for ${component} → ${fallback}`);
        const result = await registryTools.installComponents('shadcn', [fallback], projectPath);
        
        if (result.installed && result.installed.length > 0) {
          if (!installedComponents.shadcn) installedComponents.shadcn = [];
          if (!installedComponents.shadcn.includes(fallback)) {
            installedComponents.shadcn.push(fallback);
          }
          
          // ✅ Track fallback component
          if (stateManager) {
            await stateManager.addComponent('shadcn', fallback);
          }
        }
      }
    }
  }

  // Ensure baseline components are installed
  if (!installedComponents.shadcn || installedComponents.shadcn.length === 0) {
    logger.warn('No components installed, forcing baseline shadcn components...');
    
    // ✅ Filter baseline components that aren't installed
    const baselineToInstall = stateManager
      ? builderConfig.shadcnBaselineComponents.filter(
          comp => !stateManager.isComponentInstalled('shadcn', comp)
        )
      : builderConfig.shadcnBaselineComponents;

    if (baselineToInstall.length > 0) {
      const result = await registryTools.installComponents('shadcn', baselineToInstall, projectPath);
      
      if (result.installed && result.installed.length > 0) {
        installedComponents.shadcn = result.installed;
        
        // ✅ Track baseline components
        if (stateManager) {
          for (const comp of result.installed) {
            await stateManager.addComponent('shadcn', comp);
          }
        }
      }
    } else {
      logger.info('⏭️ All baseline components already installed');
      installedComponents.shadcn = builderConfig.shadcnBaselineComponents;
    }
  }

  // ✅ Log summary
  const totalInstalled = Object.values(installedComponents).flat().length;
  logger.info(`📦 Installation complete: ${totalInstalled} components available`);
  if (skippedCount > 0) {
    logger.info(`⏭️ Skipped ${skippedCount} already installed component(s)`);
  }
  
  logger.info('Final installed components:', installedComponents);
  return installedComponents;
}


/**
 * Ensure correct component name
 */
function ensureCorrectComponentName(code, expectedName) {
  const functionPattern = /function\s+(\w+)/;
  const arrowPattern = /const\s+(\w+)\s*=/;
  let match;
  let actualName = null;

  match = code.match(functionPattern);
  if (match) {
    actualName = match[1];
  } else {
    match = code.match(arrowPattern);
    if (match) actualName = match[1];
  }

  if (actualName && actualName !== expectedName) {
    logger.warn(`Fixing component name: ${actualName} → ${expectedName}`);
    code = code.replace(new RegExp(`function ${actualName}`, 'g'), `function ${expectedName}`);
    code = code.replace(new RegExp(`const ${actualName}`, 'g'), `const ${expectedName}`);
    code = code.replace(new RegExp(`export default ${actualName}`, 'g'), `export default ${expectedName}`);
  }

  return code;
}

/**
 * Validate and fix page code
 */
function validateAndFixPageCode(rawCode, projectAnalysis, pageName) {
  let code = rawCode.replace(/```[\s\S]*?```/gi, '').trim();
  
  code = ensureCorrectComponentName(code, pageName);

  if (projectAnalysis.language === 'javascript') {
    code = code.replace(/React\.FC/g, '');
  }

  const quoteCount = (code.match(/`/g) || []).length;
  if (quoteCount % 2 !== 0) {
    code += '`';
  }

  const hasMainOpen = /<main[^>]*>/.test(code);
  const hasMainClose = /<\/main>/.test(code);
  if (hasMainOpen && !hasMainClose) {
    code += '</main>';
  }

  if (!/export default/.test(code)) {
    code += `\n\nexport default ${pageName};`;
  }

  return code;
}

/**
 * ✅ FIX #4: Generate page code with enhanced validation and "use client" detection
 */
/**
 * ✅ FIX #6: Post-process generated code to fix common JSX errors
 * Place this BEFORE the ProjectBuilderAgent class definition
 */
/**
 * ✅ ENHANCED: Post-process generated code to fix common JSX errors
 * Place this BEFORE the ProjectBuilderAgent class definition
 */
function postProcessJSXCode(code, componentName) {
  let fixed = code;

  // ✅ FIX #1: Escape quotes in metadata strings (CRITICAL for layout.tsx)
  if (componentName.toLowerCase().includes('layout')) {
    // Match the entire metadata object
    fixed = fixed.replace(
      /(export\s+const\s+metadata\s*:\s*Metadata\s*=\s*\{[\s\S]*?\})/,
      (metadataBlock) => {
        // Fix unescaped single quotes in string values
        return metadataBlock.replace(
          /(title|description):\s*'([^']*)'([^']*)'([^']*)'/g,
          (match, key, before, middle, after) => {
            // Escape internal quotes
            const fixedValue = `${before}\\'${middle}\\'${after}`;
            return `${key}: '${fixedValue}'`;
          }
        );
      }
    );

    // Alternative: Convert to double quotes (safer)
    fixed = fixed.replace(
      /(title|description):\s*'([^']*)'/g,
      (match, key, value) => {
        // Escape double quotes in value and wrap in double quotes
        const escapedValue = value.replace(/"/g, '\\"');
        return `${key}: "${escapedValue}"`;
      }
    );
  }

  // ✅ FIX #2: Fix unclosed Link tags (most common issue)
  // Pattern: <Link ...>Text</Button> or </div>
  fixed = fixed.replace(
    /<Link([^>]*)>([\s\S]*?)<\/(Button|div|span|a|svg)>/g,
    (match, attrs, content, wrongClosing) => {
      // Only fix if content doesn't contain another <Link>
      if (!content.includes('<Link')) {
        logger.warn(`Fixed: <Link> closed with </${wrongClosing}>`);
        return `<Link${attrs}>${content}</Link>`;
      }
      return match; // Leave nested Links alone
    }
  );

  // ✅ FIX #3: Remove orphaned closing Link tags
  // Pattern: </Link> at the start of a line without opening
  const linkOpenings = (fixed.match(/<Link[^>]*>/g) || []).length;
  const linkClosings = (fixed.match(/<\/Link>/g) || []).length;
  
  if (linkClosings > linkOpenings) {
    logger.warn(`Removing ${linkClosings - linkOpenings} orphaned </Link> tag(s)`);
    let removed = 0;
    const target = linkClosings - linkOpenings;
    
    // Remove closing tags that appear after other closing tags (likely orphaned)
    fixed = fixed.replace(/<\/(div|Button|span)>\s*<\/Link>/g, (match) => {
      if (removed < target) {
        removed++;
        return match.replace('</Link>', '');
      }
      return match;
    });
  }

  // ✅ FIX #4: Fix semicolons in JSX props (common AI mistake)
  fixed = fixed.replace(/(<\w+[^>]*?);(\s*\w+=)/g, '$1$2');

  // ✅ FIX #5: Fix broken JSX text nodes (missing spaces)
  // Pattern: </Tag><span> without space
  fixed = fixed.replace(/(<\/\w+>)(<span|<div|<Link)/g, '$1\n          $2');

  // ✅ FIX #6: Ensure export default statement
  if (!fixed.includes('export default')) {
    fixed += `\n\nexport default ${componentName};`;
  }

  return fixed;
}


/**
 * ✅ UPDATED:1 Generate page code with enhanced validation and post-processing
 */

/**
 * ✅ ENHANCED:2 Generate page code with AST validation (NEW!)
 * Falls back to regex validation if AST fails
 */
/**
 * ✅  PRODUCTION READY:3 Generate page code with AST validation + Regex fallback
 */

/**
 * ✅ PRODUCTION READY:4 Generate page code with AST validation + Regex fallback + VS Code Diagnostics
 */
/**
 * ✅ PRODUCTION READY:5 Generate page code with AST validation + API tracking
 */
async function generatePageCode(pageName, pageDesc, installedComponents, projectAnalysis, projectPath, stateManager) {
  const { projectType } = projectAnalysis;
  const isVite = projectType === 'vite-react';

  // Build imports from ALL registries
  const allImports = [];
  for (const [registry, components] of Object.entries(installedComponents)) {
    if (!components || components.length === 0) continue;

    for (const comp of components) {
      const pascal = comp
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');

      let importLine;

      switch (registry) {
        case 'shadcn':
          try {
            const detailsResult = await registryTools.getComponentDetails('shadcn', comp);
            const detail = detailsResult.details.find((d) => d.found && d.name === comp);
            if (detail && detail.usage) {
              const usageLines = detail.usage
                .split('\n')
                .filter((line) => line.trim().startsWith('import') && line.includes('from'));
              allImports.push(...usageLines);
              continue;
            }
          } catch (e) {
            // Fall back to constructed import
          }
          importLine = `import { ${pascal} } from '@/components/ui/${comp}';`;
          break;
        case 'magicui':
          importLine = `import { ${pascal} } from '@/components/magicui/${comp}';`;
          break;
        case 'aceternity':
          importLine = `import { ${pascal} } from '@/components/aceternity/${comp}';`;
          break;
        case 'motion-primitives':
          importLine = `import { ${pascal} } from '@/components/motion/${comp}';`;
          break;
        case 'daisyui':
          continue;
        default:
          importLine = `import { ${pascal} } from '@/components/${registry}/${comp}';`;
      }

      if (importLine && !allImports.includes(importLine)) {
        allImports.push(importLine);
      }
    }
  }

  const uniqueImports = [...new Set(allImports)];
  const availableImports = uniqueImports.slice(0, 25).join('\n');

  // ✅ ENHANCED PROMPT WITH "use client" REQUIREMENT
  const codePrompt = `Generate a professional, production-ready React component: ${pageName}

Description: ${pageDesc}

AVAILABLE COMPONENTS FROM ALL REGISTRIES:
${availableImports || 'No component imports detected. Use plain JSX with Tailwind CSS.'}

DESIGN SYSTEM RULES:
${designSystem.layoutPatterns}
${designSystem.componentSelection}
${designSystem.spacingAndTypography}
${designSystem.responsiveDesign}
${designSystem.interactionDesign}
${designSystem.advancedPatterns}

CRITICAL REQUIREMENTS:

1. Component name MUST be exactly: ${pageName}
2. Export default: export default ${pageName}
3. Import React: import React from 'react'

4. ✅ "use client" DIRECTIVE (CRITICAL):
   - IF using ANY React hooks (useState, useEffect, useRef, useCallback, useMemo, etc.)
   - OR using event handlers (onClick, onChange, onSubmit, onFocus, etc.)
   - OR using browser APIs (window, document, localStorage, sessionStorage, etc.)
   - THEN ADD 'use client' as the VERY FIRST line of the file
   - Example:
     'use client'
     
     import React, { useState } from 'react'
     import { Button } from '@/components/ui/button'
     
     export default function MyPage() {
       const [count, setCount] = useState(0)
       ...
     }

5. JSX TAG CLOSURE (CRITICAL):
   - EVERY opening tag MUST have matching closing tag with exact same name
   - <Link> must close with </Link> (NOT </div> or </a>)
   - <Button> must close with </Button> (NOT </div>)
   - <Card> must close with </Card> (NOT </div>)
   - Double-check ALL nested components before generating
   - Count your tags: every <TagName> needs exactly one </TagName>

6. NAVIGATION: ALWAYS use Next.js Link component
   - Import: import Link from 'next/link'
   - Usage: <Link href="/route">Text</Link>
   - NEVER use <a href> - always Link
   - Always provide valid routes like "/contact", "/about"

7. TYPESCRIPT TYPES (if TypeScript):
   - Type ALL function parameters: (id: number, name: string) => void
   - Use generics for state: useState<User[]>([])
   - Define types for objects: type User = { id: number; name: string }
   - Type component props: interface Props { title: string }

8. DATA: Provide default/mock data for all arrays
   - Example: const features = [{ id: 1, title: 'Feature 1', icon: '🚀', description: 'Details...' }]
   - NEVER leave arrays undefined or expect props

9. NO SEMICOLONS IN JSX PROPS:
   - WRONG: <Button key={id}; variant="ghost" />
   - RIGHT: <Button key={id} variant="ghost" />

10. Use components from available imports - select BEST registry for each UI element
11. Follow design system spacing, typography, responsive rules
12. Create visually balanced layout with proper hierarchy
13. Use Tailwind for all styling - NO custom CSS
14. Add proper hover states: hover:shadow-2xl hover:-translate-y-1 transition-all
15. Use gradients and shadows: bg-gradient-to-r from-primary/10 to-transparent
16. ALWAYS fully close all JSX tags and strings
17. Make it responsive: mobile-first design
18. NO comments, NO explanations, NO markdown fences
19. Return ONLY the code

Generate the code now:`;

  // RETRY LOGIC WITH VALIDATION
  const maxAttempts = 3;
  let lastError = null;
  let validationMethod = 'unknown';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`Generating ${pageName} (attempt ${attempt}/${maxAttempts})...`);

      // ✅ ENHANCED SYSTEM PROMPT
      const response = await aiClient.generate(codePrompt, {
        systemPrompt: `You are a senior frontend developer specializing in React and Next.js.

CRITICAL NEXT.JS APP ROUTER RULES:
- Page components in Next.js App Router DO NOT receive props
- ALWAYS provide default/mock data inside the component
- Use Next.js Link for all navigation: import Link from 'next/link'

"use client" REQUIREMENT:
- If component uses React hooks (useState, useEffect, etc.) → ADD 'use client' as FIRST line
- If component uses event handlers (onClick, onChange, etc.) → ADD 'use client' as FIRST line
- If component uses browser APIs (window, localStorage, etc.) → ADD 'use client' as FIRST line

TYPESCRIPT REQUIREMENTS:
- Type ALL function parameters explicitly
- Use generics for useState: useState<Type[]>([])
- Define interfaces/types for complex objects
- Add proper React component prop types

JSX REQUIREMENTS (ABSOLUTELY CRITICAL):
- EVERY <Link> MUST close with </Link> (NOT </div> or </Button>)
- EVERY <Button> MUST close with </Button> (NOT </div> or </Link>)
- EVERY <Card> MUST close with </Card> (NOT </div>)
- Match ALL opening and closing tags exactly by name
- NO semicolons between JSX props
- Before finishing, mentally count: Do I have equal <Link> and </Link> tags?

DESIGN REQUIREMENTS:
- Add visual depth with gradients, shadows, hover effects
- Ensure color contrast between normal and hover states
- Provide mock data for all arrays (never undefined)

Generate production-quality, visually appealing components following design best practices.
Return only valid JSX/TSX code with no markdown, explanations, or comments.`,
        maxTokens: 10000,
        temperature: 0.5 - attempt * 0.1,
      });

      // ================================================================
      // ✅ NEW: Track API usage for cost monitoring
      // ================================================================
      if (stateManager && response.usage) {
        // Gemini 2.0 Flash pricing: $0.075 per 1M input tokens, $0.30 per 1M output tokens
        const inputCost = ((response.usage.promptTokens || 0) / 1000000) * 0.075;
        const outputCost = ((response.usage.completionTokens || 0) / 1000000) * 0.30;
        const totalCost = inputCost + outputCost;
        const totalTokens = response.usage.totalTokens || 
                          (response.usage.promptTokens || 0) + (response.usage.completionTokens || 0);
        
        await stateManager.trackAPIUsage(totalTokens, totalCost);
        
        logger.debug(`💰 API Usage: ${totalTokens} tokens ($${totalCost.toFixed(6)})`);
      }
      // ================================================================

      // ================================================================
      // ✅ AST VALIDATION WITH FALLBACK TO REGEX
      // ================================================================
      let validation;
      let usedAST = false;

      try {
        // Try AST validation first
        logger.info(`🔬 Attempting AST validation for ${pageName}...`);
        validation = await ASTValidator.validate(
          response, 
          pageName, 
          `${pageName.toLowerCase()}.tsx`, 
          projectPath
        );
        
        usedAST = true;
        validationMethod = 'AST';
        
        logger.info(`✅ AST validation: ${validation.success ? 'PASSED' : 'FAILED'}`);
        
        if (validation.fixes && validation.fixes.length > 0) {
          logger.info(`🔧 AST applied ${validation.fixes.length} fix(es):`);
          validation.fixes.forEach(fix => {
            logger.info(`   - ${fix.type}: ${fix.from || 'N/A'} → ${fix.to || 'applied'}`);
          });
        }

        // Log JSX errors if any
        if (validation.jsxErrors && validation.jsxErrors.length > 0) {
          logger.warn(`⚠️ JSX errors detected (${validation.jsxErrors.length}):`);
          validation.jsxErrors.forEach(err => {
            logger.warn(`   - ${err.type}: ${err.tag || err.message} (line ${err.line})`);
          });
        }

        // Log TypeScript warnings (non-critical)
        if (validation.warnings && validation.warnings.length > 0) {
          logger.debug(`📝 TypeScript warnings (${validation.warnings.length}):`);
          validation.warnings.slice(0, 3).forEach(warn => {
            logger.debug(`   - Line ${warn.line}: ${warn.message}`);
          });
        }

      } catch (astError) {
        // AST failed, fallback to regex
        logger.warn(`⚠️ AST validation failed: ${astError.message}`);
        logger.info(`🔄 Falling back to regex validation...`);
        
        try {
          validation = await CodeValidator.validate(
            response, 
            pageName, 
            `${pageName.toLowerCase()}.tsx`, 
            projectPath
          );
          
          usedAST = false;
          validationMethod = 'Regex (fallback)';
          
          logger.info(`✅ Regex validation: ${validation.success ? 'PASSED' : 'FAILED'}`);
          
          if (validation.correctedImports && validation.correctedImports.length > 0) {
            logger.info(`🔧 Regex corrected ${validation.correctedImports.length} import(s)`);
          }
          
        } catch (regexError) {
          // Both failed
          logger.error(`❌ Both AST and Regex validation failed!`);
          logger.error(`   AST error: ${astError.message}`);
          logger.error(`   Regex error: ${regexError.message}`);
          throw new Error(`All validation methods failed: AST (${astError.message}), Regex (${regexError.message})`);
        }
      }
      // ================================================================

      // Check validation result
      if (!validation.success) {
        const errorMsg = validation.error || 'Unknown validation error';
        logger.error(`❌ Validation failed for ${pageName}: ${errorMsg}`);
        
        if (attempt < maxAttempts) {
          logger.warn(`🔄 Retrying generation (attempt ${attempt + 1})...`);
          continue;
        }
        
        throw new Error(`Failed to generate valid code after ${maxAttempts} attempts: ${errorMsg}`);
      }

      // ================================================================
      // ✅ VS CODE DIAGNOSTICS INTEGRATION
      // ================================================================
      if (validation.fixes && validation.fixes.length > 0) {
        logger.info(`📋 Creating VS Code diagnostics for ${validation.fixes.length} fix(es)...`);
        
        validation.fixes.forEach(fix => {
          if (fix.openLine && fix.closeLine) {
            // Create VS Code diagnostic with line numbers
            const diagnostic = {
              severity: 'warning',
              range: {
                start: { line: fix.openLine - 1, character: 0 },
                end: { line: fix.closeLine - 1, character: 0 }
              },
              message: fix.message || `${fix.type}: ${fix.from} → ${fix.to}`,
              source: 'CodeSentinel AST',
              code: fix.type
            };
            
            logger.info(`📍 Diagnostic (Line ${fix.openLine}-${fix.closeLine}): ${diagnostic.message}`);
          } else if (fix.type === 'AUTO_IMPORT_ADDED') {
            // Log auto-import fixes
            logger.info(`📦 Auto-imported: ${fix.component} from ${fix.path}`);
          } else if (fix.type === 'USE_CLIENT_ADDED') {
            // Log "use client" directive
            logger.info(`📦 Added "use client" directive`);
          } else if (fix.type === 'IMPORT_PATH_CORRECTION') {
            // Log import path corrections
            logger.info(`🔧 Corrected import: ${fix.from} → ${fix.to}`);
          } else {
            // Generic fix logging
            logger.info(`🔧 Applied fix: ${fix.type}`);
          }
        });
      }

      // Log JSX errors separately (critical)
      if (validation.jsxErrors && validation.jsxErrors.length > 0) {
        logger.error(`❌ ${validation.jsxErrors.length} JSX error(s) detected:`);
        validation.jsxErrors.forEach(err => {
          logger.error(`   Line ${err.line}: ${err.message}`);
        });
      }

      // Log TypeScript warnings (non-critical)
      if (validation.warnings && validation.warnings.length > 0) {
        logger.warn(`⚠️ ${validation.warnings.length} TypeScript warning(s):`);
        validation.warnings.slice(0, 5).forEach(warn => {
          logger.warn(`   Line ${warn.line}: ${warn.message}`);
        });
      }

      // Log missing components if any
      if (validation.missingComponents && validation.missingComponents.length > 0) {
        logger.info(`📦 Auto-imported ${validation.missingComponents.length} component(s): ${validation.missingComponents.join(', ')}`);
      }
      // ================================================================

      // ✅ PROCESSING PIPELINE (ORDER MATTERS!)
      let code = validation.code;

      // Step 1: Post-process JSX errors (fix Link tags, metadata)
      // Note: AST already handles most of these, but keep for regex fallback
      if (!usedAST) {
        code = postProcessJSXCode(code, pageName);
        code = validateJSXCode(code);
      } else {
        logger.debug('⏭️ Skipping post-process (AST already applied fixes)');
      }

      // Step 2: Apply general fixes (component names, etc.)
      code = validateAndFixPageCode(code, projectAnalysis, pageName);

      // Step 3: Vite-specific transformations
      if (isVite) {
        code = code.replace(/from ['"]next\/router['"]/g, 'from "react-router-dom"');
        code = code.replace(/from ['"]next\/link['"]/g, 'from "react-router-dom"');
        logger.debug('🔄 Applied Vite-specific transformations');
      }

      // Step 4: Component name fixes (common AI mistakes)
      code = code.replace(/CardBody/g, 'CardContent');

      // Step 5: Ensure React import
      if (!code.includes('import React')) {
        code = `import React from 'react';\n${code}`;
        logger.debug('📦 Added React import');
      }

      // ✅ SUCCESS LOGGING
      const lineCount = code.split('\n').length;
      logger.info(`✅ Generated ${pageName} successfully (${lineCount} lines)`);
      logger.info(`📊 Validation method: ${validationMethod}`);

      if (validation.warnings && validation.warnings.length > 0) {
        logger.warn(`⚠️ ${validation.warnings.length} warning(s) (non-critical)`);
      }

      if (validation.correctedImports && validation.correctedImports.length > 0) {
        logger.info(`🔧 ${validation.correctedImports.length} import path(s) auto-corrected`);
      }

      // Log summary for debugging
      const summary = {
        component: pageName,
        lines: lineCount,
        validationMethod: validationMethod,
        astUsed: usedAST,
        fixes: validation.fixes?.length || 0,
        warnings: validation.warnings?.length || 0,
        jsxErrors: validation.jsxErrors?.length || 0,
        autoImports: validation.missingComponents?.length || 0
      };
      logger.debug('Generation summary:', JSON.stringify(summary, null, 2));

      // ================================================================
      // ✅ RETURN: Code + Validation metadata for tracking
      // ================================================================
      return {
        code,
        validationMethod,
        lineCount
      };
      // ================================================================

    } catch (error) {
      lastError = error;
      logger.warn(`⚠️ Attempt ${attempt}/${maxAttempts} failed for ${pageName}:`, error.message);

      if (attempt < maxAttempts) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        logger.info(`⏳ Waiting ${waitTime / 1000}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  // ALL RETRIES FAILED
  logger.error(`❌ Failed to generate ${pageName} after ${maxAttempts} attempts`);
  logger.error(`Last error: ${lastError.message}`);
  logger.error(`Stack trace:`, lastError.stack);
  
  throw new Error(`AI generation failed for ${pageName} after ${maxAttempts} attempts: ${lastError.message}`);
}



 

// ============================
// MAIN CLASS
// ============================

class ProjectBuilderAgent {
  constructor() {
    this.projectPath = null;
    this.projectAnalysis = null;
    this.projectPlan = null;
    this.installedComponents = {};
  }

  /**
   * Main build project method with name sanitization and validation
   */
  /**
 * ✅ PRODUCTION READY: Build project with State Manager integration
 */
/**
 * ✅ PRODUCTION READY: Build project with State Manager + Null Safety
 */
async buildProject(userPrompt, projectPath) {
  try {
    logger.info('🚀 Smart Project Builder started');
    logger.info('📝 User Request:', userPrompt);

    // ✅ FIX: Validate and sanitize project name FIRST
    const rawName = path.basename(projectPath);
    const sanitizedName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    if (sanitizedName !== rawName) {
      logger.warn(`⚠️ Project name contains uppercase or special characters: "${rawName}"`);
      logger.info(`📝 npm requires lowercase alphanumeric names with dashes/underscores only`);

      const choice = await vscode.window.showWarningMessage(
        `Project name "${rawName}" is not valid for npm.\n\nnpm requires lowercase letters, numbers, dashes, and underscores only.\n\nRename to "${sanitizedName}"?`,
        { modal: true },
        'Yes, rename it',
        'Cancel'
      );

      if (choice !== 'Yes, rename it') {
        logger.info('❌ User cancelled due to naming issue');
        return { success: false, error: 'Project name must follow npm naming conventions (lowercase only)' };
      }

      // Update project path with sanitized name
      projectPath = path.join(path.dirname(projectPath), sanitizedName);
      logger.info(`✅ Project renamed to: ${sanitizedName}`);
      logger.info(`✅ New path: ${projectPath}`);
    }

    this.projectPath = projectPath;
    const projectSession = require('../services/projectSession');

    // ================================================================
    // ✅ FIXED: Always initialize State Manager
    // ================================================================
    const StateManager = require('../services/stateManager');
    this.stateManager = new StateManager(projectPath);

    // Check if this is a resume or fresh build
    const folderExists = await this.folderExists(projectPath);

    if (folderExists) {
      const isEmpty = await this.folderIsEmpty(projectPath);
      
      if (!isEmpty) {
        // Try to load existing manifest
        try {
          await this.stateManager.initialize();
          const summary = this.stateManager.getSummary();
          
          logger.info(`📊 Found existing project with ${summary.components} components installed`);
          
          const choice = await vscode.window.showInformationMessage(
            `Folder "${path.basename(projectPath)}" already exists.\n\n` +
            `Progress: ${summary.progress} steps complete\n` +
            `Components: ${summary.components} installed\n` +
            `API Calls: ${summary.apiCalls} (${summary.tokens} tokens, ${summary.cost})\n\n` +
            `What would you like to do?`,
            { modal: true },
            'Resume Build',
            'Start Fresh',
            'Cancel'
          );

          if (choice === 'Cancel') {
            logger.info('User cancelled build');
            return { success: false, error: 'User cancelled' };
          }

          if (choice === 'Start Fresh') {
            logger.info('User chose to start fresh, clearing manifest...');
            await this.stateManager.initialize(); // Creates fresh state
          } else {
            logger.info('User chose to resume build');
          }
        } catch (error) {
          // No manifest or corrupted, ask user
          const choice = await vscode.window.showWarningMessage(
            `Folder "${path.basename(projectPath)}" is not empty. Continue and potentially overwrite files?`,
            { modal: true },
            'Continue',
            'Cancel'
          );

          if (choice !== 'Continue') {
            logger.info('User cancelled build due to non-empty folder');
            return { success: false, error: 'Target folder is not empty' };
          }
          
          // Initialize fresh state (folder exists but no manifest)
          await this.stateManager.initialize();
        }
      } else {
        // Empty folder exists, initialize fresh state
        await this.stateManager.initialize();
        logger.info('📄 Initialized state manager for empty folder');
      }
    } else {
      // ✅ CRITICAL FIX: Folder doesn't exist yet
      // Create a temporary state object until folder is created
      logger.info('📄 Pre-initializing state manager (folder will be created during scaffold)');
      
      // Set a flag to initialize properly after scaffold
      this.stateManagerNeedsInit = true;
      
      // Create minimal state to prevent null errors
      this.stateManager.state = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectName: path.basename(projectPath),
        installedComponents: [],
        generatedFiles: [],
        apiUsage: {
          totalTokens: 0,
          totalCalls: 0,
          estimatedCost: 0
        },
        buildSteps: {
          scaffold: false,
          uiLibrary: false,
          components: false,
          pages: false,
          navigation: false
        }
      };
    }
    // ================================================================

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Building Project',
        cancellable: false,
      },
      async (progress) => {
        // ================================================================
        // ✅ DEFENSIVE CHECK: Extra safety net
        // ================================================================
        if (!this.stateManager || !this.stateManager.state) {
          logger.warn('⚠️ State manager not properly initialized, applying emergency fix...');
          this.stateManager = this.stateManager || new StateManager(this.projectPath);
          this.stateManager.state = {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            projectName: path.basename(this.projectPath),
            installedComponents: [],
            generatedFiles: [],
            apiUsage: { totalTokens: 0, totalCalls: 0, estimatedCost: 0 },
            buildSteps: { scaffold: false, uiLibrary: false, components: false, pages: false, navigation: false }
          };
        }
        // ================================================================

        // PHASE 1: PROMPT ENGINEERING
        progress.report({ message: 'Analyzing your request...', increment: 5 });
        const promptEngineer = new PromptEngineerAgent();
        const engineeredSpec = await promptEngineer.improvePrompt(userPrompt);

        const showSpec = await vscode.window.showInformationMessage(
          `I understand you want to build:\n\n${engineeredSpec.improvedPrompt}`,
          { modal: true },
          'Yes, build it!',
          'Modify request'
        );

        if (showSpec !== 'Yes, build it!') {
          logger.info('User cancelled or wants to modify');
          return { success: false, reason: 'User cancelled' };
        }

        // PHASE 2: TECH STACK ANALYSIS
        progress.report({ message: 'Analyzing tech stack...', increment: 10 });
        this.projectAnalysis = {
          projectType: engineeredSpec.projectType,
          language: engineeredSpec.language || 'javascript',
          framework: engineeredSpec.projectType === 'nextjs' ? 'next' : 'react',
          reasoning: engineeredSpec.reasoning,
        };
        logger.info(`Selected: ${this.projectAnalysis.projectType} + ${this.projectAnalysis.language}`);

        // PHASE 3: PROJECT PLANNING
        progress.report({ message: 'Creating project plan...', increment: 10 });
        this.projectPlan = {
          projectName: path.basename(projectPath),
          description: engineeredSpec.improvedPrompt,
          pages: engineeredSpec.keyFeatures.map((feature, idx) => ({
            name: feature.replace(/\s+/g, '') + 'Page',
            route: idx === 0 ? '/' : `/${feature.toLowerCase().replace(/\s+/g, '-')}`,
            description: feature,
            features: [feature],
          })),
          componentNeeds: engineeredSpec.componentNeeds,
        };

        this.projectPlan = await refineComponentNeedsWithRegistry(this.projectPlan);

        // ================================================================
        // ✅ FIXED: Check if scaffold step is complete (with null safety)
        // ================================================================
        if (!this.stateManager.isStepComplete('scaffold')) {
          progress.report({ message: 'Scaffolding...', increment: 20 });
          await this.scaffoldWithOfficialCLI();
          
          // ✅ FIXED: Initialize state manager properly after folder creation
          if (this.stateManagerNeedsInit) {
            logger.info('📄 Initializing state manager after scaffold...');
            await this.stateManager.initialize();
            this.stateManagerNeedsInit = false;
          }
          
          await this.stateManager.markStepComplete('scaffold');
        } else {
          logger.info('⏭️ Skipping scaffold (already complete)');
          progress.report({ message: 'Scaffold already complete...', increment: 20 });
        }
        // ================================================================

        // ✅ NEW: Check if UI library setup is complete
        if (!this.stateManager.isStepComplete('uiLibrary')) {
          progress.report({ message: 'Setting up UI...', increment: 15 });
          await this.setupUILibrary();
          await this.stateManager.markStepComplete('uiLibrary');
        } else {
          logger.info('⏭️ Skipping UI setup (already complete)');
          progress.report({ message: 'UI already configured...', increment: 15 });
        }

        progress.report({ message: 'Creating layout...', increment: 5 });
        await this.createRootLayout();

        progress.report({ message: 'Discovering components...', increment: 10 });
        const selectedComponents = await discoverComponents(this.projectPlan.componentNeeds);

        // ✅ NEW: Check if components are installed
        if (!this.stateManager.isStepComplete('components')) {
          progress.report({ message: 'Installing components...', increment: 15 });
          this.installedComponents = await installComponentsWithFallback(
            selectedComponents, 
            this.projectPath, 
            this.stateManager // ✅ Pass state manager
          );
          await this.stateManager.markStepComplete('components');
        } else {
          logger.info('⏭️ Skipping component installation (already complete)');
          progress.report({ message: 'Components already installed...', increment: 15 });
          // Load installed components from state
          this.installedComponents = selectedComponents;
        }

        progress.report({ message: 'Generating code...', increment: 10 });
        const [generatedPages, failedPages] = await this.generatePages();

        if (generatedPages.length > 1) {
          progress.report({ message: 'Creating navigation...', increment: 5 });
          await this.createNavigationComponent(generatedPages);
          await this.addNavigationToLayout();
        }

        await this.cleanupDuplicateFiles();
        await this.createVSCodeSettings();

        projectSession.setSession({
          projectPath: this.projectPath,
          analysis: this.projectAnalysis,
          plan: this.projectPlan,
          installedComponents: this.installedComponents,
        });

        // ✅ NEW: Show final summary with costs
        const finalSummary = this.stateManager.getSummary();
        logger.info('✅ Complete!');
        logger.info('📊 Build Summary:', JSON.stringify(finalSummary, null, 2));
        
        vscode.window.showInformationMessage(
          `✅ Project "${path.basename(this.projectPath)}" is ready!\n\n` +
          `📊 Summary:\n` +
          `- Components: ${finalSummary.components}\n` +
          `- Files: ${finalSummary.files}\n` +
          `- API Calls: ${finalSummary.apiCalls}\n` +
          `- Tokens Used: ${finalSummary.tokens}\n` +
          `- Estimated Cost: ${finalSummary.cost}\n\n` +
          `Run: cd ${path.basename(this.projectPath)} && npm run dev`
        );
      }
    );

    return { success: true };
  } catch (error) {
    logger.error('Build failed:', error);
    vscode.window.showErrorMessage(`Build failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}



  async folderExists(folderPath) {
    try {
      const stat = await fs.stat(folderPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async folderIsEmpty(folderPath) {
    try {
      const entries = await fs.readdir(folderPath);
      return entries.length === 0;
    } catch {
      return true;
    }
  }

  /**
   * Scaffold with official CLI (Force lowercase project names)
   */
  async scaffoldWithOfficialCLI() {
    const { projectType } = this.projectAnalysis;

    const rawProjectName = path.basename(this.projectPath);
    const projectName = rawProjectName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    if (projectName !== rawProjectName) {
      logger.warn(`⚠️ Project name sanitized: "${rawProjectName}" → "${projectName}" (npm naming rules)`);
      const parentDir = path.dirname(this.projectPath);
      this.projectPath = path.join(parentDir, projectName);
      logger.info(`✅ Updated project path: ${this.projectPath}`);
    }

    const parentDir = path.dirname(this.projectPath);

    if (projectType === 'vite-react') {
      const { language } = this.projectAnalysis;
      const template = language === 'typescript' ? 'react-ts' : 'react';

      await runCommand(builderConfig.cli.vite(projectName, template), parentDir, 'Creating Vite project');
      await runCommand(builderConfig.cli.npmInstall, this.projectPath, 'Installing base deps');

      logger.info('Installing react-router-dom...');
      await runCommand(builderConfig.cli.reactRouterDom, this.projectPath, 'Installing react-router-dom');

      await this.fixViteConfig();
      logger.info('✅ Project scaffolded');
      return;
    }

    if (projectType === 'nextjs') {
      this.projectAnalysis.language = 'typescript';
      logger.info(`📦 Creating Next.js project: "${projectName}" (TypeScript forced)...`);

      let nextOk = false;
      try {
        await runCommand(
          `npx create-next-app@latest ${projectName} --typescript --tailwind --eslint --app --no-src-dir --use-npm --yes`,
          parentDir,
          'Creating Next.js project'
        );
        nextOk = true;
      } catch (error) {
        logger.error('Creating Next.js project failed:', error);
      }

      if (!nextOk) {
        throw new Error('Next.js scaffolding failed. Aborting build.');
      }

      logger.info('✅ Project scaffolded');
      return;
    }

    throw new Error(`Unsupported project type: ${projectType}`);
  }

  async fixViteConfig() {
    const { language } = this.projectAnalysis;
    const ext = language === 'typescript' ? 'ts' : 'js';

    const fixedConfig = `import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});`;

    await fileSystem.writeFile(this.projectPath, `vite.config.${ext}`, fixedConfig);
    logger.info('✅ Fixed vite.config');
  }

  /**
 * ✅ PRODUCTION READY: Setup UI Library with package.json validation
 * Prevents "Invalid Version" errors during Tailwind installation
 */
async setupUILibrary() {
  const { language } = this.projectAnalysis;
  const isTypeScript = language === 'typescript';

  await this.createConfigFiles();

  // ================================================================
  // ✅ NEW: Validate package.json before installing Tailwind
  // ================================================================
  logger.info('🔍 Validating package.json...');
  const packageJsonPath = path.join(this.projectPath, 'package.json');
  
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    
    // Check for empty or invalid version
    if (!packageJson.version || packageJson.version.trim() === '') {
      logger.warn('⚠️ Invalid package.json detected (empty version), fixing...');
      packageJson.version = '0.1.0';
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      logger.info('✅ Fixed package.json version to 0.1.0');
    } else {
      logger.info(`✅ package.json is valid (version: ${packageJson.version})`);
    }

    // Additional validation checks
    if (!packageJson.name || packageJson.name.trim() === '') {
      logger.warn('⚠️ Invalid package.json detected (empty name), fixing...');
      packageJson.name = path.basename(this.projectPath);
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      logger.info(`✅ Fixed package.json name to ${packageJson.name}`);
    }

  } catch (error) {
    logger.error('❌ Failed to validate package.json:', error.message);
    
    // Provide detailed error message
    const errorMessage = error.code === 'ENOENT' 
      ? 'package.json not found. create-next-app may have failed.'
      : `package.json validation failed: ${error.message}`;
    
    throw new Error(
      `${errorMessage}\n\n` +
      'Recovery steps:\n' +
      '1. Run: npm cache clean --force\n' +
      `2. Delete folder: ${this.projectPath}\n` +
      '3. Re-run the build command'
    );
  }
  // ================================================================

  logger.info('Installing Tailwind CSS v3...');
  const tailwindResult = await runCommand(
    builderConfig.cli.tailwindV3,
    this.projectPath,
    'Installing Tailwind v3'
  );

  if (!tailwindResult.success) {
    logger.error('Tailwind installation failed!');
    
    // ================================================================
    // ✅ NEW: Better error message with actionable steps
    // ================================================================
    const errorDetails = tailwindResult.error?.stderr || tailwindResult.error?.stdout || 'Unknown error';
    
    // Check for specific error patterns
    if (errorDetails.includes('Invalid Version')) {
      throw new Error(
        '❌ Tailwind installation failed due to corrupted package.json.\n\n' +
        'Recovery steps:\n' +
        '1. Run in terminal: npm cache clean --force\n' +
        `2. Delete folder: ${this.projectPath}\n` +
        '3. Re-run the build command with a different project name\n' +
        '4. Avoid names like "sass", "react", "next" (reserved package names)\n\n' +
        `Error details: ${errorDetails}`
      );
    }
    
    if (errorDetails.includes('EACCES') || errorDetails.includes('permission denied')) {
      throw new Error(
        '❌ Tailwind installation failed due to permission issues.\n\n' +
        'Recovery steps:\n' +
        '1. Close all VS Code windows\n' +
        '2. Run terminal as Administrator\n' +
        '3. Run: npm cache clean --force\n' +
        '4. Re-run the build command\n\n' +
        `Error details: ${errorDetails}`
      );
    }

    if (errorDetails.includes('ENOTFOUND') || errorDetails.includes('network')) {
      throw new Error(
        '❌ Tailwind installation failed due to network issues.\n\n' +
        'Recovery steps:\n' +
        '1. Check your internet connection\n' +
        '2. Try again in a few minutes\n' +
        '3. If using a proxy, configure npm proxy settings\n\n' +
        `Error details: ${errorDetails}`
      );
    }
    
    // Generic error
    throw new Error(
      `❌ Failed to install Tailwind CSS.\n\n` +
      `Error details: ${errorDetails}\n\n` +
      'Recovery steps:\n' +
      '1. Run: npm cache clean --force\n' +
      `2. Delete folder: ${this.projectPath}\n` +
      '3. Re-run the build command'
    );
    // ================================================================
  }

  logger.info('✅ Tailwind CSS v3 installed successfully');

  await this.createTailwindConfig();

  logger.info('Initializing shadcn...');
  const result = await runCommand(
    builderConfig.cli.shadcnInit,
    this.projectPath,
    'Initializing shadcn'
  );

  if (!result.success) {
    logger.warn('shadcn init failed, using manual setup');
    await this.manualShadcnSetup();
  }

  logger.info('✅ UI library ready');
}


  async createConfigFiles() {
    const { language } = this.projectAnalysis;
    const isTypeScript = language === 'typescript';

    if (isTypeScript) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          paths: {
            '@/*': ['./*'],
          },
          plugins: [
            {
              name: 'next',
            },
          ],
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      };

      await fileSystem.writeFile(this.projectPath, 'tsconfig.json', JSON.stringify(tsconfig, null, 2));
      logger.info('✅ Created tsconfig.json with path aliases');
    } else {
      const jsconfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
          },
        },
        include: ['src'],
        exclude: ['node_modules'],
      };

      await fileSystem.writeFile(this.projectPath, 'jsconfig.json', JSON.stringify(jsconfig, null, 2));
      logger.info('✅ Created jsconfig.json');
    }
  }

  async createTailwindConfig() {
    const { language, projectType } = this.projectAnalysis;
    const isTypeScript = language === 'typescript';

    const postcssConfig = `export default {
  plugins: {
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};`;

    await fileSystem.writeFile(this.projectPath, 'postcss.config.js', postcssConfig);

    const contentPaths =
      projectType === 'nextjs'
        ? `"./app/**/*.{js,jsx,ts,tsx}",\n    "./components/**/*.{js,jsx,ts,tsx}"`
        : `"./index.html",\n    "./src/**/*.{js,jsx,ts,tsx}"`;

    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    ${contentPaths}
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};`;

    await fileSystem.writeFile(this.projectPath, 'tailwind.config.js', tailwindConfig);

    const indexCss =
      projectType === 'nextjs'
        ? `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`
        : `@tailwind base;
@tailwind components;
@tailwind utilities;`;

    const cssPath = projectType === 'nextjs' ? 'app/globals.css' : 'src/index.css';
    await fileSystem.writeFile(this.projectPath, cssPath, indexCss);
    logger.info('✅ Created Tailwind config');
  }

  async manualShadcnSetup() {
    const { language } = this.projectAnalysis;
    const isTypeScript = language === 'typescript';

    await runCommand(builderConfig.cli.shadcnDeps, this.projectPath, 'Installing shadcn deps');

    const componentsJson = {
      $schema: 'https://ui.shadcn.com/schema.json',
      style: 'new-york',
      rsc: false,
      tsx: isTypeScript,
      tailwind: {
        config: 'tailwind.config.js',
        css: 'src/index.css',
        baseColor: 'slate',
        cssVariables: true,
      },
      aliases: {
        components: '@/components',
        utils: '@/lib/utils',
        ui: '@/components/ui',
      },
    };

    await fileSystem.writeFile(this.projectPath, 'components.json', JSON.stringify(componentsJson, null, 2));
    await fileSystem.createDirectory(this.projectPath, 'src/lib');

    const utilsCode = `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}`;

    await fileSystem.writeFile(this.projectPath, `src/lib/utils.${isTypeScript ? 'ts' : 'js'}`, utilsCode);
    logger.info('✅ Manual shadcn setup complete');
  }

  async createRootLayout() {
    const { language, projectType } = this.projectAnalysis;
    if (projectType !== 'nextjs') return;

    const isTS = language === 'typescript';
    const ext = isTS ? 'tsx' : 'jsx';

    const sanitizedDescription = this.projectPlan.description
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .substring(0, 160);

    const layoutCode = isTS
      ? `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${this.projectPlan.projectName}',
  description: '${sanitizedDescription}',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`
      : `import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`;

    await fileSystem.writeFile(this.projectPath, `app/layout.${ext}`, layoutCode);
    logger.info('✅ Created root layout');
  }

  /**
   * ✅ FIX #5: Create navigation component with sanitized routes and unique keys
   */
  async createNavigationComponent(pages) {
    const { language, projectType } = this.projectAnalysis;
    if (projectType !== 'nextjs') return;

    const isTS = language === 'typescript';
    const ext = isTS ? 'tsx' : 'jsx';

    // ✅ Use sanitized routes from generated pages
    const routes = pages
      .filter((p) => p.sanitizedRoute !== '/')
      .map((p) => ({
        path: p.sanitizedRoute || p.route,
        label: p.name.replace(/Page$/, '').replace(/([A-Z])/g, ' $1').trim(),
      }));

    const navCode = `'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Navigation() {
  const pathname = usePathname()

  const routes = [
    { path: '/', label: 'Home' },
${routes.map((r, index) => `    { path: '${r.path}', label: '${r.label}' }`).join(',\n')}
  ]

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          ${this.projectPlan.projectName}
        </Link>
        <div className="flex gap-2">
          {routes.map((route, index) => (
            <Link
              key={\`\${route.path}-\${index}\`}
              href={route.path}
              className={\`px-4 py-2 rounded-md transition-all duration-200 \${
                pathname === route.path
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }\`}
            >
              {route.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}`;

    await fileSystem.createDirectory(this.projectPath, 'components');
    await fileSystem.writeFile(this.projectPath, `components/navigation.${ext}`, navCode);
    logger.info('✅ Created navigation component with sanitized routes');
  }

  async addNavigationToLayout() {
    const { language, projectType } = this.projectAnalysis;
    if (projectType !== 'nextjs') return;

    const isTS = language === 'typescript';
    const ext = isTS ? 'tsx' : 'jsx';
    const layoutPath = path.join(this.projectPath, `app/layout.${ext}`);

    try {
      let layoutContent = await fs.readFile(layoutPath, 'utf-8');

      if (!layoutContent.includes('Navigation')) {
        layoutContent = layoutContent.replace(
          /import.*?globals\.css['"]/,
          `import './globals.css'\nimport { Navigation } from '@/components/navigation'`
        );

        layoutContent = layoutContent.replace(
          /<body[^>]*>({children}|{\s*children\s*})<\/body>/,
          `<body className={inter.className}>\n        <Navigation />\n        {children}\n      </body>`
        );

        await fs.writeFile(layoutPath, layoutContent);
        logger.info('✅ Added navigation to layout');
      }
    } catch (error) {
      logger.warn('Could not add navigation to layout:', error.message);
    }
  }

  /**
   * ✅ FIX #6: Generate pages with sanitized routes and component names
   */
  /**
 * ✅ PRODUCTION READY: Generate pages with state tracking
 */ 
async generatePages() {
  const { pages } = this.projectPlan;
  const { language, projectType } = this.projectAnalysis;
  const isTS = language === 'typescript';
  const ext = isTS ? 'tsx' : 'jsx';

  const generatedPages = [];
  const failedPages = [];

  for (const page of pages) {
    logger.info(`Generating ${page.name}...`);

    try {
      // ✅ FIX: Sanitize component name properly
      const componentName = sanitizeComponentName(page.name);
      logger.info(`✅ Sanitized: "${page.name}" → "${componentName}"`);

      // ================================================================
      // ✅ NEW: Pass stateManager to generatePageCode
      // ================================================================
      const result = await generatePageCode(
        componentName,
        page.description,
        this.installedComponents,
        this.projectAnalysis,
        this.projectPath,
        this.stateManager // ✅ Pass state manager for API tracking
      );

      const code = result.code;
      const validationMethod = result.validationMethod;
      const lineCount = result.lineCount;
      // ================================================================

      let relativePath;
      let sanitizedRoute = page.route;

      if (projectType === 'nextjs') {
        // ✅ FIX: Sanitize route before creating folder
        if (page.route !== '/') {
          sanitizedRoute = sanitizeRouteName(page.route);
          logger.info(`✅ Route: "${page.route}" → "${sanitizedRoute}"`);
        }

        if (sanitizedRoute === '/') {
          relativePath = path.join('app', 'page.tsx');
        } else {
          const routeSegments = sanitizedRoute.replace(/^\//, '').split('/');
          relativePath = path.join('app', ...routeSegments, 'page.tsx');
        }
      } else {
        relativePath = path.join('src', 'pages', `${componentName}.${ext}`);
      }

      const absPath = path.join(this.projectPath, relativePath);
      const dir = path.dirname(absPath);

      await fileSystem.createDirectory(this.projectPath, path.relative(this.projectPath, dir));
      await fileSystem.writeFile(this.projectPath, relativePath, code);

      logger.info(`✅ Created: ${relativePath}`);

      // ================================================================
      // ✅ NEW: Track generated file in state
      // ================================================================
      if (this.stateManager) {
        await this.stateManager.addGeneratedFile(
          relativePath,
          componentName,
          validationMethod,
          lineCount
        );
        logger.debug(`📝 Tracked file: ${relativePath} in manifest`);
      }
      // ================================================================

      generatedPages.push({
        ...page,
        name: componentName,
        file: relativePath,
        sanitizedRoute: sanitizedRoute, // ✅ Store for navigation
      });
    } catch (error) {
      logger.error(`Failed ${page.name}:`, error.message);
      failedPages.push({ name: page.name, route: page.route, error: error.message });
    }
  }

  // Generate App.jsx/tsx for Vite
  if (projectType === 'vite-react' && generatedPages.length > 0) {
    const appCode = this.generateAppCode(generatedPages, ext);
    await fileSystem.writeFile(this.projectPath, `src/App.${ext}`, appCode);
    await this.validateMainJsx(ext);
  }

  logger.info(`✅ Pages: ${generatedPages.length}/${pages.length}`);

  if (failedPages.length > 0) {
    logger.warn('Failed:', failedPages.map((p) => p.name).join(', '));
    vscode.window
      .showWarningMessage(
        `Project created with ${generatedPages.length}/${pages.length} pages. Failed: ${failedPages.map((p) => p.name).join(', ')}.`,
        'View Logs'
      )
      .then((selection) => {
        if (selection === 'View Logs') {
          vscode.commands.executeCommand('workbench.action.output.toggleOutput');
        }
      });
  }

  return [generatedPages, failedPages];
}


  async validateMainJsx(ext) {
    const mainPath = path.join(this.projectPath, `src/main.${ext}`);

    try {
      let content = await fs.readFile(mainPath, 'utf-8');
      if (!content.includes("import './index.css'")) {
        logger.warn('main.jsx missing CSS import, fixing...');
        content = content.replace(/import App from '\.\/App'/, `import './index.css'\nimport App from './App'`);
        await fs.writeFile(mainPath, content);
        logger.info('✅ Fixed main.jsx CSS import');
      }
    } catch (error) {
      logger.error('Failed to validate main.jsx:', error);
    }
  }

  generateAppCode(pages, ext) {
    if (pages.length === 1) {
      const page = pages[0];
      return `import React from 'react';
import ${page.name} from './pages/${page.name}';

function App() {
  return <${page.name} />;
}

export default App;`;
    }

    const imports = pages.map((p) => `import ${p.name} from './pages/${p.name}';`).join('\n');
    const routes = pages.map((p) => `<Route path="${p.route}" element={<${p.name} />} />`).join('\n        ');

    return `import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
${imports}

function App() {
  return (
    <Router>
      <Routes>
        ${routes}
      </Routes>
    </Router>
  );
}

export default App;`;
  }

  async cleanupDuplicateFiles() {
    const appPath = path.join(this.projectPath, 'app');

    try {
      const files = await fs.readdir(appPath, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.js')) {
          const tsxVersion = file.name.replace('.js', '.tsx');
          const tsxPath = path.join(appPath, tsxVersion);

          try {
            await fs.access(tsxPath);
            const jsPath = path.join(appPath, file.name);
            await fs.unlink(jsPath);
            logger.info(`🗑️ Removed duplicate: ${file.name} (${tsxVersion} exists)`);
          } catch {
            // TSX doesn't exist, keep JS
          }
        }
      }
    } catch (error) {
      logger.warn('Could not cleanup duplicate files:', error.message);
    }
  }

  async createVSCodeSettings() {
    const settings = {
      'css.lint.unknownAtRules': 'ignore',
      'scss.lint.unknownAtRules': 'ignore',
      'less.lint.unknownAtRules': 'ignore',
      'tailwindCSS.experimental.classRegex': [
        ['cva\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
        ['cx\\(([^)]*)\\)', "(?:'|\"|`)([^']*)(?:'|\"|`)"],
      ],
    };

    try {
      await fileSystem.createDirectory(this.projectPath, '.vscode');
      await fileSystem.writeFile(this.projectPath, '.vscode/settings.json', JSON.stringify(settings, null, 2));
      logger.info('✅ Created VS Code settings');
    } catch (error) {
      logger.warn('Could not create VS Code settings:', error.message);
    }
  }
}

module.exports = ProjectBuilderAgent;
