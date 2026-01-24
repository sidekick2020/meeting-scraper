import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';

const DataCacheContext = createContext(null);

// Default TTL values (in milliseconds)
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TTL = 30 * 1000; // 30 seconds - data is stale but usable
const MAX_CACHE_ENTRIES = 100; // Maximum number of cache entries
const CLEANUP_INTERVAL = 60 * 1000; // Clean up expired entries every 60 seconds

// Cache entry structure: { data, timestamp, ttl, lastAccess }

export function DataCacheProvider({ children }) {
  const cacheRef = useRef(new Map());
  const [, forceUpdate] = useState(0);
  const cleanupIntervalRef = useRef(null);

  // Get cached data if valid
  const getCache = useCallback((key) => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    const isExpired = age > entry.ttl;
    const isStale = age > STALE_TTL;

    if (isExpired) {
      cacheRef.current.delete(key);
      return null;
    }

    // Update last access time for LRU eviction
    entry.lastAccess = Date.now();

    return { data: entry.data, isStale };
  }, []);

  // Evict expired entries
  const evictExpired = useCallback(() => {
    const now = Date.now();
    let evictedCount = 0;
    for (const [key, entry] of cacheRef.current.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        cacheRef.current.delete(key);
        evictedCount++;
      }
    }
    return evictedCount;
  }, []);

  // Evict oldest entries by last access time
  const evictOldest = useCallback((count) => {
    if (count <= 0) return;

    // Sort entries by lastAccess time (oldest first)
    const entries = Array.from(cacheRef.current.entries())
      .sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0));

    // Remove oldest entries
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      cacheRef.current.delete(entries[i][0]);
    }
  }, []);

  // Set cache data
  const setCache = useCallback((key, data, ttl = DEFAULT_TTL) => {
    const now = Date.now();

    // First, evict expired entries
    evictExpired();

    // If still over limit, evict oldest entries
    if (cacheRef.current.size >= MAX_CACHE_ENTRIES) {
      const toEvict = cacheRef.current.size - MAX_CACHE_ENTRIES + 1;
      evictOldest(toEvict);
    }

    cacheRef.current.set(key, {
      data,
      timestamp: now,
      ttl,
      lastAccess: now
    });
    // Trigger a re-render for components watching this cache
    forceUpdate(n => n + 1);
  }, [evictExpired, evictOldest]);

  // Invalidate specific cache key or pattern
  const invalidateCache = useCallback((keyOrPattern) => {
    if (typeof keyOrPattern === 'string') {
      cacheRef.current.delete(keyOrPattern);
    } else if (keyOrPattern instanceof RegExp) {
      for (const key of cacheRef.current.keys()) {
        if (keyOrPattern.test(key)) {
          cacheRef.current.delete(key);
        }
      }
    }
    forceUpdate(n => n + 1);
  }, []);

  // Clear all cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    forceUpdate(n => n + 1);
  }, []);

  // Get all cache keys (for debugging)
  const getCacheKeys = useCallback(() => {
    return Array.from(cacheRef.current.keys());
  }, []);

  // Get cache stats for monitoring
  const getCacheStats = useCallback(() => {
    const entries = Array.from(cacheRef.current.entries());
    const now = Date.now();
    let expiredCount = 0;
    let staleCount = 0;
    let totalSize = 0;

    entries.forEach(([, entry]) => {
      const age = now - entry.timestamp;
      if (age > entry.ttl) expiredCount++;
      else if (age > STALE_TTL) staleCount++;

      // Estimate size (rough approximation)
      try {
        totalSize += JSON.stringify(entry.data).length;
      } catch {
        totalSize += 1000; // Default estimate
      }
    });

    return {
      totalEntries: cacheRef.current.size,
      maxEntries: MAX_CACHE_ENTRIES,
      expiredCount,
      staleCount,
      estimatedSizeBytes: totalSize
    };
  }, []);

  // Memory cleanup handler (can be called by MemoryMonitor)
  const performCleanup = useCallback(({ level } = {}) => {
    const evicted = evictExpired();

    if (level === 'warning' || level === 'critical' || level === 'forced') {
      // Aggressive cleanup: reduce to 50% of max entries
      const targetSize = Math.floor(MAX_CACHE_ENTRIES / 2);
      if (cacheRef.current.size > targetSize) {
        evictOldest(cacheRef.current.size - targetSize);
      }
    }

    if (level === 'critical') {
      // Emergency: clear all cache
      cacheRef.current.clear();
      console.log('[DataCache] Emergency cleanup: cleared all entries');
    }

    if (evicted > 0) {
      forceUpdate(n => n + 1);
    }

    return evicted;
  }, [evictExpired, evictOldest]);

  // Periodic cleanup interval
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(() => {
      const evicted = evictExpired();
      if (evicted > 0) {
        console.log(`[DataCache] Periodic cleanup: evicted ${evicted} expired entries`);
        forceUpdate(n => n + 1);
      }
    }, CLEANUP_INTERVAL);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [evictExpired]);

  return (
    <DataCacheContext.Provider value={{
      getCache,
      setCache,
      invalidateCache,
      clearCache,
      getCacheKeys,
      getCacheStats,
      performCleanup
    }}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
}

/**
 * Custom hook for cached data fetching
 *
 * @param {string} url - The URL to fetch
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Time-to-live in milliseconds (default: 5 minutes)
 * @param {boolean} options.refetchOnStale - Whether to refetch in background when data is stale (default: true)
 * @param {boolean} options.skip - Skip fetching (useful for conditional fetching)
 * @param {Object} options.fetchOptions - Options to pass to fetch()
 * @param {Function} options.transform - Transform function for the response data
 * @param {string} options.cacheKey - Custom cache key (defaults to URL)
 * @param {number} options.timeout - Request timeout in milliseconds (default: 10000)
 *
 * @returns {Object} { data, isLoading, error, isStale, refetch }
 */
export function useCachedFetch(url, options = {}) {
  const {
    ttl = DEFAULT_TTL,
    refetchOnStale = true,
    skip = false,
    fetchOptions = {},
    transform = (data) => data,
    cacheKey: customCacheKey,
    timeout = 10000
  } = options;

  const { getCache, setCache } = useDataCache();
  const cacheKey = customCacheKey || url;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (isBackgroundFetch = false) => {
    if (skip || !url) return;

    // Check cache first
    const cached = getCache(cacheKey);
    if (cached) {
      setData(cached.data);
      setIsStale(cached.isStale);

      // If not stale or we don't want to refetch, return early
      if (!cached.isStale || !refetchOnStale) {
        return;
      }
      // Continue to background fetch for stale data
      isBackgroundFetch = true;
    }

    // Only show loading for non-background fetches
    if (!isBackgroundFetch) {
      setIsLoading(true);
    }
    setError(null);

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      const transformedData = transform(responseData);

      // Cache the result
      setCache(cacheKey, transformedData, ttl);

      // Update state if still mounted
      if (isMountedRef.current) {
        setData(transformedData);
        setIsStale(false);
        setError(null);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }

      if (isMountedRef.current) {
        // Only set error if we don't have cached data
        if (!data) {
          setError(err.message);
        }
      }
    } finally {
      if (isMountedRef.current && !isBackgroundFetch) {
        setIsLoading(false);
      }
    }
  }, [url, cacheKey, skip, getCache, setCache, transform, ttl, refetchOnStale, fetchOptions, timeout, data]);

  // Initial fetch on mount or when URL changes
  useEffect(() => {
    isMountedRef.current = true;

    // Check cache first for immediate data
    const cached = getCache(cacheKey);
    if (cached) {
      setData(cached.data);
      setIsStale(cached.isStale);

      // If stale and refetchOnStale, fetch in background
      if (cached.isStale && refetchOnStale && !skip) {
        fetchData(true);
      }
    } else if (!skip) {
      fetchData(false);
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cacheKey, skip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refetch function
  const refetch = useCallback(() => {
    // Clear cache and fetch fresh
    setCache(cacheKey, null, 0);
    return fetchData(false);
  }, [cacheKey, setCache, fetchData]);

  return { data, isLoading, error, isStale, refetch };
}

/**
 * Hook for caching data that's fetched elsewhere (e.g., polling)
 *
 * @param {string} cacheKey - The cache key
 * @param {*} data - The data to cache
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Time-to-live in milliseconds
 *
 * This hook automatically caches data whenever it changes
 */
export function useCacheData(cacheKey, data, options = {}) {
  const { ttl = DEFAULT_TTL } = options;
  const { setCache, getCache } = useDataCache();
  const lastDataRef = useRef(null);

  useEffect(() => {
    // Only cache if data is truthy and different from last cached value
    if (data && data !== lastDataRef.current) {
      lastDataRef.current = data;
      setCache(cacheKey, data, ttl);
    }
  }, [cacheKey, data, ttl, setCache]);

  // Return cached data on initial render
  const cached = getCache(cacheKey);
  return cached?.data || data;
}

/**
 * Hook to get cached data without fetching
 *
 * @param {string} cacheKey - The cache key
 * @returns {*} The cached data or null
 */
export function useCachedData(cacheKey) {
  const { getCache } = useDataCache();
  const cached = getCache(cacheKey);
  return cached?.data || null;
}
