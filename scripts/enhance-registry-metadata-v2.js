/**
 * ADVANCED Component Metadata Enhancement Script
 * Version 2.0 - With Web-Verified Data & Full Schema
 * 
 * THIS SCRIPT ADDS:
 * - Rich embeddingContext (natural language paragraph)
 * - Enhanced tags with conceptual synonyms
 * - implementation block { importSpecifier, dependencies, keyProps }
 * - Improved descriptions
 * 
 * Run with: node scripts/enhance-registry-metadata-v2.js
 */

const fs = require('fs').promises;
const path = require('path');

const REGISTRY_DATA_DIR = path.join(__dirname, '..', 'src', 'registry', 'data');

/**
 * WEB-VERIFIED Component Enhancements
 * Data gathered from official documentation via web search
 */
const VERIFIED_ENHANCEMENTS = {
  // =========================================
  // SHADCN UI (Verified 2025)
  // =========================================
  'shadcn': {
    'button': {
      description: 'A clickable interactive element that triggers actions. Built on Radix Slot for composition. Supports multiple variants (default, destructive, outline, secondary, ghost, link) and sizes (default, sm, lg, icon, icon-sm, icon-lg). Fully accessible with keyboard navigation.',
      embeddingContext: 'A button is a fundamental interactive element that users click to trigger actions, submit forms, or navigate. Also known as: CTA, call-to-action, action button, submit button, clickable element. Supports variants for visual hierarchy (primary, secondary, destructive for danger actions, ghost for subtle, link for navigation). Sizes include default, small, large, and icon-only. Accessible via keyboard (Enter/Space). Built on Radix UI Slot for composition with asChild prop.',
      tags: ['action', 'input', 'click', 'submit', 'cta', 'call-to-action', 'interactive', 'form-control', 'clickable', 'primary', 'secondary', 'danger'],
      implementation: {
        importSpecifier: "import { Button } from '@/components/ui/button'",
        dependencies: ['@radix-ui/react-slot', 'class-variance-authority'],
        keyProps: [
          { name: 'variant', type: "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'", description: 'Visual style variant' },
          { name: 'size', type: "'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'", description: 'Button size' },
          { name: 'asChild', type: 'boolean', description: 'Render as child component for composition' },
          { name: 'disabled', type: 'boolean', description: 'Disable button interactions' }
        ]
      }
    },
    'dialog': {
      description: 'A modal window that interrupts user workflow. Supports focus trapping, keyboard navigation (Escape to close), and accessible by default with ARIA attributes. Can be controlled or uncontrolled.',
      embeddingContext: 'A dialog is a modal overlay window that interrupts the user to display critical information or request input. Also known as: modal, popup, lightbox, modal dialog, overlay window. Used for confirmations, form inputs, alerts, or focused tasks. Supports accessibility with focus trapping, Escape key to close, and screen reader announcements. Parts include Trigger, Content, Header, Footer, Title, Description, and Close button.',
      tags: ['modal', 'popup', 'window', 'overlay', 'lightbox', 'interrupt', 'focus-trap', 'confirmation', 'form-dialog'],
      implementation: {
        importSpecifier: "import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'",
        dependencies: ['@radix-ui/react-dialog'],
        keyProps: [
          { name: 'open', type: 'boolean', description: 'Controlled open state' },
          { name: 'onOpenChange', type: '(open: boolean) => void', description: 'Callback when open state changes' },
          { name: 'modal', type: 'boolean', description: 'Whether to render as modal (blocks interaction outside)' }
        ]
      }
    },
    'sheet': {
      description: 'A sliding panel that enters from the edge of the viewport (left, right, top, or bottom). Built on Radix Dialog primitives for accessibility. Ideal for mobile navigation, settings panels, or detailed filters.',
      embeddingContext: 'A sheet is a sidebar component that slides in from the left, right, top, or bottom edge of the screen. Also known as: drawer, sidebar, slide-over, off-canvas panel, sliding panel. Used for mobile hamburger menus, edit forms, configuration panels, or displaying details without leaving context. Provides native app-like smooth animations with focus management. Parts include Trigger, Content, Header, Title, Description, and Footer.',
      tags: ['sidebar', 'drawer', 'slide-over', 'off-canvas', 'panel', 'modal-alternative', 'navigation', 'mobile-menu', 'sliding'],
      implementation: {
        importSpecifier: "import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from '@/components/ui/sheet'",
        dependencies: ['@radix-ui/react-dialog'],
        keyProps: [
          { name: 'side', type: "'top' | 'right' | 'bottom' | 'left'", description: 'Edge the sheet slides in from' },
          { name: 'open', type: 'boolean', description: 'Controlled open state' },
          { name: 'onOpenChange', type: '(open: boolean) => void', description: 'Callback when state changes' }
        ]
      }
    },
    'drawer': {
      description: 'A mobile-first slide-out panel with physics-based animations and gesture support. Built on Vaul library. Supports swipe-to-dismiss and drag-to-resize.',
      embeddingContext: 'A drawer is a native app-style slide-out panel optimized for mobile with gesture support. Also known as: mobile sidebar, bottom sheet, sliding drawer, off-canvas menu. Features physics-based animations, swipe gestures to open/close, and drag-to-resize. Can combine with Dialog for responsive behavior (Drawer on mobile, Dialog on desktop). Ideal for quick actions, mobile navigation, or contextual content.',
      tags: ['sidebar', 'mobile', 'bottom-sheet', 'gesture', 'swipe', 'off-canvas', 'slide-panel', 'touch', 'physics'],
      implementation: {
        importSpecifier: "import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from '@/components/ui/drawer'",
        dependencies: ['vaul'],
        keyProps: [
          { name: 'open', type: 'boolean', description: 'Controlled open state' },
          { name: 'onOpenChange', type: '(open: boolean) => void', description: 'Callback when state changes' },
          { name: 'direction', type: "'bottom' | 'top' | 'left' | 'right'", description: 'Edge the drawer slides from' }
        ]
      }
    },
    'sonner': {
      description: 'Modern toast/notification component that replaces the deprecated Toast. Shows non-blocking alerts with smooth animations. Supports promise integration for async operations.',
      embeddingContext: 'Sonner is the modern toast notification system that replaces the deprecated shadcn Toast component. Also known as: toast, snackbar, notification, popup message, status toast, alert toast. Provides non-blocking notifications with smooth animations. Features promise integration for automatic loading/success/error states, mobile-optimized swipe-to-dismiss, and customizable positioning. Uses lucide icons since October 2025.',
      tags: ['toast', 'notification', 'snackbar', 'message', 'alert', 'popup', 'feedback', 'status', 'promise'],
      implementation: {
        importSpecifier: "import { toast } from 'sonner';\nimport { Toaster } from '@/components/ui/sonner'",
        dependencies: ['sonner'],
        keyProps: [
          { name: 'description', type: 'string', description: 'Additional descriptive text' },
          { name: 'action', type: '{ label: string; onClick: () => void }', description: 'Action button configuration' },
          { name: 'duration', type: 'number', description: 'Auto-dismiss duration in ms' },
          { name: 'position', type: 'string', description: 'Toast position (e.g., top-right, bottom-left)' }
        ]
      }
    },
    'toast': {
      description: 'DEPRECATED: Use Sonner component instead. Legacy toast notification system.',
      embeddingContext: 'The Toast component is DEPRECATED in shadcn/ui. Use Sonner instead for toast notifications. Sonner provides better animations, promise integration, and mobile gesture support. Legacy Toast was built on Radix Toast primitive.',
      tags: ['deprecated', 'notification', 'use-sonner', 'legacy'],
      implementation: {
        importSpecifier: "// DEPRECATED - Use Sonner instead\nimport { toast } from 'sonner'",
        dependencies: [],
        keyProps: []
      }
    },
    'card': {
      description: 'A flexible container component for grouping related content with optional header, body, and footer sections. Commonly used for product displays, profiles, or information panels.',
      embeddingContext: 'A card is a versatile container that groups related content and actions. Also known as: panel, box, tile, container, content card, info card. Typically composed of Header (with Title and Description), Content (main body), and Footer (actions). Used for product listings, user profiles, dashboard widgets, or any grouped information. Supports custom styling via className.',
      tags: ['container', 'box', 'panel', 'layout', 'tile', 'grouping', 'content', 'product', 'profile', 'widget'],
      implementation: {
        importSpecifier: "import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'",
        dependencies: [],
        keyProps: [
          { name: 'className', type: 'string', description: 'Custom Tailwind classes' }
        ]
      }
    },
    'tabs': {
      description: 'Tabbed interface for switching between content panels. Built on Radix primitives for full accessibility including keyboard navigation and ARIA labels.',
      embeddingContext: 'Tabs provide a tabbed interface for organizing content into switchable panels. Also known as: tab switcher, tab navigation, segmented control, tab panel. Supports controlled and uncontrolled modes. Accessible with keyboard navigation (arrow keys) and ARIA labels. Can be oriented horizontally or vertically. Parts include TabsList (container), TabsTrigger (clickable tabs), and TabsContent (panel content).',
      tags: ['navigation', 'switch', 'panels', 'content', 'tabbed', 'segmented', 'organize', 'sections'],
      implementation: {
        importSpecifier: "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'",
        dependencies: ['@radix-ui/react-tabs'],
        keyProps: [
          { name: 'value', type: 'string', description: 'Controlled active tab value' },
          { name: 'defaultValue', type: 'string', description: 'Default tab for uncontrolled mode' },
          { name: 'onValueChange', type: '(value: string) => void', description: 'Callback when active tab changes' },
          { name: 'orientation', type: "'horizontal' | 'vertical'", description: 'Tab layout orientation' }
        ]
      }
    },
    'accordion': {
      description: 'Vertically stacked collapsible sections with interactive headers. Supports single or multiple open items. Built on Radix primitives for accessibility.',
      embeddingContext: 'An accordion organizes content into collapsible sections with expandable headers. Also known as: collapsible, expandable, faq, disclosure, toggle panel. Supports single mode (only one open at a time) or multiple mode (many can be open). Features smooth animations, keyboard navigation, and ARIA attributes. Parts include AccordionItem (section), AccordionTrigger (clickable header), and AccordionContent (collapsible body).',
      tags: ['collapse', 'expand', 'faq', 'list', 'disclosure', 'toggle', 'sections', 'collapsible'],
      implementation: {
        importSpecifier: "import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'",
        dependencies: ['@radix-ui/react-accordion'],
        keyProps: [
          { name: 'type', type: "'single' | 'multiple'", description: 'Allow one or multiple items open' },
          { name: 'collapsible', type: 'boolean', description: 'Allow closing the open item (single mode)' },
          { name: 'value', type: 'string | string[]', description: 'Controlled open item(s)' },
          { name: 'onValueChange', type: 'function', description: 'Callback when open items change' }
        ]
      }
    },
    'tooltip': {
      description: 'Popup that displays contextual information on hover or focus. Accessible with keyboard focus support. Requires TooltipProvider wrapper.',
      embeddingContext: 'A tooltip shows informative text when hovering over or focusing on an element. Also known as: hint, hover tip, info tooltip, helper text, title popup. Requires TooltipProvider wrapper for proper state management. Features configurable delay, positioning (side/align), and optional arrow. Accessible via keyboard focus with proper ARIA attributes.',
      tags: ['hint', 'hover', 'info', 'label', 'help', 'contextual', 'popup', 'helper'],
      implementation: {
        importSpecifier: "import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'",
        dependencies: ['@radix-ui/react-tooltip'],
        keyProps: [
          { name: 'delayDuration', type: 'number', description: 'Delay before showing (default 700ms)' },
          { name: 'side', type: "'top' | 'right' | 'bottom' | 'left'", description: 'Preferred side for tooltip' },
          { name: 'align', type: "'start' | 'center' | 'end'", description: 'Alignment relative to trigger' }
        ]
      }
    },
    'popover': {
      description: 'Floating panel that appears relative to a trigger element. Supports smart positioning to avoid viewport edges. More complex than tooltip, suitable for rich content.',
      embeddingContext: 'A popover is a floating panel that appears anchored to a trigger element. Also known as: popup, floating content, info bubble, dropdown panel. Unlike tooltips, popovers can contain rich interactive content like forms or menus. Features smart positioning with collision avoidance, focus management, and accessibility. Parts include PopoverTrigger and PopoverContent.',
      tags: ['popup', 'floating', 'panel', 'dropdown', 'contextual', 'anchored', 'interactive'],
      implementation: {
        importSpecifier: "import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'",
        dependencies: ['@radix-ui/react-popover'],
        keyProps: [
          { name: 'open', type: 'boolean', description: 'Controlled open state' },
          { name: 'onOpenChange', type: '(open: boolean) => void', description: 'Callback when state changes' },
          { name: 'side', type: "'top' | 'right' | 'bottom' | 'left'", description: 'Preferred side' },
          { name: 'align', type: "'start' | 'center' | 'end'", description: 'Alignment to trigger' }
        ]
      }
    },
    'select': {
      description: 'Dropdown selection component with search optional. Built for accessibility with keyboard navigation and proper ARIA attributes.',
      embeddingContext: 'A select is a dropdown picker for choosing from a list of options. Also known as: dropdown, picker, choice list, option selector, combobox. Features keyboard navigation, type-ahead search, and proper ARIA labels. Composed of Select, SelectTrigger, SelectValue, SelectContent, SelectItem, and optional SelectGroup/SelectLabel for organization.',
      tags: ['dropdown', 'picker', 'input', 'form', 'choice', 'options', 'selection'],
      implementation: {
        importSpecifier: "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'",
        dependencies: ['@radix-ui/react-select'],
        keyProps: [
          { name: 'value', type: 'string', description: 'Controlled selected value' },
          { name: 'onValueChange', type: '(value: string) => void', description: 'Callback when selection changes' },
          { name: 'defaultValue', type: 'string', description: 'Default value for uncontrolled mode' }
        ]
      }
    },
    'input': {
      description: 'Styled text input field matching the shadcn design system. Extends native HTML input with consistent styling.',
      embeddingContext: 'An input is a single-line text field for user data entry. Also known as: text field, text input, form field, input box. Provides consistent shadcn styling with focus states, disabled states, and error states via className. Accepts all native HTML input attributes including type, placeholder, disabled, and value.',
      tags: ['text', 'field', 'form', 'input', 'entry', 'data', 'textbox'],
      implementation: {
        importSpecifier: "import { Input } from '@/components/ui/input'",
        dependencies: [],
        keyProps: [
          { name: 'type', type: 'string', description: 'Input type (text, email, password, etc.)' },
          { name: 'placeholder', type: 'string', description: 'Placeholder text' },
          { name: 'disabled', type: 'boolean', description: 'Disable input' },
          { name: 'className', type: 'string', description: 'Custom Tailwind classes' }
        ]
      }
    }
  },
  
  // =========================================
  // ACETERNITY UI (Verified 2025)
  // =========================================
  'aceternity': {
    '3d-card': {
      description: 'Interactive card with 3D perspective transform on hover. Creates a depth effect where child elements appear to float above the card surface.',
      embeddingContext: '3D Card Effect creates an interactive card with perspective transform that tilts on hover. Also known as: perspective card, tilt card, floating card, hover card effect. Child elements appear to elevate above the surface on interaction. Built with framer-motion for smooth physics-based animations. Used for feature highlights, product showcases, or interactive galleries.',
      tags: ['3d', 'perspective', 'tilt', 'hover', 'interactive', 'animation', 'card', 'effect', 'float'],
      implementation: {
        importSpecifier: "import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'translateZ', type: 'number', description: 'Z-axis translation for floating effect' },
          { name: 'rotateX', type: 'number', description: 'X-axis rotation amount' },
          { name: 'rotateY', type: 'number', description: 'Y-axis rotation amount' }
        ]
      }
    },
    'hero-highlight': {
      description: 'Background highlight effect for hero sections. Creates a gradient spotlight that follows cursor movement.',
      embeddingContext: 'Hero Highlight creates a dynamic background effect with gradient spotlight that follows the cursor. Also known as: spotlight effect, cursor glow, hero background, interactive gradient. Designed specifically for hero sections and landing pages. Features smooth animation and customizable colors. Creates an engaging, interactive first impression.',
      tags: ['hero', 'background', 'spotlight', 'gradient', 'cursor', 'interactive', 'landing', 'effect'],
      implementation: {
        importSpecifier: "import { HeroHighlight, Highlight } from '@/components/ui/hero-highlight'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'containerClassName', type: 'string', description: 'Container wrapper class' },
          { name: 'children', type: 'ReactNode', description: 'Content to display' }
        ]
      }
    },
    'text-generate-effect': {
      description: 'Animated text that appears character-by-character or word-by-word with fade-in effect. Creates a typewriter-like generation animation.',
      embeddingContext: 'Text Generate Effect animates text appearing with a fade-in effect, word by word or character by character. Also known as: typewriter effect, text reveal, animated typing, text fade-in. Creates the illusion of text being generated or typed in real-time. Perfect for hero headlines, AI-generated content displays, or dramatic text reveals.',
      tags: ['text', 'animation', 'typewriter', 'generate', 'fade', 'reveal', 'typing', 'effect'],
      implementation: {
        importSpecifier: "import { TextGenerateEffect } from '@/components/ui/text-generate-effect'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'words', type: 'string', description: 'Text to animate' },
          { name: 'duration', type: 'number', description: 'Animation duration per word' },
          { name: 'className', type: 'string', description: 'Text styling classes' }
        ]
      }
    },
    'floating-dock': {
      description: 'macOS-style animated dock navigation bar with magnification effect on hover. Smooth spring physics for natural feel.',
      embeddingContext: 'Floating Dock is a macOS-style navigation bar with magnification effect. Also known as: mac dock, app dock, icon bar, magnifying menu. Features smooth spring physics animations and hover magnification. Icons scale up when hovered, creating a fluid, Apple-like experience. Best for app navigation, quick actions, or portfolio showcases.',
      tags: ['dock', 'mac', 'navigation', 'magnify', 'icons', 'bar', 'floating', 'spring', 'physics'],
      implementation: {
        importSpecifier: "import { FloatingDock } from '@/components/ui/floating-dock'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'items', type: 'Array<{ title: string; icon: ReactNode; href: string }>', description: 'Dock items' },
          { name: 'mobileClassName', type: 'string', description: 'Mobile-specific styles' }
        ]
      }
    }
  },
  
  // =========================================
  // MAGIC UI (Verified 2025)
  // =========================================
  'magicui': {
    'animated-beam': {
      description: 'Animated light beam that travels along SVG paths. Used to visualize connections or integrations between UI elements.',
      embeddingContext: 'Animated Beam creates a light beam animation traveling along an SVG path between elements. Also known as: connection line, integration beam, flow animation, path animation. Used to showcase integrations, data flow, or connections between icons/logos. Features customizable gradient colors and animation speed. Common in landing pages showing service integrations.',
      tags: ['beam', 'line', 'connection', 'animation', 'path', 'svg', 'integration', 'flow', 'light'],
      implementation: {
        importSpecifier: "import { AnimatedBeam } from '@/components/ui/animated-beam'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'containerRef', type: 'RefObject<HTMLElement>', description: 'Reference to container element' },
          { name: 'fromRef', type: 'RefObject<HTMLElement>', description: 'Starting element reference' },
          { name: 'toRef', type: 'RefObject<HTMLElement>', description: 'Ending element reference' }
        ]
      }
    },
    'dock': {
      description: 'macOS-inspired dock component with magnification and smooth spring animations. Similar to Aceternity floating dock.',
      embeddingContext: 'Dock is a macOS-inspired navigation component with magnification effects. Also known as: app dock, icon bar, mac dock, floating navigation. Features smooth spring physics and hover magnification for a native desktop feel. Icons scale up organically when hovered. Used for app launchers, quick navigation, or action bars.',
      tags: ['dock', 'navigation', 'mac', 'magnify', 'icons', 'spring', 'physics', 'floating'],
      implementation: {
        importSpecifier: "import { Dock, DockIcon } from '@/components/ui/dock'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'magnification', type: 'number', description: 'Scale factor on hover' },
          { name: 'distance', type: 'number', description: 'Magnification effect radius' }
        ]
      }
    },
    'marquee': {
      description: 'Infinite horizontal or vertical scrolling component for content like logos, testimonials, or news tickers.',
      embeddingContext: 'Marquee creates an infinite scrolling effect for content. Also known as: ticker, carousel, infinite scroll, logo scroll, news ticker. Scrolls content horizontally or vertically in a loop. Features customizable speed, direction, and pause-on-hover. Common uses: client logos, testimonials, news headlines, or social proof sections.',
      tags: ['scroll', 'ticker', 'infinite', 'loop', 'carousel', 'logos', 'animation', 'horizontal', 'vertical'],
      implementation: {
        importSpecifier: "import { Marquee } from '@/components/ui/marquee'",
        dependencies: [],
        keyProps: [
          { name: 'pauseOnHover', type: 'boolean', description: 'Pause scrolling on mouse hover' },
          { name: 'reverse', type: 'boolean', description: 'Reverse scroll direction' },
          { name: 'className', type: 'string', description: 'Custom styles' }
        ]
      }
    },
    'shimmer-button': {
      description: 'Button with an animated shimmer effect around its border. Eye-catching call-to-action button.',
      embeddingContext: 'Shimmer Button features an animated shimmering light effect around its perimeter. Also known as: glowing button, animated CTA, sparkle button, highlight button. Creates an eye-catching effect that draws user attention. The shimmer travels around the border like liquid metal. Perfect for primary CTAs, sign-up buttons, or featured actions.',
      tags: ['button', 'shimmer', 'glow', 'cta', 'animated', 'highlight', 'sparkle', 'action'],
      implementation: {
        importSpecifier: "import { ShimmerButton } from '@/components/ui/shimmer-button'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'shimmerColor', type: 'string', description: 'Color of the shimmer effect' },
          { name: 'shimmerDuration', type: 'string', description: 'Animation duration' },
          { name: 'className', type: 'string', description: 'Button styling' }
        ]
      }
    },
    'bento-grid': {
      description: 'Grid layout component for creating visually interesting feature sections with varying cell sizes.',
      embeddingContext: 'Bento Grid creates a modern layout with cards of varying sizes, similar to the Apple iOS bento design. Also known as: feature grid, mosaic layout, dashboard grid, card grid. Allows flexible arrangements with some cells spanning multiple rows or columns. Perfect for showcasing features, stats, or portfolio items in a visually engaging way.',
      tags: ['grid', 'layout', 'bento', 'cards', 'features', 'mosaic', 'dashboard', 'responsive'],
      implementation: {
        importSpecifier: "import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid'",
        dependencies: [],
        keyProps: [
          { name: 'className', type: 'string', description: 'Grid container styling' },
          { name: 'children', type: 'ReactNode', description: 'BentoGridItem children' }
        ]
      }
    }
  },
  
  // =========================================
  // MOTION PRIMITIVES (Verified 2025)
  // =========================================
  'motion-primitives': {
    'text-effect': {
      description: 'Animated text effects including blur, fade, roll, and slide animations for text appearance.',
      embeddingContext: 'Text Effect provides various animation presets for text appearance. Also known as: animated text, text animation, reveal effect. Includes blur-in, fade-in, roll, and slide animations. Segments text by character, word, or line for staggered effects. Perfect for hero headlines, section titles, or dynamic content reveals.',
      tags: ['text', 'animation', 'blur', 'fade', 'roll', 'slide', 'reveal', 'stagger'],
      implementation: {
        importSpecifier: "import { TextEffect } from '@/components/ui/text-effect'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'per', type: "'char' | 'word' | 'line'", description: 'Animation segmentation' },
          { name: 'preset', type: "'blur' | 'fade' | 'roll' | 'slide'", description: 'Animation preset' }
        ]
      }
    },
    'animated-group': {
      description: 'Container that orchestrates staggered animations for child elements with coordinated timing.',
      embeddingContext: 'Animated Group coordinates staggered animations across child elements. Also known as: staggered animation, group animation, orchestrated motion. Children animate in sequence with configurable delay between each. Creates elegant cascade effects for lists, grids, or grouped content. Built on framer-motion for smooth, physics-based animations.',
      tags: ['animation', 'stagger', 'group', 'sequence', 'cascade', 'orchestrate', 'children'],
      implementation: {
        importSpecifier: "import { AnimatedGroup } from '@/components/ui/animated-group'",
        dependencies: ['framer-motion'],
        keyProps: [
          { name: 'preset', type: 'string', description: 'Animation preset' },
          { name: 'staggerChildren', type: 'number', description: 'Delay between children animations' }
        ]
      }
    }
  }
};

/**
 * Apply verified enhancements to a component
 */
function applyEnhancements(registryId, comp) {
  const registryEnhancements = VERIFIED_ENHANCEMENTS[registryId];
  if (!registryEnhancements) return;
  
  const enhancement = registryEnhancements[comp.name];
  if (!enhancement) return;
  
  // Apply all verified enhancements
  if (enhancement.description) {
    comp.description = enhancement.description;
  }
  
  if (enhancement.embeddingContext) {
    comp.embeddingContext = enhancement.embeddingContext;
  }
  
  if (enhancement.tags && enhancement.tags.length > 0) {
    comp.tags = enhancement.tags;
  }
  
  if (enhancement.implementation) {
    comp.implementation = enhancement.implementation;
  }
  
  return true;
}

/**
 * Generate fallback embeddingContext for components without verified data
 */
function generateFallbackEmbeddingContext(comp) {
  if (comp.embeddingContext) return; // Already has one
  
  const name = comp.name || 'Unknown';
  const description = comp.description || '';
  const tags = comp.tags || [];
  const useCase = comp.useCase || '';
  const subComponents = comp.subComponents ? Object.keys(comp.subComponents) : [];
  
  let context = description;
  
  if (tags.length > 0) {
    context += ` Related concepts: ${tags.join(', ')}.`;
  }
  
  if (useCase) {
    context += ` Primary use case: ${useCase}`;
  }
  
  if (subComponents.length > 0) {
    context += ` Composed of parts: ${subComponents.join(', ')}.`;
  }
  
  comp.embeddingContext = context.trim();
}

/**
 * Enhance a registry JSON file
 */
async function enhanceRegistryFile(filePath) {
  const registryId = path.basename(filePath, '.json');
  console.log(`\n📁 Processing: ${registryId}`);
  
  const content = await fs.readFile(filePath, 'utf-8');
  const registry = JSON.parse(content);
  
  if (!registry.components || !Array.isArray(registry.components)) {
    console.log('  ⚠️ No components array found, skipping.');
    return;
  }
  
  let enhanced = 0;
  let fallback = 0;
  
  for (const comp of registry.components) {
    const wasEnhanced = applyEnhancements(registryId, comp);
    if (wasEnhanced) {
      enhanced++;
    } else {
      generateFallbackEmbeddingContext(comp);
      fallback++;
    }
  }
  
  // Write back
  await fs.writeFile(filePath, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`  ✅ Web-verified: ${enhanced}, Fallback: ${fallback}`);
}

/**
 * Main
 */
async function main() {
  console.log('🚀 ADVANCED Component Metadata Enhancement Script v2.0');
  console.log('='.repeat(60));
  console.log('This script applies WEB-VERIFIED data from official docs.\n');
  
  const files = await fs.readdir(REGISTRY_DATA_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  console.log(`Found ${jsonFiles.length} registry files`);
  
  for (const file of jsonFiles) {
    await enhanceRegistryFile(path.join(REGISTRY_DATA_DIR, file));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ ADVANCED Enhancement complete!');
  console.log('\n📝 Next Steps:');
  console.log('  1. Delete src/registry/vectorData.json');
  console.log('  2. Restart the extension to rebuild embeddings');
}

main().catch(console.error);
