/**
 * MCP Resource Handlers
 * Provides read-only access to design system, component registry, and project state
 */

const { logger } = require('../utils/logger');

/**
 * Main router for resource reads
 */
async function handleResourceRead(uri) {
  logger.info(`Reading resource: ${uri}`);
  
  try {
    // Route based on URI prefix
    if (uri.startsWith('codesentinel://design-system/')) {
      return await handleDesignSystemResource(uri);
    }
    
    if (uri.startsWith('codesentinel://registry/')) {
      return await handleRegistryResource(uri);
    }
    
    if (uri.startsWith('codesentinel://project/')) {
      return await handleProjectResource(uri);
    }
    
    throw new Error(`Unknown resource URI: ${uri}`);
    
  } catch (error) {
    logger.error(`Failed to read resource ${uri}:`, error);
    throw error;
  }
}

/**
 * Handle design-system resources
 */
async function handleDesignSystemResource(uri) {
  const designSystem = require('../agents/designSystemContext');
  
  switch (uri) {
    case 'codesentinel://design-system/layout-patterns':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: designSystem.layoutPatterns
        }]
      };
      
    case 'codesentinel://design-system/component-selection':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: designSystem.componentSelection
        }]
      };
      
    case 'codesentinel://design-system/spacing-typography':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: designSystem.spacingAndTypography
        }]
      };
      
    case 'codesentinel://design-system/responsive-design':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: designSystem.responsiveDesign
        }]
      };
      
    default:
      throw new Error(`Unknown design-system resource: ${uri}`);
  }
}

/**
 * Handle registry resources
 */
async function handleRegistryResource(uri) {
  const registryTools = require('../registry/registryTools');
  const { getRegistryData } = require('../registry/registryIndex');
  
  switch (uri) {
    case 'codesentinel://registry/components':
      // Return all components from all registries
      const allComponents = {};
      const registries = ['shadcn', 'magicui', 'aceternity', 'motion-primitives', 'daisyui'];
      
      for (const registryId of registries) {
        try {
          const result = await registryTools.listComponents(registryId);
          allComponents[registryId] = result;
        } catch (error) {
          logger.warn(`Failed to load ${registryId}:`, error.message);
        }
      }
      
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(allComponents, null, 2)
        }]
      };
      
    case 'codesentinel://registry/shadcn':
      return await getSingleRegistryResource(uri, 'shadcn');
      
    case 'codesentinel://registry/magicui':
      return await getSingleRegistryResource(uri, 'magicui');
      
    case 'codesentinel://registry/aceternity':
      return await getSingleRegistryResource(uri, 'aceternity');
      
    case 'codesentinel://registry/motion-primitives':
      return await getSingleRegistryResource(uri, 'motion-primitives');
      
    case 'codesentinel://registry/daisyui':
      return await getSingleRegistryResource(uri, 'daisyui');
      
    default:
      throw new Error(`Unknown registry resource: ${uri}`);
  }
}

/**
 * Helper to get single registry data
 */
async function getSingleRegistryResource(uri, registryId) {
  const registryTools = require('../registry/registryTools');
  
  try {
    const result = await registryTools.listComponents(registryId);
    
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    throw new Error(`Failed to load ${registryId}: ${error.message}`);
  }
}

/**
 * Handle project resources
 */
async function handleProjectResource(uri) {
  switch (uri) {
    case 'codesentinel://project/current-state':
      // Get current project session state
      try {
        const projectSession = require('../services/projectSession');
        const state = projectSession.getSession();
        
        if (!state || Object.keys(state).length === 0) {
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                message: 'No active project session',
                hasProject: false
              }, null, 2)
            }]
          };
        }
        
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(state, null, 2)
          }]
        };
        
      } catch (error) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error.message,
              hasProject: false
            }, null, 2)
          }]
        };
      }
      
    default:
      throw new Error(`Unknown project resource: ${uri}`);
  }
}

module.exports = {
  handleResourceRead,
  handleDesignSystemResource,
  handleRegistryResource,
  handleProjectResource
};
