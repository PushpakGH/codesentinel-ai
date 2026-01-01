/**
 * Registry Index
 * Master list of all available component registries
 * Similar to MCP server discovery mechanism
 */

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
    categories: ['forms', 'navigation', 'data-display', 'feedback', 'overlay'],
    supported: true
  },
  
  {
    id: 'magicui',
    name: 'Magic UI',
    namespace: '@magicui',
    type: 'animated',
    cli: 'npx shadcn@latest add @magicui/',
    website: 'https://magicui.design',
    description: '150+ animated components with React, TypeScript, Tailwind, Motion',
    totalComponents: 150,
    categories: ['animations', 'effects', 'backgrounds', 'text'],
    supported: true
  },

  {
    id: 'aceternity',
    name: 'Aceternity UI',
    namespace: '@aceternity',
    type: 'interactive',
    cli: 'npx shadcn@latest add @aceternity/',
    website: 'https://ui.aceternity.com',
    description: 'Interactive components for landing pages with Motion',
    totalComponents: 80,
    categories: ['hero', 'features', 'pricing', 'testimonials'],
    supported: true
  },

  {
    id: 'motion-primitives',
    name: 'Motion Primitives',
    namespace: '@motion-primitives',
    type: 'animated',
    cli: 'npx shadcn@latest add @motion-primitives/',
    website: 'https://motion-primitives.com',
    description: 'Motion components for seamless animations',
    totalComponents: 50,
    categories: ['transitions', 'gestures', 'scroll'],
    supported: true
  },

  {
    id: 'plate',
    name: 'Plate',
    namespace: '@plate',
    type: 'editor',
    cli: 'npx shadcn@latest add @plate/',
    website: 'https://platejs.org',
    description: 'AI-powered rich text editor components',
    totalComponents: 30,
    categories: ['editor', 'formatting', 'plugins'],
    supported: true
  },

  // More registries can be added here...
];

/**
 * Component metadata for each registry
 * Fetched dynamically or cached locally
 */
const REGISTRY_COMPONENTS = {
  shadcn: [
    { name: 'accordion', category: 'data-display', description: 'Vertically stacked set of interactive headings' },
    { name: 'alert-dialog', category: 'overlay', description: 'Modal dialog that interrupts the user' },
    { name: 'alert', category: 'feedback', description: 'Displays a callout for user attention' },
    { name: 'aspect-ratio', category: 'layout', description: 'Displays content within a desired ratio' },
    { name: 'avatar', category: 'data-display', description: 'Image element with fallback' },
    { name: 'badge', category: 'data-display', description: 'Displays a badge or label' },
    { name: 'breadcrumb', category: 'navigation', description: 'Navigation with hierarchy' },
    { name: 'button', category: 'forms', description: 'Displays a button or component that looks like a button' },
    { name: 'calendar', category: 'forms', description: 'Date picker component' },
    { name: 'card', category: 'data-display', description: 'Container for content' },
    { name: 'carousel', category: 'data-display', description: 'Carousel with motion and swipe' },
    { name: 'chart', category: 'data-display', description: 'Beautiful charts with Recharts' },
    { name: 'checkbox', category: 'forms', description: 'Checkbox with text label' },
    { name: 'collapsible', category: 'data-display', description: 'Interactive component that expands/collapses' },
    { name: 'combobox', category: 'forms', description: 'Autocomplete input with dropdown' },
    { name: 'command', category: 'navigation', description: 'Fast command menu' },
    { name: 'context-menu', category: 'overlay', description: 'Right-click menu' },
    { name: 'data-table', category: 'data-display', description: 'Powerful table with sorting and filtering' },
    { name: 'date-picker', category: 'forms', description: 'Date picker with calendar' },
    { name: 'dialog', category: 'overlay', description: 'Modal dialog' },
    { name: 'drawer', category: 'overlay', description: 'Side panel that slides in' },
    { name: 'dropdown-menu', category: 'overlay', description: 'Menu triggered by button' },
    { name: 'form', category: 'forms', description: 'Form with validation using react-hook-form' },
    { name: 'hover-card', category: 'overlay', description: 'Popup on hover' },
    { name: 'input', category: 'forms', description: 'Text input field' },
    { name: 'input-otp', category: 'forms', description: 'OTP input component' },
    { name: 'label', category: 'forms', description: 'Form label' },
    { name: 'menubar', category: 'navigation', description: 'Menu bar for navigation' },
    { name: 'navigation-menu', category: 'navigation', description: 'Collection of navigation links' },
    { name: 'pagination', category: 'navigation', description: 'Pagination controls' },
    { name: 'popover', category: 'overlay', description: 'Popup triggered by click' },
    { name: 'progress', category: 'feedback', description: 'Progress indicator' },
    { name: 'radio-group', category: 'forms', description: 'Set of radio buttons' },
    { name: 'scroll-area', category: 'layout', description: 'Custom scrollbar' },
    { name: 'select', category: 'forms', description: 'Dropdown select' },
    { name: 'separator', category: 'layout', description: 'Visual divider' },
    { name: 'sheet', category: 'overlay', description: 'Side sheet drawer' },
    { name: 'sidebar', category: 'navigation', description: 'Application sidebar' },
    { name: 'skeleton', category: 'feedback', description: 'Loading placeholder' },
    { name: 'slider', category: 'forms', description: 'Range slider input' },
    { name: 'sonner', category: 'feedback', description: 'Toast notifications' },
    { name: 'switch', category: 'forms', description: 'Toggle switch' },
    { name: 'table', category: 'data-display', description: 'Data table' },
    { name: 'tabs', category: 'navigation', description: 'Tabbed interface' },
    { name: 'textarea', category: 'forms', description: 'Multi-line text input' },
    { name: 'toast', category: 'feedback', description: 'Toast notification' },
    { name: 'toggle', category: 'forms', description: 'Two-state button' },
    { name: 'tooltip', category: 'overlay', description: 'Popup on hover with info' }
  ],

  magicui: [
    { name: 'animated-beam', category: 'animations', description: 'Animated connection lines' },
    { name: 'bento-grid', category: 'layout', description: 'Masonry grid layout' },
    { name: 'globe', category: 'effects', description: '3D rotating globe' },
    { name: 'particles', category: 'backgrounds', description: 'Animated particle background' },
    { name: 'ripple', category: 'effects', description: 'Ripple effect on click' },
    { name: 'shimmer', category: 'effects', description: 'Shimmer loading effect' },
    { name: 'sparkles', category: 'effects', description: 'Sparkle animation' },
    { name: 'text-reveal', category: 'text', description: 'Text reveal on scroll' },
    { name: 'typewriter', category: 'text', description: 'Typewriter text effect' }
  ],

  aceternity: [
    { name: '3d-card', category: 'interactive', description: '3D tilt card effect' },
    { name: 'background-beams', category: 'backgrounds', description: 'Animated beam background' },
    { name: 'background-gradient', category: 'backgrounds', description: 'Animated gradient' },
    { name: 'hero-parallax', category: 'hero', description: 'Parallax hero section' },
    { name: 'infinite-moving-cards', category: 'animations', description: 'Infinite scrolling cards' },
    { name: 'lamp', category: 'effects', description: 'Lamp spotlight effect' },
    { name: 'spotlight', category: 'effects', description: 'Mouse-following spotlight' },
    { name: 'wavy-background', category: 'backgrounds', description: 'Wavy animated background' }
  ]
};

module.exports = {
  AVAILABLE_REGISTRIES,
  REGISTRY_COMPONENTS
};
