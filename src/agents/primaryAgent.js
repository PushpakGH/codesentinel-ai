/**
 * Primary Agent - General Code Review
 * Analyzes bugs, performance, and code quality
 */

const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');

class PrimaryAgent {
  constructor() {
    this.name = 'PrimaryAgent';
  }

  /**
   * Analyze code for general issues
   * @param {string} code 
   * @param {string} language 
   * @returns {Promise<object>}
   */
  async analyze(code, language) {
    const startTime = Date.now();
    logger.debug(`${this.name} analyzing ${language} code...`);

    const systemPrompt = `You are a senior software engineer performing code review.
Focus on:
1. **Bugs & Logic Errors**: Identify incorrect implementations
2. **Performance Issues**: Detect inefficient algorithms, memory leaks
3. **Best Practices**: Check for code style, naming conventions
4. **Maintainability**: Assess readability and documentation

Return JSON format:
{
  "issues": [
    {
      "type": "bug|performance|style",
      "severity": "critical|high|medium|low",
      "line": 5,
      "title": "Short description",
      "description": "Detailed explanation",
      "suggestion": "How to fix"
    }
  ],
  "confidence": 90,
  "summary": "Overall assessment"
}`;

    const prompt = `Review this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``;

    try {
      await aiClient.initialize();
      const response = await aiClient.generate(prompt, { systemPrompt });
      
      const result = this._parseResponse(response);
      const latency = Date.now() - startTime;
      
      logger.metrics('PrimaryAgent.analyze', latency, {
        issuesFound: result.issues.length,
        confidence: result.confidence
      });

      return result;
    } catch (error) {
      logger.error(`${this.name} analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Parse AI response to structured format
   * @private
   */
  /**
 * Parse AI response to structured format
 * @private
 */
_parseResponse(response) {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/``````/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try direct JSON parse
    const parsed = JSON.parse(response);
    if (parsed.issues) {
      return parsed;
    }
  } catch (error) {
    // JSON parsing failed - create structured response from text
    logger.debug('JSON parse failed, using intelligent text parsing');
  }

  // Intelligent fallback: Parse text response into structure
  return this._parseTextResponse(response);
}

/**
 * Parse text response into structured format (fallback)
 * @private
 */
_parseTextResponse(response) {
  const lines = response.split('\n');
  const issues = [];
  let currentIssue = null;
  
  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Detect severity keywords
    if (trimmed.match(/\b(critical|high|medium|low)\b/i)) {
      if (currentIssue) {
        issues.push(currentIssue);
      }
      
      const severityMatch = trimmed.match(/\b(critical|high|medium|low)\b/i);
      currentIssue = {
        type: 'general',
        severity: severityMatch ? severityMatch[1].toLowerCase() : 'medium',
        line: 0,
        title: trimmed.substring(0, 100),
        description: '',
        suggestion: ''
      };
    } else if (currentIssue && trimmed.length > 10) {
      // Add to current issue description
      currentIssue.description += (currentIssue.description ? ' ' : '') + trimmed;
    }
  });

  if (currentIssue) {
    issues.push(currentIssue);
  }

  // If no issues found, create one from entire response
  if (issues.length === 0) {
    issues.push({
      type: 'general',
      severity: 'medium',
      line: 0,
      title: 'Code Analysis',
      description: response.substring(0, 500),
      suggestion: 'Review the analysis above'
    });
  }

  return {
    issues,
    confidence: 70,
    summary: `Analysis completed (${issues.length} issue(s) found)`
  };
}

  // _parseResponse(response) {
  //   try {
  //     // Try to extract JSON from markdown code blocks
  //     const jsonMatch = response.match(/``````/);
  //     if (jsonMatch) {
  //       return JSON.parse(jsonMatch[1]);
  //     }
      
  //     // Try direct JSON parse
  //     return JSON.parse(response);
  //   } catch (error) {
  //     logger.warn('Failed to parse JSON, using fallback format');
      
  //     // Fallback: Create structured response from text
  //     return {
  //       issues: [{
  //         type: 'general',
  //         severity: 'medium',
  //         line: 0,
  //         title: 'Analysis Result',
  //         description: response,
  //         suggestion: 'Review the analysis above'
  //       }],
  //       confidence: 70,
  //       summary: 'Analysis completed with text response'
  //     };
  //   }
  // }
}

module.exports = new PrimaryAgent();
