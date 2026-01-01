/**
 * MCP Tool Handlers
 * Implements all MCP tools by delegating to existing agents and services
 */

const { logger } = require('../utils/logger');
const vscode = require('vscode');

/**
 * Main router for all tool calls
 */
async function handleToolCall(toolName, params, mcpServer) {
  logger.info(`Handling tool call: ${toolName}`);
  
  switch (toolName) {
    case 'generate_project':
      return await handleGenerateProject(params, mcpServer);
      
    case 'install_components':
      return await handleInstallComponents(params, mcpServer);
      
    case 'discover_components':
      return await handleDiscoverComponents(params, mcpServer);
      
    case 'review_code':
      return await handleReviewCode(params, mcpServer);
      
    case 'fix_code':
      return await handleFixCode(params, mcpServer);
      
    case 'generate_tests':
      return await handleGenerateTests(params, mcpServer);
      
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Tool: generate_project
 * Delegates to existing ProjectBuilderAgent
 */
async function handleGenerateProject(params, mcpServer) {
  const { prompt, projectPath, projectType } = params;
  
  if (!prompt || !projectPath) {
    throw new Error('Missing required parameters: prompt and projectPath');
  }

  logger.info(`Generating project at: ${projectPath}`);
  
  // Emit progress events
  mcpServer.emit('tool_progress', {
    tool: 'generate_project',
    phase: 'initializing',
    percent: 0
  });

  try {
    // Use existing ProjectBuilderAgent
    const ProjectBuilderAgent = require('../agents/projectBuilder');
    const builder = new ProjectBuilderAgent();
    
    // Hook into progress events
    const progressCallback = (phase, percent) => {
      mcpServer.emit('tool_progress', {
        tool: 'generate_project',
        phase,
        percent
      });
    };

    // Execute project generation
    const result = await builder.buildProject(prompt, projectPath);
    
    if (!result.success) {
      throw new Error(result.error || 'Project generation failed');
    }

    // Return structured result
    return {
      success: true,
      projectPath: projectPath,
      projectType: result.projectAnalysis?.projectType || projectType || 'auto',
      generatedFiles: result.generatedPages?.length || 0,
      installedComponents: result.installedComponents || {},
      techStack: {
        framework: result.projectAnalysis?.framework || 'react',
        language: result.projectAnalysis?.language || 'javascript'
      },
      message: `✅ Project generated successfully at ${projectPath}`,
      nextSteps: [
        `cd ${projectPath}`,
        'npm install',
        'npm run dev'
      ]
    };
    
  } catch (error) {
    logger.error('generate_project failed:', error);
    throw new Error(`Project generation failed: ${error.message}`);
  }
}

/**
 * Tool: install_components
 */
async function handleInstallComponents(params, mcpServer) {
  const { registry, components, projectPath } = params;
  
  if (!registry || !components || !projectPath) {
    throw new Error('Missing required parameters: registry, components, projectPath');
  }

  logger.info(`Installing ${components.length} components from ${registry}`);
  
  mcpServer.emit('tool_progress', {
    tool: 'install_components',
    phase: 'installing',
    percent: 0
  });

  try {
    const registryTools = require('../registry/registryTools');
    
    const result = await registryTools.installComponents(
      registry,
      components,
      projectPath
    );
    
    mcpServer.emit('tool_progress', {
      tool: 'install_components',
      phase: 'complete',
      percent: 100
    });

    return {
      success: result.successCount > 0,
      installed: result.installed || [],
      failed: result.failed || [],
      successCount: result.successCount || 0,
      failCount: result.failCount || 0,
      registry: registry,
      message: `✅ Installed ${result.successCount}/${components.length} components from ${registry}`
    };
    
  } catch (error) {
    logger.error('install_components failed:', error);
    throw new Error(`Component installation failed: ${error.message}`);
  }
}

/**
 * Tool: discover_components
 */
async function handleDiscoverComponents(params, mcpServer) {
  const { registry = 'all', category } = params;
  
  logger.info(`Discovering components from registry: ${registry}`);
  
  try {
    const registryTools = require('../registry/registryTools');
    const { AVAILABLE_REGISTRIES } = require('../registry/registryIndex');
    
    if (registry === 'all') {
      // Fetch from all registries
      const allComponents = {};
      
      for (const reg of AVAILABLE_REGISTRIES) {
        if (!reg.supported) continue;
        
        try {
          const result = await registryTools.listComponents(reg.id, category);
          allComponents[reg.id] = result;
        } catch (error) {
          logger.warn(`Failed to fetch ${reg.id}:`, error.message);
          allComponents[reg.id] = { error: error.message };
        }
      }
      
      return {
        registries: allComponents,
        totalRegistries: Object.keys(allComponents).length,
        message: 'Component discovery complete for all registries'
      };
      
    } else {
      // Fetch from specific registry
      const result = await registryTools.listComponents(registry, category);
      
      return {
        registry: registry,
        totalComponents: result.totalComponents || 0,
        categories: result.categories || [],
        components: result.components || [],
        message: `Found ${result.totalComponents || 0} components in ${registry}`
      };
    }
    
  } catch (error) {
    logger.error('discover_components failed:', error);
    throw new Error(`Component discovery failed: ${error.message}`);
  }
}

/**
 * Tool: review_code
 */
async function handleReviewCode(params, mcpServer) {
  const { code, language, fileName } = params;
  
  if (!code || !language) {
    throw new Error('Missing required parameters: code and language');
  }

  logger.info(`Reviewing ${language} code...`);
  
  mcpServer.emit('tool_progress', {
    tool: 'review_code',
    phase: 'analyzing',
    percent: 30
  });

  try {
    const { reviewCodeForChat } = require('../commands/reviewCode');
    
    const result = await reviewCodeForChat(code, language, fileName || 'untitled');
    
    mcpServer.emit('tool_progress', {
      tool: 'review_code',
      phase: 'complete',
      percent: 100
    });

    return {
      success: true,
      summary: result.summary || {},
      issues: result.issues || [],
      riskScore: result.summary?.riskScore || 0,
      totalIssues: result.summary?.totalIssues || 0,
      message: `Code review complete: ${result.summary?.totalIssues || 0} issues found`
    };
    
  } catch (error) {
    logger.error('review_code failed:', error);
    throw new Error(`Code review failed: ${error.message}`);
  }
}

/**
 * Tool: fix_code
 */
async function handleFixCode(params, mcpServer) {
  const { code, issues, language } = params;
  
  if (!code || !language) {
    throw new Error('Missing required parameters: code and language');
  }

  logger.info('Applying AI fixes to code...');
  
  mcpServer.emit('tool_progress', {
    tool: 'fix_code',
    phase: 'analyzing',
    percent: 20
  });

  try {
    const aiClient = require('../services/aiClient');
    await aiClient.initialize();
    
    const fixPrompt = `You are an expert code fixer.

Original code:
\`\`\`${language}
${code}
\`\`\`

Issues to fix:
${issues ? issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n') : 'General improvements needed'}

Generate FIXED code that:
1. Resolves all mentioned issues
2. Maintains original functionality
3. Follows best practices for ${language}
4. Has proper error handling

Return ONLY the fixed code, no explanations.`;

    mcpServer.emit('tool_progress', {
      tool: 'fix_code',
      phase: 'generating',
      percent: 60
    });

    const fixedCode = await aiClient.generate(fixPrompt, {
      systemPrompt: 'You are a code fixing expert. Return only code, no markdown fences.',
      maxTokens: 8000
    });

    mcpServer.emit('tool_progress', {
      tool: 'fix_code',
      phase: 'complete',
      percent: 100
    });

    // Clean up code fences if AI added them
    const cleanedCode = fixedCode
      .replace(/```[a-z]*\n/g, '')
      .replace(/```$/g, '')
      .trim();

    return {
      success: true,
      fixedCode: cleanedCode,
      issuesFixed: issues?.length || 0,
      message: 'Code fixes applied successfully'
    };
    
  } catch (error) {
    logger.error('fix_code failed:', error);
    throw new Error(`Code fixing failed: ${error.message}`);
  }
}

/**
 * Tool: generate_tests
 */
async function handleGenerateTests(params, mcpServer) {
  const { code, framework = 'auto', language } = params;
  
  if (!code || !language) {
    throw new Error('Missing required parameters: code and language');
  }

  logger.info(`Generating ${framework} tests for ${language} code...`);
  
  mcpServer.emit('tool_progress', {
    tool: 'generate_tests',
    phase: 'analyzing',
    percent: 30
  });

  try {
    const { generateTestsForCode } = require('../commands/testGenerator');
    
    const testCode = await generateTestsForCode(code, language, framework);
    
    mcpServer.emit('tool_progress', {
      tool: 'generate_tests',
      phase: 'complete',
      percent: 100
    });

    return {
      success: true,
      testCode: testCode,
      framework: framework,
      language: language,
      message: 'Test generation complete'
    };
    
  } catch (error) {
    logger.error('generate_tests failed:', error);
    throw new Error(`Test generation failed: ${error.message}`);
  }
}

module.exports = {
  handleToolCall,
  handleGenerateProject,
  handleInstallComponents,
  handleDiscoverComponents,
  handleReviewCode,
  handleFixCode,
  handleGenerateTests
};
