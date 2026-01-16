/**
 * RouteValidator.js - Validates Next.js App Router Logic
 * =======================================================
 * 
 * checks for:
 * 1. useParams() usage in static routes (Issue #5)
 * 2. Missing dynamic segments in file paths
 * 
 * @version 1.0.0
 */
const { logger } = require('./logger');

class RouteValidator {
    
    /**
     * Validate page code against its route path
     * @param {string} code - The generated TypeScript code
     * @param {string} filePath - The intended file path (e.g., app/profile/page.tsx)
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    static validate(code, filePath) {
        const errors = [];
        
        // Check 1: useParams usage in static routes
        // "app/profile/page.tsx" -> Static
        // "app/profile/[username]/page.tsx" -> Dynamic
        // "app/profile/[...slug]/page.tsx" -> Catch-all Dynamic
        
        const isDynamicRoute = filePath.includes('[') && filePath.includes(']');
        const usesParams = code.includes('useParams()') || code.includes('params:');
        
        if (usesParams && !isDynamicRoute) {
            // It's using params in a static route!
            // BUT, wait - useParams() *can* be used in a Client Component anywhere 
            // IF it's inside a dynamic parent. But we can't know the parent easily.
            // HOWEVER, the user specifically flagged "app/profile/page.tsx" (static) using params for "username".
            
            // Heuristic: If accessing a specific param like params.username or params['id'] 
            // and that param is NOT in the path, it's likely a logic error.
            
            if (code.includes('params.username') && !filePath.includes('[username]')) {
                 errors.push(`❌ Logic Error: Accessing 'params.username' in static route '${filePath}'. Use a dynamic route like 'app/profile/[username]/page.tsx' instead.`);
            }
            else if (code.includes('params.id') && !filePath.includes('[id]')) {
                 errors.push(`❌ Logic Error: Accessing 'params.id' in static route '${filePath}'.`);
            }
            
            // Warn if using useParams in a totally static path root
            // e.g. app/page.tsx
            if (filePath.endsWith('app/page.tsx') || filePath.endsWith('app/layout.tsx')) {
                // It's rare to use useParams in root layout/page unless checking strictly for catch-all
                // We'll warn if it seems to be main logic
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = RouteValidator;
