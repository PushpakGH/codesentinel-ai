/**
 * CodeSentinel AI - Embedded MCP Server
 * Production-ready implementation with full error handling
 * 
 * This runs INSIDE the VS Code extension process, not as a separate server.
 * External clients (Claude Desktop) can still connect via stdio transport.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const EventEmitter = require('events');
const { logger } = require('../utils/logger');

class MCPServer extends EventEmitter {
  constructor(extensionContext) {
    super();
    this.context = extensionContext;
    this.server = null;
    this.transport = null;
    this.initialized = false;
    this.externalMode = false; // true if started for Claude Desktop
  }

  /**
   * Initialize MCP server (registers handlers)
   * Call this during extension activation
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('MCP server already initialized');
      return true;
    }

    logger.info('🚀 Initializing embedded MCP server...');

    try {
      // Create MCP server instance
      this.server = new Server(
        {
          name: 'codesentinel-ai',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
        }
      );

      // Register all handlers
      await this._registerTools();
      await this._registerResources();
      await this._registerPrompts();

      this.initialized = true;
      logger.info('✅ MCP server initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize MCP server:', error);
      // Don't throw - allow extension to continue without MCP
      return false;
    }
  }

  /**
   * Start external transport (for Claude Desktop)
   * This is OPTIONAL - only call if you want external MCP clients
   */
  async startExternalTransport() {
    if (!this.initialized) {
      throw new Error('MCP server not initialized. Call initialize() first.');
    }

    if (this.externalMode) {
      logger.warn('External transport already started');
      return;
    }

    try {
      logger.info('Starting stdio transport for external MCP clients...');
      
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);
      
      this.externalMode = true;
      logger.info('✅ MCP server listening on stdio (Claude Desktop can connect)');
    } catch (error) {
      logger.error('Failed to start external transport:', error);
      // Don't throw - internal mode still works
    }
  }

  /**
   * Internal method for chat panel to call MCP tools
   * This is the primary method your chat panel will use
   * 
   * @param {string} toolName - Tool to call (e.g., 'generate_project')
   * @param {object} params - Tool parameters
   * @returns {Promise<object>} Tool result
   */
  async callTool(toolName, params) {
    if (!this.initialized) {
      throw new Error('MCP server not initialized');
    }

    logger.info(`🔧 Internal MCP tool call: ${toolName}`);
    logger.debug('Tool params:', params);
    
    // Emit start event for progress tracking
    this.emit('tool_call_start', { 
      tool: toolName, 
      params,
      timestamp: Date.now()
    });
    
    try {
      // Dynamically load tool handler
      const toolHandlers = require('./toolHandlers');
      const result = await toolHandlers.handleToolCall(toolName, params, this);
      
      // Emit success event
      this.emit('tool_call_complete', { 
        tool: toolName, 
        result,
        timestamp: Date.now()
      });
      
      logger.info(`✅ Tool ${toolName} completed successfully`);
      return result;
      
    } catch (error) {
      logger.error(`Tool ${toolName} failed:`, error);
      
      // Emit error event
      this.emit('tool_call_error', { 
        tool: toolName, 
        error: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Internal method to read MCP resources
   * 
   * @param {string} uri - Resource URI (e.g., 'codesentinel://design-system/layout-patterns')
   * @returns {Promise<object>} Resource content
   */
  async readResource(uri) {
    if (!this.initialized) {
      throw new Error('MCP server not initialized');
    }

    logger.info(`📖 Reading MCP resource: ${uri}`);
    
    try {
      const resourceHandlers = require('./resourceHandlers');
      const result = await resourceHandlers.handleResourceRead(uri);
      
      logger.debug(`✅ Resource ${uri} read successfully`);
      return result;
      
    } catch (error) {
      logger.error(`Failed to read resource ${uri}:`, error);
      throw error;
    }
  }

  /**
   * Get available prompt templates
   * 
   * @returns {Promise<Array>} List of prompts
   */
  async listPrompts() {
    if (!this.initialized) {
      throw new Error('MCP server not initialized');
    }

    const promptTemplates = require('./promptTemplates');
    return promptTemplates.getAvailablePrompts();
  }

  /**
   * Execute a prompt template
   * 
   * @param {string} promptName - Name of prompt template
   * @param {object} variables - Variables to fill in template
   * @returns {Promise<object>} Prompt result
   */
  async executePrompt(promptName, variables) {
    if (!this.initialized) {
      throw new Error('MCP server not initialized');
    }

    logger.info(`📝 Executing prompt template: ${promptName}`);
    
    const promptTemplates = require('./promptTemplates');
    return await promptTemplates.executePrompt(promptName, variables, this);
  }

  // =========================================
  // PRIVATE METHODS - Handler Registration
  // =========================================

  async _registerTools() {
    const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
    
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('MCP client requesting tool list');
      
      return {
        tools: [
          {
            name: 'generate_project',
            description: 'Generate a complete React/Next.js project with AI-designed UI using all available component libraries (shadcn, magicui, aceternity, motion-primitives)',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Natural language description of the project (e.g., "Build a SaaS landing page with pricing, testimonials, and hero section")',
                },
                projectPath: {
                  type: 'string',
                  description: 'Absolute path to target folder where project will be created',
                },
                projectType: {
                  type: 'string',
                  enum: ['nextjs', 'vite-react', 'auto'],
                  description: 'Framework choice. Use "auto" for AI to decide based on project requirements.',
                }
              },
              required: ['prompt', 'projectPath'],
            },
          },
          {
            name: 'install_components',
            description: 'Install UI components from shadcn/magicui/aceternity/motion-primitives registries into an existing project',
            inputSchema: {
              type: 'object',
              properties: {
                registry: {
                  type: 'string',
                  enum: ['shadcn', 'magicui', 'aceternity', 'motion-primitives', 'all'],
                  description: 'Component registry to install from. Use "all" to try all registries.',
                },
                components: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of component names to install (e.g., ["button", "card", "dialog"])',
                },
                projectPath: {
                  type: 'string',
                  description: 'Absolute path to project root (must have package.json)',
                }
              },
              required: ['registry', 'components', 'projectPath'],
            },
          },
          {
            name: 'discover_components',
            description: 'Fetch complete list of available components from all registries with usage examples and categories',
            inputSchema: {
              type: 'object',
              properties: {
                registry: {
                  type: 'string',
                  enum: ['shadcn', 'magicui', 'aceternity', 'motion-primitives', 'daisyui', 'all'],
                  description: 'Registry to query. Use "all" to get components from all registries.',
                },
                category: {
                  type: 'string',
                  description: 'Optional: Filter by category (e.g., "forms", "navigation", "animations")',
                }
              },
            },
          },
          {
            name: 'review_code',
            description: 'Perform multi-agent code review (security, quality, best practices) with detailed issue reports',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Source code to review',
                },
                language: {
                  type: 'string',
                  description: 'Programming language (e.g., "javascript", "typescript", "python")',
                },
                fileName: {
                  type: 'string',
                  description: 'Optional: File name for context',
                }
              },
              required: ['code', 'language'],
            },
          },
          {
            name: 'fix_code',
            description: 'Apply AI-generated fixes to code based on review issues',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Source code to fix',
                },
                issues: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of issues to fix (from review_code results)',
                },
                language: {
                  type: 'string',
                  description: 'Programming language',
                }
              },
              required: ['code', 'language'],
            },
          },
          {
            name: 'generate_tests',
            description: 'Generate unit tests for provided code using appropriate testing framework',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Source code to generate tests for',
                },
                framework: {
                  type: 'string',
                  enum: ['jest', 'vitest', 'mocha', 'pytest', 'auto'],
                  description: 'Testing framework. Use "auto" to detect from project.',
                },
                language: {
                  type: 'string',
                  description: 'Programming language',
                }
              },
              required: ['code', 'language'],
            },
          },
          {
            name: 'search_components',
            description: 'Semantically search for UI components across all registries (Shadcn, MagicUI, Aceternity, Motion Primitives). Uses intelligent ranking.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (e.g. "animated hero section", "minimal button").',
                },
                style_preference: {
                  type: 'string',
                  enum: ['minimal', 'animated', 'creative', 'corporate', 'neutral'],
                  description: 'Visual style preference to bias the results.',
                  default: 'neutral'
                }
              },
              required: ['query'],
            },
          }
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info(`External MCP tool call: ${name}`);
      
      try {
        const toolHandlers = require('./toolHandlers');
        const result = await toolHandlers.handleToolCall(name, args, this);
        
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }],
        };
      } catch (error) {
        logger.error(`Tool ${name} failed:`, error);
        return {
          content: [{
            type: 'text',
            text: `❌ Error: ${error.message}\n\nStack: ${error.stack}`
          }],
          isError: true,
        };
      }
    });

    logger.debug('✅ MCP tools registered');
  }

  async _registerResources() {
    const { ListResourcesRequestSchema, ReadResourceRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
    
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.debug('MCP client requesting resource list');
      
      return {
        resources: [
          {
            uri: 'codesentinel://design-system/layout-patterns',
            name: 'Layout Design Patterns',
            description: 'Professional layout patterns for different page types (hero, dashboard, form, grid, table)',
            mimeType: 'application/json',
          },
          {
            uri: 'codesentinel://design-system/component-selection',
            name: 'Component Selection Rules',
            description: 'Rules for choosing components from different registries based on use case',
            mimeType: 'application/json',
          },
          {
            uri: 'codesentinel://registry/components',
            name: 'Available Components',
            description: 'Complete list of all installable components across all registries',
            mimeType: 'application/json',
          },
          {
            uri: 'codesentinel://registry/shadcn',
            name: 'Shadcn UI Components',
            description: 'Detailed component list for shadcn/ui registry',
            mimeType: 'application/json',
          },
          {
            uri: 'codesentinel://registry/magicui',
            name: 'Magic UI Components',
            description: 'Animated components from Magic UI',
            mimeType: 'application/json',
          },
          {
            uri: 'codesentinel://registry/aceternity',
            name: 'Aceternity UI Components',
            description: 'Beautiful animated components from Aceternity',
            mimeType: 'application/json',
          },
          {
            uri: 'codesentinel://project/current-state',
            name: 'Current Project State',
            description: 'Tech stack, installed components, and file structure of active project',
            mimeType: 'application/json',
          }
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      logger.debug(`External MCP resource read: ${uri}`);
      
      const resourceHandlers = require('./resourceHandlers');
      return await resourceHandlers.handleResourceRead(uri);
    });

    logger.debug('✅ MCP resources registered');
  }

  async _registerPrompts() {
    const { ListPromptsRequestSchema, GetPromptRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
    
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.debug('MCP client requesting prompt list');
      
      const promptTemplates = require('./promptTemplates');
      return {
        prompts: promptTemplates.getAvailablePrompts()
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.debug(`External MCP prompt request: ${name}`);
      
      const promptTemplates = require('./promptTemplates');
      return await promptTemplates.getPromptTemplate(name, args);
    });

    logger.debug('✅ MCP prompts registered');
  }

  /**
   * Shutdown MCP server gracefully
   */
  async shutdown() {
    logger.info('Shutting down MCP server...');
    
    if (this.transport) {
      try {
        await this.server.close();
        logger.info('✅ MCP server shutdown complete');
      } catch (error) {
        logger.error('Error during MCP server shutdown:', error);
      }
    }
    
    this.initialized = false;
    this.externalMode = false;
  }
}

module.exports = MCPServer;
