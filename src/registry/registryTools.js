/**
 * Registry Tools
 * Functions that AI can call to discover and install components
 * MCP-style function calling interface
 */

let vscode;
try {
  vscode = require('vscode');
} catch (e) {
  // Standalone mode - mock
  vscode = {
     window: { showInformationMessage: () => {}, showErrorMessage: console.error },
     workspace: { rootPath: process.cwd() }
  };
}
const { exec } = require('child_process');
const { promisify } = require('util');
const { logger } = require('../utils/logger');
const {
  AVAILABLE_REGISTRIES,
  getRegistry,
  getRegistryData,
  listRegistryComponents,
  getRegistryComponentMeta
} = require('./registryIndex');
const { fetchComponentList } = require('./registryFetcher');

const execAsync = promisify(exec);

/**
 * Tool 1: List available component registries
 * AI calls this to discover what libraries exist
 */
function listRegistries() {
  logger.info('AI requesting list of registries');

  return AVAILABLE_REGISTRIES.map((reg) => ({
    id: reg.id,
    name: reg.name,
    namespace: reg.namespace,
    type: reg.type,
    description: reg.description,
    totalComponents: reg.totalComponents,
    categories: reg.categories,
    website: reg.website
  }));
}

/**
 * Tool 2: List components in a specific registry
 * AI calls this after choosing a library
 */
async function listComponents(registryId, category = null) {
  logger.info(`AI requesting components from ${registryId}`, { category });

  try {
    // Prefer embedded rich data; allow fetch fallback if you later wire it
    const registryData = await getRegistryData(registryId);
    const componentsSource =
      registryData && Array.isArray(registryData.components)
        ? registryData.components
        : await fetchComponentList(registryId);

    let filtered = componentsSource;
    if (category) {
      filtered = filtered.filter((c) => c.category === category);
    }

    return {
      registry: registryId,
      totalComponents: filtered.length,
      categories: [...new Set(componentsSource.map((c) => c.category).filter(Boolean))],
      components: filtered.map((c) => ({
        name: c.name,
        category: c.category,
        description: c.description,
        // Hint whether this is class-based (daisyUI) vs component-based
        kind: c.classes ? 'class-based' : 'component-based'
      }))
    };
  } catch (error) {
    logger.error(`Failed to list components for ${registryId}:`, error);
    throw new Error(`Registry "${registryId}" not found or not accessible`);
  }
}

/**
 * Tool 3: Get detailed info about specific components
 * AI calls this to understand how to use components
 */
async function getComponentDetails(registryId, componentNames) {
  logger.info(`AI requesting details for ${componentNames.join(', ')} from ${registryId}`);

  try {
    const results = [];

    for (const name of componentNames) {
      // Try from embedded rich data first
      let component = await getRegistryComponentMeta(registryId, name);

      // Optional: fallback to fetched data (if you later normalize it)
      if (!component) {
        try {
          const remote = await fetchComponentList(registryId);
          component = Array.isArray(remote)
            ? remote.find((c) => c.name === name)
            : Array.isArray(remote.components)
            ? remote.components.find((c) => c.name === name)
            : null;
        } catch {
          // ignore fetch error here; handled below
        }
      }

      if (!component) {
        results.push({
          name,
          found: false,
          error: `Component "${name}" not found in ${registryId}`
        });
        continue;
      }

      const isDaisy = registryId === 'daisyui';

      results.push({
        name: component.name,
        category: component.category,
        description: component.description,
        dependencies: component.dependencies || [],
        files: component.files || [],
        usage: component.usage || (isDaisy ? 'Use the documented daisyUI classes on HTML elements.' : 'Import and use the component'),
        // For shadcn/magicui/aceternity/motion-primitives
        props: component.props || null,
        subComponents: component.subComponents || null,
        // For daisyUI
        classes: component.classes || null,
        examples: component.examples || [],
        found: true
      });
    }

    return {
      registry: registryId,
      requestedComponents: componentNames.length,
      foundComponents: results.filter((d) => d.found).length,
      details: results
    };
  } catch (error) {
    logger.error('Failed to get component details:', error);
    throw error;
  }
}

/**
 * Tool 4: Install components using CLI
 * AI calls this to add components to the project
 *
 * Returns installed/failed arrays for projectBuilder.js
 */
async function installComponents(registryId, componentNames, projectPath) {
  logger.info(`Installing ${componentNames.length} components from ${registryId}`);

  const registry = getRegistry(registryId);

  if (!registry) {
    logger.error(`Registry "${registryId}" not found`);
    return {
      installed: [],
      failed: componentNames,
      successCount: 0,
      failCount: componentNames.length,
      error: `Registry "${registryId}" not found`
    };
  }

  const installed = [];
  const failed = [];

  // Special handling for daisyUI (no individual component install)
  if (registryId === 'daisyui') {
    logger.info('daisyUI uses utility classes, no installation needed for individual components');

    try {
      await execAsync('npm list daisyui', { cwd: projectPath });

      return {
        installed: componentNames,
        failed: [],
        successCount: componentNames.length,
        failCount: 0,
        message: 'daisyUI uses utility classes (no CLI install needed)'
      };
    } catch {
      // daisyUI not installed, install it
      try {
        logger.info('Installing daisyUI package...');
        await execAsync('npm install -D daisyui@latest', { cwd: projectPath, timeout: 120000 });

        logger.info('✅ daisyUI installed');

        return {
          installed: componentNames,
          failed: [],
          successCount: componentNames.length,
          failCount: 0,
          message: 'daisyUI package installed'
        };
      } catch (installError) {
        logger.error('Failed to install daisyUI:', installError);
        return {
          installed: [],
          failed: componentNames,
          successCount: 0,
          failCount: componentNames.length,
          error: installError.message
        };
      }
    }
  }

  // For shadcn, magicui, aceternity, motion-primitives (shadcn-style CLI) or motion (npm)
  for (const componentName of componentNames) {
    try {
      logger.info(`Installing component: ${componentName}`);

      let command;

      if (registryId === 'motion-primitives') {
        // For now: install core motion package; components are copy-paste
        command = 'npm install motion';
      } else {
        const namespace = registry.namespace ? `${registry.namespace}/` : '';
        command = `npx shadcn@latest add ${namespace}${componentName} --yes --overwrite`;
      }

      logger.debug(`Running command: ${command}`);

      const { stderr } = await execAsync(command, {
        cwd: projectPath,
        timeout: 60000,
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      if (stderr && (stderr.includes('Invalid configuration') || stderr.includes('error:'))) {
        throw new Error(stderr);
      }

      installed.push(componentName);
      logger.info(`✅ Installed: ${componentName}`);
    } catch (error) {
      logger.error(`Failed to install ${componentName}:`, {
        message: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      });

      failed.push(componentName);
      logger.warn(`❌ Failed: ${componentName}`);
    }
  }

  const successCount = installed.length;
  const failCount = failed.length;

  if (successCount > 0) {
    vscode.window.showInformationMessage(
      `✅ Installed ${successCount}/${componentNames.length} component(s) from ${registry.name}`
    );
  }

  return {
    installed,
    failed,
    successCount,
    failCount,
    registry: registryId
  };
}

/**
 * Tool 5: Run npm install
 * AI calls this after project is created
 */
async function installDependencies(projectPath) {
  logger.info('Installing npm dependencies...');

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Installing Dependencies',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Running npm install...' });

        const { stdout } = await execAsync('npm install', {
          cwd: projectPath,
          timeout: 300000
        });

        logger.debug('npm install output:', stdout);
        return stdout;
      }
    );

    vscode.window.showInformationMessage('✅ Dependencies installed successfully');

    return {
      success: true,
      message: 'All dependencies installed'
    };
  } catch (error) {
    logger.error('npm install failed:', error);

    vscode.window
      .showErrorMessage(`❌ npm install failed: ${error.message}`, 'View Logs')
      .then((action) => {
        if (action === 'View Logs') {
          logger.show();
        }
      });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 6: Initialize shadcn in project
 * AI calls this before installing components
 */
async function initializeShadcn(projectPath) {
  logger.info('Initializing shadcn/ui...');

  try {
    const fs = require('fs').promises;
    const path = require('path');
    const componentsJsonPath = path.join(projectPath, 'components.json');

    try {
      await fs.access(componentsJsonPath);
      logger.info('shadcn/ui already initialized');
      return {
        success: true,
        message: 'shadcn/ui already configured',
        alreadyInitialized: true
      };
    } catch {
      // Not initialized, proceed
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Initializing shadcn/ui',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Running shadcn init...' });

        const { stdout } = await execAsync('npx shadcn@latest init -d', {
          cwd: projectPath,
          timeout: 120000
        });

        logger.debug('shadcn init output:', stdout);
        return stdout;
      }
    );

    vscode.window.showInformationMessage('✅ shadcn/ui initialized');

    // NEW: Install commonly needed packages that AI often uses
    try {
      logger.info('📦 Installing common dependencies...');
      await execAsync('npm install recharts next-themes @radix-ui/react-icons class-variance-authority clsx tailwind-merge tailwindcss-animate react-resizable-panels framer-motion date-fns @nivo/calendar @nivo/core @tailwindcss/typography canvas-confetti @types/canvas-confetti', {
        cwd: projectPath,
        timeout: 90000
      });
      logger.info('✅ Installed common dependencies');
    } catch (depsError) {
      logger.warn('Could not install common deps:', depsError.message);
    }

    // Install core Shadcn components that AI frequently uses
    // These ensure consistent API regardless of what vector search returns
    try {
      logger.info('📦 Installing core Shadcn components...');
      await execAsync('npx shadcn@latest add tabs card tooltip select dialog dropdown-menu avatar skeleton --yes', {
        cwd: projectPath,
        timeout: 120000
      });
      logger.info('✅ Installed core Shadcn components (tabs, card, tooltip, select, dialog, dropdown-menu, avatar, skeleton)');
    } catch (coreError) {
      logger.warn('Could not install core Shadcn components:', coreError.message);
    }

    return {
      success: true,
      message: 'shadcn/ui initialized successfully',
      alreadyInitialized: false
    };
  } catch (error) {
    logger.error('shadcn init failed:', error);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get tool definitions for Gemini function calling
 */
function getRegistryToolDefinitions() {
  return [
    {
      name: 'listRegistries',
      description: 'Get a list of all available component registries (shadcn, magicui, aceternity, daisyui, etc.)',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'listComponents',
      description: 'Get all components available in a specific registry. Optionally filter by category.',
      parameters: {
        type: 'object',
        properties: {
          registryId: {
            type: 'string',
            description: 'Registry ID (e.g., "shadcn", "magicui", "daisyui")',
            enum: AVAILABLE_REGISTRIES.map((r) => r.id)
          },
          category: {
            type: 'string',
            description: 'Optional: Filter by category (e.g., "forms", "navigation")'
          }
        },
        required: ['registryId']
      }
    },
    {
      name: 'getComponentDetails',
      description:
        'Get detailed information about specific components including props/classes, usage examples, and dependencies',
      parameters: {
        type: 'object',
        properties: {
          registryId: {
            type: 'string',
            description: 'Registry ID',
            enum: AVAILABLE_REGISTRIES.map((r) => r.id)
          },
          componentNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of component names to get details for (e.g., ["button", "card"])'
          }
        },
        required: ['registryId', 'componentNames']
      }
    },
    {
      name: 'initializeShadcn',
      description: 'Initialize shadcn/ui in the project (must be done before installing shadcn components)',
      parameters: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Absolute path to project directory'
          }
        },
        required: ['projectPath']
      }
    },
    {
      name: 'installComponents',
      description:
        'Install components using appropriate CLI. For shadcn/magicui/aceternity it runs shadcn CLI. For daisyUI it installs the npm package.',
      parameters: {
        type: 'object',
        properties: {
          registryId: {
            type: 'string',
            description: 'Registry ID',
            enum: AVAILABLE_REGISTRIES.map((r) => r.id)
          },
          componentNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of component names to install (e.g., ["button", "card", "dialog"])'
          },
          projectPath: {
            type: 'string',
            description: 'Absolute path to project directory'
          }
        },
        required: ['registryId', 'componentNames', 'projectPath']
      }
    },
    {
      name: 'installDependencies',
      description: 'Run npm install to install all dependencies listed in package.json',
      parameters: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Absolute path to project directory'
          }
        },
        required: ['projectPath']
      }
    }
  ];
}

module.exports = {
  listRegistries,
  listComponents,
  getComponentDetails,
  installComponents,
  installDependencies,
  initializeShadcn,
  getRegistryToolDefinitions
};
