/**
 * MCP Prompt Templates
 * Pre-configured workflows for common project types
 */

const { logger } = require('../utils/logger');

/**
 * Get list of available prompt templates
 */
function getAvailablePrompts() {
  return [
    {
      name: 'create_dashboard',
      description: 'Generate a complete admin dashboard with sidebar navigation, data tables, and charts',
      arguments: [
        {
          name: 'projectPath',
          description: 'Path where dashboard project will be created',
          required: true
        },
        {
          name: 'features',
          description: 'Comma-separated list of features (e.g., "users,analytics,settings")',
          required: false
        }
      ]
    },
    {
      name: 'create_landing_page',
      description: 'Generate a SaaS landing page with hero, features, pricing, and testimonials',
      arguments: [
        {
          name: 'projectPath',
          description: 'Path where landing page will be created',
          required: true
        },
        {
          name: 'productName',
          description: 'Name of the product/service',
          required: false
        }
      ]
    },
    {
      name: 'create_auth_flow',
      description: 'Generate authentication flow with login, signup, and password reset pages',
      arguments: [
        {
          name: 'projectPath',
          description: 'Path where auth project will be created',
          required: true
        },
        {
          name: 'authProvider',
          description: 'Auth provider (firebase, supabase, nextauth, custom)',
          required: false
        }
      ]
    },
    {
      name: 'create_blog',
      description: 'Generate a blog with post listing, individual post pages, and markdown support',
      arguments: [
        {
          name: 'projectPath',
          description: 'Path where blog will be created',
          required: true
        },
        {
          name: 'cms',
          description: 'Content management (contentful, sanity, markdown, mdx)',
          required: false
        }
      ]
    },
    {
      name: 'create_ecommerce',
      description: 'Generate an e-commerce store with product listing, cart, and checkout',
      arguments: [
        {
          name: 'projectPath',
          description: 'Path where store will be created',
          required: true
        },
        {
          name: 'paymentProvider',
          description: 'Payment provider (stripe, paypal, razorpay)',
          required: false
        }
      ]
    }
  ];
}

/**
 * Get a specific prompt template with filled arguments
 */
async function getPromptTemplate(promptName, args) {
  logger.info(`Getting prompt template: ${promptName}`);
  
  switch (promptName) {
    case 'create_dashboard':
      return getDashboardPrompt(args);
      
    case 'create_landing_page':
      return getLandingPagePrompt(args);
      
    case 'create_auth_flow':
      return getAuthFlowPrompt(args);
      
    case 'create_blog':
      return getBlogPrompt(args);
      
    case 'create_ecommerce':
      return getEcommercePrompt(args);
      
    default:
      throw new Error(`Unknown prompt template: ${promptName}`);
  }
}

/**
 * Execute a prompt template (fills in arguments and calls generate_project)
 */
async function executePrompt(promptName, args, mcpServer) {
  logger.info(`Executing prompt template: ${promptName}`);
  
  const template = await getPromptTemplate(promptName, args);
  
  // Call generate_project tool with the constructed prompt
  return await mcpServer.callTool('generate_project', {
    prompt: template.prompt,
    projectPath: args.projectPath,
    projectType: template.projectType || 'auto'
  });
}

// =========================================
// PROMPT TEMPLATE GENERATORS
// =========================================

function getDashboardPrompt(args) {
  const { projectPath, features = 'users,analytics,settings' } = args;
  
  const featureList = features.split(',').map(f => f.trim());
  
  return {
    description: 'Admin Dashboard',
    prompt: `Build a professional admin dashboard with the following:

**Layout:**
- Sidebar navigation with icons
- Top navbar with user profile dropdown
- Responsive design (mobile-friendly)

**Pages to create:**
${featureList.map(f => `- ${f.charAt(0).toUpperCase() + f.slice(1)} page with data table`).join('\n')}
- Dashboard home with statistics cards

**Components needed:**
- shadcn: sidebar, table, card, badge, button, dropdown-menu, avatar
- magicui: number-ticker for statistics
- Charts for analytics visualization

**Styling:**
- Dark mode support
- Professional color scheme
- Proper spacing and typography

Generate a complete, production-ready dashboard.`,
    projectType: 'nextjs',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: this.prompt
        }
      }
    ]
  };
}

function getLandingPagePrompt(args) {
  const { projectPath, productName = 'Your Product' } = args;
  
  return {
    description: 'SaaS Landing Page',
    prompt: `Build a stunning SaaS landing page for "${productName}" with:

**Sections:**
1. Hero section with headline, subheadline, and CTA button
   - Use aceternity/hero-parallax or aceternity/background-beams
   - Eye-catching gradient background
   
2. Features section
   - 3-column grid of feature cards
   - Icons and descriptions
   - Use magicui/bento-grid or shadcn/card
   
3. Pricing section
   - 3 pricing tiers (Starter, Pro, Enterprise)
   - Feature comparison
   - shadcn/card with badges
   
4. Testimonials section
   - Customer quotes with avatars
   - shadcn/card + shadcn/avatar
   
5. CTA section
   - Final call-to-action
   - Email signup form
   - shadcn/input + shadcn/button

**Styling:**
- Modern, professional design
- Smooth animations (use motion-primitives for transitions)
- Mobile-responsive
- Fast loading

Generate a complete, conversion-optimized landing page.`,
    projectType: 'nextjs',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: this.prompt
        }
      }
    ]
  };
}

function getAuthFlowPrompt(args) {
  const { projectPath, authProvider = 'custom' } = args;
  
  return {
    description: 'Authentication Flow',
    prompt: `Build a complete authentication system with:

**Pages:**
1. Login page
   - Email/password inputs
   - "Remember me" checkbox
   - "Forgot password?" link
   - Social login buttons (Google, GitHub)
   
2. Signup/Register page
   - Name, email, password fields
   - Password strength indicator
   - Terms & conditions checkbox
   
3. Forgot Password page
   - Email input
   - Reset instructions
   
4. Reset Password page
   - New password input
   - Confirm password input

**Components:**
- shadcn/card for form containers
- shadcn/input for text fields
- shadcn/button for actions
- shadcn/checkbox for agreements
- shadcn/label for field labels
- shadcn/alert for error messages

**Features:**
- Form validation (client-side)
- Loading states during submission
- Error handling with user-friendly messages
- Redirect logic after successful auth

**Styling:**
- Centered form layout
- Clean, minimal design
- Mobile-responsive

${authProvider !== 'custom' ? `**Note:** Structure code to easily integrate with ${authProvider}` : ''}

Generate production-ready auth pages.`,
    projectType: 'nextjs',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: this.prompt
        }
      }
    ]
  };
}

function getBlogPrompt(args) {
  const { projectPath, cms = 'markdown' } = args;
  
  return {
    description: 'Blog Website',
    prompt: `Build a professional blog website with:

**Pages:**
1. Blog listing page (/)
   - Grid of blog post cards
   - Post title, excerpt, date, author
   - Pagination or infinite scroll
   
2. Individual blog post page (/posts/[slug])
   - Full blog content
   - Author info
   - Reading time
   - Related posts section
   
3. About page
   - Author bio
   - Social links

**Components:**
- shadcn/card for post cards
- shadcn/badge for categories/tags
- shadcn/avatar for author images
- Markdown/MDX rendering for post content

**Features:**
- SEO-optimized (meta tags, OpenGraph)
- Fast page loads
- Responsive images
- Syntax highlighting for code blocks
- Dark/light mode toggle

**Content:**
${cms === 'markdown' ? '- Use local markdown files in /posts directory' : `- Structure for ${cms} integration`}

**Styling:**
- Clean, readable typography
- Generous white space
- Mobile-friendly

Generate a complete blog platform ready for content.`,
    projectType: 'nextjs',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: this.prompt
        }
      }
    ]
  };
}

function getEcommercePrompt(args) {
  const { projectPath, paymentProvider = 'stripe' } = args;
  
  return {
    description: 'E-commerce Store',
    prompt: `Build a complete e-commerce store with:

**Pages:**
1. Product listing page (/)
   - Grid of product cards
   - Filters (category, price range)
   - Sort options
   - shadcn/card for products
   
2. Product detail page (/products/[id])
   - Product images gallery
   - Price, description, specs
   - Add to cart button
   - Reviews section
   
3. Shopping cart page (/cart)
   - Cart items list
   - Quantity adjustments
   - Total calculation
   - Proceed to checkout button
   
4. Checkout page (/checkout)
   - Shipping information form
   - Payment form
   - Order summary
   
5. Order confirmation page (/order-complete)
   - Order details
   - Next steps

**Components:**
- shadcn/card, badge, button, input, select
- shadcn/sheet for cart sidebar
- shadcn/dialog for quick view
- magicui/animated-card for featured products

**Features:**
- Shopping cart state management
- Product search
- Responsive design
${paymentProvider !== 'custom' ? `- Structured for ${paymentProvider} integration` : ''}

**Styling:**
- Modern e-commerce aesthetic
- Professional product presentation
- Trust indicators (secure checkout badges)

Generate a production-ready store.`,
    projectType: 'nextjs',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: this.prompt
        }
      }
    ]
  };
}

module.exports = {
  getAvailablePrompts,
  getPromptTemplate,
  executePrompt
};
