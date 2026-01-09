/**
 * Discovery Service
 * Handles Component Registry Interaction and Semantic Search.
 */

const { logger } = require('../utils/logger');
const registryTools = require('../registry/registryTools');
const { UniversalRegistry } = require('../registry/registryIndex');
const { runCommand } = require('../utils/commandRunner');

class DiscoveryService {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Refine component needs with registry intelligence
   */
  async refineComponentNeeds(plan) {
    const refined = { ...plan.componentNeeds };
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
      pagination: ['pagination'],
    };

    for (const page of plan.pages) {
      const text = `${page.name} ${page.description}`.toLowerCase();
      for (const [intent, comps] of Object.entries(intentMap)) {
        if (text.includes(intent)) {
          if (!refined.dataDisplay) refined.dataDisplay = [];
          for (const c of comps) {
            if (!refined.dataDisplay.includes(c)) refined.dataDisplay.push(c);
          }
        }
      }
    }
    return { ...plan, componentNeeds: refined };
  }

  /**
   * Discover components from registry
   */
  async discoverComponents(componentNeeds, projectPlan = {}) {
    logger.info('🔍 Discovering components using registry metadata...');

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

    const invalidComponents = ['loginform', 'registerform', 'form'];
    
    // Extract preferences from plan
    const styleIntent = projectPlan.styleIntent || 'neutral';
    const preferredLibraries = projectPlan.preferredLibraries || [];

    logger.info(`🎨 Style Intent: ${styleIntent}`);
    logger.info(`📚 Preferred Libraries: ${preferredLibraries.join(', ') || 'None'}`);

    for (const [category, needed] of Object.entries(componentNeeds)) {
      if (!Array.isArray(needed) || needed.length === 0) continue;

      logger.info(`Discovering components for category "${category}":`, needed);

      for (const rawName of needed) {
        if (invalidComponents.includes(rawName.toLowerCase())) continue;

        // ✅ CHECK SPECIAL COMPONENTS FIRST (Monaco, Markdown, etc.)
        const specialKey = Object.keys(SPECIAL_COMPONENTS).find(
          k => rawName.toLowerCase().includes(k.toLowerCase())
        );
        if (specialKey) {
          const special = SPECIAL_COMPONENTS[specialKey];
          if (!selectedComponents.npm.includes(special.pkg)) {
            selectedComponents.npm.push(special.pkg);
            logger.info(`✅ Mapped "${rawName}" -> npm/${special.pkg} (Special Component)`);
          }
          continue;
        }

        // 1. Determine local style override
        let localStyle = styleIntent;
        if (category.includes('hero') || category.includes('background') || rawName.includes('Card')) localStyle = 'creative';
        if (category.includes('animation') || rawName.includes('Text')) localStyle = 'animated';
        if (category.includes('form') || category.includes('layout')) localStyle = 'minimal';

        // 2. Use Universal Registry with Explicit Preferences
        let bestMatch = null;
        let highestScore = 0;

        // Primary Search: Targeted Preference
        if (preferredLibraries.length > 0) {
          for (const lib of preferredLibraries) {
            const matches = await UniversalRegistry.findBestMatch(rawName, localStyle, lib);
            if (matches.length > 0 && matches[0].score > highestScore) {
               highestScore = matches[0].score;
               bestMatch = matches[0];
            }
          }
        }

        // Secondary Search: General
        if (!bestMatch || highestScore < 10) { 
           const matches = await UniversalRegistry.findBestMatch(rawName, localStyle);
           if (matches.length > 0 && matches[0].score > highestScore) {
             bestMatch = matches[0];
           }
        }
        
        if (bestMatch) {
            const best = bestMatch;
            if (best.score > 0.5) {
                logger.info(`✅ Mapped "${rawName}" -> ${best.registry}/${best.name} (Score: ${best.score.toFixed(2)})`);
                if (!selectedComponents[best.registry]) selectedComponents[best.registry] = [];
                if (!selectedComponents[best.registry].includes(best.name)) {
                selectedComponents[best.registry].push(best.name);
                }
            } else {
                 logger.warn(`⚠️ Low confidence match for "${rawName}" (Best: ${best.name} @ ${best.score.toFixed(2)}). Fallback to shadcn.`);
            }
        } else {
            // ✅ Special Case: Code Editor -> Monaco
            if (rawName.toLowerCase().includes('editor') || rawName.toLowerCase().includes('monaco')) {
                logger.info(`✅ Mapped "${rawName}" -> npm/monaco-editor`);
                if (!selectedComponents.npm) selectedComponents.npm = [];
                if (!selectedComponents.npm.includes('@monaco-editor/react')) {
                    selectedComponents.npm.push('@monaco-editor/react');
                }
                continue; 
            }
            logger.warn(`❌ No match found for "${rawName}"`);
        }
      }
    }

    // Ensure baseline components
    // We assume caller or ProjectBuilder config handles baseline, but we can return raw selected here
    return selectedComponents;
  }
}

module.exports = { DiscoveryService };
