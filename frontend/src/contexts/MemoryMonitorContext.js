import React, { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react';

const MemoryMonitorContext = createContext(null);

// Configuration
const CLEANUP_INTERVAL = 30 * 1000; // Run cleanup every 30 seconds
const MEMORY_WARNING_THRESHOLD = 100 * 1024 * 1024; // 100MB - start aggressive cleanup
const MEMORY_CRITICAL_THRESHOLD = 200 * 1024 * 1024; // 200MB - emergency cleanup
const MAX_CACHE_ENTRIES = 100; // Max entries in data cache
const MAX_LOG_RESPONSE_SIZE = 10 * 1024; // Truncate response bodies larger than 10KB

/**
 * MemoryMonitorProvider - Monitors memory usage and performs periodic cleanup
 *
 * Features:
 * - Periodic memory monitoring (every 30 seconds)
 * - Automatic cleanup of stale cache entries
 * - Truncation of large response bodies in dev logs
 * - Manual cleanup triggers
 * - Memory usage stats
 */
export function MemoryMonitorProvider({ children }) {
  const [memoryStats, setMemoryStats] = useState({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
    isSupported: false,
    lastCleanup: null,
    cleanupCount: 0
  });

  const cleanupCallbacksRef = useRef([]);
  const intervalRef = useRef(null);

  // Register a cleanup callback from other contexts
  const registerCleanup = useCallback((callback) => {
    cleanupCallbacksRef.current.push(callback);
    // Return unregister function
    return () => {
      cleanupCallbacksRef.current = cleanupCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  // Get current memory usage
  const getMemoryUsage = useCallback(() => {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        isSupported: true
      };
    }
    // Fallback for browsers without performance.memory
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      isSupported: false
    };
  }, []);

  // Perform cleanup
  const runCleanup = useCallback((force = false) => {
    const memory = getMemoryUsage();
    const isWarning = memory.usedJSHeapSize > MEMORY_WARNING_THRESHOLD;
    const isCritical = memory.usedJSHeapSize > MEMORY_CRITICAL_THRESHOLD;

    // Determine cleanup level
    let level = 'routine';
    if (isCritical) level = 'critical';
    else if (isWarning) level = 'warning';
    else if (force) level = 'forced';

    // Call all registered cleanup callbacks
    cleanupCallbacksRef.current.forEach(callback => {
      try {
        callback({ level, memory });
      } catch (err) {
        console.error('[MemoryMonitor] Cleanup callback error:', err);
      }
    });

    // Clear Parse local datastore if memory is critical
    if (isCritical) {
      try {
        if (typeof localStorage !== 'undefined') {
          // Clear Parse SDK cached data from localStorage
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('Parse/') || key.startsWith('parse'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          if (keysToRemove.length > 0) {
            console.log(`[MemoryMonitor] Cleared ${keysToRemove.length} Parse cache entries from localStorage`);
          }
        }
      } catch (err) {
        console.error('[MemoryMonitor] Failed to clear Parse cache:', err);
      }
    }

    // Update stats
    setMemoryStats(prev => ({
      ...memory,
      lastCleanup: new Date().toISOString(),
      cleanupCount: prev.cleanupCount + 1
    }));

    if (level !== 'routine') {
      console.log(`[MemoryMonitor] Cleanup completed (${level}). Memory: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`);
    }

    return { level, memory };
  }, [getMemoryUsage]);

  // Manual full cleanup
  const forceCleanup = useCallback(() => {
    console.log('[MemoryMonitor] Forcing full cleanup...');
    return runCleanup(true);
  }, [runCleanup]);

  // Start periodic cleanup
  useEffect(() => {
    // Initial memory reading
    setMemoryStats(prev => ({
      ...prev,
      ...getMemoryUsage()
    }));

    // Start interval
    intervalRef.current = setInterval(() => {
      runCleanup(false);
    }, CLEANUP_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [getMemoryUsage, runCleanup]);

  const value = {
    memoryStats,
    registerCleanup,
    forceCleanup,
    getMemoryUsage,
    config: {
      cleanupInterval: CLEANUP_INTERVAL,
      warningThreshold: MEMORY_WARNING_THRESHOLD,
      criticalThreshold: MEMORY_CRITICAL_THRESHOLD,
      maxCacheEntries: MAX_CACHE_ENTRIES,
      maxLogResponseSize: MAX_LOG_RESPONSE_SIZE
    }
  };

  return (
    <MemoryMonitorContext.Provider value={value}>
      {children}
    </MemoryMonitorContext.Provider>
  );
}

export function useMemoryMonitor() {
  const context = useContext(MemoryMonitorContext);
  if (!context) {
    throw new Error('useMemoryMonitor must be used within a MemoryMonitorProvider');
  }
  return context;
}

// Export constants for use in other contexts
export const MEMORY_CONFIG = {
  MAX_CACHE_ENTRIES,
  MAX_LOG_RESPONSE_SIZE,
  MEMORY_WARNING_THRESHOLD,
  MEMORY_CRITICAL_THRESHOLD
};

export default MemoryMonitorContext;
