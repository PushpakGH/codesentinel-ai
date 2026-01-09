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
    
    // Access global context set in extension.js
    this.context = global.extensionContext;
  }

  /**
   * Initialize or load existing state
   * Tries Global State -> File System -> New
   */
  async initialize() {
    try {
      // 1. Try Global State (Fastest, withstands reload)
      if (this.context) {
        const globalKey = `projectState_${this.projectPath}`;
        const stored = this.context.globalState.get(globalKey);
        if (stored) {
            this.state = stored;
            logger.info(`✅ Restored state from VS Code Global Storage`);
            return;
        }
      }

      // 2. Try File System (Backup / Shared state)
      const dir = path.dirname(this.manifestPath);
      await fs.mkdir(dir, { recursive: true });

      try {
        const content = await fs.readFile(this.manifestPath, 'utf-8');
        this.state = JSON.parse(content);
        logger.info(`✅ Loaded existing manifest from disk`);
        
        // Sync back to global state
        if (this.context) {
             const globalKey = `projectState_${this.projectPath}`;
             await this.context.globalState.update(globalKey, this.state);
        }
      } catch (error) {
        // 3. Create New State
        this.state = {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          projectName: path.basename(this.projectPath),
          isActive: true, // NEW
          currentStep: 'planning', // NEW
          installedComponents: [],
          generatedFiles: [],
          chatHistory: [], // NEW: Chat history persistence
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
   * Save project plan to state
   */
  async savePlan(plan) {
    this.state.projectPlan = plan;
    await this.save();
  }

  /**
   * Save state to both Disk and Global State
   */
  async save() {
    try {
      this.state.updatedAt = new Date().toISOString();
      
      // 1. Save to Disk
      await fs.writeFile(this.manifestPath, JSON.stringify(this.state, null, 2));
      
      // 2. Save to Global State (Persistence across reloads)
      if (this.context) {
          const globalKey = `projectState_${this.projectPath}`;
          await this.context.globalState.update(globalKey, this.state);
      }
      
      logger.debug('💾 Saved manifest (Disk + Global)');
    } catch (error) {
      logger.error('Failed to save manifest:', error);
    }
  }

  async updateStep(step) {
      this.state.currentStep = step;
      await this.save();
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
  async addComponent(registry, componentName, metadata = {}) {
    if (!this.state.installedComponents || !Array.isArray(this.state.installedComponents)) {
      this.state.installedComponents = [];
    }
    
    if (!this.isComponentInstalled(registry, componentName)) {
      this.state.installedComponents.push({
        registry,
        name: componentName,
        installedAt: new Date().toISOString(),
        ...metadata
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
   * Check if page is already generated
   */
  isPageGenerated(pageName) {
    return this.state.buildSteps[`page_${pageName}`] === true;
  }

  /**
   * Mark page as generated
   */
  async markPageGenerated(pageName) {
    this.state.buildSteps[`page_${pageName}`] = true;
    await this.save();
  }

  /**
   * Get complete state
   */
  getState() {
    return this.state;
  }

  /**
   * Clear state (Emergency Reset)
   */
  async clearState() {
    this.state = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectName: path.basename(this.projectPath),
      isActive: true,
      currentStep: 'planning',
      installedComponents: [],
      generatedFiles: [],
      chatHistory: [], // Consistent reset
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
        navigation: false,
        theme: false
      }
    };
    await this.save();
    logger.info('🗑️ State cleared by user.');
  }

  /**
   * Get chat history
   */
  getChatHistory() {
      return this.state.chatHistory || [];
  }

  /**
   * Save chat history
   */
  async saveChatHistory(history) {
      this.state.chatHistory = history;
      await this.save();
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
