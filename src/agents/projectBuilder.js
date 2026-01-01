/**
 * Project Builder Agent - PRODUCTION READY WITH ALL FIXES
 * Handles complete project scaffolding with proper error handling
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
const CodeValidator = require('../utils/codeValidator'); // ✅ ADDED

// ============================
// HELPER FUNCTIONS
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
 * Convert Next.js route to file path
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
 * Sanitize route names for Next.js (remove special regex characters)
 * FIX: Prevents "Invalid regular expression" errors
 */
function sanitizeRouteName(name) {
  return name
    .toLowerCase()
    .replace(/[()[\]{}+*?^$|\\]/g, '')  // Remove regex special chars
    .replace(/\s+/g, '-')                // Spaces to dashes
    .replace(/[^a-z0-9-_]/g, '-')        // Only allow alphanumeric, dash, underscore
    .replace(/-+/g, '-')                 // Collapse multiple dashes
    .replace(/^-|-$/g, '');              // Trim dashes from ends
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
async function installComponentsWithFallback(selectedComponents, projectPath) {
  logger.info('📦 Installing components...');

  const installedComponents = {};
  const failedComponents = [];

  for (const [registryId, components] of Object.entries(selectedComponents)) {
    if (!components || components.length === 0) continue;

    logger.info(`Installing from ${registryId}:`, components);

    const result = await registryTools.installComponents(registryId, components, projectPath);

    if (result.installed && result.installed.length > 0) {
      installedComponents[registryId] = result.installed;
      logger.info(`✅ Installed ${result.installed.length} from ${registryId}`);
    }

    if (result.failed && result.failed.length > 0) {
      failedComponents.push(...result.failed.map((name) => ({ registry: registryId, component: name })));
    }
  }

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
        logger.info(`Fallback for ${component} → ${fallback}`);
        const result = await registryTools.installComponents('shadcn', [fallback], projectPath);
        if (result.installed && result.installed.length > 0) {
          if (!installedComponents.shadcn) installedComponents.shadcn = [];
          if (!installedComponents.shadcn.includes(fallback)) {
            installedComponents.shadcn.push(fallback);
          }
        }
      }
    }
  }

  if (!installedComponents.shadcn || installedComponents.shadcn.length === 0) {
    logger.warn('No components installed, forcing baseline shadcn components...');
    const result = await registryTools.installComponents('shadcn', builderConfig.shadcnBaselineComponents, projectPath);
    if (result.installed && result.installed.length > 0) {
      installedComponents.shadcn = result.installed;
    }
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

  const hasMainOpen = /<main/.test(code);
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
 * Generate page code with validation
 */
async function generatePageCode(pageName, pageDesc, installedComponents, projectAnalysis, projectPath) {
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
4. **NAVIGATION: ALWAYS use Next.js Link component**
   - Import: import Link from 'next/link'
   - For buttons with links: <Link href="/route"><Button>Text</Button></Link>
   - NEVER use <a href="#"> - always provide valid routes like "/contact", "/about"
5. **DATA: Provide default/mock data for all arrays**
   - Example: const features = [{ id: 1, title: 'Feature 1', icon: '🚀', description: 'Details...' }]
   - NEVER leave arrays undefined or expect props
6. Use components from the available imports list - select the BEST registry for each UI element
7. Follow the design system spacing, typography, and responsive rules
8. Create a visually balanced, professional layout with proper hierarchy
9. Use Tailwind for all styling - NO custom CSS
10. **INTERACTION: Add proper hover states**
    - Cards: hover:shadow-2xl hover:-translate-y-1 transition-all duration-300
    - Buttons: hover:scale-105 transition-transform
    - Links: hover:text-primary transition-colors
11. **VISUAL DEPTH: Use gradients and shadows**
    - Add gradient accents: bg-gradient-to-r from-primary/10 to-transparent
    - Layer shadows: shadow-md hover:shadow-xl
12. ALWAYS fully close all JSX tags and strings
13. Make it responsive: mobile-first design
14. NO comments, NO explanations, NO markdown fences
15. Return ONLY the code

Generate the code now:`;

  // RETRY LOGIC WITH VALIDATION
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`Generating ${pageName} (attempt ${attempt}/${maxAttempts})...`);

      const response = await aiClient.generate(codePrompt, {
        systemPrompt: `You are a senior frontend developer specializing in React and Next.js. 

CRITICAL NEXT.JS RULES:
- Page components in Next.js App Router DO NOT receive props
- ALWAYS provide default/mock data inside the component
- Use Next.js Link for all navigation: import Link from 'next/link'
- Example: const data = [{ id: 1, name: 'Item 1', icon: '🚀', description: 'Details' }]
- Add visual depth with gradients, shadows, and hover effects
- Ensure color contrast between normal and hover states

Generate production-quality, visually appealing components following design best practices. Return only valid JSX/TSX code with no markdown, explanations, or comments.`,
        maxTokens: 10000,
        temperature: 0.5 - attempt * 0.1,
      });

      // ✅ VALIDATE with project path
      const validation = await CodeValidator.validate(response, pageName, `${pageName.toLowerCase()}.tsx`, projectPath);

      if (!validation.success) {
        logger.error(`Validation failed for ${pageName}:`, validation.error);

        if (attempt < maxAttempts) {
          logger.warn(`Retrying generation (attempt ${attempt + 1})...`);
          continue;
        }

        throw new Error(`Failed to generate valid code after ${maxAttempts} attempts: ${validation.error}`);
      }

      // ✅ Use validated & fixed code
      let code = validation.code;

      // Apply existing post-processing
      code = validateAndFixPageCode(code, projectAnalysis, pageName);

      if (isVite) {
        code = code.replace(/from ['"]next\/router['"]/g, 'from "react-router-dom"');
        code = code.replace(/from ['"]next\/link['"]/g, 'from "react-router-dom"');
      }

      code = code.replace(/CardBody/g, 'CardContent');
      code = code.replace(/<Link>/g, '<div>');
      code = code.replace(/<\/Link>/g, '</div>');

      if (!code.includes('import React')) {
        code = `import React from 'react';\n${code}`;
      }

      const lineCount = code.split('\n').length;
      logger.info(`✅ Generated ${pageName} successfully (${lineCount} lines)`);
      if (validation.warnings.length > 0) {
        logger.warn(`⚠️  ${validation.warnings.length} warnings (auto-fixed)`);
      }

      return code;
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed for ${pageName}:`, error.message);

      if (attempt < maxAttempts) {
        const waitTime = Math.pow(2, attempt) * 1000;
        logger.info(`Waiting ${waitTime / 1000}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  // ALL RETRIES FAILED
  logger.error(`Failed to generate ${pageName} after ${maxAttempts} attempts`);
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
   * Main build project method
   */
  /**
 * Main build project method with name sanitization and validation
 */
async buildProject(userPrompt, projectPath) {
  try {
    logger.info('🚀 Smart Project Builder started');
    logger.info('📝 User Request:', userPrompt);

    // ✅ FIX: Validate and sanitize project name FIRST
    const rawName = path.basename(projectPath);
    const sanitizedName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    
    if (sanitizedName !== rawName) {
      logger.warn(`⚠️  Project name contains uppercase or special characters: "${rawName}"`);
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

    // Check if folder exists and is empty
    const folderExists = await this.folderExists(projectPath);
    if (folderExists) {
      const isEmpty = await this.folderIsEmpty(projectPath);
      if (!isEmpty) {
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
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Building Project',
        cancellable: false,
      },
      async (progress) => {
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
          projectName: path.basename(projectPath), // ✅ Use sanitized name
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

        progress.report({ message: 'Scaffolding...', increment: 20 });
        await this.scaffoldWithOfficialCLI(); // ✅ Will use sanitized name from this.projectPath

        progress.report({ message: 'Setting up UI...', increment: 15 });
        await this.setupUILibrary();

        // ✅ CREATE ROOT LAYOUT
        progress.report({ message: 'Creating layout...', increment: 5 });
        await this.createRootLayout();

        progress.report({ message: 'Discovering components...', increment: 10 });
        const selectedComponents = await discoverComponents(this.projectPlan.componentNeeds);

        progress.report({ message: 'Installing components...', increment: 15 });
        this.installedComponents = await installComponentsWithFallback(selectedComponents, this.projectPath);

        progress.report({ message: 'Generating code...', increment: 10 });
        const [generatedPages, failedPages] = await this.generatePages();

        // ✅ CREATE NAVIGATION COMPONENT
        if (generatedPages.length > 1) {
          progress.report({ message: 'Creating navigation...', increment: 5 });
          await this.createNavigationComponent(generatedPages);
          await this.addNavigationToLayout();
        }

        // ✅ CLEANUP DUPLICATES
        await this.cleanupDuplicateFiles();

        // ✅ CREATE VSCODE SETTINGS
        await this.createVSCodeSettings();

        projectSession.setSession({
          projectPath: this.projectPath,
          analysis: this.projectAnalysis,
          plan: this.projectPlan,
          installedComponents: this.installedComponents,
        });

        logger.info('✅ Complete!');
        vscode.window.showInformationMessage(
          `✅ Project "${path.basename(this.projectPath)}" is ready!\n\nRun: cd ${path.basename(this.projectPath)} && npm run dev`
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
   * Scaffold with official CLI (FIX #2: Force TypeScript for Next.js)
   */
/**
 * Scaffold with official CLI (FIX: Force lowercase project names)
 */
async scaffoldWithOfficialCLI() {
  const { projectType } = this.projectAnalysis;
  
  // ✅ FIX: Sanitize project name to lowercase (npm requirement)
  const rawProjectName = path.basename(this.projectPath);
  const projectName = rawProjectName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  
  if (projectName !== rawProjectName) {
    logger.warn(`⚠️  Project name sanitized: "${rawProjectName}" → "${projectName}" (npm naming rules)`);
    // Update the project path to use sanitized name
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
    // ✅ FIX: FORCE TYPESCRIPT FOR NEXT.JS
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

  async setupUILibrary() {
    const { language } = this.projectAnalysis;
    const isTypeScript = language === 'typescript';

    await this.createConfigFiles();

    logger.info('Installing Tailwind CSS v3...');
    const tailwindResult = await runCommand(builderConfig.cli.tailwindV3, this.projectPath, 'Installing Tailwind v3');

    if (!tailwindResult.success) {
      logger.error('Tailwind installation failed!');
      throw new Error('Failed to install Tailwind CSS');
    }

    await this.createTailwindConfig();

    logger.info('Initializing shadcn...');
    const result = await runCommand(builderConfig.cli.shadcnInit, this.projectPath, 'Initializing shadcn');

    if (!result.success) {
      logger.warn('shadcn init failed, using manual setup');
      await this.manualShadcnSetup();
    }

    logger.info('✅ UI library ready');
  }

  /**
   * Create config files (FIX #5: Add path aliases)
   */
  async createConfigFiles() {
    const { language } = this.projectAnalysis;
    const isTypeScript = language === 'typescript';

    if (isTypeScript) {
    // ✅ FIXED: Use paths without deprecated baseUrl
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
        // ✅ FIX: Modern path mapping without baseUrl
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

    // ✅ FIX #8: Proper content paths for both App Router and src
    const contentPaths = projectType === 'nextjs' 
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

    // ✅ FIX: Proper CSS with @tailwind directives FIRST
    const indexCss = projectType === 'nextjs' ? `@tailwind base;
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
}` : `@tailwind base;
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

  /**
   * ✅ FIX #1: Create root layout file (CRITICAL)
   */
async createRootLayout() {
  const { language, projectType } = this.projectAnalysis;

  if (projectType !== 'nextjs') return;

  const isTS = language === 'typescript';
  const ext = isTS ? 'tsx' : 'jsx';

  // ✅ FIX: Truncate and sanitize description to avoid parsing errors
  const sanitizedDescription = this.projectPlan.description
    .replace(/"/g, '\\"') // Escape quotes
    .replace(/\n/g, ' ') // Remove newlines
    .substring(0, 160); // Limit length

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
   * ✅ FIX #6: Create navigation component
   */
  /**
 * Create navigation component with sanitized routes
 * FIX: Use sanitized routes from generated pages
 */
async createNavigationComponent(pages) {
  const { language, projectType } = this.projectAnalysis;
  if (projectType !== 'nextjs') return;

  const isTS = language === 'typescript';
  const ext = isTS ? 'tsx' : 'jsx';

  // ✅ FIX: Use sanitized routes from generated pages
  const routes = pages
    .filter(p => p.route !== '/') // Don't duplicate home in the list
    .map((p) => ({
      path: p.sanitizedRoute || p.route, // Use sanitized route if available
      label: p.name.replace(/Page$/, '').replace(/([A-Z])/g, ' $1').trim()
    }));

  const navCode = `'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Navigation() {
  const pathname = usePathname()

  const routes = [
    { path: '/', label: 'Home' },
${routes.map((r) => `    { path: '${r.path}', label: '${r.label}' }`).join(',\n')}
  ]

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          ${this.projectPlan.projectName}
        </Link>
        <div className="flex gap-2">
          {routes.map((route) => (
            <Link
              key={route.path}
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
  logger.info('✅ Created navigation component');
}


  /**
   * Add navigation to layout
   */
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
 * Generate all pages with sanitized routes
 * FIX: Sanitize routes to prevent regex errors in Next.js
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
      // ✅ FIX: Sanitize component name (remove special chars)
      let componentName = page.name.replace(/\s+/g, '');
      componentName = componentName.replace(/[()[\]{}+*?^$|\\]/g, ''); // Remove regex chars
      componentName = componentName.replace(/[^a-zA-Z0-9_]/g, ''); // Only alphanumeric and underscore
      
      if (!componentName) {
        componentName = 'GeneratedPage';
      }

      const code = await generatePageCode(
        componentName,
        page.description,
        this.installedComponents,
        this.projectAnalysis,
        this.projectPath
      );

      let relativePath;
      let sanitizedRoute = page.route; // Keep original for vite

      if (projectType === 'nextjs') {
        // ✅ FIX: Sanitize route before creating folder
        if (page.route !== '/') {
          sanitizedRoute = sanitizeRouteName(page.route);
          logger.info(`✅ Sanitized route: "${page.route}" → "${sanitizedRoute}"`);
        }
        
        if (sanitizedRoute === '/' || page.route === '/') {
          relativePath = path.join('app', 'page.tsx');
        } else {
          // Remove leading slash and create folder path
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

      logger.info(`✅ Created file: ${relativePath}`);
      generatedPages.push({ 
        ...page, 
        name: componentName, 
        file: relativePath,
        sanitizedRoute: sanitizedRoute // ✅ Store sanitized route for navigation
      });
    } catch (error) {
      logger.error(`Failed to generate ${page.name}:`, error.message);
      failedPages.push({ name: page.name, route: page.route, error: error.message });
    }
  }

  // Generate App.jsx/tsx for Vite
  if (projectType === 'vite-react' && generatedPages.length > 0) {
    const appCode = this.generateAppCode(generatedPages, ext);
    await fileSystem.writeFile(this.projectPath, `src/App.${ext}`, appCode);
    await this.validateMainJsx(ext);
  }

  logger.info(`✅ Pages generated: ${generatedPages.length}/${pages.length}`);

  if (failedPages.length > 0) {
    logger.warn('Failed pages:', failedPages.map((p) => p.name).join(', '));
    vscode.window
      .showWarningMessage(
        `Project created with ${generatedPages.length}/${pages.length} pages. Failed: ${failedPages
          .map((p) => p.name)
          .join(', ')}. You can manually create these or retry.`,
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
    const routes = pages.map((p) => `<Route path="${p.route}" element={<${p.name} />} />`).join('\n          ');

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

  /**
   * ✅ Remove duplicate .js files if .tsx versions exist
   */
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
            logger.info(`🗑️  Removed duplicate: ${file.name} (${tsxVersion} exists)`);
          } catch {
            // TSX doesn't exist, keep JS
          }
        }
      }
    } catch (error) {
      logger.warn('Could not cleanup duplicate files:', error.message);
    }
  }

  /**
   * ✅ FIX #7: Create VS Code settings for better DX
   */
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
