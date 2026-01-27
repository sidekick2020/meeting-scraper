/**
 * Data Cache Context
 *
 * Provides client-side caching with TTL and LRU eviction.
 *
 * Usage:
 *   import { DataCacheProvider, useDataCache, useCachedFetch } from './contexts/DataCacheContext';
 *
 *   // In app root
 *   <DataCacheProvider>
 *     <App />
 *   </DataCacheProvider>
 *
 *   // Manual cache management
 *   const { getCache, setCache, invalidateCache } = useDataCache();
 *
 *   // Automatic cached fetching
 *   const { data, isLoading, error, refetch } = useCachedFetch('/api/data');
 */

import React, { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';

const DataCacheContext = createContext(null);

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 100;

export const DataCacheProvider = ({ children, defaultTTL = DEFAULT_TTL, maxEntries = MAX_ENTRIES }) => {
  const cacheRef = useRef(new Map());
  const accessOrderRef = useRef([]); // Track access order for LRU

  /**
   * Get a cached value by key
   * Returns null if not found or expired
   */
  const getCache = useCallback((key) => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      cacheRef.current.delete(key);
      accessOrderRef.current = accessOrderRef.current.filter(k => k !== key);
      return null;
    }

    // Update access order (LRU)
    accessOrderRef.current = accessOrderRef.current.filter(k => k !== key);
    accessOrderRef.current.push(key);

    return entry.data;
  }, []);

  /**
   * Check if a cache entry exists and is fresh
   */
  const hasCache = useCallback((key) => {
    const entry = cacheRef.current.get(key);
    if (!entry) return false;
    return Date.now() <= entry.expiresAt;
  }, []);

  /**
   * Check if a cache entry is stale (exists but expired)
   */
  const isStale = useCallback((key) => {
    const entry = cacheRef.current.get(key);
    if (!entry) return false;
    return Date.now() > entry.expiresAt;
  }, []);

  /**
   * Set a cache value with TTL
   */
  const setCache = useCallback((key, data, ttl = defaultTTL) => {
    // LRU eviction if at capacity
    while (cacheRef.current.size >= maxEntries && accessOrderRef.current.length > 0) {
      const oldestKey = accessOrderRef.current.shift();
      cacheRef.current.delete(oldestKey);
    }

    // Store the entry
    cacheRef.current.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });

    // Update access order
    accessOrderRef.current = accessOrderRef.current.filter(k => k !== key);
    accessOrderRef.current.push(key);
  }, [defaultTTL, maxEntries]);

  /**
   * Invalidate cache entries by key or pattern
   * Supports wildcards: 'meetings:*' matches 'meetings:123', 'meetings:456'
   */
  const invalidateCache = useCallback((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      const keysToDelete = [];

      for (const key of cacheRef.current.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => {
        cacheRef.current.delete(key);
        accessOrderRef.current = accessOrderRef.current.filter(k => k !== key);
      });

      return keysToDelete.length;
    } else {
      const existed = cacheRef.current.has(pattern);
      cacheRef.current.delete(pattern);
      accessOrderRef.current = accessOrderRef.current.filter(k => k !== pattern);
      return existed ? 1 : 0;
    }
  }, []);

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(() => {
    const count = cacheRef.current.size;
    cacheRef.current.clear();
    accessOrderRef.current = [];
    return count;
  }, []);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    let expiredCount = 0;
    let totalSize = 0;
    const now = Date.now();

    for (const [key, entry] of cacheRef.current.entries()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      }
      // Rough estimate of entry size
      totalSize += JSON.stringify(entry.data).length;
    }

    return {
      totalEntries: cacheRef.current.size,
      expiredEntries: expiredCount,
      activeEntries: cacheRef.current.size - expiredCount,
      estimatedSizeBytes: totalSize,
      maxEntries,
    };
  }, [maxEntries]);

  /**
   * Clean up expired entries (can be called periodically)
   */
  const cleanupExpired = useCallback(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of cacheRef.current.entries()) {
      if (now > entry.expiresAt) {
        cacheRef.current.delete(key);
        accessOrderRef.current = accessOrderRef.current.filter(k => k !== key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }, []);

  // Periodic cleanup every 5 minutes
  useEffect(() => {
    const interval = setInterval(cleanupExpired, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cleanupExpired]);

  const value = {
    getCache,
    setCache,
    hasCache,
    isStale,
    invalidateCache,
    clearCache,
    getCacheStats,
    cleanupExpired,
  };

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
};

/**
 * Hook for cached data fetching
 *
 * @param {string} url - The URL to fetch
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Cache TTL in milliseconds
 * @param {boolean} options.enabled - Whether to fetch (default: true)
 * @param {Function} options.transform - Transform function for response
 * @param {boolean} options.refetchOnStale - Refetch when cache is stale
 */
export const useCachedFetch = (url, options = {}) => {
  const {
    ttl = DEFAULT_TTL,
    enabled = true,
    transform = (data) => data,
    refetchOnStale = false,
    fetchOptions = {},
  } = options;

  const { getCache, setCache, isStale: checkStale } = useDataCache();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const fetchData = useCallback(async (skipCache = false) => {
    if (!enabled || !url) {
      setIsLoading(false);
      return;
    }

    try {
      // Check cache first (unless skip)
      if (!skipCache) {
        const cached = getCache(url);
        if (cached !== null) {
          setData(cached);
          setIsLoading(false);
          setIsStale(checkStale(url));

          // If stale and refetchOnStale, fetch in background
          if (refetchOnStale && checkStale(url)) {
            fetchData(true);
          }
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const transformed = transform(json);

      // Update cache
      setCache(url, transformed, ttl);

      setData(transformed);
      setIsStale(false);
    } catch (err) {
      setError(err);
      console.error(`Failed to fetch ${url}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [url, enabled, ttl, getCache, setCache, checkStale, transform, refetchOnStale, fetchOptions]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch,
  };
};

export default DataCacheContext;
