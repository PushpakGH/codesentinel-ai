/**
 * Project Builder Configuration - FIXED WITH MISSING METHOD
 */

const builderConfig = {
  /**
   * CLI Commands
   */
  cli: {
    vite: (projectName, template) => `npm create vite@latest ${projectName} -- --template ${template}`,
    nextjs: (projectName) => `npx create-next-app@latest ${projectName} --typescript --tailwind --eslint --app --no-src-dir --use-npm --yes`,
    npmInstall: 'npm install',
    tailwindV3: 'npm install -D tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0 tailwindcss-animate@^1.0.0',
    shadcnInit: 'npx shadcn@latest init -d',
    shadcnDeps: 'npm install clsx tailwind-merge class-variance-authority',
    reactRouterDom: 'npm install react-router-dom',
  },

  /**
   * Registry configuration
   */
  registries: {
    shadcn: {
      priority: 1,
      categories: ['forms', 'dataDisplay', 'feedback', 'overlay'],
    },
    magicui: {
      priority: 2,
      categories: ['animations', 'effects'],
    },
    aceternity: {
      priority: 3,
      categories: ['hero', 'backgrounds', 'decorative'],
    },
    daisyui: {
      priority: 4,
      categories: ['forms', 'navigation'],
    },
    'motion-primitives': {
      priority: 5,
      categories: ['animations', 'transitions'],
    },
  },

  /**
   * Baseline components to always install
   */
  shadcnBaselineComponents: ['button', 'card', 'input', 'label'],

  /**
   * ✅ FIX: Add the missing registryForCategory method
   * Maps component categories to preferred registry
   */
  registryForCategory(category) {
    const categoryMap = {
      forms: 'shadcn',
      dataDisplay: 'shadcn',
      feedback: 'shadcn',
      overlay: 'shadcn',
      navigation: 'shadcn',
      animations: 'magicui',
      effects: 'magicui',
      hero: 'aceternity',
      backgrounds: 'aceternity',
      decorative: 'aceternity',
      transitions: 'motion-primitives',
      editor: null, // Monaco editor is installed separately
      utility: null, // Utility components don't come from registries
    };

    return categoryMap[category] || 'shadcn'; // Default to shadcn
  },
};



module.exports = builderConfig;
