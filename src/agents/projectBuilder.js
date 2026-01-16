/**
 * Project Builder Agent - SERVICE ORIENTED ARCHITECTURE
 * âœ… Refactored: Split into micro-services (Planner, Discovery, Generator)
 */

let vscode;
try {
  vscode = require('vscode');
} catch (e) {
  vscode = {
    window: { 
        showInformationMessage: async () => 'Proceed with Build', 
        showErrorMessage: async (msg) => console.error('VSCODE ERROR MSG:', msg),
        withProgress: async (opts, fn) => await fn({ report: () => {} }),
        createOutputChannel: () => ({ appendLine: console.log, show: () => {}, clear: () => {} })
    },
    workspace: { workspaceFolders: [], getConfiguration: () => ({ get: () => '' }) },
    ProgressLocation: { Notification: 15 }
  };
}
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const { logger } = require('../utils/logger');
const fileSystem = require('../services/fileSystemManager');
const registryTools = require('../registry/registryTools');
const builderConfig = require('./projectBuilderConfig');
const StateManager = require('../services/stateManager');
const { runCommand } = require('../utils/commandRunner');

// Micro-services
const { PlannerService } = require('../services/planner');
const { DiscoveryService } = require('../services/discovery');
const { GeneratorService } = require('../services/generator');



// ============================
// MAIN CLASS (Orchestrator)
// ============================
class ProjectBuilderAgent {
  constructor() {
    this.projectPath = null;
    this.projectAnalysis = null;
    
    // Services
    this.stateManager = null;
    this.planner = new PlannerService();
    this.discovery = null; // init later
    this.generator = null; // init later
  }

  // Proxy getters/setters to State Manager
  get projectPlan() {
    return this.stateManager?.state?.projectPlan || null;
  }

  get installedComponents() {
      // FIXED: Return { registry: [componentNames] } format
      // This is what ComponentCatalog.buildCatalog() expects
      const map = {};
      if (this.stateManager?.state?.installedComponents) {
          this.stateManager.state.installedComponents.forEach(c => {
              if (!map[c.registry]) map[c.registry] = [];
              if (!map[c.registry].includes(c.name)) {
                  map[c.registry].push(c.name);
              }
          });
      }
      return map;
  }

  /**
   * Main Entry Point
   * Orchestrates the entire build process
   */
  async buildProject(userPrompt, projectPath) {
    this.projectPath = projectPath;
    this.stateManager = new StateManager(projectPath); // New instance handles restoration internally
    await this.stateManager.initialize();
    
    // CRITICAL FIX: Validate that scaffold truly completed by checking physical files
    // This prevents stale state from Global Storage causing skipped scaffolding
    if (this.stateManager.state.buildSteps?.scaffold === true) {
        const hasPackageJson = await this.hasPackageJson(projectPath);
        const hasGlobalsCss = await this.fileExists(path.join(projectPath, 'app', 'globals.css'));
        
        if (!hasPackageJson || !hasGlobalsCss) {
            logger.warn('âš ï¸ Stale state detected: Scaffold marked complete but files missing. Resetting scaffold step.');
            this.stateManager.state.buildSteps.scaffold = false;
            this.stateManager.state.buildSteps.components = false;
            this.stateManager.state.buildSteps.theme = false;
            await this.stateManager.save();
        }
    }
    
    // Resume Logic: Restore internal state from persisted manifest if available
    if (this.stateManager.state.projectPlan) {
        logger.info('ðŸ”„ Resuming from existing project plan...');
    }
    
    // Init services dependent on state
    this.discovery = new DiscoveryService(this.stateManager);
    this.generator = new GeneratorService(this.stateManager);

    logger.info(`ðŸš€ Starting Project Build at: ${projectPath}`);
    logger.info(`ðŸ“ User Request: ${userPrompt}`);

    const progressOptions = {
      location: vscode.ProgressLocation.Notification,
      title: 'Building Project',
      cancellable: true,
    };

    return await vscode.window.withProgress(progressOptions, async (progress, token) => {
      try {
        // PHASE 1: PLANNING
        progress.report({ message: 'Analyzing requirements...', increment: 5 });
        
        // 1a. Refine Prompt & Review
        const engineeredSpec = await this.planner.refineAndReview(userPrompt, this.projectPath);
        
        // 1b. Confirmation
        const confirmation = await vscode.window.showInformationMessage(
             `I have generated a detailed specification in 'project-spec.md'. Please review it.`,
             { modal: false }, 'Proceed with Build', 'Cancel'
        );
        if (confirmation !== 'Proceed with Build') return { success: false, reason: 'User cancelled' };

        // 1c. Analyze Tech Stack
        this.projectAnalysis = await this.planner.analyzeProjectType(engineeredSpec.improvedPrompt);
        
        // 1d. Create Detailed Plan
        const plan = await this.planner.createProjectPlan(engineeredSpec.improvedPrompt, this.projectAnalysis);
        await this.stateManager.savePlan(plan);
        // Note: this.projectPlan getter now reads from stateManager

        // PHASE 2 & 3: PARALLEL EXECUTION (Scaffolding + Discovery)
        progress.report({ message: 'Scaffolding & Discovering...', increment: 30 });

        // 2a. Define Scaffolding Task
        const scaffoldTask = async () => {
             if (!this.stateManager.isStepComplete('scaffold')) {
                 const hasPackageJson = await this.hasPackageJson(this.projectPath);
                 if (!hasPackageJson) {
                     logger.info('No package.json found. Scaffolding new project...');
                     if (await this.folderIsEmpty(this.projectPath)) {
                         await this.scaffoldWithOfficialCLI();
                     } else {
                         throw new Error(`Target directory '${path.basename(this.projectPath)}' is not empty and contains no package.json. Please clear the folder and try again.`);
                     }
                 } else {
                     logger.info('Existing project detected. Skipping scaffold.');
                 }
                 
                 await this.createConfigFiles(); 
                 await this.fixViteConfig(); 
                 await this.createTailwindConfig();
                 await this.setupUILibrary(); 
                 await this.installDependencies();
                 
                 // NEW: Validate and auto-install missing dependencies
                 await this.validateAndInstallMissingDeps();
                 
                 await this.stateManager.markStepComplete('scaffold');
             }
        };

        // 2b. Define Discovery Task
        const discoveryTask = async () => {
             logger.info('ðŸ” Starting parallel component discovery...');
             return await this.discovery.discoverComponents(this.projectPlan.componentNeeds, this.projectPlan);
        };

        // 2c. Execute in Parallel
        const [_, selectedComponents] = await Promise.all([
             scaffoldTask(),
             discoveryTask()
        ]);

        // PHASE 3: DESIGN SYSTEM GENERATION (NEW!)
        progress.report({ message: 'Generating design system...', increment: 5 });
        if (!this.stateManager.isStepComplete('theme')) {
             const DesignIntentAnalyzer = require('../services/designIntentAnalyzer');
             const ThemeGenerator = require('../services/themeGenerator');
             
             const analyzer = new DesignIntentAnalyzer();
             const designIntent = analyzer.analyzeIntent(
               this.spec?.userRequest || this.projectPlan.description,
               this.projectPlan.styleIntent || 'minimal'
             );
             
             logger.info(`ðŸŽ¨ Design Intent: ${designIntent.industry} (${designIntent.mood}) - ${designIntent.primaryColor}`);
             
             const themeGen = new ThemeGenerator();
             await themeGen.applyTheme(this.projectPath, designIntent);
             
             await this.stateManager.markStepComplete('theme');
        }

        // PHASE 3.5: COMPONENT INSTALLATION (Sequential after scaffold)
        progress.report({ message: 'Installing components...', increment: 10 });
        if (!this.stateManager.isStepComplete('components')) {
             await this.installComponentsWithFallback(selectedComponents);
             await this.stateManager.markStepComplete('components');
        }

        // PHASE 3.75: BUILD COMPONENT CATALOG (NEW!)
        progress.report({ message: 'Analyzing components...', increment: 5 });
        const ComponentCatalog = require('../services/componentCatalog');
        const catalog = new ComponentCatalog(this.projectPath);
        this.componentCatalog = await catalog.buildCatalog(this.installedComponents);
        logger.info(`ðŸ“š Component catalog built: ${Object.keys(this.componentCatalog).length} components`);

        // PHASE 4: CODE GENERATION
        progress.report({ message: 'Generating Layouts & Pages...', increment: 40 });
        const buildStartTime = Date.now();
        
        // 4a. Layouts (Context Aware)
        await this.generateLayouts();
        
        // 4a.5. PHASE 12 FIX: Generate Landing Page (MANDATORY)
        // This prevents the default Next.js boilerplate from being left at app/page.tsx
        await this.generateLandingPage();
        
        // 4b. Pages (Surgical Context)
        await this.generatePages();

        // PHASE 5: POST-GENERATION VALIDATION
        progress.report({ message: 'Validating generated code...', increment: 5 });
        const PostGenerationValidator = require('../utils/postGenerationValidator');
        const validator = new PostGenerationValidator(this.projectPath);
        const validationResult = await validator.validateProject();
        
        if (!validationResult.success) {
          logger.warn('âš ï¸  Post-generation validation found issues:');
          validationResult.errors.forEach(err => logger.warn(err));
        }

        // PHASE 6: BUILD SUMMARY
        const totalDuration = ((Date.now() - buildStartTime) / 1000 / 60).toFixed(2);
        const pagesGenerated = this.projectPlan.pages?.length || 0;
        const componentsInstalled = Object.keys(this.componentCatalog).length;
        
        logger.info(`\n${'='.repeat(60)}`);
        logger.info(`âœ¨ PROJECT BUILD COMPLETE! âœ¨`);
        logger.info(`${'='.repeat(60)}`);
        logger.info(`ðŸ“¦ Project: ${this.projectPlan.projectName}`);
        logger.info(`ðŸ“ Location: ${this.projectPath}`);
        logger.info(`â±ï¸  Total Time: ${totalDuration} minutes`);
        logger.info(`ðŸ“„ Pages Generated: ${pagesGenerated}`);
        logger.info(`ðŸ§© Components Installed: ${componentsInstalled}`);
        logger.info(`âœ… Validation: ${validationResult.success ? 'PASSED' : 'PASSED WITH WARNINGS'}`);
        logger.info(`${'='.repeat(60)}\n`);

        // âœ… Save to Project History for Resume Feature
        try {
          const historyProvider = global.projectHistoryProvider;
          if (historyProvider) {
            await historyProvider.addProject(this.projectPath, this.stateManager.state);
            logger.info('ðŸ“š Saved to project history');
          }
        } catch (historyError) {
          logger.warn('Could not save to project history:', historyError.message);
        }

        return { 
          success: true, 
          projectPath: this.projectPath,
          validation: validationResult,
          stats: {
            duration: totalDuration,
            pages: pagesGenerated,
            components: componentsInstalled
          }
        };

      } catch (error) {
        const msg = error.message || error.stderr || (typeof error === 'string' ? error : JSON.stringify(error, Object.getOwnPropertyNames(error)));
        logger.error('Build failed:', msg);
        vscode.window.showErrorMessage(`Build failed: ${msg.substring(0, 200)}... (See logs)`);
        return { success: false, error: msg };
      }
    });
  }

  // Wrappers for Service Calls
  // Wrappers for Service Calls
  
  async generateLayouts() {
    if (this.stateManager.isStepComplete('layouts')) return;
    
    // Default to root layout if none exist (backward compatibility)
    const layouts = this.projectPlan.layouts || [
        { path: 'app/layout.tsx', description: 'Root layout with Navbar/Footer', type: 'root' }
    ];

    logger.info(`\nðŸ—ï¸  Starting Layout Generation (${layouts.length} layouts)...\n`);

    for (const layout of layouts) {
        if (this.stateManager.isPageGenerated(layout.path)) continue;

        // Surgical Context for Layout
        // Layouts need global design system but less specific feature context than pages
        const context = {
            path: layout.path,
            description: layout.description,
            type: layout.type || 'nested',
            designSystem: this.projectPlan.designSystem
        };
        
        // Inject Project Identity for Root Layout Branding
        if (layout.type === 'root') {
            context.projectName = this.projectPlan.projectName;
            context.projectDescription = this.projectPlan.description;
        }


        const success = await this.generator.generateLayoutCode(context, this.projectPath);
        if (success) {
            await this.stateManager.markPageGenerated(layout.path);
        }
    }
    
    await this.stateManager.markStepComplete('layouts');
  }

  async generatePages() {
    if (this.stateManager.isStepComplete('pages')) return;

    // Create navigation component first (Dynamic based on pages)
    await this.createNavigationComponent(this.projectPlan.pages);

    logger.info(`\nðŸ“„ Starting page generation (${this.projectPlan.pages.length} pages)...\n`);

    for (let i = 0; i < this.projectPlan.pages.length; i++) {
       const page = this.projectPlan.pages[i];
       
       // Skip if done
       if (this.stateManager.isPageGenerated(page.name)) continue;

       const pageStartTime = Date.now();
       
       logger.info(`${'â”€'.repeat(60)}`);
       logger.info(`ðŸ“„ [${i + 1}/${this.projectPlan.pages.length}] ${page.name}`);
       logger.info(`ðŸ“ Route: ${page.route}`);
       logger.info(`ðŸ“ Features: ${page.features?.join(', ') || 'None specified'}`);
       
       try {
         // Determine project type from analysis
         const projectType = this.projectAnalysis?.type || 
                            (this.projectPlan.description?.toLowerCase().includes('code') ? 'ide' : 'web-app');
         
         // SURGICAL CONTEXT SLICING ðŸ”ª
         // 1. Find semantic matches for THIS page only
         const pageSpecificNeeds = await this.discovery.discoverComponents(
             { ...this.projectPlan.componentNeeds, pageSpecific: page.features }, 
             { ...this.projectPlan, styleIntent: this.projectPlan.styleIntent } 
         );
         
         // 2. Pass context to Generator
         // Fix: Use the page-specific catalog found by discovery service!
         const code = await this.generator.generatePageCode(
            page.name, 
            page.description, 
            this.installedComponents,
            this.projectAnalysis,
            this.projectPath,
            pageSpecificNeeds.catalog || this.componentCatalog, // Use sliced catalog
            this.projectPlan.designSystem,
            page.features || [], 
            projectType,
            { 
              sitemap: this.projectPlan.pages,
              projectName: this.projectPlan.projectName,
              projectDescription: this.projectPlan.description 
            } // 10. Pass Sitemap & Identity Context
         );
         
         await this.generator.writePageFile(this.projectPath, page.route, code);
         
         // AUTO-FIX: Scan for missing imports
         await this.verifyAndFixImports(code, this.projectPath);
         
         // VALIDATION
         if (!code || code.length < 500) {
            throw new Error(`Generated code is too short (${code?.length || 0} chars). AI likely failed to complete.`);
         }
         
         // Strict AST Check
         const ASTValidator = require('../utils/ASTValidator');
         const report = await ASTValidator.validate(code, page.name, `${page.name}.tsx`, this.projectPath);
         if (!report.success) {
            throw new Error(`Syntactic Validation Failed: ${report.jsxErrors.map(e => e.message).join(', ')}`);
         }
         
         await this.stateManager.markPageGenerated(page.name);
         
         const duration = ((Date.now() - pageStartTime) / 1000).toFixed(2);
         logger.info(`âœ… Generated successfully (${duration}s, ${code?.length || 0} chars)`);
         
       } catch (error) {
         const duration = ((Date.now() - pageStartTime) / 1000).toFixed(2);
         logger.error(`âŒ Generation failed (${duration}s): ${error.message}`);
         throw error;
       }
    }
    
    logger.info(`${'â”€'.repeat(60)}\n`);
    await this.stateManager.markStepComplete('pages');
  }

  // --- Infrastructure Methods ---
  
  // ... (keeping existing methods) 

  async createTailwindConfig() {
      // Fix: Use strictly typed string for darkMode, not array
      const fs = require('fs').promises;
      const path = require('path');
      
      const config = `import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
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
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;`;

      await fs.writeFile(path.join(this.projectPath, 'tailwind.config.ts'), config);
      logger.info('âœ… Generated robust tailwind.config.ts');
  }

  // --- Infrastructure Methods ---

  async hasPackageJson(folderPath) {
    try {
      await fs.access(path.join(folderPath, 'package.json'));
      return true;
    } catch {
      return false;
    }
  }
  
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  async folderIsEmpty(folderPath) {
    try {
      const files = await fs.readdir(folderPath);
      // Ignore .codesentinel, .git, .vscode, logs, and project-spec.md (which is created before scaffold)
      const validFiles = files.filter(f => !['.codesentinel', '.git', '.vscode', '.DS_Store', 'project-spec.md'].includes(f) && !f.endsWith('.log'));
      return validFiles.length === 0;
    } catch { return true; }
  }

  async scaffoldWithOfficialCLI() {
     const fs = require('fs').promises;
     const path = require('path');
     
     // 1. Identify conflicting files
     const conflictingFiles = ['.codesentinel', 'project-spec.md'];
     const tempDir = path.join(path.dirname(this.projectPath), `.temp_config_${Date.now()}`);
     const movedFiles = [];

     try {
       // 2. Move conflicting files out
       await fs.mkdir(tempDir, { recursive: true });
       for (const file of conflictingFiles) {
         const src = path.join(this.projectPath, file);
         const dest = path.join(tempDir, file);
         try {
           await fs.rename(src, dest);
           movedFiles.push({ src, dest, name: file });
         } catch (e) {
           // File might not exist, ignore
         }
       }
       
       // 3. Run Scaffold
       // Force Next.js with TypeScript and Tailwind
       // Added --yes to handle new interactive prompts (like React Compiler) automatically
       const cmd = 'npx create-next-app@latest . --yes --typescript --tailwind --eslint --no-src-dir --app --import-alias "@/*" --use-npm';
       const result = await runCommand(cmd, this.projectPath, 'Scaffolding Next.js');
       
       if (!result.success) {
         throw new Error(`Scaffolding failed: ${result.stderr || result.error || 'Unknown error'}`);
       }

     } catch (error) {
       throw error;
     } finally {
       // 4. Restore files
       for (const move of movedFiles) {
         try {
           await fs.rename(move.dest, move.src);
         } catch (e) {
            logger.warn(`Failed to restore ${move.name}: ${e.message}`);
         }
       }
       // Cleanup temp
       try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
     }
  }

  async installComponentsWithFallback(selectedComponents) {
     for (const [registryId, components] of Object.entries(selectedComponents)) {
        if (!components.length) continue;
        
        if (registryId === 'npm') {
            const res = await runCommand(`npm install ${components.join(' ')}`, this.projectPath, 'Installing npm packages');
            if (res.success && this.stateManager) {
                for (const pkg of components) await this.stateManager.addComponent('npm', pkg);
            }
            continue;
        }
        
        // Use registry tools for installing Shadcn/Aceternity/etc
        const result = await registryTools.installComponents(registryId, components, this.projectPath);

        // EXTRA SAFETY: If installing 'resizable' component, ensure we have the latest react-resizable-panels
        // to match our AI's v4+ code generation patterns.
        if (components.includes('resizable') || components.includes('react-resizable-panels')) {
             await runCommand('npm install react-resizable-panels@latest', this.projectPath, 'Enforcing latest react-resizable-panels');
        }

        if (this.stateManager && result.installed && result.installed.length > 0) {
            // Update state with RICH details
            try {
                const details = await registryTools.getComponentDetails(registryId, result.installed);
                
                const richMap = {};
                if (details && details.details) {
                    details.details.forEach(d => {
                        if (d.found) richMap[d.name] = { usage: d.usage, category: d.category };
                    });
                }
                
                for (const comp of result.installed) {
                    const meta = richMap[comp] || { usage: `// import ${comp}` };
                    await this.stateManager.addComponent(registryId, comp, meta);
                }
                
            } catch (err) {
                 logger.warn(`Failed to fetch details for ${registryId}, falling back to names only`, err);
                 for (const comp of result.installed) {
                     await this.stateManager.addComponent(registryId, comp, { usage: `// import ${comp}` });
                 }
            }
        }
     }
  }

  async installDependencies() {
      // Just in case create-next-app didn't finish or user customized
      await runCommand('npm install', this.projectPath, 'Installing Dependencies');
  }

  async validateAndInstallMissingDeps() {
    const { DependencyValidator } = require('../utils/DependencyValidator');
    const validator = new DependencyValidator(this.projectPath);
    
    const initialized = await validator.initialize();
    if (!initialized) {
      logger.warn('Could not validate dependencies - package.json not found');
      return;
    }
    
    const missing = await validator.validateConfigFiles();
    
    if (missing.length > 0) {
      logger.info(`ðŸ“¦ Installing missing config dependencies: ${missing.join(', ')}`);
      const cmd = validator.getInstallCommand(missing);
      await runCommand(cmd, this.projectPath, 'Installing missing deps');
    } else {
      logger.info('âœ… All config dependencies are installed');
    }
  }

  async createRootLayout() {
     const layoutPath = path.join(this.projectPath, 'app', 'layout.tsx');
     
     // 1. Generate Metadata with ThemeProvider for persistent dark mode
     const metadataCode = `
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { ThemeProvider } from '@/components/providers/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '${this.projectPlan.projectName || 'My App'}',
  description: '${this.projectPlan.description || 'Generated by CodeSentinel'}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          <main className="min-h-screen bg-background text-foreground">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
`;
     
     // 2. Write Layout File
     await fs.writeFile(layoutPath, metadataCode);
     logger.info('âœ… Created Root Layout with ThemeProvider');
     
     // 3. Generate ThemeProvider Component
     await this.createThemeProvider();
  }
  
  async createThemeProvider() {
    // Path must match: @/components/providers/theme-provider
    const providersDir = path.join(this.projectPath, 'components', 'providers');
    const themeProviderPath = path.join(providersDir, 'theme-provider.tsx');
    
    // Ensure directory exists
    await fs.mkdir(providersDir, { recursive: true });
    
    const themeProviderCode = `"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
`;
    
    await fs.writeFile(themeProviderPath, themeProviderCode);
    logger.info('âœ… Created ThemeProvider at components/providers/theme-provider.tsx');
  }
  
  async createNavigationComponent(pages) {
    const aiClient = require('../services/aiClient');
    
    // 1. Create ModeToggle component at components/mode-toggle.tsx
    const modeToggleDir = path.join(this.projectPath, 'components');
    const modeTogglePath = path.join(modeToggleDir, 'mode-toggle.tsx');
    
    // Check if mode-toggle exists (or we create it manually as it's a "cookbook" component)
    const modeToggleCode = `"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
`;
    
    try {
        await fs.mkdir(modeToggleDir, { recursive: true });
        await fs.writeFile(modeTogglePath, modeToggleCode);
        logger.info('âœ… Created ModeToggle component');
    } catch (err) {
        logger.warn('Failed to create ModeToggle:', err.message);
    }
    
    // Build page list for navbar
    const navLinks = pages.map(p => ({
      label: p.name.replace('Page', ''),
      href: p.route
    }));
    
    const prompt = `Generate a professional Next.js navbar component for a ${this.projectPlan.styleIntent || 'modern'} ${this.projectAnalysis?.type || 'web'} application.

PROJECT: ${this.projectPlan.projectName || 'App'}
PAGES: ${JSON.stringify(navLinks)}

REQUIREMENTS:
1. Use "use client" directive
2. Import Link from "next/link" and usePathname from "next/navigation"
3. Import { ModeToggle } from "@/components/mode-toggle"
4. Include all pages as nav links
5. Highlight active page using pathname
6. Use glassmorphism: bg-background/95 backdrop-blur
7. Add responsive design with mobile menu
8. Include project name as logo
9. PLACE <ModeToggle /> COMPONENT ON THE RIGHT SIDE (next to mobile menu)
10. Use shadcn-compatible Tailwind classes
11. Export named function "Navbar"

Return ONLY the complete TypeScript code, no explanations.`;

    try {
      const navCode = await aiClient.generate(prompt, {
        systemPrompt: 'You are an expert UI developer. Generate clean, professional React components.',
        maxTokens: 4000,
        temperature: 0.3
      });
      
      // Clean the code
      const cleanCode = navCode.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      
      const compDir = path.join(this.projectPath, 'components');
      await fileSystem.createDirectory(compDir, '');
      await fileSystem.writeFile(compDir, 'navbar.tsx', cleanCode);
      logger.info('âœ… Generated dynamic Navbar component');
    } catch (error) {
      logger.warn('Navbar generation failed, using fallback:', error.message);
      // Fallback to simple nav
      const fallbackNav = `
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';

export function Navbar() {
  const pathname = usePathname();
  
  return (
    <nav className="flex h-16 items-center justify-between px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="font-bold text-lg">${this.projectPlan.projectName || 'App'}</div>
      <div className="flex items-center gap-6">
       ${navLinks.map(link => 
         `<Link href="${link.href}" className={\`text-sm font-medium transition-colors hover:text-primary \${pathname === '${link.href}' ? 'text-foreground' : 'text-muted-foreground'}\`}>${link.label}</Link>`
       ).join('\n       ')}
        <ModeToggle />
      </div>
    </nav>
  );
}
`;
      const compDir = path.join(this.projectPath, 'components', 'ui');
      await fileSystem.createDirectory(compDir, '');
      await fileSystem.writeFile(compDir, 'navbar.tsx', fallbackNav);
    }
    
    // PHASE 12 FIX: MANDATORY FOOTER GENERATION
    await this.createFooterComponent();
    await this.createThemeProvider();
  }
  
  /**
   * Creates the ThemeProvider component (Mandatory for dark mode).
   */
  async createThemeProvider() {
    const fs = require('fs').promises;
    const providerPath = require('path').join(this.projectPath, 'components', 'providers');
    await fs.mkdir(providerPath, { recursive: true });
    
    const code = `"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
`;

    await fs.writeFile(require('path').join(providerPath, 'theme-provider.tsx'), code);
  }
  
  /**
   * Creates a Footer component (MANDATORY for all projects).
   * Phase 12: Addresses missing footer issue.
   */
  async createFooterComponent() {
    const fs = require('fs').promises;
    
    const footerCode = `"use client";

import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full mt-auto border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">${this.projectPlan.projectName || 'App'}</h3>
            <p className="text-sm text-muted-foreground">
              ${this.projectPlan.description?.substring(0, 100) || 'Building the future of software.'}
            </p>
          </div>
          
          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
            </ul>
          </div>
          
          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} ${this.projectPlan.projectName || 'App'}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
`;


    try {
      const compDir = path.join(this.projectPath, 'components');
      await fs.mkdir(compDir, { recursive: true });
      await fs.writeFile(path.join(compDir, 'footer.tsx'), footerCode);
      logger.info('âœ… Created Footer component');
    } catch (err) {
      logger.warn('Failed to create Footer:', err.message);
    }
  }

  /**
   * Generates a proper landing page to replace the default Next.js boilerplate.
   * Phase 12: Addresses missing landing page issue.
   */
  async generateLandingPage() {
    const fs = require('fs').promises;
    const aiClient = require('../services/aiClient');
    
    // Check if a "/" page already exists in the plan (skip if user defined it)
    const hasRootPage = this.projectPlan.pages?.some(p => p.route === '/' || p.route === '');
    if (hasRootPage) {
      logger.info('â„¹ï¸ Root page already in plan, skipping landing page generation');
      return;
    }
    
    const prompt = `Generate a STUNNING landing page for "${this.projectPlan.projectName || 'App'}" - a ${this.projectPlan.description || 'modern web application'}.

REQUIREMENTS (MANDATORY):
1. "use client" directive
2. Import Navbar from "@/components/navbar" and Footer from "@/components/footer"
3. Hero section with:
   - Gradient background (bg-gradient-to-br from-primary/10 via-background to-accent/10)
   - Large headline with the project name
   - Subheadline describing the value proposition
   - Two CTA buttons (primary: "Get Started", ghost: "Learn More")
4. Features section with:
   - 3-4 feature cards using glassmorphism (backdrop-blur-xl bg-card/50 border)
   - Each card MUST have a Lucide icon (import from "lucide-react")
   - Hover effects (hover:scale-[1.02] transition-all)
5. Stats or social proof section
6. Include <Navbar /> at top and <Footer /> at bottom
7. Use dark mode compatible colors (bg-background, text-foreground, etc.)
8. Mobile responsive (use grid-cols-1 md:grid-cols-3)

STYLE: ${this.projectPlan.styleIntent || 'modern, premium, glassmorphism'}

Return ONLY the complete TypeScript/TSX code.`;

    try {
      const landingCode = await aiClient.generate(prompt, {
        systemPrompt: 'You are an expert UI developer creating premium, visually stunning landing pages. Always include icons, gradients, and hover effects.',
        maxTokens: 8000,
        temperature: 0.4
      });
      
      const cleanCode = landingCode.replace(/```[a-z]*\\n?/g, '').replace(/```/g, '').trim();
      
      const appDir = path.join(this.projectPath, 'app');
      await fs.mkdir(appDir, { recursive: true });
      await fs.writeFile(path.join(appDir, 'page.tsx'), cleanCode);
      logger.info('âœ… Generated Landing Page (app/page.tsx)');
    } catch (error) {
      logger.warn('Landing page generation failed, using fallback:', error.message);
      
      // Fallback static landing page
      const fallbackLanding = `"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ArrowRight, Zap, Shield, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 px-4 py-20">
        <div className="container mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Welcome to ${this.projectPlan.projectName || 'Our Platform'}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            ${this.projectPlan.description?.substring(0, 150) || 'Build something amazing with our powerful platform.'}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      {/* Features */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Lightning Fast", desc: "Built for speed and performance" },
              { icon: Shield, title: "Secure", desc: "Enterprise-grade security built in" },
              { icon: BarChart3, title: "Analytics", desc: "Powerful insights at your fingertips" },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-xl border bg-card/50 backdrop-blur-xl hover:scale-[1.02] transition-all shadow-lg">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
`;
      const appDir = path.join(this.projectPath, 'app');
      await fs.mkdir(appDir, { recursive: true });
      await fs.writeFile(path.join(appDir, 'page.tsx'), fallbackLanding);
      logger.info('âœ… Created fallback Landing Page');
    }
  }

  /**
   * Scans generated code for UI component imports and ensures they exist.
   * Installs REAL Shadcn components when possible, falls back to placeholder for custom components.
   */
  async verifyAndFixImports(code, projectPath) {
    const fs = require('fs').promises;
    const path = require('path');
    const { execAsync } = require('../utils/execAsync');
    
    // Known Shadcn components that can be installed via CLI
    const SHADCN_COMPONENTS = new Set([
      'accordion', 'alert', 'alert-dialog', 'aspect-ratio', 'avatar', 'badge', 'breadcrumb',
      'button', 'calendar', 'card', 'carousel', 'chart', 'checkbox', 'collapsible', 'combobox',
      'command', 'context-menu', 'dialog', 'drawer', 'dropdown-menu', 'form', 'hover-card',
      'input', 'input-otp', 'label', 'menubar', 'navigation-menu', 'pagination', 'popover',
      'progress', 'radio-group', 'resizable', 'scroll-area', 'select', 'separator', 'sheet',
      'sidebar', 'skeleton', 'slider', 'sonner', 'switch', 'table', 'tabs', 'textarea',
      'toast', 'toggle', 'toggle-group', 'tooltip'
    ]);
    
    // Regex to find imports from @/components/ui/NAME
    const importRegex = /import\s+{([^}]+)}\s+from\s+['"]@\/components\/ui\/([^'"]+)['"]/g;
    
    const componentsToInstall = new Set();
    const customComponents = [];
    
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const componentNames = match[1].split(',').map(n => n.trim());
      const fileName = match[2]; // e.g., "card" or "custom-widget"
      
      const componentPath = path.join(projectPath, 'components', 'ui', `${fileName}.tsx`);
      
      try {
        await fs.access(componentPath);
        // Exists, all good
      } catch (err) {
        // Missing! Check if it's a known Shadcn component
        if (SHADCN_COMPONENTS.has(fileName)) {
          componentsToInstall.add(fileName);
          logger.info(`ðŸ“¦ Will install Shadcn component: ${fileName}`);
        } else {
          customComponents.push({ fileName, componentNames });
        }
      }
    }
    
    // 1. Batch install all Shadcn components (much faster than one-by-one)
    if (componentsToInstall.size > 0) {
      const componentList = [...componentsToInstall].join(' ');
      logger.info(`ðŸ“¦ Installing ${componentsToInstall.size} Shadcn components: ${componentList}`);
      
      try {
        await execAsync(`npx shadcn@latest add ${componentList} --yes`, {
          cwd: projectPath,
          timeout: 120000
        });
        logger.info(`âœ… Installed ${componentsToInstall.size} Shadcn components successfully`);
      } catch (installErr) {
        logger.error(`Failed to install Shadcn components:`, installErr.message);
        // Fallback: Create placeholders for failed components
        for (const fileName of componentsToInstall) {
          await this._createPlaceholderComponent(fileName, projectPath);
        }
      }
    }
    
    // 2. Create placeholders for truly custom components
    for (const { fileName, componentNames } of customComponents) {
      logger.warn(`ðŸ› ï¸  Creating placeholder for custom component: ${fileName}`);
      await this._createPlaceholderComponent(fileName, projectPath, componentNames);
    }
  }

  /**
   * Create a placeholder component file (only for non-Shadcn components)
   */
  async _createPlaceholderComponent(fileName, projectPath, componentNames = []) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const componentPath = path.join(projectPath, 'components', 'ui', `${fileName}.tsx`);
    
    const isIcon = fileName.includes('icon');
    
    let fileContent = '';
    
    if (isIcon) {
      // Lucide facade
      const exports = componentNames.map(name => {
        let lucideName = name.replace(/Icon$/, '');
        
        // Handle edge case: "Icon" -> "" (invalid export)
        // Handle edge case: "BoxIcon" -> "Box" (valid)
        if (!lucideName || lucideName === '') {
          lucideName = 'Image'; // Fallback to a generic icon
        }
        
        // Ensure first char is uppercase
        lucideName = lucideName.charAt(0).toUpperCase() + lucideName.slice(1);
        
        return `export { ${lucideName} as ${name} } from 'lucide-react';`;
      }).join('\n');
      
      fileContent = `import 'lucide-react';\n${exports}\n\n// Fallback\nexport function IconPlaceholder() { return null; }`;
    } else {
      // Generic placeholder with clear visual indicator
      const exportName = componentNames[0] || fileName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
      fileContent = `import React from 'react';

// TODO: Implement this component or install via: npx shadcn@latest add ${fileName}
export function ${exportName}({ children, className, ...props }: any) {
  return (
    <div className={\`p-4 border-2 border-dashed border-amber-400 rounded-lg bg-amber-50/10 \\${className}\`} {...props}>
      <span className="text-xs font-mono text-amber-500 block mb-2">âš ï¸ Placeholder: ${exportName}</span>
      {children}
    </div>
  );
}

// Re-export as commonly expected names
export const ${exportName}Content = ${exportName};
export const ${exportName}Header = ${exportName};
export const ${exportName}Title = ${exportName};
export const ${exportName}Description = ${exportName};
export const ${exportName}Footer = ${exportName};
`;
    }
    
    try {
      const dir = path.dirname(componentPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(componentPath, fileContent);
      logger.info(`âœ… Created placeholder for ${fileName}`);
    } catch (writeErr) {
      logger.error(`Failed to create placeholder for ${fileName}:`, writeErr);
    }
  }

  async setupUILibrary() {
       // Initialize shadcn
       // We use registryTools logic which handles checking if components.json exists
       await registryTools.initializeShadcn(this.projectPath);
  }
  
  async createConfigFiles() {
       const ConfigManager = require('../services/configManager');
       const fs = require('fs').promises;
       const path = require('path');

       // 1. Add Image Domains
       await ConfigManager.addImageDomains(this.projectPath);
       
       // 2. Fix tsconfig.json (add baseUrl)
       try {
         const tsconfigPath = path.join(this.projectPath, 'tsconfig.json');
         if (await this.hasPackageJson(this.projectPath)) { // Ensure project exists
            const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf-8'));
            if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
            
            // Critical for path aliases @/
            tsconfig.compilerOptions.baseUrl = ".";
            tsconfig.compilerOptions.paths = { ...tsconfig.compilerOptions.paths, "@/*": ["./*"] };
            
            await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
            logger.info('âœ… Updated tsconfig.json with baseUrl: "."');
         }
       } catch (err) {
         logger.warn('Could not update tsconfig.json:', err.message);
       }
       
       // 3. Fix globals.css for Tailwind v4
       // MOVED TO ThemeGenerator to avoid conflict/overwrite issues
       logger.info('â„¹ï¸  Skipping direct globals.css write (ThemeGenerator handles this)');
  } 
  
  async createTailwindConfig() {}
  async fixViteConfig() {}
}

module.exports = ProjectBuilderAgent;


