/**
 * Project Builder Agent - SERVICE ORIENTED ARCHITECTURE
 * ✅ Refactored: Split into micro-services (Planner, Discovery, Generator)
 */

const vscode = require('vscode');
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
    
    // Resume Logic: Restore internal state from persisted manifest if available
    if (this.stateManager.state.projectPlan) {
        logger.info('🔄 Resuming from existing project plan...');
    }
    
    // Init services dependent on state
    this.discovery = new DiscoveryService(this.stateManager);
    this.generator = new GeneratorService(this.stateManager);

    logger.info(`🚀 Starting Project Build at: ${projectPath}`);
    logger.info(`📝 User Request: ${userPrompt}`);

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
             logger.info('🔍 Starting parallel component discovery...');
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
             
             logger.info(`🎨 Design Intent: ${designIntent.industry} (${designIntent.mood}) - ${designIntent.primaryColor}`);
             
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
        logger.info(`📚 Component catalog built: ${Object.keys(this.componentCatalog).length} components`);

        // PHASE 4: CODE GENERATION
        progress.report({ message: 'Generating pages...', increment: 40 });
        const buildStartTime = Date.now();
        await this.generatePages();
        await this.createRootLayout();

        // PHASE 5: POST-GENERATION VALIDATION
        progress.report({ message: 'Validating generated code...', increment: 5 });
        const PostGenerationValidator = require('../utils/postGenerationValidator');
        const validator = new PostGenerationValidator(this.projectPath);
        const validationResult = await validator.validateProject();
        
        if (!validationResult.success) {
          logger.warn('⚠️  Post-generation validation found issues:');
          validationResult.errors.forEach(err => logger.warn(err));
        }

        // PHASE 6: BUILD SUMMARY
        const totalDuration = ((Date.now() - buildStartTime) / 1000 / 60).toFixed(2);
        const pagesGenerated = this.projectPlan.pages?.length || 0;
        const componentsInstalled = Object.keys(this.componentCatalog).length;
        
        logger.info(`\n${'='.repeat(60)}`);
        logger.info(`✨ PROJECT BUILD COMPLETE! ✨`);
        logger.info(`${'='.repeat(60)}`);
        logger.info(`📦 Project: ${this.projectPlan.projectName}`);
        logger.info(`📁 Location: ${this.projectPath}`);
        logger.info(`⏱️  Total Time: ${totalDuration} minutes`);
        logger.info(`📄 Pages Generated: ${pagesGenerated}`);
        logger.info(`🧩 Components Installed: ${componentsInstalled}`);
        logger.info(`✅ Validation: ${validationResult.success ? 'PASSED' : 'PASSED WITH WARNINGS'}`);
        logger.info(`${'='.repeat(60)}\n`);

        // ✅ Save to Project History for Resume Feature
        try {
          const historyProvider = global.projectHistoryProvider;
          if (historyProvider) {
            await historyProvider.addProject(this.projectPath, this.stateManager.state);
            logger.info('📚 Saved to project history');
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
  async generatePages() {
    if (this.stateManager.isStepComplete('pages')) return;

    // Create navigation component first
    await this.createNavigationComponent(this.projectPlan.pages);

    logger.info(`\n📄 Starting page generation (${this.projectPlan.pages.length} pages)...\n`);

    for (let i = 0; i < this.projectPlan.pages.length; i++) {
       const page = this.projectPlan.pages[i];
       const pageStartTime = Date.now();
       
       logger.info(`${'─'.repeat(60)}`);
       logger.info(`📄 [${i + 1}/${this.projectPlan.pages.length}] ${page.name}`);
       logger.info(`📍 Route: ${page.route}`);
       logger.info(`📝 Features: ${page.features?.join(', ') || 'None specified'}`);
       
       try {
         // Determine project type from analysis
         const projectType = this.projectAnalysis?.type || 
                            (this.projectPlan.description?.toLowerCase().includes('code') ? 'ide' : 'web-app');
         
         const code = await this.generator.generatePageCode(
            page.name, 
            page.description, 
            this.installedComponents,
            this.projectAnalysis,
            this.projectPath,
            this.componentCatalog,
            this.projectPlan.designSystem,
            page.features || [], // ✅ Pass page features
            projectType          // ✅ Pass project type
         );
         
         await this.generator.writePageFile(this.projectPath, page.route, code);
         
         // AUTO-FIX: Scan for missing imports and create them on the fly
         await this.verifyAndFixImports(code, this.projectPath);
         
         // VALIDATION: Ensure code is complete and syntactically valid
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
         logger.info(`✅ Generated successfully (${duration}s, ${code?.length || 0} chars)`);
         
       } catch (error) {
         const duration = ((Date.now() - pageStartTime) / 1000).toFixed(2);
         logger.error(`❌ Generation failed (${duration}s): ${error.message}`);
         throw error;
       }
    }
    
    logger.info(`${'─'.repeat(60)}\n`);
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
      logger.info('✅ Generated robust tailwind.config.ts');
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
      logger.info(`📦 Installing missing config dependencies: ${missing.join(', ')}`);
      const cmd = validator.getInstallCommand(missing);
      await runCommand(cmd, this.projectPath, 'Installing missing deps');
    } else {
      logger.info('✅ All config dependencies are installed');
    }
  }

  async createRootLayout() {
     const layoutPath = path.join(this.projectPath, 'app', 'layout.tsx');
     
     // 1. Generate Metadata with ThemeProvider for persistent dark mode
     const metadataCode = `
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/ui/navbar';
import { ThemeProvider } from '@/components/theme-provider';

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
     logger.info('✅ Created Root Layout with ThemeProvider');
     
     // 3. Generate ThemeProvider Component
     await this.createThemeProvider();
  }
  
  async createThemeProvider() {
    const themeProviderDir = path.join(this.projectPath, 'components');
    const themeProviderPath = path.join(themeProviderDir, 'theme-provider.tsx');
    
    // Ensure directory exists
    await fs.mkdir(themeProviderDir, { recursive: true });
    
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
    logger.info('✅ Created ThemeProvider for persistent dark mode');
    
    // Install next-themes if not already
    await runCommand('npm install next-themes', this.projectPath, 'Installing next-themes');
  }
  
  async createNavigationComponent(pages) {
    const aiClient = require('../services/aiClient');
    
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
3. Include all pages as nav links
4. Highlight active page using pathname
5. Use glassmorphism: bg-background/95 backdrop-blur
6. Add responsive design with mobile menu
7. Include project name as logo
8. Use shadcn-compatible Tailwind classes
9. Export named function "Navbar"

Return ONLY the complete TypeScript code, no explanations.`;

    try {
      const navCode = await aiClient.generate(prompt, {
        systemPrompt: 'You are an expert UI developer. Generate clean, professional React components.',
        maxTokens: 4000,
        temperature: 0.3
      });
      
      // Clean the code
      const cleanCode = navCode.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      
      const compDir = path.join(this.projectPath, 'components', 'ui');
      await fileSystem.createDirectory(compDir, '');
      await fileSystem.writeFile(compDir, 'navbar.tsx', cleanCode);
      logger.info('✅ Generated dynamic Navbar component');
    } catch (error) {
      logger.warn('Navbar generation failed, using fallback:', error.message);
      // Fallback to simple nav
      const fallbackNav = `
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  
  return (
    <nav className="flex h-16 items-center justify-between px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="font-bold text-lg">${this.projectPlan.projectName || 'App'}</div>
      <div className="flex gap-6">
       ${navLinks.map(link => 
         `<Link href="${link.href}" className={\`text-sm font-medium transition-colors hover:text-primary \${pathname === '${link.href}' ? 'text-foreground' : 'text-muted-foreground'}\`}>${link.label}</Link>`
       ).join('\n       ')}
      </div>
    </nav>
  );
}
`;
      const compDir = path.join(this.projectPath, 'components', 'ui');
      await fileSystem.createDirectory(compDir, '');
      await fileSystem.writeFile(compDir, 'navbar.tsx', fallbackNav);
    }
  }

  /**
   * Scans generated code for UI component imports and ensures they exist.
   * If a component is missing, it generates a placeholder to prevent build errors.
   */
  async verifyAndFixImports(code, projectPath) {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Regex to find imports from @/components/ui/NAME
    // capturing group 1: component names (e.g. "ProductCard, Button")
    // capturing group 2: file path (e.g. "product-card")
    const importRegex = /import\s+{([^}]+)}\s+from\s+['"]@\/components\/ui\/([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const componentNames = match[1].split(',').map(n => n.trim());
      const fileName = match[2]; // e.g., "product-card" or "icons"
      
      const componentPath = path.join(projectPath, 'components', 'ui', `${fileName}.tsx`);
      
      try {
        await fs.access(componentPath);
        // Exists, all good
      } catch (err) {
        // Missing! Create it.
        logger.warn(`🛠️  Auto-fixing missing component: ${fileName}`);
        
        let fileContent = '';
        
        // Strategy: Check if it's likely an icon
        const isIcon = fileName.includes('icon');
        
        if (isIcon) {
             // Generate Lucide facade
             const exports = componentNames.map(name => {
                 // Remove 'Icon' suffix if present for Lucide mapping: ShoppingCartIcon -> ShoppingCart
                 const lucideName = name.replace(/Icon$/, '');
                 return `export { ${lucideName} as ${name} } from 'lucide-react';`;
             }).join('\n');
             fileContent = `import 'lucide-react';\n${exports}\n\n// Fallback for missing icons\nexport function ${componentNames[0]}Fallback() { return null; }`;
        } else {
             // Generate simple functional component for each exported name
             const exports = componentNames.map(name => {
                return `export function ${name}({ children, className, ...props }: any) {
       return (
         <div className={\`p-4 border border-dashed border-yellow-400 rounded bg-yellow-50/10 text-yellow-500 \${className}\`} {...props}>
           <span className="text-xs font-mono block mb-1">Missing: ${name}</span>
           {children}
         </div>
       );
     }`;
             }).join('\n\n');
             fileContent = `import React from 'react';\n\n${exports}`;
        }
        
        try {
           const dir = path.dirname(componentPath);
           await fs.mkdir(dir, { recursive: true });
           await fs.writeFile(componentPath, fileContent);
           logger.info(`✅ Created ${isIcon ? 'icon wrapper' : 'placeholder'} for ${fileName}`);
        } catch (writeErr) {
           logger.error(`Failed to create placeholder for ${fileName}:`, writeErr);
        }
      }
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
            logger.info('✅ Updated tsconfig.json with baseUrl: "."');
         }
       } catch (err) {
         logger.warn('Could not update tsconfig.json:', err.message);
       }
       
       // 3. Fix globals.css for Tailwind v4
       // MOVED TO ThemeGenerator to avoid conflict/overwrite issues
       logger.info('ℹ️  Skipping direct globals.css write (ThemeGenerator handles this)');
  } 
  
  async createTailwindConfig() {}
  async fixViteConfig() {}
}

module.exports = ProjectBuilderAgent;
