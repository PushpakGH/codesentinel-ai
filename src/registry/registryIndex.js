/**
 * Registry Index
 * Master list of all available component registries
 * Backend by MiniSearch for intelligent, semantic component retrieval
 */

const path = require('path');
const fs = require('fs').promises;
const MiniSearch = require('minisearch');

const AVAILABLE_REGISTRIES = [
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    namespace: null,
    type: 'component-based',
    cli: 'npx shadcn@latest add',
    website: 'https://ui.shadcn.com',
    componentsEndpoint: 'https://ui.shadcn.com/registry/index.json',
    description: 'Official shadcn/ui components - Accessible, customizable, open source',
    totalComponents: 65,
    categories: ['forms', 'navigation', 'data-display', 'feedback', 'overlay', 'layout'],
    supported: true,
    installation: {
      init: 'npx shadcn@latest init',
      addComponent: 'npx shadcn@latest add'
    }
  },
  {
    id: 'daisyui',
    name: 'daisyUI',
    namespace: null,
    type: 'utility-class',
    cli: 'npm install daisyui',
    website: 'https://daisyui.com',
    description: 'Tailwind CSS component library - No installation commands needed, just use classes',
    totalComponents: 65,
    categories: ['actions', 'data-display', 'data-input', 'layout', 'navigation', 'feedback', 'mockup'],
    supported: true,
    installation: {
      npm: 'npm install -D daisyui@latest',
      tailwindConfig: 'plugins: [require("daisyui")]'
    }
  },
  {
    id: 'magicui',
    name: 'Magic UI',
    namespace: '@magicui',
    type: 'animated',
    cli: 'npx shadcn@latest add @magicui/',
    website: 'https://magicui.design',
    description: 'Animated React components and effects for landing pages.',
    totalComponents: 150,
    categories: ['animations', 'effects', 'backgrounds', 'text', 'interactive', 'layout', 'feedback', 'navigation'],
    supported: true,
    installation: {
      addComponent: 'npx shadcn@latest add @magicui/'
    }
  },
  {
    id: 'aceternity',
    name: 'Aceternity UI',
    namespace: '@aceternity',
    type: 'animated',
    cli: 'npx shadcn@latest add @aceternity/',
    website: 'https://ui.aceternity.com',
    description: 'Beautiful Tailwind CSS and Framer Motion components for modern landing pages.',
    totalComponents: 80,
    categories: ['interactive', 'overlay', 'backgrounds', 'layout', 'navigation', 'hero', 'effects', 'text'],
    supported: true,
    installation: {
      addComponent: 'npx shadcn@latest add @aceternity/'
    }
  },
  {
    id: 'motion-primitives',
    name: 'Motion Primitives',
    namespace: '@motion/primitives',
    type: 'animation-primitives',
    cli: 'npm install motion',
    website: 'https://motion-primitives.com',
    description: 'Open-source UI kit of Framer Motion primitives.',
    totalComponents: 50,
    categories: ['layout', 'gestures', 'scroll', 'transitions', 'effects'],
    supported: true,
    installation: {
      npm: 'npm install motion'
    }
  }
];

class UniversalRegistry {
  constructor() {
    this.registryData = {};
    this.searchEngine = null;
    this.initialized = false;
    this.loadingPromise = null;
  }

  async initialize() {
    if (this.initialized) return;

    // Initialize MiniSearch efficiently
    this.searchEngine = new MiniSearch({
      fields: ['name', 'description', 'tags', 'category', 'useCase', 'registry'], 
      storeFields: ['name', 'registry', 'category', 'description', 'installMethod', 'tags', 'useCase', 'usage'], 
      searchOptions: {
        boost: { name: 2, tags: 1.5, useCase: 1.2 },
        fuzzy: 0.2
      }
    });

    this.initialized = true;
  }

  // OLD: _loadRegistryData removed. We load lazily now.

  async getRegistryData(registryId) {
    if (!this.initialized) await this.initialize();
    
    // 1. Return cached if exists
    if (this.registryData[registryId]) return this.registryData[registryId];

    // 2. Load ON DEMAND
    try {
      const filePath = path.join(__dirname, 'data', `${registryId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      this.registryData[registryId] = data;

      // OPTIMIZATION: Incrementally add to search engine when loaded!
      // This keeps the search index growing only as needed, or we might miss results.
      // TRADEOFF: If we want global search, we unfortunately DO need all files loaded.
      // BUT: The user asked for "True Lazy Loading".
      // COMPROMISE: We will NOT add to search engine here to respect "lazy". 
      // If the user performs a search (findBestMatch), THAT method will force load all.
      
      return data;
    } catch (error) {
      console.error(`Failed to load registry data for ${registryId}:`, error);
      return { components: [] };
    }
  }

  /**
   * For global search, we MUST load everything.
   * This is the trade-off of lazy loading.
   */
  async ensureAllRegistriesLoaded() {
     const registries = ['shadcn', 'daisyui', 'magicui', 'aceternity', 'motion-primitives'];
     await Promise.all(registries.map(id => this.getRegistryData(id)));
     
     // Now populate search engine if not already done
     if (this.searchEngine.documentCount === 0) {
        const documents = [];
        let idCounter = 0;
        for (const [registryId, data] of Object.entries(this.registryData)) {
            if (data && data.components && Array.isArray(data.components)) {
              data.components.forEach(comp => {
                documents.push({
                  id: idCounter++,
                  registry: registryId,
                  name: comp.name,
                  description: comp.description || '',
                  category: comp.category || '',
                  tags: (comp.tags || []).join(' '),
                  useCase: comp.useCase || '',
                  usage: comp.usage,
                });
              });
            }
        }
        this.searchEngine.addAll(documents);
     }
  }

  /**
   * Get metadata for a specific component
   */
  async getRegistryComponentMeta(registryId, componentName) {
      if (!this.initialized) await this.initialize();
      const data = await this.getRegistryData(registryId);
      
      if (!data || !data.components) return null;
      
      return data.components.find(c => c.name === componentName) || null;
  }

  /**
   * Find best matching components using MiniSearch with semantic weighting
   */
  async findBestMatch(query, stylePreference = 'neutral', preferredRegistry = null) {
    if (!this.initialized) await this.initialize();
    
    // Search requires ALL registries to be loaded to find the "best" match globally
    await this.ensureAllRegistriesLoaded();

    const splitQuery = query.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    let boostedQuery = splitQuery;

    const results = this.searchEngine.search(boostedQuery, {
      boost: { name: 2, tags: 1.5, category: 1.2, useCase: 1.2 },
      fuzzy: 0.2,
      prefix: true 
    }); 

    return results.map(res => {
      let score = res.score;
      
      if (stylePreference === 'minimal' && res.registry === 'shadcn') score *= 1.5;
      if (stylePreference === 'animated' && ['magicui', 'aceternity', 'motion-primitives'].includes(res.registry)) score *= 1.5;
      if (stylePreference === 'creative' && ['aceternity', 'motion-primitives', 'magicui'].includes(res.registry)) score *= 1.5;
      
      if (preferredRegistry && res.registry === preferredRegistry) {
        score *= 5.0; 
      }

      return { ...res, score };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Suggest a composition of components for a full project manifest
   */
  async suggestComposition(manifest) {
    const composition = {};
    
    for (const [section, requirements] of Object.entries(manifest)) {
      let style = 'neutral';
      if (requirements.includes('animated')) style = 'animated';
      else if (requirements.includes('minimal')) style = 'minimal';
      else if (requirements.includes('creative')) style = 'creative';
      else if (requirements.includes('corporate')) style = 'corporate';
      
      const query = `${section} ${requirements}`;
      const matches = await this.findBestMatch(query, style);
      
      composition[section] = matches.length > 0 ? matches[0] : null;
    }
    
    return composition;
  }
}

// Singleton instance
const registry = new UniversalRegistry();

// Async Wrapper API
module.exports = {
  AVAILABLE_REGISTRIES,
  UniversalRegistry: registry,
  
  getRegistryData: async (id) => await registry.getRegistryData(id),
  listRegistryComponents: async (id) => await registry.listRegistryComponents(id),
  getRegistryComponentMeta: async (id, name) => await registry.getRegistryComponentMeta(id, name),
  getRegistry: (id) => AVAILABLE_REGISTRIES.find(r => r.id === id),
  getRegistriesByType: (type) => AVAILABLE_REGISTRIES.filter(r => r.type === type),
  
  searchRegistries: async (query) => await registry.findBestMatch(query),
  findBestMatch: async (query, style, preferredRegistry) => await registry.findBestMatch(query, style, preferredRegistry)
};
