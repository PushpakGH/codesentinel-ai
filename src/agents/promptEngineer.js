/**
 * Prompt Engineer Agent
 * Transforms vague user prompts into professional, detailed specifications
 */

const aiClient = require('../services/aiClient');
const { logger } = require('../utils/logger');

class PromptEngineerAgent {
  /**
   * Improve and expand user prompt
   * @param {string} userPrompt - Raw user input
   * @returns {Object} { improvedPrompt, requirements, suggestedComponents, designSystem }
   */
  async improvePrompt(userPrompt) {
    logger.info('🎨 Prompt Engineer: Analyzing user intent & designing visual system...');

    const systemPrompt = `You are a Senior Software Architect and Design System Expert.

Your task: Transform vague user requests into professional project specifications with a COMPLETE VISUAL IDENTITY.

Guidelines:
1. Extract ALL implicit requirements
2. Suggest modern best practices (Next.js 15, Tailwind v4)
3. DESIGN A VISUAL IDENTITY:
   - Define a color palette (Primary, Secondary, Accent, Background) using specific HSL values
   - Choose a Typography strategy (e.g., Inter, Geist Sans)
   - Define a Radius strategy (0.5rem, 1rem, etc.)
4. Identify specific component needs from shadcn/magicui/aceternity
5. Think about user experience and interaction design

Available Component Registries:
- shadcn: Core UI primitives (Forms, Data Display, Feedback) - 48 components
- magicui: High-impact animations (Shimmer Button, Animated Beam) - 30 components
- aceternity: Hero sections & Effects (Hero Parallax, Tracing Beam) - 42 components
- motion-primitives: Gestures & transitions - 10 components
- daisyui: Utility-first components - 55 components

Return ONLY valid JSON:
{
  "originalIntent": "Brief summary",
  "improvedPrompt": "Detailed technical spec",
  "projectType": "nextjs",
  "reasoning": "Tech stack justification",
  "designSystem": {
    "style": "minimal" | "cyberpunk" | "corporate" | "playful",
    "colors": {
       "primary": "222.2 47.4% 11.2%",
       "secondary": "210 40% 96.1%",
       "accent": "210 40% 96.1%",
       "background": "0 0% 100%",
       "foreground": "222.2 84% 4.9%"
    },
    "radius": "0.5rem",
    "typography": "Inter",
    "layoutStrategy": "dashboard" | "landing" | "fullscreen"
  },
  "keyFeatures": ["feature1", "feature2"],
  "componentNeeds": {
    "forms": ["input", "button"],
    "navigation": ["navbar", "sidebar"],
    "animations": ["shimmer-button", "animated-beam"],
    "layout": ["resizable-panel", "card"]
  },
  "impliedLibraries": ["lucide-react", "clsx", "tailwind-merge"],
  "estimatedComplexity": "moderate"
}`;

    const prompt = `User Request: "${userPrompt}"

Analyze this request and create a professional project specification + Design System.

Important:
- If "visual enhanced" or "animated" is requested, choose 'magicui' and 'aceternity' components.
- Define a color palette that matches the mood (e.g., Cyberpunk = Neon HSL values).
- For Layouts: Suggest 'resizable-panel' for IDEs, 'sidebar' for dashboards.
- Return detailed JSON specification now:`;

    try {
      const response = await aiClient.generate(prompt, {
        systemPrompt,
        maxTokens: 5000,
        temperature: 0.5 
      });

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('Failed to parse prompt engineering response, using fallback');
        return this._createFallbackSpec(userPrompt);
      }

      const spec = JSON.parse(jsonMatch[0]);

      logger.info('✅ Prompt Engineering Complete');
      logger.debug('Improved Prompt:', spec.improvedPrompt);
      logger.debug('Design System:', spec.designSystem);

      return {
        success: true,
        original: userPrompt,
        ...spec
      };

    } catch (error) {
      logger.error('Prompt engineering failed:', error);
      return this._createFallbackSpec(userPrompt);
    }
  }

  /**
   * Fallback specification for simple projects
   */
  _createFallbackSpec(userPrompt) {
    return {
      success: false,
      original: userPrompt,
      originalIntent: 'Simple web application',
      improvedPrompt: `Create a modern, responsive web application: ${userPrompt}. Include professional UI components.`,
      projectType: 'nextjs',
      reasoning: 'Default to Next.js for robustness',
      designSystem: {
        style: "minimal",
        colors: {
           "primary": "222.2 47.4% 11.2%",
           "secondary": "210 40% 96.1%",
           "accent": "210 40% 96.1%",
           "background": "0 0% 100%",
           "foreground": "222.2 84% 4.9%"
        },
        radius: "0.5rem"
      },
      keyFeatures: ['Responsive design', 'Modern UI'],
      componentNeeds: {
        forms: ['button', 'input', 'card'],
        navigation: ['navigation-menu'],
        dataDisplay: ['card', 'badge']
      },
      estimatedComplexity: 'simple'
    };
  }

  /**
   * Validate improved prompt makes sense
   */
  async validateSpecification(spec) {
    const required = ['improvedPrompt', 'projectType', 'keyFeatures', 'componentNeeds', 'designSystem'];

    for (const field of required) {
      if (!spec[field]) {
        logger.warn(`Missing required field: ${field}`);
        return false;
      }
    }
    return true;
  }
}

module.exports = PromptEngineerAgent;
