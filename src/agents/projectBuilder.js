/**
 * Project Builder Agent
 * Handles multi-turn conversations for project generation
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');

// Safety: Prevent dangerous operations
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /del\s+\/[fFsS]/,
  /format\s+c:/i,
  /:\//,  // Absolute paths
  /\.\.\//  // Parent directory traversal
];

class ProjectBuilderAgent {
  constructor() {
    this.conversationHistory = [];
    this.currentProject = null;
  }

  /**
   * Main entry point - User says "Build me X"
   */
  async startProject(userPrompt, workspaceFolder) {
    this.currentProject = {
      rootPath: workspaceFolder.uri.fsPath,
      createdFiles: [],
      installedPackages: []
    };

    // Phase 1: Planning
    const plan = await this.createProjectPlan(userPrompt);
    
    // Phase 2: Get user approval
    const approved = await this.showPlanApproval(plan);
    if (!approved) return;

    // Phase 3: Execute with tools
    await this.executeProjectGeneration(plan, userPrompt);
  }

  /**
   * Phase 1: Ask AI to create a project plan
   */
  async createProjectPlan(userPrompt) {
    const planningPrompt = `You are a project planning assistant. Analyze this request and create a structured plan.

User Request: "${userPrompt}"

Create a JSON plan with:
{
  "projectType": "dashboard|landing|saas|blog|ecommerce",
  "framework": "react|next|vanilla",
  "uiLibrary": "tailwind|daisyui|none",
  "folders": ["src", "components", "pages"],
  "files": [
    {"path": "package.json", "description": "Dependencies"},
    {"path": "src/App.jsx", "description": "Main component"}
  ],
  "packages": ["react", "vite"],
  "estimatedFiles": 10,
  "complexity": 1-10
}

Return ONLY valid JSON, no explanations.`;

    const response = await aiClient.generate(planningPrompt, {
      systemPrompt: 'You are a project planner. Output only JSON.',
      maxTokens: 1000
    });

    try {
      const plan = JSON.parse(this.extractJSON(response));
      logger.info('Project plan created:', plan);
      return plan;
    } catch (e) {
      throw new Error('Failed to parse project plan');
    }
  }

  /**
   * Show plan to user for approval
   */
  async showPlanApproval(plan) {
    const message = `📋 **Project Plan**

**Type:** ${plan.projectType}
**Framework:** ${plan.framework}
**Files to create:** ${plan.estimatedFiles}
**Packages:** ${plan.packages.join(', ')}

**Folders:**
${plan.folders.map(f => `- ${f}`).join('\n')}

Proceed with generation?`;

    const choice = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      'Yes, Build It!',
      'Cancel'
    );

    return choice === 'Yes, Build It!';
  }

  /**
   * Phase 3: Execute with Gemini function calling
   */
  async executeProjectGeneration(plan, userPrompt) {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building Project',
      cancellable: false
    }, async (progress) => {
      
      progress.report({ message: 'Initializing...', increment: 10 });

      // Define tools for Gemini
      const tools = this.getProjectTools();

      const systemPrompt = `You are a project generator. Use the provided tools to create a ${plan.projectType} project.

AVAILABLE TOOLS:
- createFolder(path): Create a directory
- writeFile(path, content): Write a file
- readComponentDocs(library, components): Get usage docs for UI components

RULES:
1. Create folders before files
2. Use relative paths only (no absolute paths like C:/ or /)
3. Follow the plan: ${JSON.stringify(plan)}
4. Write production-ready code with comments
5. Don't use rm, del, or format commands

Start by creating the folder structure, then files one by one.`;

      try {
        await aiClient.initialize();

        let iteration = 0;
        const MAX_ITERATIONS = 50; // Safety limit

        while (iteration < MAX_ITERATIONS) {
          const prompt = iteration === 0 
            ? `Execute this plan: ${JSON.stringify(plan)}\n\nUser requested: "${userPrompt}"`
            : 'Continue building the project';

          const response = await aiClient.generateWithTools(prompt, {
            systemPrompt,
            tools,
            maxTokens: 2000
          });

          // Check if AI wants to call tools
          const toolCalls = this.parseToolCalls(response);
          
          if (!toolCalls || toolCalls.length === 0) {
            // Generation complete
            break;
          }

          // Execute each tool call
          for (const call of toolCalls) {
            progress.report({ 
              message: `${call.name}(${call.args.path || ''})...`,
              increment: 2
            });

            await this.executeToolCall(call);
          }

          iteration++;
        }

        progress.report({ message: 'Finalizing...', increment: 100 });

        vscode.window.showInformationMessage(
          `✅ Project created! Files: ${this.currentProject.createdFiles.length}`,
          'Open Project',
          'Install Dependencies'
        ).then(action => {
          if (action === 'Open Project') {
            vscode.commands.executeCommand('vscode.openFolder', 
              vscode.Uri.file(this.currentProject.rootPath));
          } else if (action === 'Install Dependencies') {
            this.installDependencies();
          }
        });

      } catch (error) {
        logger.error('Project generation failed:', error);
        vscode.window.showErrorMessage(`❌ Failed: ${error.message}`);
      }
    });
  }

  /**
   * Define available tools for Gemini
   */
  getProjectTools() {
    return [
      {
        name: 'createFolder',
        description: 'Create a directory in the project',
        parameters: {
          path: { type: 'string', description: 'Relative folder path like "src/components"' }
        }
      },
      {
        name: 'writeFile',
        description: 'Write content to a file',
        parameters: {
          path: { type: 'string', description: 'Relative file path like "src/App.jsx"' },
          content: { type: 'string', description: 'The file content' }
        }
      },
      {
        name: 'readComponentDocs',
        description: 'Get usage documentation for UI components',
        parameters: {
          library: { type: 'string', enum: ['tailwind', 'daisyui', 'shadcn'] },
          components: { type: 'array', items: { type: 'string' } }
        }
      }
    ];
  }

  /**
   * Execute a tool call safely
   */
  async executeToolCall(call) {
    // Safety check
    if (call.args.path) {
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(call.args.path)) {
          throw new Error(`Blocked dangerous path: ${call.args.path}`);
        }
      }
    }

    switch (call.name) {
      case 'createFolder':
        await this.createFolder(call.args.path);
        break;
      
      case 'writeFile':
        await this.writeFile(call.args.path, call.args.content);
        break;
      
      case 'readComponentDocs':
        return await this.readComponentDocs(call.args.library, call.args.components);
      
      default:
        logger.warn('Unknown tool call:', call.name);
    }
  }

  /**
   * Tool Implementation: Create Folder
   */
  async createFolder(relativePath) {
    const fullPath = path.join(this.currentProject.rootPath, relativePath);
    await fs.mkdir(fullPath, { recursive: true });
    logger.info('Created folder:', relativePath);
  }

  /**
   * Tool Implementation: Write File
   */
  async writeFile(relativePath, content) {
    const fullPath = path.join(this.currentProject.rootPath, relativePath);
    
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
    
    this.currentProject.createdFiles.push(relativePath);
    logger.info('Created file:', relativePath);

    // Show in VS Code
    const doc = await vscode.workspace.openTextDocument(fullPath);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  /**
   * Tool Implementation: Read Component Docs (Embedded Registry)
   */
  async readComponentDocs(library, components) {
    const registry = require('../registry/componentRegistry');
    const docs = registry.getDocs(library, components);
    return JSON.stringify(docs);
  }

  /**
   * Install dependencies using terminal
   */
  async installDependencies() {
    const terminal = vscode.window.createTerminal('Project Setup');
    terminal.show();
    terminal.sendText(`cd "${this.currentProject.rootPath}"`);
    terminal.sendText('npm install');
  }

  // Helper methods
  extractJSON(text) {
    const match = text.match(/``````/) || text.match(/{[\s\S]*}/);
    return match ? match[1] || match[0] : text;
  }

  parseToolCalls(response) {
    // Parse function calls from AI response
    // Implementation depends on your AI client format
    return []; // Placeholder
  }
}

module.exports = { ProjectBuilderAgent };
