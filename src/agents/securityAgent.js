/**
 * Security Agent - Vulnerability Detection
 * Scans for OWASP Top 10 and common security issues
 */

const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const configManager = require('../services/configManager');

class SecurityAgent {
  constructor() {
    this.name = 'SecurityAgent';
    this.vulnerabilityPatterns = {
      sqlInjection: /SELECT.*FROM.*WHERE.*['"].*\+/i,
      xss: /(innerHTML|outerHTML|document\.write)\s*=/i,
      hardcodedSecrets: /(api[_-]?key|password|secret|token)\s*=\s*['"]/i,
      evalUsage: /\beval\s*\(/i,
      cmdInjection: /(exec|spawn|system)\s*\(/i
    };
  }

  /**
   * Scan code for security vulnerabilities
   * @param {string} code 
   * @param {string} language 
   * @returns {Promise<object>}
   */
  async analyze(code, language) {
    if (!configManager.isSecurityAgentEnabled()) {
      logger.debug('Security Agent disabled, skipping...');
      return { issues: [], confidence: 100, summary: 'Security scan disabled' };
    }

    const startTime = Date.now();
    logger.debug(`${this.name} scanning for vulnerabilities...`);

    // Quick regex pre-scan
    const quickScanIssues = this._quickScan(code);

    // AI deep scan
    const systemPrompt = `You are a security expert specializing in application security.
Scan this code for OWASP Top 10 vulnerabilities:

1. SQL Injection
2. Cross-Site Scripting (XSS)
3. Broken Authentication
4. Sensitive Data Exposure (hardcoded secrets)
5. XML External Entities (XXE)
6. Broken Access Control
7. Security Misconfiguration
8. CSRF
9. Insecure Deserialization
10. Known Vulnerable Dependencies

Also check for:
- Exposed API keys, tokens, passwords
- Unsafe cryptography
- Command injection
- Path traversal

Return JSON format:
{
  "vulnerabilities": [
    {
      "type": "SQL Injection|XSS|Secret Exposure|etc",
      "severity": "critical|high|medium|low",
      "line": 10,
      "description": "Detailed explanation",
      "exploit": "How it can be exploited",
      "fix": "How to fix it"
    }
  ],
  "confidence": 95,
  "riskScore": 85
}`;

    const prompt = `Scan this ${language} code for security vulnerabilities:\n\`\`\`${language}\n${code}\n\`\`\``;

    try {
      await aiClient.initialize();
      const response = await aiClient.generate(prompt, { systemPrompt });
      
      const aiResult = this._parseResponse(response);
      
      // Merge quick scan and AI results
      const mergedIssues = [...quickScanIssues, ...aiResult.vulnerabilities];
      
      const latency = Date.now() - startTime;
      logger.metrics('SecurityAgent.analyze', latency, {
        vulnerabilitiesFound: mergedIssues.length,
        confidence: aiResult.confidence
      });

      return {
        issues: mergedIssues,
        confidence: aiResult.confidence,
        riskScore: aiResult.riskScore,
        summary: `Found ${mergedIssues.length} security issue(s)`
      };
    } catch (error) {
      logger.error(`${this.name} scan failed:`, error);
      
      // Fallback to quick scan only
      return {
        issues: quickScanIssues,
        confidence: 60,
        summary: 'Quick scan completed (AI scan failed)'
      };
    }
  }

  /**
   * Quick regex-based vulnerability detection
   * @private
   */
  _quickScan(code) {
    const issues = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      for (const [vuln, pattern] of Object.entries(this.vulnerabilityPatterns)) {
        if (pattern.test(line)) {
          issues.push({
            type: this._formatVulnType(vuln),
            severity: this._getSeverity(vuln),
            line: index + 1,
            description: `Potential ${this._formatVulnType(vuln)} detected`,
            exploit: 'Pattern-based detection',
            fix: this._getQuickFix(vuln)
          });
        }
      }
    });

    return issues;
  }

  /**
   * Format vulnerability type name
   * @private
   */
  _formatVulnType(vuln) {
    const types = {
      sqlInjection: 'SQL Injection',
      xss: 'Cross-Site Scripting (XSS)',
      hardcodedSecrets: 'Hardcoded Secret',
      evalUsage: 'Unsafe eval() Usage',
      cmdInjection: 'Command Injection'
    };
    return types[vuln] || vuln;
  }

  /**
   * Get severity level for vulnerability type
   * @private
   */
  _getSeverity(vuln) {
    const severities = {
      sqlInjection: 'critical',
      xss: 'high',
      hardcodedSecrets: 'critical',
      evalUsage: 'high',
      cmdInjection: 'critical'
    };
    return severities[vuln] || 'medium';
  }

  /**
   * Get quick fix suggestion
   * @private
   */
  _getQuickFix(vuln) {
    const fixes = {
      sqlInjection: 'Use parameterized queries or prepared statements',
      xss: 'Use textContent instead of innerHTML, sanitize user input',
      hardcodedSecrets: 'Use environment variables or secret management service',
      evalUsage: 'Avoid eval(), use safer alternatives',
      cmdInjection: 'Validate and sanitize all user inputs'
    };
    return fixes[vuln] || 'Review code carefully';
  }

  /**
   * Parse AI response
   * @private
   */
  _parseResponse(response) {
    try {
      const jsonMatch = response.match(/``````/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return JSON.parse(response);
    } catch (error) {
      return {
        vulnerabilities: [],
        confidence: 50,
        riskScore: 0
      };
    }
  }
}

module.exports = new SecurityAgent();
