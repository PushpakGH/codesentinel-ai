/**
 * Design System Context for AI Code Generation
 * Provides layout patterns, component selection rules, and styling guidelines
 */

module.exports = {
  layoutPatterns: `
## Layout Best Practices
- **Hero/Landing sections**: min-h-screen flex items-center justify-center bg-gradient-to-br
- **Dashboard layouts**: Use sidebar (fixed w-64) + main content (flex-1) with proper spacing
- **Card grids**: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- **Forms**: max-w-md mx-auto with space-y-4 for vertical rhythm
- **Tables/Lists**: w-full with proper overflow handling (overflow-x-auto)
- **Content pages**: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
`,

  componentSelection: `
## Component Registry Selection Rules

### shadcn (Core UI - Use First)
Use for: buttons, inputs, forms, cards, tables, dialogs, dropdowns, alerts, badges, tabs
Import pattern: import { Button } from '@/components/ui/button'

### magicui (Animated/Gradient Components)
Use for: animated cards, gradient backgrounds, spotlight effects, bento grids, particle effects
Use when: You need visual wow-factor or animations
Import pattern: import { AnimatedCard } from '@/components/magicui/animated-card'

### aceternity (Hero Sections & Interactive Backgrounds)
Use for: hero sections, parallax effects, 3D cards, background beams, aurora backgrounds
Use when: Building landing pages, hero sections, or need dramatic visual effects
Import pattern: import { HeroParallax } from '@/components/aceternity/hero-parallax'

### motion-primitives (Animations)
Use for: page transitions, scroll animations, fade effects, slide animations
Use when: Adding micro-interactions or transitions between states
Import pattern: import { FadeIn } from '@/components/motion-primitives/fade-in'

### Selection Strategy Examples:
- Login page → shadcn Card + Input + Button
- Landing page hero → aceternity HeroParallax + BackgroundBeams + shadcn Button
- Dashboard → shadcn Sidebar + Card + Table + Badge
- Feature showcase → magicui BentoGrid + AnimatedCard + shadcn Card
- Pricing page → shadcn Card + Badge + Button + magicui GradientBackground
`,

  spacingAndTypography: `
## Spacing & Typography System

### Spacing Scale
- Page padding: p-6 md:p-8 lg:p-12
- Section gaps: space-y-8 or space-y-12 for major sections
- Card padding: p-6
- Form element spacing: space-y-4
- Grid gaps: gap-4 (tight), gap-6 (normal), gap-8 (spacious)

### Typography Scale
- h1: text-4xl md:text-5xl font-bold tracking-tight
- h2: text-3xl md:text-4xl font-semibold
- h3: text-2xl font-semibold
- Body large: text-lg text-gray-700 dark:text-gray-300
- Body normal: text-base text-gray-600 dark:text-gray-400
- Caption: text-sm text-gray-500 dark:text-gray-500

### Color Usage
- Primary actions: bg-primary text-primary-foreground
- Secondary actions: bg-secondary text-secondary-foreground
- Destructive: bg-destructive text-destructive-foreground
- Muted backgrounds: bg-muted
- Borders: border border-border
`,

  responsiveDesign: `
## Responsive Design Rules
- Mobile first: base styles for mobile, use md: lg: xl: for larger screens
- Navigation: hamburger menu on mobile, full nav on md and up
- Grids: 1 column mobile, 2 columns tablet (md:), 3+ columns desktop (lg:)
- Text sizes: scale up on larger screens (text-2xl md:text-3xl lg:text-4xl)
- Padding: increase on larger screens (p-4 md:p-6 lg:p-8)
- Hide/show elements: hidden md:block or md:hidden based on screen size
`
};
