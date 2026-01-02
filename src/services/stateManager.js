/**
 * Project State Manager - Tracks build progress and component installations
 * Prevents duplicate work and enables resume-on-failure
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

class StateManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.manifestPath = path.join(projectPath, '.codesentinel', 'manifest.json');
    this.state = null;
  }

  /**
   * Initialize or load existing state
   */
  async initialize() {
    try {
      // Create .codesentinel directory if it doesn't exist
      const dir = path.dirname(this.manifestPath);
      await fs.mkdir(dir, { recursive: true });

      // Try to load existing manifest
      try {
        const content = await fs.readFile(this.manifestPath, 'utf-8');
        this.state = JSON.parse(content);
        logger.info(`✅ Loaded existing manifest (${this.state.installedComponents?.length || 0} components)`);
      } catch (error) {
        // No manifest exists, create new state
        this.state = {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          projectName: path.basename(this.projectPath),
          installedComponents: [],
          generatedFiles: [],
          apiUsage: {
            totalTokens: 0,
            totalCalls: 0,
            estimatedCost: 0
          },
          buildSteps: {
            scaffold: false,
            uiLibrary: false,
            components: false,
            pages: false,
            navigation: false
          }
        };
        await this.save();
        logger.info('📄 Created new manifest');
      }
    } catch (error) {
      logger.error('Failed to initialize state manager:', error);
      throw error;
    }
  }

  /**
   * Save state to disk
   */
  async save() {
    try {
      this.state.updatedAt = new Date().toISOString();
      await fs.writeFile(this.manifestPath, JSON.stringify(this.state, null, 2));
      logger.debug('💾 Saved manifest');
    } catch (error) {
      logger.error('Failed to save manifest:', error);
    }
  }

  /**
   * Check if a component is already installed
   */
  isComponentInstalled(registry, componentName) {
    return this.state.installedComponents.some(
      c => c.registry === registry && c.name === componentName
    );
  }

  /**
   * Add installed component to state
   */
  async addComponent(registry, componentName) {
    if (!this.isComponentInstalled(registry, componentName)) {
      this.state.installedComponents.push({
        registry,
        name: componentName,
        installedAt: new Date().toISOString()
      });
      await this.save();
      logger.debug(`📦 Tracked: ${registry}/${componentName}`);
    }
  }

  /**
   * Track generated file
   */
  async addGeneratedFile(filePath, componentName, validationMethod, lineCount) {
    this.state.generatedFiles.push({
      path: filePath,
      component: componentName,
      validationMethod,
      lineCount,
      generatedAt: new Date().toISOString()
    });
    await this.save();
  }

  /**
   * Track API usage (for cost monitoring)
   */
  async trackAPIUsage(tokens, estimatedCost) {
    this.state.apiUsage.totalTokens += tokens;
    this.state.apiUsage.totalCalls += 1;
    this.state.apiUsage.estimatedCost += estimatedCost;
    await this.save();
  }

  /**
   * Mark build step as complete
   */
  async markStepComplete(step) {
    if (this.state.buildSteps.hasOwnProperty(step)) {
      this.state.buildSteps[step] = true;
      await this.save();
      logger.debug(`✅ Completed step: ${step}`);
    }
  }

  /**
   * Check if build step is complete
   */
  isStepComplete(step) {
    return this.state.buildSteps[step] === true;
  }

  /**
   * Get summary for display
   */
  getSummary() {
    return {
      components: this.state.installedComponents.length,
      files: this.state.generatedFiles.length,
      apiCalls: this.state.apiUsage.totalCalls,
      tokens: this.state.apiUsage.totalTokens,
      cost: `$${this.state.apiUsage.estimatedCost.toFixed(4)}`,
      progress: Object.values(this.state.buildSteps).filter(Boolean).length + '/' + Object.keys(this.state.buildSteps).length
    };
  }
}

module.exports = StateManager;
