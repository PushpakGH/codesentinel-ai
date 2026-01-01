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
   * @returns {Object} { improvedPrompt, requirements, suggestedComponents }
   */
  async improvePrompt(userPrompt) {
    logger.info('🎨 Prompt Engineer: Analyzing user intent...');

    const systemPrompt = `You are a Senior Software Architect and Requirements Engineer.

Your task: Transform vague user requests into professional, detailed project specifications.

Guidelines:
1. Extract ALL implicit requirements from vague descriptions
2. Suggest modern best practices (responsive, accessible, performant)
3. Recommend appropriate tech stack based on project type
4. Identify specific component needs from available registries
5. Consider edge cases and error handling
6. Think about user experience and polish

Available Component Registries:
- shadcn: Forms, navigation, data display (48 components)
- magicui: Animations, effects, backgrounds (30 components)
- aceternity: Hero sections, interactive effects (42 components)
- motion-primitives: Scroll animations, gestures (10 components)
- daisyui: Utility-first components (55 components)

Return ONLY valid JSON:
{
  "originalIntent": "Brief summary of user's request",
  "improvedPrompt": "Professional, detailed specification",
  "projectType": "vite-react" | "nextjs",
  "reasoning": "Why this tech stack",
  "keyFeatures": ["feature1", "feature2"],
  "componentNeeds": {
    "forms": ["input", "button"],
    "navigation": ["navbar", "sidebar"],
    "animations": ["shimmer-button", "animated-beam"]
  },
  "designGuidelines": ["guideline1", "guideline2"],
  "estimatedComplexity": "simple" | "moderate" | "complex"
}`;

    const prompt = `User Request: "${userPrompt}"

Analyze this request and create a professional project specification.

Important:
- If the request is vague (e.g., "build a website"), infer reasonable defaults
- Suggest modern, production-ready approaches
- Consider mobile responsiveness, accessibility, and performance
- Recommend specific components from available registries
- Think like a senior developer planning a real project

Return detailed JSON specification now:`;

    try {
      const response = await aiClient.generate(prompt, {
        systemPrompt,
        maxTokens: 4000,
        temperature: 0.4  // Balanced: creative but focused
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
      logger.debug('Component Needs:', spec.componentNeeds);

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
      improvedPrompt: `Create a modern, responsive web application: ${userPrompt}. 
Include professional UI components, smooth animations, and best practices for accessibility and performance.`,
      projectType: 'vite-react',
      reasoning: 'Default to Vite + React for fast development',
      keyFeatures: ['Responsive design', 'Modern UI', 'Fast performance'],
      componentNeeds: {
        forms: ['button', 'input', 'card'],
        navigation: ['navigation-menu'],
        dataDisplay: ['card', 'badge']
      },
      designGuidelines: [
        'Mobile-first responsive design',
        'Clean, modern aesthetics',
        'Smooth transitions and animations'
      ],
      estimatedComplexity: 'simple'
    };
  }

  /**
   * Validate improved prompt makes sense
   */
  async validateSpecification(spec) {
    // Check if all required fields present
    const required = [
      'improvedPrompt',
      'projectType',
      'keyFeatures',
      'componentNeeds'
    ];

    for (const field of required) {
      if (!spec[field]) {
        logger.warn(`Missing required field: ${field}`);
        return false;
      }
    }

    // Check if componentNeeds is reasonable
    const totalComponents = Object.values(spec.componentNeeds)
      .reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

    if (totalComponents === 0) {
      logger.warn('No components specified, adding defaults');
      spec.componentNeeds = {
        forms: ['button', 'input'],
        dataDisplay: ['card']
      };
    }

    if (totalComponents > 30) {
      logger.warn('Too many components requested, may need simplification');
    }

    return true;
  }
}

module.exports = PromptEngineerAgent;
