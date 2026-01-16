/**
 * Vector Registry Service
 * Semantic Search Engine for Component Discovery
 * 
 * Uses AI Embeddings + Cosine Similarity to find components by *intent* 
 * rather than just keywords.
 */

const fs = require('fs').promises;
const path = require('path');
const { UniversalRegistry } = require('../registry/registryIndex');
const aiClient = require('./aiClient');
const { logger } = require('../utils/logger');

const VECTOR_CACHE_FILE = path.join(__dirname, '..', 'registry', 'vectorData.json');
const REGISTRY_DATA_DIR = path.join(__dirname, '..', 'registry', 'data');

class VectorRegistryService {
  constructor() {
    this.index = [];
    this.initialized = false;
  }

  /**
   * Initialize the vector index
   * Loads from disk or rebuilds if missing/stale
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 1. Check if cache exists
      const cacheExists = await this._checkFileExists(VECTOR_CACHE_FILE);
      
      if (cacheExists) {
        logger.info('🧠 Vector Service: Loading index from cache...');
        const data = await fs.readFile(VECTOR_CACHE_FILE, 'utf-8');
        this.index = JSON.parse(data);
        this.initialized = true;
        
        // CRITICAL FIX: Validate embeddings are real (not placeholders)
        const isValidCache = this._validateCacheQuality();
        if (!isValidCache) {
            logger.warn('🧠 Vector Service: Cache has invalid embeddings, rebuilding...');
            await this.buildIndex();
        }
      } else {
        logger.info('🧠 Vector Service: No cache found, building index (this may take a moment)...');
        await this.buildIndex();
      }
    } catch (error) {
      logger.error('🧠 Vector Service: Initialization failed', error);
      // Fallback: Empty index, search will return empty results (safe failure)
      this.index = []; 
    }
  }

  /**
   * Validate that cached embeddings are real, not placeholders
   */
  _validateCacheQuality() {
    if (this.index.length === 0) return false;
    
    // Check first few embeddings
    const sample = this.index.slice(0, 5);
    for (const item of sample) {
        if (!item.embedding || item.embedding.length < 100) {
            logger.warn(`🧠 Invalid embedding dimension for ${item.name}: ${item.embedding?.length || 0}`);
            return false;
        }
        // Check if all values are identical (placeholder pattern)
        const first = item.embedding[0];
        if (item.embedding.every(v => v === first)) {
            logger.warn(`🧠 Placeholder embedding detected for ${item.name}`);
            return false;
        }
    }
    return true;
  }

  /**
   * Build the vector index from scratch
   */
  async buildIndex() {
    logger.info('🧠 Vector Service: Hydrating registry data...');
    
    // 1. Ensure all registry data is loaded in memory
    await UniversalRegistry.ensureAllRegistriesLoaded();
    
    const newIndex = [];
    const registries = UniversalRegistry.registryData;

    // 2. Iterate and Embed
    // We batch requests to avoid rate limits if possible, but for now serial is checking correctness
    for (const [registryId, data] of Object.entries(registries)) {
        if (!data.components || !Array.isArray(data.components)) continue;

        logger.info(`🧠 Vector Service: Indexing ${registryId} (${data.components.length} components)...`);
        
        for (const comp of data.components) {
            // Construct semantic document
            // PREFER embeddingContext if available (new optimized field)
            const textToEmbed = comp.embeddingContext || `
              Component: ${comp.name}
              Category: ${comp.category || 'UI'}
              Description: ${comp.description || ''}
              Tags: ${(comp.tags || []).join(', ')}
              UseCase: ${comp.useCase || ''}
            `.trim();

            try {
                const vector = await aiClient.embed(textToEmbed);
                
                if (vector && vector.length > 0) {
                    newIndex.push({
                        id: `${registryId}:${comp.name}`,
                        registry: registryId,
                        name: comp.name,
                        description: comp.description,
                        category: comp.category,
                        embedding: vector
                    });
                }
            } catch (err) {
                logger.warn(`Failed to embed ${comp.name}:`, err.message);
            }
        }
    }

    this.index = newIndex;
    this.initialized = true;

    // 3. Save to disk
    if (this.index.length > 0) {
        await fs.writeFile(VECTOR_CACHE_FILE, JSON.stringify(this.index, null, 2));
        logger.info(`🧠 Vector Service: Index saved with ${this.index.length} items.`);
    }
  }

  /**
   * Search for components using cosine similarity
   * @param {string} query - Natural language query
   * @param {number} topK - Number of results to return
   */
  async search(query, topK = 5) {
    if (!this.initialized) await this.initialize();
    if (this.index.length === 0) return [];

    try {
        const queryVector = await aiClient.embed(query);
        if (!queryVector || queryVector.length === 0) return [];

        // Brute-force Cosine Similarity (Fast enough for <10k items)
        const scored = this.index.map(item => {
            return {
                ...item,
                score: this._cosineSimilarity(queryVector, item.embedding)
            };
        });

        // Softmax-ish sort
        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, topK);
    } catch (error) {
        logger.error('Vector Search Error:', error);
        return [];
    }
  }

  /**
   * Helper: Calculate cosine similarity between two vectors
   */
  _cosineSimilarity(vecA, vecB) {
      if (vecA.length !== vecB.length) return 0;
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < vecA.length; i++) {
          dot += vecA[i] * vecB[i];
          normA += vecA[i] * vecA[i];
          normB += vecB[i] * vecB[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async _checkFileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new VectorRegistryService();
