// Simple in-memory cache with Time-To-Live (TTL)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cacheMap = new Map<string, CacheEntry<any>>();

/**
 * Get cached item if it exists and hasn't expired.
 */
export function getCache<T>(key: string): T | null {
  const entry = cacheMap.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheMap.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Store item in cache with a TTL (default: 5 minutes = 300,000 ms).
 */
export function setCache<T>(key: string, data: T, ttlMs: number = 300_000): void {
  // Simple LRU cleanup if cache exceeds 500 items
  if (cacheMap.size > 500) {
    const oldestKey = cacheMap.keys().next().value;
    if (oldestKey) cacheMap.delete(oldestKey);
  }
  cacheMap.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}
