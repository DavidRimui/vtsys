/**
 * Simple in-memory cache implementation for high-traffic scenarios
 * In a production environment with multiple instances, this would be replaced with Redis
 */

// Cache expiration times
export const CACHE_TTL = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
};

// Cache structure
type CacheItem<T> = {
  value: T;
  expiry: number;
};

// Main cache storage
const cache: Record<string, CacheItem<any>> = {};

/**
 * Get an item from the cache
 */
export function getCacheItem<T>(key: string): T | null {
  const item = cache[key];
  const now = Date.now();

  // Return null if item doesn't exist or has expired
  if (!item || item.expiry < now) {
    return null;
  }

  return item.value as T;
}

/**
 * Set an item in the cache with a specific TTL
 */
export function setCacheItem<T>(key: string, value: T, ttl: number = CACHE_TTL.MEDIUM): void {
  cache[key] = {
    value,
    expiry: Date.now() + ttl,
  };
}

/**
 * Delete an item from the cache
 */
export function deleteCacheItem(key: string): void {
  delete cache[key];
}

/**
 * Clear expired items from the cache (should be called periodically)
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  Object.keys(cache).forEach((key) => {
    if (cache[key].expiry < now) {
      delete cache[key];
    }
  });
}

/**
 * Memoize function results with a cache
 */
export function memoize<T>(fn: (...args: any[]) => Promise<T>, ttl: number = CACHE_TTL.MEDIUM) {
  return async (...args: any[]): Promise<T> => {
    const key = `memo:${fn.name}:${JSON.stringify(args)}`;
    const cachedResult = getCacheItem<T>(key);
    
    if (cachedResult !== null) {
      return cachedResult;
    }
    
    const result = await fn(...args);
    setCacheItem(key, result, ttl);
    return result;
  };
}

// Start periodic cache cleanup
if (typeof window !== 'undefined') {
  setInterval(clearExpiredCache, 5 * 60 * 1000); // Every 5 minutes
}

export default {
  getCacheItem,
  setCacheItem,
  deleteCacheItem,
  clearExpiredCache,
  memoize,
  CACHE_TTL,
};
