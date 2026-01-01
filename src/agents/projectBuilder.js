/**
 * Project Builder Agent - PRODUCTION READY
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


// ========== HELPER FUNCTIONS ==========

async function runCommand(command, cwd, description) {
  logger.info(`Running: ${description}`);
  logger.debug(`Command: ${command}`);

  if (/[;&|]/.test(command) || /rm -rf|del\s+/i.test(command)) {
    throw new Error(`Blocked potentially unsafe command: ${command}`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024
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
      stderr: error.stderr
    });
    return { success: false, error };
  }
}

function routeToNextAppPath(route) {
  if (!route || route === '/') {
    return path.join('app', 'page.tsx');
  }
  const clean = route.replace(/^\//, '');
  const segments = clean.split('/');
  return path.join('app', ...segments, 'page.tsx');
}

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
      temperature: 0.3
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : {
          projectType: 'vite-react',
          language: 'javascript',
          framework: 'react',
          reasoning: 'Default'
        };
  } catch (error) {
    logger.error('Analysis failed, using defaults:', error);
    return {
      projectType: 'vite-react',
      language: 'javascript',
      framework: 'react',
      reasoning: 'Fallback'
    };
  }
}

async function createProjectPlan(userPrompt, projectAnalysis) {
  const planPrompt = `Create project plan for: "${userPrompt}"

Tech: ${projectAnalysis.projectType} + ${projectAnalysis.language}

Return ONLY JSON:
{
  "projectName": "MyApp",
  "description": "Brief description",
  "pages": [
    {
      "name": "HomePage",
      "route": "/",
      "description": "Main landing page",
      "features": ["Hero section", "CTA buttons"]
    }
  ],
  "componentNeeds": {
    "forms": ["input", "button"],
    "dataDisplay": ["card"]
  }
}

Rules:
- Component names lowercase (input, button, card)
- Max 3 pages for MVP
- componentNeeds is an object with categories as keys

Return ONLY JSON.`;

  try {
    const response = await aiClient.generate(planPrompt, {
      systemPrompt: 'You are a project architect. Return valid JSON only.',
      maxTokens: 10000,
      temperature: 0.4
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const plan = JSON.parse(jsonMatch[0]);

    if (!plan.pages || !Array.isArray(plan.pages) || plan.pages.length === 0) {
      plan.pages = [
        {
          name: 'HomePage',
          route: '/',
          description: 'Main page',
          features: ['Content display']
        }
      ];
    }

    if (!plan.componentNeeds || typeof plan.componentNeeds !== 'object') {
      plan.componentNeeds = {
        forms: ['input', 'button'],
        dataDisplay: ['card']
      };
    }

    logger.info('Project plan created:', JSON.stringify(plan, null, 2));
    return plan;
  } catch (error) {
    logger.error('Planning failed, using fallback:', error);
    return {
      projectName: 'MyApp',
      description: 'Generated application',
      pages: [
        {
          name: 'HomePage',
          route: '/',
          description: 'Main page',
          features: ['Content']
        }
      ],
      componentNeeds: {
        forms: ['input', 'button'],
        dataDisplay: ['card']
      }
    };
  }
}

async function refineComponentNeedsWithRegistry(plan) {
  const refined = { ...(plan.componentNeeds || {}) };

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
    pagination: ['pagination']
  };

  for (const page of plan.pages || []) {
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
    'motion-primitives': new Set(motionList.components.map((c) => c.name))
  };

  const invalidComponents = [
    'markdown',
    'navbar',
    'link',
    'monacoeditor',
    'monaco',
    'code-editor',
    'loginform',
    'registerform',
    'form',
    'spinner',
    'check-icon',
    'delete-icon',
    'list',
    'list-item',
    'delete',
    'trash',
    'remove'
  ];

  const normalize = (name) => name.toLowerCase().trim();

  const selectedComponents = {};

  for (const [category, needed] of Object.entries(componentNeeds)) {
    if (!Array.isArray(needed) || needed.length === 0) continue;

    logger.info(`Discovering components for category "${category}":`, needed);

    const targetRegistry = builderConfig.registryForCategory[category] || 'shadcn';
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
        button: 'button'
      };

      const fallback = fallbackMap[name];
      if (fallback && validSet.has(fallback)) {
        logger.info(`Mapped requested "${rawName}" → "${fallback}" in ${targetRegistry}`);
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
      failedComponents.push(
        ...result.failed.map((name) => ({
          registry: registryId,
          component: name
        }))
      );
    }
  }

  if (failedComponents.length > 0) {
    logger.warn(`⚠️ ${failedComponents.length} components failed, trying fallbacks...`);

    const fallbackMap = {
      list: 'card',
      'list-item': 'card',
      navbar: 'button',
      menu: 'dropdown-menu',
      toast: 'alert',
      spinner: 'button',
      loading: 'skeleton'
    };

    for (const { component } of failedComponents) {
      const fallback = fallbackMap[component];

      if (fallback) {
        logger.info(`🔄 Fallback for ${component}: ${fallback}`);

        const result = await registryTools.installComponents('shadcn', [fallback], projectPath);

        if (result.installed && result.installed.length > 0) {
          if (!installedComponents.shadcn) {
            installedComponents.shadcn = [];
          }
          if (!installedComponents.shadcn.includes(fallback)) {
            installedComponents.shadcn.push(fallback);
          }
        }
      }
    }
  }

  if (!installedComponents.shadcn || installedComponents.shadcn.length === 0) {
    logger.warn('No components installed, forcing baseline shadcn components...');

    const result = await registryTools.installComponents(
      'shadcn',
      builderConfig.shadcnBaselineComponents,
      projectPath
    );

    if (result.installed && result.installed.length > 0) {
      installedComponents.shadcn = result.installed;
    }
  }

  logger.info('Final installed components:', installedComponents);
  return installedComponents;
}

function ensureCorrectComponentName(code, expectedName) {
  const functionPattern = /function\s+(\w+)\s*\(/;
  const arrowPattern = /const\s+(\w+)\s*=/;

  let match;
  let actualName = null;

  match = code.match(functionPattern);
  if (match) {
    actualName = match[1];
  } else {
    match = code.match(arrowPattern);
    if (match) {
      actualName = match[1];
    }
  }

  if (actualName && actualName !== expectedName) {
    logger.warn(`Fixing component name: "${actualName}" → "${expectedName}"`);

    code = code.replace(new RegExp(`function\\s+${actualName}\\s*\\(`, 'g'), `function ${expectedName}(`);
    code = code.replace(new RegExp(`const\\s+${actualName}\\s*=`, 'g'), `const ${expectedName} =`);
    code = code.replace(new RegExp(`export default ${actualName}`, 'g'), `export default ${expectedName}`);
  }

  return code;
}

function validateAndFixPageCode(rawCode, projectAnalysis, pageName) {
  let code = rawCode;

  code = code.replace(/``````/gi, '').trim();
  code = ensureCorrectComponentName(code, pageName);

  if (projectAnalysis.language === 'javascript') {
    code = code.replace(/(:\s*React\.FC\b[^=)]*)/g, '');
  }

  const quoteCount = (code.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    code += '"';
  }

  const hasMainOpen = /<main[\s>]/.test(code);
  const hasMainClose = /<\/main>/.test(code);
  if (hasMainOpen && !hasMainClose) {
    code += '\n</main>';
  }

  if (!/export default\s+\w+/.test(code)) {
    code += `\n\nexport default ${pageName}`;
  }

  return code;
}

 


async function generatePageCode(pageName, pageDesc, installedComponents, projectAnalysis) {
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
          // Try to get actual usage from registry first
          try {
            const detailsResult = await registryTools.getComponentDetails('shadcn', [comp]);
            const detail = detailsResult.details.find(d => d.found && d.name === comp);
            if (detail && detail.usage) {
              const usageLines = detail.usage
                .split('\n')
                .filter(line => line.trim().startsWith('import ') && line.includes('from'));
              allImports.push(...usageLines);
              continue;
            }
          } catch (e) {
            // Fall back to constructed import
          }
          importLine = `import { ${pascal} } from '@/components/ui/${comp}'`;
          break;

        case 'magicui':
          importLine = `import { ${pascal} } from '@/components/magicui/${comp}'`;
          break;

        case 'aceternity':
          importLine = `import { ${pascal} } from '@/components/aceternity/${comp}'`;
          break;

        case 'motion-primitives':
          importLine = `import { ${pascal} } from '@/components/motion/${comp}'`;
          break;

        case 'daisyui':
          // DaisyUI uses class names, not imports
          continue;

        default:
          importLine = `import { ${pascal} } from '@/components/${registry}/${comp}'`;
      }

      if (importLine && !allImports.includes(importLine)) {
        allImports.push(importLine);
      }
    }
  }

  // Deduplicate and format imports
  const uniqueImports = [...new Set(allImports)];
  const availableImports = uniqueImports.slice(0, 25).join('\n');

  const codePrompt = `Generate a professional, production-ready React component: "${pageName}"

Description: ${pageDesc}

AVAILABLE COMPONENTS FROM ALL REGISTRIES:
${availableImports || '// No component imports detected. Use plain JSX with Tailwind CSS.'}

DESIGN SYSTEM RULES:
${designSystem.layoutPatterns}
${designSystem.componentSelection}
${designSystem.spacingAndTypography}
${designSystem.responsiveDesign}

CRITICAL REQUIREMENTS:
1. Component name MUST be exactly: ${pageName}
2. Export default: export default ${pageName}
3. Import React: import React from 'react'
4. Use components from the available imports list - select the BEST registry for each UI element
5. Follow the design system spacing, typography, and responsive rules
6. Create a visually balanced, professional layout with proper hierarchy
7. Use Tailwind for all styling - NO custom CSS
8. ALWAYS fully close all JSX tags and strings
9. Make it responsive (mobile-first design)
10. NO comments, NO explanations, NO markdown fences
11. Return ONLY the code

Generate the code now:`;

  // ===== RETRY LOGIC WITH EXPONENTIAL BACKOFF =====
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`Generating ${pageName} (attempt ${attempt}/${maxAttempts})...`);

      const response = await aiClient.generate(codePrompt, {
        systemPrompt: `You are a senior frontend developer specializing in React and modern design systems. 
Generate production-quality, visually appealing components following design best practices. 
Return only valid JSX/TSX code with no markdown, explanations, or comments.`,
        maxTokens: 10000,
        temperature: 0.5 - (attempt * 0.1) // Lower temperature on retries
      });

      let code = validateAndFixPageCode(response, projectAnalysis, pageName);

      // Validate generated code quality
      if (!code.includes('return (')) {
        throw new Error('Generated code missing return statement');
      }

      // Post-processing fixes
      if (isVite) {
        code = code.replace(/from ['"]next\/router['"]/g, "from 'react-router-dom'");
        code = code.replace(/from ['"]next\/link['"]/g, "from 'react-router-dom'");
      }

      // Common component naming fixes
      code = code.replace(/CardBody/g, 'CardContent');
      code = code.replace(/\bList\b/g, 'div');
      code = code.replace(/\bListItem\b/g, 'div');

      // Ensure React import
      if (!code.includes('import React')) {
        code = "import React from 'react'\n" + code;
      }

      logger.info(`✅ Generated ${pageName} successfully (${code.split('\n').length} lines)`);
      return code;

    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed for ${pageName}:`, error.message);

      // If not last attempt, wait before retry (exponential backoff)
      if (attempt < maxAttempts) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        logger.info(`Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // ===== ALL RETRIES FAILED - THROW ERROR =====
  logger.error(`❌ Failed to generate ${pageName} after ${maxAttempts} attempts`);
  throw new Error(`AI generation failed for ${pageName} after ${maxAttempts} attempts: ${lastError.message}`);
}
// === Next.js route → file helper ===

function routeToNextAppPath(route) {
  if (!route || route === '/') {
    return path.join('app', 'page.tsx');
  }

  const clean = route.replace(/^\//, '');
  const segments = clean.split('/');

  return path.join('app', ...segments, 'page.tsx');
}

// ========== MAIN CLASS ==========

class ProjectBuilderAgent {
  constructor() {
    this.projectPath = null;
    this.projectAnalysis = null;
    this.projectPlan = null;
    this.installedComponents = {};
  }

  async buildProject(userPrompt, projectPath) {
    try {
      logger.info('🚀 Project Builder started');
      this.projectPath = projectPath;

      const projectSession = require('../services/projectSession');

      const folderExists = await this._folderExists(projectPath);
      if (folderExists) {
        const isEmpty = await this._folderIsEmpty(projectPath);
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
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: 'Analyzing...', increment: 10 });
          this.projectAnalysis = await analyzeProjectType(userPrompt);
          logger.info(
            `Detected: ${this.projectAnalysis.projectType} + ${this.projectAnalysis.language}`
          );

          progress.report({ message: 'Planning...', increment: 15 });

          try {
            this.projectPlan = await createProjectPlan(userPrompt, this.projectAnalysis);
            this.projectPlan = await refineComponentNeedsWithRegistry(this.projectPlan);
          } catch (e) {
            logger.error('❌ Planning failed:', e);
            vscode.window.showErrorMessage(`Planning failed: ${e.message}`);
            throw e;
          }

          progress.report({ message: 'Scaffolding...', increment: 20 });
          await this.scaffoldWithOfficialCLI();

          progress.report({ message: 'Setting up UI...', increment: 15 });
          await this.setupUILibrary();

          progress.report({ message: 'Discovering components...', increment: 10 });
          const selectedComponents = await discoverComponents(
            this.projectPlan.componentNeeds
          );

          progress.report({ message: 'Installing components...', increment: 15 });
          this.installedComponents = await installComponentsWithFallback(
            selectedComponents,
            this.projectPath
          );

          progress.report({ message: 'Generating code...', increment: 10 });
          await this.generatePages();

          projectSession.setSession({
            projectPath: this.projectPath,
            analysis: this.projectAnalysis,
            plan: this.projectPlan,
            installedComponents: this.installedComponents
          });

          logger.info('✅ Complete!');
          vscode.window.showInformationMessage(
            `✅ Project ready! Run: cd ${path.basename(this.projectPath)} && npm run dev`
          );
        }
      );

      return { success: true };
    } catch (error) {
      logger.error('Build failed:', error);
      vscode.window.showErrorMessage(`❌ Build failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async _folderExists(folderPath) {
    try {
      const stat = await fs.stat(folderPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async _folderIsEmpty(folderPath) {
    try {
      const entries = await fs.readdir(folderPath);
      return entries.length === 0;
    } catch {
      return true;
    }
  }

  async scaffoldWithOfficialCLI() {
    const { projectType, language } = this.projectAnalysis;
    const projectName = path.basename(this.projectPath);
    const parentDir = path.dirname(this.projectPath);

    if (projectType === 'vite-react') {
      const template = language === 'typescript' ? 'react-ts' : 'react';

      await runCommand(
        builderConfig.cli.vite(projectName, template),
        parentDir,
        'Creating Vite project'
      );

      await runCommand(
        builderConfig.cli.npmInstall,
        this.projectPath,
        'Installing base deps'
      );

      logger.info('Installing react-router-dom...');
      await runCommand(
        builderConfig.cli.reactRouterDom,
        this.projectPath,
        'Installing react-router-dom'
      );

      await this.fixViteConfig();

      logger.info('✅ Project scaffolded');
      return;
    }

    if (projectType === 'nextjs') {
      let nextOk = false;
      try {
        await runCommand(
          builderConfig.cli.next(projectName, language),
          parentDir,
          'Creating Next.js project'
        );
        nextOk = true;
      } catch (error) {
        logger.error('❌ Creating Next.js project failed:', error);
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

    const fixedConfig = `import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    },
  },
})`;

    await fileSystem.writeFile(this.projectPath, `vite.config.${ext}`, fixedConfig);
    logger.info('✅ Fixed vite.config');
  }

  async setupUILibrary() {
    const { language } = this.projectAnalysis;
    const isTypeScript = language === 'typescript';

    await this.createConfigFiles();

    logger.info('Installing Tailwind CSS v3...');
    const tailwindResult = await runCommand(
      builderConfig.cli.tailwindV3,
      this.projectPath,
      'Installing Tailwind v3'
    );

    if (!tailwindResult.success) {
      logger.error('Tailwind installation failed!');
      throw new Error('Failed to install Tailwind CSS');
    }

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
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          paths: {
            '@/*': ['./src/*']
          }
        },
        include: ['src']
      };

      await fileSystem.writeFile(
        this.projectPath,
        'tsconfig.json',
        JSON.stringify(tsconfig, null, 2)
      );
      logger.info('✅ Created tsconfig.json');
    } else {
      const jsconfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          paths: {
            '@/*': ['./src/*']
          }
        },
        include: ['src'],
        exclude: ['node_modules']
      };

      await fileSystem.writeFile(
        this.projectPath,
        'jsconfig.json',
        JSON.stringify(jsconfig, null, 2)
      );
      logger.info('✅ Created jsconfig.json');
    }
  }

  async createTailwindConfig() {
    const { language } = this.projectAnalysis;
    const isTypeScript = language === 'typescript';

    const postcssConfig = `export default {
  plugins: {
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

    await fileSystem.writeFile(this.projectPath, 'postcss.config.js', postcssConfig);

    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{${isTypeScript ? 'ts,tsx' : 'js,jsx'}}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};`;

    await fileSystem.writeFile(this.projectPath, 'tailwind.config.js', tailwindConfig);

    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;`;

    await fileSystem.writeFile(this.projectPath, 'src/index.css', indexCss);

    logger.info('✅ Created Tailwind config');
  }

  async manualShadcnSetup() {
    const { language } = this.projectAnalysis;
    const isTypeScript = language === 'typescript';

    await runCommand(
      builderConfig.cli.shadcnDeps,
      this.projectPath,
      'Installing shadcn deps'
    );

    const componentsJson = {
      $schema: 'https://ui.shadcn.com/schema.json',
      style: 'new-york',
      rsc: false,
      tsx: isTypeScript,
      tailwind: {
        config: 'tailwind.config.js',
        css: 'src/index.css',
        baseColor: 'slate',
        cssVariables: true
      },
      aliases: {
        components: '@/components',
        utils: '@/lib/utils',
        ui: '@/components/ui'
      }
    };

    await fileSystem.writeFile(
      this.projectPath,
      'components.json',
      JSON.stringify(componentsJson, null, 2)
    );

    await fileSystem.createDirectory(this.projectPath, 'src/lib');

    const utilsCode = `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}`;

    await fileSystem.writeFile(
      this.projectPath,
      `src/lib/utils.${isTypeScript ? 'ts' : 'js'}`,
      utilsCode
    );

    const enhancedTailwind = `import tailwindAnimate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{${isTypeScript ? 'ts,tsx' : 'js,jsx'}}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindAnimate],
};`;

    await fileSystem.writeFile(this.projectPath, 'tailwind.config.js', enhancedTailwind);

    const enhancedCss = `@tailwind base;
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
}`;

    await fileSystem.writeFile(this.projectPath, 'src/index.css', enhancedCss);

    logger.info('✅ Manual shadcn setup complete');
  }


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
      const componentName = page.name.replace(/\s+/g, '');
      
      // This will retry 3 times internally
      const code = await generatePageCode(
        componentName,
        page.description,
        this.installedComponents,
        this.projectAnalysis
      );

      let relativePath;

      if (projectType === 'nextjs') {
        relativePath = routeToNextAppPath(page.route);
      } else {
        relativePath = path.join('src', 'pages', `${componentName}.${ext}`);
      }

      const absPath = path.join(this.projectPath, relativePath);
      const dir = path.dirname(absPath);

      await fileSystem.createDirectory(
        this.projectPath,
        path.relative(this.projectPath, dir)
      );

      await fileSystem.writeFile(this.projectPath, relativePath, code);

      logger.info(`✅ Created file: ${relativePath}`);
      generatedPages.push({ ...page, name: componentName, _file: relativePath });

    } catch (error) {
      logger.error(`❌ Failed to generate ${page.name}:`, error.message);
      failedPages.push({ name: page.name, route: page.route, error: error.message });
      // Continue to next page instead of crashing
    }
  }

  // Generate App.jsx/tsx for Vite
  if (projectType === 'vite-react' && generatedPages.length > 0) {
    const appCode = this.generateAppCode(generatedPages, ext);
    await fileSystem.writeFile(this.projectPath, `src/App.${ext}`, appCode);
    await this.validateMainJsx(ext);
  }

  // Report summary
  logger.info(`✅ Pages generated: ${generatedPages.length}/${pages.length}`);
  
  if (failedPages.length > 0) {
    logger.warn(`⚠️ Failed pages: ${failedPages.map(p => p.name).join(', ')}`);
    
    // Show user notification
    vscode.window.showWarningMessage(
      `Project created with ${generatedPages.length}/${pages.length} pages. ` +
      `Failed: ${failedPages.map(p => p.name).join(', ')}. ` +
      `You can manually create these or retry.`,
      'View Logs'
    ).then(selection => {
      if (selection === 'View Logs') {
        vscode.commands.executeCommand('workbench.action.output.toggleOutput');
      }
    });
  }

  return { generatedPages, failedPages };
}


  async validateMainJsx(ext) {
    const mainPath = path.join(this.projectPath, `src/main.${ext}`);

    try {
      let content = await fs.readFile(mainPath, 'utf-8');

      if (!content.includes("import './index.css'")) {
        logger.warn('main.jsx missing CSS import, fixing...');

        content = content.replace(
          /(import App from ['"]\.\/App.*['"])/,
          "$1\nimport './index.css'"
        );

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
      return `import React from 'react'
import ${page.name} from './pages/${page.name}'

function App() {
  return <${page.name} />
}

export default App`;
    }

    const imports = pages
      .map((p) => `import ${p.name} from './pages/${p.name}'`)
      .join('\n');
    const routes = pages
      .map((p) => `        <Route path="${p.route}" element={<${p.name} />} />`)
      .join('\n');

    return `import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
${imports}

function App() {
  return (
    <Router>
      <Routes>
${routes}
      </Routes>
    </Router>
  )
}

export default App`;
  }
}

module.exports = ProjectBuilderAgent;
