/**
 * Registry Index
 * Master list of all available component registries
 * Similar to MCP server discovery mechanism
 */

const path = require('path');

const AVAILABLE_REGISTRIES = [
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    namespace: null, // Official, no namespace
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
      tailwindConfig: `// tailwind.config.js
module.exports = {
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark", "cupcake"],
  },
}`
    }
  },

  {
    id: 'magicui',
    name: 'Magic UI',
    namespace: '@magicui',
    type: 'animated',
    cli: 'npx shadcn@latest add @magicui/',
    website: 'https://magicui.design',
    description: 'Animated React components and effects for landing pages, built with React, Tailwind CSS, and Framer Motion.',
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
    description: 'Beautiful Tailwind CSS and Framer Motion components for React/Next.js, designed for modern, animated landing pages.',
    totalComponents: 80,
    categories: ['interactive', 'overlay', 'backgrounds', 'layout', 'navigation', 'hero', 'effects', 'text', 'data-display'],
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
    description: 'Open-source UI kit of Framer Motion primitives for building beautiful, animated interfaces quickly with React and Tailwind CSS.',
    totalComponents: 50,
    categories: ['layout', 'gestures', 'scroll', 'transitions', 'effects'],
    supported: true,
    installation: {
      npm: 'npm install motion',
      note: 'Components are copy-paste from docs; Pro adds advanced sections/templates.'
    }
  }
];

/**
 * Load full registry JSON objects from /data
 * Each JSON has: id, name, description, type, website, categories, components[]
 */
function loadRegistryData() {
  // Using require so this works in Node without fs boilerplate
  return {
    shadcn: require(path.join(__dirname, 'data', 'shadcn.json')),
    daisyui: require(path.join(__dirname, 'data', 'daisyui.json')),
    magicui: require(path.join(__dirname, 'data', 'magicui.json')),
    aceternity: require(path.join(__dirname, 'data', 'aceternity.json')),
    'motion-primitives': require(path.join(__dirname, 'data', 'motion-primitives.json'))
  };
}

// Lazy-loaded cache of all registry JSONs
let REGISTRY_DATA = null;

/**
 * Get full registry JSON (metadata + components) by ID
 */
function getRegistryData(registryId) {
  if (!REGISTRY_DATA) {
    REGISTRY_DATA = loadRegistryData();
  }
  return REGISTRY_DATA[registryId] || null;
}

/**
 * List all component definitions for a registry
 */
function listRegistryComponents(registryId) {
  const data = getRegistryData(registryId);
  return data && Array.isArray(data.components) ? data.components : [];
}

/**
 * Get a single component meta object by name
 */
function getRegistryComponentMeta(registryId, componentName) {
  const components = listRegistryComponents(registryId);
  return components.find((c) => c.name === componentName) || null;
}

/**
 * Get registry metadata by ID (from AVAILABLE_REGISTRIES)
 */
function getRegistry(registryId) {
  return AVAILABLE_REGISTRIES.find((r) => r.id === registryId);
}

/**
 * Get all registries by type
 */
function getRegistriesByType(type) {
  return AVAILABLE_REGISTRIES.filter((r) => r.type === type);
}

/**
 * Search registries by query
 */
function searchRegistries(query) {
  const lower = query.toLowerCase();
  return AVAILABLE_REGISTRIES.filter(
    (r) =>
      r.name.toLowerCase().includes(lower) ||
      r.description.toLowerCase().includes(lower) ||
      (Array.isArray(r.categories) && r.categories.some((cat) => cat.toLowerCase().includes(lower)))
  );
}

module.exports = {
  AVAILABLE_REGISTRIES,
  getRegistryData,
  listRegistryComponents,
  getRegistryComponentMeta,
  getRegistry,
  getRegistriesByType,
  searchRegistries
};
