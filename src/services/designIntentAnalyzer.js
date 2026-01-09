const { logger } = require('../utils/logger');

/**
 * Design Intent Analyzer
 * Extracts design preferences from user prompts
 */
class DesignIntentAnalyzer {
  /**
   * Analyze user prompt to extract design intent
   * @param {string} userPrompt 
   * @param {string} styleIntent - from planner (minimal, animated, etc)
   * @returns {Object} Design intent with theme, colors, mood
   */
  analyzeIntent(userPrompt, styleIntent = 'minimal') {
    // Defensive check for undefined/null prompt
    if (!userPrompt || typeof userPrompt !== 'string') {
      logger.warn('No user prompt provided to DesignIntentAnalyzer, using defaults');
      return {
        theme: 'dark',
        industry: 'general',
        primaryColor: '#3b82f6',
        accentColor: '#8b5cf6',
        animationLevel: styleIntent === 'animated' ? 'rich' : 'subtle',
        mood: 'minimal'
      };
    }
    
    const prompt = userPrompt.toLowerCase();
    
    // 1. Detect Theme Preference
    const theme = this.detectTheme(prompt);
    
    // 2. Detect Industry/Context
    const industry = this.detectIndustry(prompt);
    
    // 3. Detect Color Preferences
    const colorHints = this.detectColorHints(prompt, industry);
    
    // 4. Detect Animation Intent
    const animationLevel = styleIntent === 'animated' ? 'rich' : 'subtle';
    
    // 5. Detect Mood
    const mood = this.detectMood(prompt, industry);
    
    return {
      theme,
      industry,
      primaryColor: colorHints.primary,
      accentColor: colorHints.accent,
      animationLevel,
      mood
    };
  }
  
  detectTheme(prompt) {
    if (prompt.includes('dark') || prompt.includes('night')) return 'dark';
    if (prompt.includes('light') || prompt.includes('bright')) return 'light';
    // Default to dark for modern apps
    return 'dark';
  }
  
  detectIndustry(prompt) {
    const industries = {
      'dashboard': ['dashboard', 'admin', 'analytics', 'metrics'],
      'ecommerce': ['shop', 'store', 'ecommerce', 'product', 'cart'],
      'portfolio': ['portfolio', 'showcase', 'personal', 'blog'],
      'saas': ['saas', 'platform', 'tool', 'app'],
      'finance': ['finance', 'banking', 'trading', 'investment'],
      'social': ['social', 'community', 'network', 'chat'],
      'creative': ['creative', 'design', 'art', 'gallery']
    };
    
    for (const [industry, keywords] of Object.entries(industries)) {
      if (keywords.some(kw => prompt.includes(kw))) {
        return industry;
      }
    }
    
    return 'general';
  }
  
  detectColorHints(prompt, industry) {
    // Color mapping
    const colorMap = {
      'blue': '#3b82f6',
      'purple': '#a855f7',
      'green': '#10b981',
      'red': '#ef4444',
      'orange': '#f97316',
      'pink': '#ec4899',
      'cyan': '#06b6d4',
      'indigo': '#6366f1'
    };
    
    // Check for explicit color mentions
    for (const [color, hex] of Object.entries(colorMap)) {
      if (prompt.includes(color)) {
        return { primary: hex, accent: this.generateAccent(hex) };
      }
    }
    
    // Industry defaults
    const industryColors = {
      'dashboard': '#3b82f6', // Blue
      'ecommerce': '#10b981', // Green
      'portfolio': '#6366f1', // Indigo
      'saas': '#8b5cf6',      // Purple
      'finance': '#0ea5e9',   // Sky blue
      'social': '#ec4899',    // Pink
      'creative': '#f59e0b'   // Amber
    };
    
    const primary = industryColors[industry] || '#3b82f6';
    return { primary, accent: this.generateAccent(primary) };
  }
  
  generateAccent(primaryHex) {
    // Shift hue by 30 degrees for accent color
    const rgb = this.hexToRgb(primaryHex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + 30) % 360;
    const accentRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(accentRgb.r, accentRgb.g, accentRgb.b);
  }
  
  detectMood(prompt, industry) {
    if (prompt.match(/professional|corporate|formal|business/i)) return 'professional';
    if (prompt.match(/playful|fun|casual|friendly/i)) return 'playful';
    if (prompt.match(/minimal|clean|simple|elegant/i)) return 'minimal';
    if (prompt.match(/bold|vibrant|energetic|dynamic/i)) return 'bold';
    
    // Industry defaults
    const industryMoods = {
      'finance': 'professional',
      'creative': 'playful',
      'portfolio': 'minimal',
      'social': 'playful',
      'dashboard': 'professional'
    };
    
    return industryMoods[industry] || 'minimal';
  }
  
  // Color utility functions
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  }
  
  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
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
    
    return { h: h * 360, s, l };
  }
  
  hslToRgb(h, s, l) {
    h /= 360;
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
  
  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
}

module.exports = DesignIntentAnalyzer;
