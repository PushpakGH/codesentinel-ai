const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Theme Generator
 * Generates tailwind.config.ts and globals.css from design intent
 */
class ThemeGenerator {
  /**
   * Generate Tailwind config from design intent
   * @param {Object} designIntent 
   * @returns {string} tailwind.config.ts content
   */
  generateTailwindConfig(designIntent) {
    const { primaryColor, accentColor, theme, animationLevel, mood } = designIntent;
    
    // Generate color scale from primary color
    const primaryScale = this.generateColorScale(primaryColor);
    const accentScale = this.generateColorScale(accentColor);
    
    // Animation presets
    const animations = animationLevel === 'rich' ? this.getRichAnimations() : this.getSubtleAnimations();
    
    return `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom brand colors
        primary: ${JSON.stringify(primaryScale, null, 10)},
        accent: ${JSON.stringify(accentScale, null, 10)},
        
        // System colors (keep shadcn defaults)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: ${JSON.stringify(animations.keyframes, null, 8)},
      animation: ${JSON.stringify(animations.animation, null, 8)},
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
`;
  }
  
  /**
   * Generate CSS variables for globals.css
   */
  generateGlobalCSS(designIntent) {
    const { theme, primaryColor, mood } = designIntent;
    
    // Convert hex to HSL for CSS variables
    const primaryHSL = this.hexToHSL(primaryColor);
    
    return `@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: ${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: ${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: ${primaryHSL.h} ${primaryHSL.s}% ${Math.min(primaryHSL.l + 10, 70)}%;
    --primary-foreground: 222.2 84% 4.9%; 
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: ${primaryHSL.h} ${primaryHSL.s}% ${Math.min(primaryHSL.l + 10, 70)}%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

/* Base styles */
* {
  border-color: hsl(var(--border));
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
`;
  }
  
  /**
   * Write theme files to project
   */
  async applyTheme(projectPath, designIntent) {
    try {
      // 1. Generate tailwind.config.ts
      const tailwindConfig = this.generateTailwindConfig(designIntent);
      await fs.writeFile(path.join(projectPath, 'tailwind.config.ts'), tailwindConfig, 'utf-8');
      logger.info('✅ Generated tailwind.config.ts with custom theme');
      
      // 2. Generate globals.css
      const globalCSS = this.generateGlobalCSS(designIntent);
      await fs.writeFile(path.join(projectPath, 'app', 'globals.css'), globalCSS, 'utf-8');
      logger.info('✅ Generated globals.css with CSS variables');
      
      return true;
    } catch (error) {
      logger.error('Failed to apply theme:', error.message);
      return false;
    }
  }
  
  // Utility methods
  generateColorScale(hexColor) {
    const baseHSL = this.hexToHSL(hexColor);
    return {
      50: this.hslToHex(baseHSL.h, baseHSL.s, 97),
      100: this.hslToHex(baseHSL.h, baseHSL.s, 94),
      200: this.hslToHex(baseHSL.h, baseHSL.s, 86),
      300: this.hslToHex(baseHSL.h, baseHSL.s, 77),
      400: this.hslToHex(baseHSL.h, baseHSL.s, 65),
      500: hexColor, // Base color
      600: this.hslToHex(baseHSL.h, baseHSL.s, Math.max(baseHSL.l - 10, 20)),
      700: this.hslToHex(baseHSL.h, baseHSL.s, Math.max(baseHSL.l - 20, 15)),
      800: this.hslToHex(baseHSL.h, baseHSL.s, Math.max(baseHSL.l - 30, 10)),
      900: this.hslToHex(baseHSL.h, baseHSL.s, Math.max(baseHSL.l - 40, 5)),
      950: this.hslToHex(baseHSL.h, baseHSL.s, 3),
    };
  }
  
  getSubtleAnimations() {
    return {
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "slide-in": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-in-out",
        "slide-in": "slide-in 0.4s ease-out",
        "float": "float 3s ease-in-out infinite"
      }
    };
  }
  
  getRichAnimations() {
    return {
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "slide-in": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        "bounce-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-in-out",
        "slide-in": "slide-in 0.6s ease-out",
        "bounce-in": "bounce-in 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 3s ease-in-out infinite"
      }
    };
  }
  
  hexToHSL(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 215, s: 100, l: 50 };
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }
  
  hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
}

module.exports = ThemeGenerator;
