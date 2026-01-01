/**
 * Design System Context - ENHANCED WITH INTERACTION PATTERNS
 * Provides comprehensive design guidelines for AI-generated components
 */

const designSystem = {
  /**
   * Layout Pattern Guidelines
   */
  layoutPatterns: `
## LAYOUT PATTERNS

### Container & Spacing
- Use consistent container: \`container mx-auto px-4 py-8\`
- Section spacing: \`space-y-8\` between major sections
- Component spacing: \`space-y-4\` within sections
- Grid layouts: \`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6\`

### Visual Hierarchy
- Primary headings: \`text-4xl md:text-5xl lg:text-6xl font-bold\`
- Secondary headings: \`text-2xl md:text-3xl font-semibold\`
- Body text: \`text-base md:text-lg text-muted-foreground\`
- Use \`max-w-4xl mx-auto\` for readable line lengths
  `,

  /**
   * Component Selection Guidelines
   */
  componentSelection: `
## COMPONENT SELECTION

### By Category
- Forms: Use \`input\`, \`button\`, \`label\`, \`textarea\` from shadcn/ui
- Data Display: Use \`card\`, \`badge\`, \`table\` from shadcn/ui
- Feedback: Use \`alert\`, \`toast\`, \`skeleton\` from shadcn/ui
- Navigation: Use \`navigation-menu\`, \`tabs\` from shadcn/ui
- Overlay: Use \`dialog\`, \`sheet\`, \`popover\` from shadcn/ui

### Component Combinations
- Hero sections: Card + Button + gradients
- Feature grids: Card + Icon + hover effects
- Contact forms: Input + Textarea + Button + validation
  `,

  /**
   * Spacing & Typography Guidelines
   */
  spacingAndTypography: `
## SPACING & TYPOGRAPHY

### Spacing Scale
- Compact: \`p-2 gap-2\` (tags, badges)
- Normal: \`p-4 gap-4\` (cards, forms)
- Spacious: \`p-6 gap-6\` (sections, containers)
- Very Spacious: \`p-8 gap-8\` (hero sections)

### Typography Scale
- Hero: \`text-5xl md:text-6xl lg:text-7xl font-bold\`
- Title: \`text-3xl md:text-4xl font-bold\`
- Heading: \`text-2xl md:text-3xl font-semibold\`
- Subheading: \`text-xl font-medium\`
- Body: \`text-base leading-relaxed\`
- Caption: \`text-sm text-muted-foreground\`
  `,

  /**
   * Responsive Design Guidelines
   */
  responsiveDesign: `
## RESPONSIVE DESIGN

### Breakpoint Strategy
- Mobile First: Start with mobile layout, add \`md:\` and \`lg:\` prefixes
- Common patterns:
  - \`flex-col md:flex-row\` (stack on mobile, row on desktop)
  - \`grid-cols-1 md:grid-cols-2 lg:grid-cols-3\` (responsive grids)
  - \`text-2xl md:text-3xl lg:text-4xl\` (responsive text)
  - \`p-4 md:p-6 lg:p-8\` (responsive padding)

### Mobile Considerations
- Touch targets: minimum \`h-11\` or \`h-12\` for buttons
- Readable text: minimum \`text-base\` (16px)
- Adequate spacing: \`gap-4\` or more between interactive elements
  `,

  /**
   * ✅ NEW: Interaction Design Guidelines
   */
  interactionDesign: `
## INTERACTION DESIGN PRINCIPLES

### Hover States
- Buttons: \`hover:scale-105 hover:shadow-lg transition-all duration-200\`
- Cards: \`hover:shadow-2xl hover:-translate-y-2 transition-all duration-300\`
- Links: \`hover:text-primary hover:underline transition-colors duration-200\`
- Images: \`hover:scale-110 transition-transform duration-500\`

### Color Transitions
- Text colors: \`text-gray-600 hover:text-gray-900 transition-colors\`
- Backgrounds: \`bg-white hover:bg-gray-50 transition-colors\`
- Ensure visible contrast between normal and hover states
- Navbar links: \`text-muted-foreground hover:text-foreground transition-colors\`

### Focus States
- Interactive elements: \`focus:ring-2 focus:ring-primary focus:ring-offset-2\`
- Keyboard navigation: Always include focus states for accessibility
- Remove default outlines: \`focus:outline-none\` only when replacing with custom ring

### Animation Standards
- Quick interactions: \`duration-200\` (hover, focus)
- Medium transitions: \`duration-300\` (cards, modals)
- Slow animations: \`duration-500\` (page transitions, images)
- Easing: Use \`ease-in-out\` for natural motion

### Group Animations
- Parent: \`group\` class
- Children: \`group-hover:scale-110 group-hover:opacity-100\`
- Example:
  \`\`\`jsx
  <Card className="group hover:shadow-2xl transition-all duration-300">
    <div className="group-hover:scale-105 transition-transform">
      <Icon className="group-hover:text-primary transition-colors" />
    </div>
  </Card>
  \`\`\`
  `,

  /**
   * ✅ NEW: Advanced Component Patterns
   */
  advancedPatterns: `
## ADVANCED UI PATTERNS

### Enhanced Cards
Add visual depth and interest to cards:
\`\`\`jsx
<Card className="group relative overflow-hidden hover:shadow-2xl transition-all duration-300">
  {/* Gradient accent bar */}
  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
  
  {/* Icon with hover effect */}
  <CardHeader>
    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <CardTitle className="group-hover:text-primary transition-colors">
      Title
    </CardTitle>
  </CardHeader>
  
  <CardContent className="space-y-4">
    <p className="text-muted-foreground">Description</p>
  </CardContent>
</Card>
\`\`\`

### Hero Sections with Depth
Create engaging hero sections:
\`\`\`jsx
<section className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
  {/* Background gradient orbs */}
  <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
  <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
  <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
  
  {/* Content */}
  <div className="relative container mx-auto px-4 py-24 md:py-32">
    <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
      Your Headline
    </h1>
    <p className="mt-6 text-xl text-muted-foreground max-w-2xl">
      Your description
    </p>
  </div>
</section>
\`\`\`

### Glassmorphism Effects
Modern frosted glass effect:
\`\`\`jsx
<div className="backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-lg p-6 shadow-xl">
  Content with glassmorphism
</div>
\`\`\`

### Gradient Text
Eye-catching gradient text:
\`\`\`jsx
<h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
  Gradient Heading
</h2>
\`\`\`

### Button with Glow Effect
\`\`\`jsx
<Button className="relative group overflow-hidden">
  <span className="relative z-10">Click Me</span>
  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-0 group-hover:opacity-75 transition-opacity duration-300" />
</Button>
\`\`\`

### Feature Grid with Icons
\`\`\`jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {features.map((feature) => (
    <Card key={feature.id} className="group hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
      <CardHeader>
        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <feature.icon className="w-7 h-7 text-white" />
        </div>
        <CardTitle className="text-xl group-hover:text-primary transition-colors">
          {feature.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </CardContent>
    </Card>
  ))}
</div>
\`\`\`

### Animated Gradient Border
\`\`\`jsx
<div className="relative p-[1px] rounded-lg bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x">
  <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
    Content with animated border
  </div>
</div>
\`\`\`

### Navigation with Active State
\`\`\`jsx
<nav className="border-b bg-background/95 backdrop-blur">
  <div className="container mx-auto px-4 py-4 flex items-center justify-between">
    <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
      Logo
    </Link>
    <div className="flex gap-2">
      {routes.map((route) => (
        <Link
          key={route.path}
          href={route.path}
          className={\`px-4 py-2 rounded-md transition-all duration-200 \${
            isActive(route.path)
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }\`}
        >
          {route.label}
        </Link>
      ))}
    </div>
  </div>
</nav>
\`\`\`
  `,
};

module.exports = designSystem;
