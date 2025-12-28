/**
 * Validator Agent - Self-Correction & Confidence Verification
 * Implements the self-correction loop: if confidence < threshold, re-analyze
 * This is a UNIQUE feature that sets CodeSentinel apart
 */

const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const configManager = require('../services/configManager');

class ValidatorAgent {
  constructor() {
    this.name = 'ValidatorAgent';
    this.reanalysisCount = 0;
  }

  /**
   * Validate analysis results and trigger re-analysis if confidence is low
   * @param {object} primaryAnalysis - Results from PrimaryAgent
   * @param {object} securityAnalysis - Results from SecurityAgent
   * @param {string} originalCode - The code that was analyzed
   * @param {string} language - Programming language
   * @returns {Promise<object>} - Validated and potentially corrected results
   */
  async validate(primaryAnalysis, securityAnalysis, originalCode, language) {
    const startTime = Date.now();
    const threshold = configManager.getConfidenceThreshold();
    
    logger.debug(`${this.name} validating results...`);
    
    // Check if validator agent is enabled
    if (!configManager.isValidatorAgentEnabled()) {
      logger.debug('Validator Agent disabled, skipping validation');
      return this._mergeResults(primaryAnalysis, securityAnalysis);
    }

    // Calculate overall confidence
    const overallConfidence = this._calculateOverallConfidence(
      primaryAnalysis.confidence,
      securityAnalysis.confidence
    );

    logger.debug(`Overall confidence: ${overallConfidence}%, Threshold: ${threshold}%`);

    // If confidence is high enough, return results as-is
    if (overallConfidence >= threshold) {
      logger.info(`✅ Confidence ${overallConfidence}% meets threshold, validation passed`);
      return this._mergeResults(primaryAnalysis, securityAnalysis);
    }

    // Confidence too low - trigger self-correction loop
    logger.warn(`⚠️ Confidence ${overallConfidence}% below threshold ${threshold}% - triggering self-correction`);
    
    try {
      const correctedResults = await this._reanalyze(
        primaryAnalysis,
        securityAnalysis,
        originalCode,
        language,
        overallConfidence
      );

      const latency = Date.now() - startTime;
      logger.metrics('ValidatorAgent.validate', latency, {
        initialConfidence: overallConfidence,
        finalConfidence: correctedResults.confidence,
        reanalysisTriggered: true
      });

      return correctedResults;
    } catch (error) {
      logger.error(`${this.name} re-analysis failed, returning original results:`, error);
      
      // Fallback: return original results with warning
      const merged = this._mergeResults(primaryAnalysis, securityAnalysis);
      merged.validationWarning = 'Re-analysis failed, using initial results';
      return merged;
    }
  }

  /**
   * Perform re-analysis with different prompting strategy
   * @private
   */
  async _reanalyze(primaryAnalysis, securityAnalysis, code, language, previousConfidence) {
    this.reanalysisCount++;
    logger.info(`🔄 Self-correction loop iteration ${this.reanalysisCount}...`);

    // Build context from previous analysis
    const previousIssues = [
      ...primaryAnalysis.issues.map(i => i.title),
      ...securityAnalysis.issues.map(i => i.description)
    ].join('\n- ');

    const systemPrompt = `You are a senior code reviewer performing SECOND-PASS verification.

A previous analysis found these issues:
${previousIssues}

Your task:
1. **Verify** if these issues are TRUE POSITIVES or FALSE POSITIVES
2. **Find MISSED issues** that the first pass didn't catch
3. **Re-assess severity** levels
4. **Provide higher confidence** by cross-checking with code context

Be more thorough than the first pass. Question each finding.

Return JSON:
{
  "verifiedIssues": [
    {
      "original": "Issue from first pass",
      "verified": true/false,
      "reason": "Why it's valid or invalid",
      "correctedSeverity": "critical|high|medium|low"
    }
  ],
  "newIssues": [
    {
      "type": "bug|security|performance|style",
      "severity": "critical|high|medium|low",
      "line": 10,
      "title": "New issue found",
      "description": "Detailed explanation"
    }
  ],
  "confidence": 95,
  "validationNotes": "Overall assessment"
}`;

    const prompt = `RE-ANALYZE this ${language} code with higher scrutiny:\n\`\`\`${language}\n${code}\n\`\`\`\n\nPrevious confidence was only ${previousConfidence}%. Provide more thorough analysis.`;

    try {
      await aiClient.initialize();
      const response = await aiClient.generate(prompt, { systemPrompt });
      const validationResult = this._parseValidationResponse(response);

      // Merge verified issues with new findings
      const finalIssues = this._reconcileIssues(
        primaryAnalysis.issues,
        securityAnalysis.issues,
        validationResult.verifiedIssues,
        validationResult.newIssues
      );

      return {
        issues: finalIssues,
        confidence: validationResult.confidence,
        summary: `Re-analyzed: ${finalIssues.length} issues confirmed (${validationResult.verifiedIssues.filter(v => v.verified).length} verified, ${validationResult.newIssues.length} newly found)`,
        validationNotes: validationResult.validationNotes,
        selfCorrectionApplied: true,
        iterations: this.reanalysisCount
      };
    } catch (error) {
      logger.error('Re-analysis failed:', error);
      throw error;
    }
  }

  /**
   * Calculate weighted average confidence
   * @private
   */
  _calculateOverallConfidence(primaryConf, securityConf) {
    // Weight security higher (70/30 split)
    return Math.round(primaryConf * 0.5 + securityConf * 0.5);
  }

  /**
   * Merge results from multiple agents
   * @private
   */
  _mergeResults(primaryAnalysis, securityAnalysis) {
    const allIssues = [
      ...primaryAnalysis.issues.map(i => ({ ...i, source: 'primary' })),
      ...securityAnalysis.issues.map(i => ({ ...i, source: 'security' }))
    ];

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      issues: allIssues,
      confidence: this._calculateOverallConfidence(
        primaryAnalysis.confidence,
        securityAnalysis.confidence
      ),
      summary: `Found ${allIssues.length} issue(s) across all agents`,
      selfCorrectionApplied: false
    };
  }

  /**
   * Reconcile issues from multiple passes
   * @private
   */
  _reconcileIssues(primaryIssues, securityIssues, verifiedIssues, newIssues) {
    const finalIssues = [];

    // Add verified issues (those that passed second-pass review)
    const allFirstPassIssues = [...primaryIssues, ...securityIssues];
    
    allFirstPassIssues.forEach(issue => {
      const verification = verifiedIssues.find(v => 
        v.original.toLowerCase().includes(issue.title.toLowerCase())
      );

      if (!verification || verification.verified) {
        // Issue verified or not explicitly rejected
        finalIssues.push({
          ...issue,
          verified: verification ? true : false,
          verificationNotes: verification?.reason,
          severity: verification?.correctedSeverity || issue.severity
        });
      } else {
        logger.debug(`Filtered out false positive: ${issue.title}`);
      }
    });

    // Add newly discovered issues
    newIssues.forEach(issue => {
      finalIssues.push({
        ...issue,
        source: 'validator',
        discoveredInSecondPass: true
      });
    });

    return finalIssues;
  }

  /**
   * Parse validation response
   * @private
   */
  _parseValidationResponse(response) {
    try {
      const jsonMatch = response.match(/``````/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return JSON.parse(response);
    } catch (error) {
      logger.warn('Failed to parse validation response, using fallback');
      return {
        verifiedIssues: [],
        newIssues: [],
        confidence: 60,
        validationNotes: 'Validation parsing failed'
      };
    }
  }

  /**
   * Reset reanalysis counter (for new review session)
   */
  resetCounter() {
    this.reanalysisCount = 0;
  }
}

module.exports = new ValidatorAgent();
