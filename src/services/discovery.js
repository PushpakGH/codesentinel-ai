/**
 * Discovery Service (v2 - Vector Powered)
 * Handles Component Registry Interaction and Semantic Search.
 */

const { logger } = require('../utils/logger');
const registryTools = require('../registry/registryTools');
const { UniversalRegistry } = require('../registry/registryIndex');
const { runCommand } = require('../utils/commandRunner');
const vectorService = require('./vectorService');

class DiscoveryService {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Refine component needs with registry intelligence
   */
  async refineComponentNeeds(plan) {
    // Vector search is powerful enough to understand intent, so we simplify this.
    // We keep basic mapping for extremely common patterns to save API calls.
    return plan;
  }

  /**
   * Discover components from registry
   */
  async discoverComponents(componentNeeds, projectPlan = {}) {
    logger.info('🔍 Discovering components using SEMANTIC Vector Search...');
    
    // Ensure vector index is ready
    await vectorService.initialize();

    const selectedComponents = {
      shadcn: [],
      magicui: [],
      aceternity: [],
      'motion-primitives': [],
      daisyui: [],
      npm: []
    };

    // ✅ SPECIAL COMPONENT MAPPINGS (Not in registries)
    const SPECIAL_COMPONENTS = {
      'codeeditor': { pkg: '@monaco-editor/react', name: 'monaco-editor' },
      'codeEditor': { pkg: '@monaco-editor/react', name: 'monaco-editor' },
      'editor': { pkg: '@monaco-editor/react', name: 'monaco-editor' },
      'monaco': { pkg: '@monaco-editor/react', name: 'monaco-editor' },
      'markdownRenderer': { pkg: 'react-markdown', name: 'react-markdown' },
      'markdown': { pkg: 'react-markdown', name: 'react-markdown' },
      'terminal': { pkg: '@xterm/xterm', name: 'xterm' },
      'consoleOutput': { pkg: '@xterm/xterm', name: 'xterm' },
      'syntaxHighlighter': { pkg: 'react-syntax-highlighter', name: 'react-syntax-highlighter' },
    };

    const invalidComponents = ['loginform', 'registerform', 'form', 'modetoggle', 'navbar', 'footer'];
    
    // Manual overrides for tricky components or preferred defaults
    const MANUAL_MAPPINGS = {
        // Shadcn mappings
        'toast': { registry: 'shadcn', name: 'sonner' }, // Shadcn uses sonner now
        'toaster': { registry: 'shadcn', name: 'sonner' }, // Toaster is also sonner
        'header': { registry: 'shadcn', name: 'navigation-menu' }, // Semantic map
        'nav': { registry: 'shadcn', name: 'navigation-menu' },
        'navigation': { registry: 'shadcn', name: 'navigation-menu' },
        'tag': { registry: 'shadcn', name: 'badge' }, // Tag is Badge in Shadcn
        'label': { registry: 'shadcn', name: 'label' }, // Label is a real component
        
        // MagicUI mappings
        'grid': { registry: 'magicui', name: 'bento-grid' },
        'grid-background': { registry: 'magicui', name: 'grid-pattern' },
        'gridbackground': { registry: 'magicui', name: 'grid-pattern' },
        'background-pattern': { registry: 'magicui', name: 'grid-pattern' },
        
        // Aceternity mappings
        'globe': { registry: 'aceternity', name: 'globe' },
        '3dglobe': { registry: 'aceternity', name: 'globe' },
        'world': { registry: 'aceternity', name: 'globe' },
        'meteors': { registry: 'aceternity', name: 'meteors' },
        'meteor': { registry: 'aceternity', name: 'meteors' },
        'stars': { registry: 'aceternity', name: 'meteors' },
        'background': { registry: 'aceternity', name: 'background-beams' },
        'animated-background': { registry: 'aceternity', name: 'background-beams' },
        'beams': { registry: 'aceternity', name: 'background-beams' },
        'spotlight': { registry: 'aceternity', name: 'spotlight' },
        '3d-card': { registry: 'aceternity', name: '3d-card' },
        '3dcard': { registry: 'aceternity', name: '3d-card' },
        'tilt-card': { registry: 'aceternity', name: '3d-card' },
        'hero': { registry: 'aceternity', name: 'hero-highlight' },
        'hero-section': { registry: 'aceternity', name: 'hero-highlight' },
        
        // Semantic/Generic mappings
        'wrapper': { registry: 'shadcn', name: 'card' }, // SectionWrapper → Card
        'sectionwrapper': { registry: 'shadcn', name: 'card' },
        'container': { registry: 'shadcn', name: 'card' },
    };
    
    // Extract preferences from plan
    const styleIntent = projectPlan.styleIntent || 'neutral';
    
    // Iterate over categories logic
    for (const [category, needed] of Object.entries(componentNeeds)) {
      if (!Array.isArray(needed) || needed.length === 0) continue;

      for (const rawName of needed) {
        const normalizedName = rawName.toLowerCase();
        if (invalidComponents.includes(normalizedName)) continue;
        
        // 0. Check Manual Mappings (Fast Path)
        if (MANUAL_MAPPINGS[normalizedName]) {
            const map = MANUAL_MAPPINGS[normalizedName];
            if (!selectedComponents[map.registry]) selectedComponents[map.registry] = [];
            if (!selectedComponents[map.registry].includes(map.name)) {
                selectedComponents[map.registry].push(map.name);
                logger.info(`✅ MAPPED "${rawName}" -> ${map.registry}/${map.name} (Manual Override)`);
            }
            continue;
        }

        // 0.5 Check Special NPM Components
        const specialKey = Object.keys(SPECIAL_COMPONENTS).find(
            k => normalizedName.includes(k.toLowerCase())
        );
        if (specialKey) {
            const special = SPECIAL_COMPONENTS[specialKey];
            if (!selectedComponents.npm.includes(special.pkg)) {
                selectedComponents.npm.push(special.pkg);
                logger.info(`✅ Mapped "${rawName}" -> npm/${special.pkg} (Special Component)`);
            }
            continue;
        }

        // 1. Semantic Search
        // Query simplified for better matches: "Component Name" is clearer than verbose sentences
        const query = `${rawName} component`; 
        
        logger.info(`🔍 Semantic Query: "${query}"`);
        
        // Fetch top 3 matches
        const results = await vectorService.search(query, 3);
        
        if (results.length > 0) {
            const best = results[0];
            // Improved Threshold Strategy:
            // 1. If strict match (> 0.75) -> Accept
            // 2. If name contains search term (partial match) -> Accept even if score is lower (0.60)
            const isNameMatch = best.name.includes(normalizedName) || normalizedName.includes(best.name);
            const threshold = isNameMatch ? 0.60 : 0.70; // Lower threshold if names align

            if (best.score > threshold) {
                logger.info(`✅ MATCH "${rawName}" -> ${best.registry}/${best.name} (Score: ${best.score.toFixed(2)})`);
                
                if (!selectedComponents[best.registry]) selectedComponents[best.registry] = [];
                if (!selectedComponents[best.registry].includes(best.name)) {
                    selectedComponents[best.registry].push(best.name);
                }
            } else {
                logger.warn(`⚠️ Low semantic match for "${rawName}" (Best: ${best.name} @ ${best.score.toFixed(2)}). Fallback to scaffolding.`);
            }
        } else {
            logger.warn(`❌ No semantic match for "${rawName}"`);
        }
      }
    }

    return selectedComponents;
  }
}

module.exports = { DiscoveryService };
