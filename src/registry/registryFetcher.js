/**
 * Registry Fetcher
 * Fetches component data dynamically from registries
 * Falls back to embedded data if fetch fails
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

// Cache duration: 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Registry endpoints
const REGISTRY_ENDPOINTS = {
  shadcn: 'https://ui.shadcn.com/registry/index.json',
  // Note: Most registries don't have public APIs, we use embedded data
};

// Cache storage
const cache = new Map();

/**
 * Fetch component list from registry (with caching)
 * @param {string} registryId - Registry identifier
 * @returns {Promise<Array>} Component list
 */
async function fetchComponentList(registryId) {
  // Check cache first
  const cached = cache.get(registryId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    logger.debug(`Using cached data for ${registryId}`);
    return cached.data;
  }

  // Try to fetch from remote
  try {
    const endpoint = REGISTRY_ENDPOINTS[registryId];
    
    if (endpoint) {
      logger.info(`Fetching ${registryId} registry from ${endpoint}`);
      const data = await fetchFromUrl(endpoint);
      
      // Cache the result
      cache.set(registryId, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    }
  } catch (error) {
    logger.warn(`Failed to fetch ${registryId} registry:`, error.message);
  }

  // Fallback to embedded data
  logger.info(`Using embedded data for ${registryId}`);
  return await loadEmbeddedData(registryId);
}

/**
 * Fetch data from URL
 * @private
 */
function fetchFromUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Load embedded data from local JSON files
 * @private
 */
async function loadEmbeddedData(registryId) {
  try {
    const dataPath = path.join(__dirname, 'data', `${registryId}.json`);
    const rawData = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    logger.error(`Failed to load embedded data for ${registryId}:`, error);
    throw new Error(`Registry "${registryId}" not found`);
  }
}

/**
 * Clear cache (useful for testing or manual refresh)
 */
function clearCache() {
  cache.clear();
  logger.info('Registry cache cleared');
}

module.exports = {
  fetchComponentList,
  clearCache
};
