/**
 * Intent Recognizer
 * Uses AI to classify user messages and extract parameters
 */

const aiClient = require('../services/aiClient');
const { logger } = require('../utils/logger');

class IntentRecognizer {
  constructor() {
    this.intents = [
      'generate_project',
      'install_components',
      'discover_components',
      'review_code',
      'fix_code',
      'generate_tests',
      'general_chat',
      'show_help'
    ];
  }

  /**
   * Recognize intent from user message
   * 
   * @param {string} userMessage - User's message
   * @param {object} sessionContext - Current session context
   * @returns {Promise<object>} Recognized intent with confidence and params
   */
  async recognize(userMessage, sessionContext) {
    logger.info('Recognizing intent for message...');
    
    try {
      await aiClient.initialize();
      
      const prompt = this._buildIntentPrompt(userMessage, sessionContext);
      
      const response = await aiClient.generate(prompt, {
        systemPrompt: 'You are an intent classification expert. Always return valid JSON.',
        maxTokens: 500,
        temperature: 0.3
      });

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('Failed to extract JSON from intent response');
        return this._fallbackIntent(userMessage);
      }

      const intent = JSON.parse(jsonMatch[0]);
      
      // Validate intent
      if (!this.intents.includes(intent.intent)) {
        logger.warn(`Unknown intent: ${intent.intent}`);
        return this._fallbackIntent(userMessage);
      }

      logger.info(`Recognized intent: ${intent.intent} (confidence: ${intent.confidence}%)`);
      
      return intent;
      
    } catch (error) {
      logger.error('Intent recognition failed:', error);
      return this._fallbackIntent(userMessage);
    }
  }

  /**
   * Build prompt for intent classification
   */
  _buildIntentPrompt(userMessage, sessionContext) {
    const contextInfo = sessionContext ? `
Current context:
- Has active project: ${!!sessionContext.projectContext}
- Project type: ${sessionContext.projectContext?.type || 'none'}
- Project path: ${sessionContext.projectContext?.path || 'none'}
- Installed components: ${JSON.stringify(sessionContext.projectContext?.installedComponents || {})}
- Recent conversation: ${sessionContext.conversationHistory?.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 50)}...`).join('\n')}
` : '';

    return `Analyze this user message and classify its intent.

User message: "${userMessage}"

${contextInfo}

Available intents:
1. **generate_project** - User wants to build/create a new project
   - Triggers: "build", "create", "generate", "make a project", "new app"
   - Extract: project type, features needed

2. **install_components** - User wants to add UI components to existing project
   - Triggers: "add component", "install", "need a button", "use shadcn"
   - Extract: registry, component names, project path

3. **discover_components** - User wants to see available components
   - Triggers: "what components", "list components", "show me", "available"
   - Extract: registry filter, category filter

4. **review_code** - User wants code reviewed
   - Triggers: "review", "check", "analyze", "audit", "security scan"
   - Extract: code snippet if provided

5. **fix_code** - User wants code fixed
   - Triggers: "fix", "debug", "solve", "repair"
   - Extract: issues to fix

6. **generate_tests** - User wants tests generated
   - Triggers: "write tests", "test this", "unit tests"
   - Extract: testing framework preference

7. **general_chat** - General questions, clarifications, explanations
   - Triggers: "how", "why", "what is", "explain"

8. **show_help** - User needs help or doesn't know what to do
   - Triggers: "help", "what can you do", "commands"

Return ONLY valid JSON in this format:
{
  "intent": "one of the above intents",
  "confidence": 0-100,
  "extractedParams": {
    // Intent-specific parameters
  },
  "reasoning": "brief explanation"
}

Examples:
User: "Build a dashboard with user management"
{
  "intent": "generate_project",
  "confidence": 95,
  "extractedParams": {
    "projectType": "dashboard",
    "features": ["user management"]
  },
  "reasoning": "User explicitly wants to build something"
}

User: "Add shadcn button and card"
{
  "intent": "install_components",
  "confidence": 90,
  "extractedParams": {
    "registry": "shadcn",
    "components": ["button", "card"]
  },
  "reasoning": "User wants to install specific components"
}

Now classify: "${userMessage}"`;
  }

  /**
   * Fallback intent when AI classification fails
   */
  _fallbackIntent(userMessage) {
    const lower = userMessage.toLowerCase();
    
    // Simple keyword matching as fallback
    if (lower.includes('build') || lower.includes('create') || lower.includes('generate project')) {
      return {
        intent: 'generate_project',
        confidence: 60,
        extractedParams: {},
        reasoning: 'Keyword match fallback'
      };
    }
    
    if (lower.includes('install') || lower.includes('add component')) {
      return {
        intent: 'install_components',
        confidence: 60,
        extractedParams: {},
        reasoning: 'Keyword match fallback'
      };
    }
    
    if (lower.includes('review') || lower.includes('check')) {
      return {
        intent: 'review_code',
        confidence: 60,
        extractedParams: {},
        reasoning: 'Keyword match fallback'
      };
    }
    
    if (lower.includes('help') || lower.includes('what can you')) {
      return {
        intent: 'show_help',
        confidence: 80,
        extractedParams: {},
        reasoning: 'Keyword match fallback'
      };
    }
    
    // Default to general chat
    return {
      intent: 'general_chat',
      confidence: 50,
      extractedParams: {},
      reasoning: 'Default fallback'
    };
  }

  /**
   * Validate if required parameters are present for intent
   */
  validateParams(intent, params) {
    const requirements = {
      generate_project: ['projectPath'],
      install_components: ['registry', 'components', 'projectPath'],
      review_code: ['code', 'language'],
      fix_code: ['code', 'language'],
      generate_tests: ['code', 'language']
    };

    const required = requirements[intent];
    if (!required) {
      return { valid: true, missing: [] };
    }

    const missing = required.filter(param => !params[param]);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
}

module.exports = IntentRecognizer;
