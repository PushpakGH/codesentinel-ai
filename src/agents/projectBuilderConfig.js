// Central config for ProjectBuilderAgent
module.exports = {
  cli: {
    vite: (projectName, template) =>
      `npm create vite@latest ${projectName} -- --template ${template}`,

    // Non‑interactive Next.js create command
next: (projectName, language) =>
  `npx create-next-app@latest ${projectName} ${
    language === 'typescript' ? '--ts' : '--js'
  } --tailwind --eslint --app --no-src-dir --use-npm --no-react-compiler --yes`,


    npmInstall: 'npm install',
    reactRouterDom: 'npm install react-router-dom',
    tailwindV3:
      'npm install -D tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0 tailwindcss-animate@^1.0.0',
    shadcnInit: 'npx shadcn@latest init -d',
    shadcnDeps:
      'npm install class-variance-authority clsx tailwind-merge lucide-react'
  },

  // Default mappings from high-level category → preferred registry
  registryForCategory: {
    forms: 'shadcn',
    dataDisplay: 'shadcn',
    'data-display': 'shadcn',
    navigation: 'shadcn',
    feedback: 'shadcn',
    overlay: 'shadcn',
    layout: 'shadcn',
    animations: 'magicui',
    effects: 'aceternity',
    hero: 'aceternity',
    backgrounds: 'aceternity',
    interactive: 'aceternity',
    scroll: 'motion-primitives',
    transitions: 'motion-primitives',
    gestures: 'motion-primitives'
  },

  // Components the agent tries to ensure are available from shadcn
  shadcnBaselineComponents: ['button', 'card', 'input']
};
