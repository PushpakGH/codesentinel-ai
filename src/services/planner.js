/**
 * Planner Service
 * Handles Project Specification, Prompt Engineering, and Planning.
 */

let vscode;
try {
  vscode = require('vscode');
} catch (e) {
  // Standalone mode - mock or ignore
  vscode = {
     window: { showInformationMessage: () => {}, withProgress: async (opts, task) => await task({ report: () => {} }) },
     workspace: { openTextDocument: async () => {}, getConfiguration: () => ({}) }
  };
}
const path = require('path');
const { logger } = require('../utils/logger');
const aiClient = require('./aiClient');
const fileSystem = require('./fileSystemManager');
const PromptEngineerAgent = require('../agents/promptEngineer'); // Keeping original location reference for now

class PlannerService {
  constructor() {
    this.promptEngineer = new PromptEngineerAgent();
  }

  /**
   * Analyze project type from user prompt
   */
  async analyzeProjectType(userPrompt) {
    const analysisPrompt = `
Analyze the following project request and return a JSON object with:
1. "projectType": "nextjs" or "react" or "vite" (default to nextjs if unsure or fullstack)
2. "language": "javascript" or "typescript"
3. "reasoning": Brief explanation why.

Request: "${userPrompt}"

JSON ONLY:
`;

    try {
      const response = await aiClient.generate(analysisPrompt, {
        systemPrompt: 'You are a senior tech lead. Output valid JSON only.',
        temperature: 0.1,
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found');
    } catch (e) {
      logger.warn('Analysis failed, using default Next.js/JS', e);
      return { projectType: 'nextjs', language: 'javascript', reasoning: 'Fallback due to analysis failure' };
    }
  }

  /**
   * Create detailed project plan
   */
  async createProjectPlan(userPrompt, projectAnalysis) {
    logger.info('Creating project plan...');

    const planPrompt = `
Act as a Senior Solutions Architect.
Create a comprehensive project plan for a "${projectAnalysis.projectType}" application using "${projectAnalysis.language}".
User Request: "${userPrompt}"

RULES:
1. **Dynamic Structure**: 
   - **Root Layout**: ALWAYS 'app/layout.tsx' (Global).
   - **Nested Layouts**: Use for Dashboards ('app/dashboard/layout.tsx') or Auth ('app/auth/layout.tsx') if needed.
   - **Pages**: explicit 'page.tsx' for every route.
   - **Layout Mapping**: Every page MUST specify which layout it uses.

2. **Naming Conventions** (Strict):
   - Page Names must be PascalCase and end with 'Page' (e.g. 'HomePage', 'DashboardPage').
   - Page Names must be SHORT (< 15 chars).
   - Routes must be lowercase, single-segment preferred (e.g. '/about', '/projects').

3. **Component Needs**:
   - Infer heavily from description.
   - If "Contact Form" -> needs 'forms'.
   - If "Charts" -> needs 'dataDisplay'.

4. **Library Preference**:
   - "modern/flashy" -> ["aceternity", "magicui"]
   - "minimal/clean" -> ["shadcn", "daisyui"]

RETURN JSON ONLY:
{
  "projectName": "PascalCaseName",
  "description": "Professional technical summary",
  "styleIntent": "creative", 
  "preferredLibraries": ["aceternity", "magicui"], 
  "layouts": [
    {
      "path": "app/layout.tsx",
      "description": "Root layout with Navbar, Footer, and ThemeProvider",
      "type": "root"
    },
    {
      "path": "app/dashboard/layout.tsx",
      "description": "Dashboard layout with Sidebar and Header",
      "type": "nested"
    }
  ],
  "pages": [
    { 
      "name": "HomePage", 
      "route": "/", 
      "description": "Primary landing page", 
      "layout": "app/layout.tsx",
      "features": ["Hero Section", "Feature Grid"] 
    },
    {
       "name": "DashboardPage",
       "route": "/dashboard",
       "layout": "app/dashboard/layout.tsx",
       "features": ["Analytics Chart", "User Table"]
    }
  ],
  "componentNeeds": {
    "forms": ["input", "button"],
    "layout": ["card", "accordion"]
  }
}
`;

    try {
      const response = await aiClient.generate(planPrompt, {
        systemPrompt: 'You are a project architect. Return valid JSON only.',
        maxTokens: 10000,
        temperature: 0.4,
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const plan = JSON.parse(jsonMatch[0]);

      // Defaults
      if (!plan.pages || !Array.isArray(plan.pages) || plan.pages.length === 0) {
        plan.pages = [{ name: 'HomePage', route: '/', description: 'Main page', features: ['Content display'], layout: 'app/layout.tsx' }];
      }
      if (!plan.layouts || !Array.isArray(plan.layouts)) {
          plan.layouts = [{ path: 'app/layout.tsx', description: 'Root layout', type: 'root' }];
      }
      if (!plan.componentNeeds || typeof plan.componentNeeds !== 'object') {
        plan.componentNeeds = { forms: ['input', 'button'], dataDisplay: ['card'] };
      }

      logger.info('Project plan created (raw):', JSON.stringify(plan, null, 2));

      // Safety Check: Enforce length limits
      plan.pages = plan.pages.map(p => {
        // Fix Name
        if (p.name.length > 20) {
          const simplified = p.name.replace(/Page$/, '').slice(0, 15);
          p.name = simplified + 'Page';
        }
        
        // Fix Route
        if (p.route.length > 20) {
          const segments = p.route.split('/').filter(Boolean);
          if (segments.length > 0) {
             let short = segments[0];
             if (short.length > 15) short = short.slice(0, 15);
             p.route = '/' + short;
          } else {
             p.route = '/page-' + Math.floor(Math.random() * 1000);
          }
        }
        
        // Fix Layout (Default to root if missing)
        if (!p.layout) p.layout = 'app/layout.tsx';
        
        return p;
      });

      return plan;
    } catch (error) {
      logger.error('Planning failed, using fallback:', error);
      return {
        projectName: 'MyApp',
        description: 'Generated application',
        preferredLibraries: ['shadcn'],
        layouts: [{ path: 'app/layout.tsx', description: 'Root layout', type: 'root' }],
        pages: [{ name: 'HomePage', route: '/', description: 'Main page', features: ['Content'], layout: 'app/layout.tsx' }],
        componentNeeds: { forms: ['input', 'button'], dataDisplay: ['card'] },
      };
    }
  }

  /**
   * Improve prompt and present for review
   */
  async refineAndReview(userPrompt, projectPath) {
    // 1. Improve Prompt
    const engineeredSpec = await this.promptEngineer.improvePrompt(userPrompt);

    // 2. Generate Review File
    const specContent = `# Project Specification
## User Goal
${engineeredSpec.improvedPrompt}

## Tech Stack
- Framework: ${engineeredSpec.projectType}
- Language: ${engineeredSpec.language || 'javascript'}

## Key Features
${engineeredSpec.keyFeatures.map(f => `- ${f}`).join('\n')}

## Component Requirements
\`\`\`json
${JSON.stringify(engineeredSpec.componentNeeds, null, 2)}
\`\`\`
`;
    
    // 3. Write and Open
    const specFile = path.join(projectPath, 'project-spec.md');
    // Ensure dir
    await fileSystem.createDirectory(projectPath, '');
    await fileSystem.writeFile(projectPath, 'project-spec.md', specContent);
    
    // Safe VSCode Interaction
    try {
        const doc = await vscode.workspace.openTextDocument(specFile);
        await vscode.window.showTextDocument(doc);
    } catch (e) {
        logger.warn('Could not open spec file in editor:', e);
    }
    
    return engineeredSpec;
  }
}

module.exports = { PlannerService };
