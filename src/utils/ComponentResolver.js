/**
 * ComponentResolver.js - Smart Component Resolution
 * ===================================================
 * 
 * Replaces placeholder stubs with REAL component implementations.
 * Uses multiple strategies to resolve components:
 * 1. shadcn-ui installation for known components
 * 2. Template-based generation for common patterns
 * 3. AI-powered generation for custom components
 * 
 * CRITICAL: NEVER generates "Missing:" placeholder stubs!
 * 
 * @version 1.0.0
 */

const { logger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Complete list of shadcn/ui components that can be installed
 */
const SHADCN_COMPONENTS = new Set([
  'accordion', 'alert', 'alert-dialog', 'aspect-ratio', 'avatar',
  'badge', 'breadcrumb', 'button', 'calendar', 'card', 'carousel',
  'chart', 'checkbox', 'collapsible', 'combobox', 'command',
  'context-menu', 'data-table', 'date-picker', 'dialog', 'drawer',
  'dropdown-menu', 'form', 'hover-card', 'input', 'input-otp',
  'label', 'menubar', 'navigation-menu', 'pagination', 'popover',
  'progress', 'radio-group', 'resizable', 'scroll-area', 'select',
  'separator', 'sheet', 'sidebar', 'skeleton', 'slider', 'sonner',
  'switch', 'table', 'tabs', 'textarea', 'toast', 'toggle',
  'toggle-group', 'tooltip'
]);

/**
 * Component templates for common patterns - REAL implementations, not stubs
 */
const COMPONENT_TEMPLATES = {
  // Skeleton patterns
  Skeleton: `import { cn } from "@/lib/utils"

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}`,

  // Card template (if shadcn not available)
  Card: `import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }`,

  // Badge template
  Badge: `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }`,

  // Button template
  Button: `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }`
};

/**
 * Skeleton pattern templates for dynamic generation
 */
const SKELETON_PATTERNS = {
  PageSkeleton: (name) => `"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ${name}() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <Skeleton className="h-12 w-[300px]" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-[200px] w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}`,

  GridSkeleton: (name) => `"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ${name}() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-[120px] w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}`,

  TableSkeleton: (name) => `"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ${name}() {
  return (
    <div className="rounded-xl border">
      <div className="p-4 border-b bg-muted/50">
        <Skeleton className="h-4 w-[200px]" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-[100px]" />
        </div>
      ))}
    </div>
  );
}`
};

/**
 * Error state templates
 */
const ERROR_STATE_PATTERNS = {
  ErrorState: (name) => `"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ${name}Props {
  message?: string;
  onRetry?: () => void;
}

export function ${name}({ message = "Something went wrong", onRetry }: ${name}Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold">Error</h3>
      <p className="text-muted-foreground mt-2 max-w-md">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-4">
          Try Again
        </Button>
      )}
    </div>
  );
}`,

  EmptyState: (name) => `"use client";

import { FileX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ${name}Props {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function ${name}({ 
  title = "No items found", 
  description = "There are no items to display.",
  action 
}: ${name}Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileX className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}`
};

/**
 * Smart Component Resolver - NEVER generates placeholder stubs
 */
class ComponentResolver {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }
  
  /**
   * Resolve a component - returns real implementation or installs it
   * @param {string} componentName - Name of the component (e.g., "Card", "ProductCard")
   * @param {string} fileName - File name without extension (e.g., "card", "product-card")
   * @returns {Promise<{action: string, code?: string, command?: string}>}
   */
  async resolve(componentName, fileName) {
    // 1. Check if it's a shadcn component
    if (SHADCN_COMPONENTS.has(fileName.toLowerCase())) {
      return {
        action: 'install-shadcn',
        command: `npx shadcn@latest add ${fileName.toLowerCase()} --yes`,
        message: `Installing shadcn component: ${fileName}`
      };
    }
    
    // 2. Check if we have a template for this component
    if (COMPONENT_TEMPLATES[componentName]) {
      return {
        action: 'use-template',
        code: COMPONENT_TEMPLATES[componentName],
        message: `Using template for: ${componentName}`
      };
    }
    
    // 3. Check for skeleton patterns
    if (componentName.includes('Skeleton')) {
      const pattern = this.getSkeletonPattern(componentName);
      return {
        action: 'generate-skeleton',
        code: pattern,
        message: `Generated skeleton: ${componentName}`
      };
    }
    
    // 4. Check for error/empty state patterns
    if (componentName.includes('Error') || componentName.includes('Empty')) {
      const pattern = this.getStatePattern(componentName);
      return {
        action: 'generate-state',
        code: pattern,
        message: `Generated state component: ${componentName}`
      };
    }
    
    // 5. Generate using AI as last resort
    return {
      action: 'generate-ai',
      componentName,
      fileName,
      message: `Will generate ${componentName} using AI`
    };
  }
  
  getSkeletonPattern(name) {
    if (name.includes('Grid')) {
      return SKELETON_PATTERNS.GridSkeleton(name);
    }
    if (name.includes('Table')) {
      return SKELETON_PATTERNS.TableSkeleton(name);
    }
    return SKELETON_PATTERNS.PageSkeleton(name);
  }
  
  getStatePattern(name) {
    if (name.includes('Empty')) {
      return ERROR_STATE_PATTERNS.EmptyState(name);
    }
    return ERROR_STATE_PATTERNS.ErrorState(name);
  }
  
  /**
   * Generate a custom component using AI
   */
  async generateWithAI(componentName, context = {}) {
    const aiClient = require('../services/aiClient');
    
    const prompt = `Generate a professional React component named "${componentName}".

REQUIREMENTS:
1. Use TypeScript with proper types
2. Use Tailwind CSS for styling
3. Import from @/components/ui for any UI primitives (Card, Button, etc.)
4. Use lucide-react for icons
5. Make it visually polished with proper spacing, borders, shadows
6. Export as named export

Context: ${context.usage || 'General purpose component'}

Return ONLY the TypeScript code, no explanations.`;

    try {
      const code = await aiClient.generate(prompt, {
        temperature: 0.3,
        systemPrompt: 'You are an expert React developer. Generate production-ready components.'
      });
      
      return code.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
    } catch (error) {
      logger.error(`AI generation failed for ${componentName}:`, error.message);
      return null;
    }
  }
}

module.exports = {
  ComponentResolver,
  SHADCN_COMPONENTS,
  COMPONENT_TEMPLATES,
  SKELETON_PATTERNS,
  ERROR_STATE_PATTERNS
};
