import { useEffect } from 'react';
import { useMemoryMonitor } from '../contexts/MemoryMonitorContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { useDevMode } from '../contexts/DevModeContext';

/**
 * MemoryCleanupIntegration - Connects all cleanup-capable contexts to the MemoryMonitor
 *
 * This component must be rendered inside all providers:
 * - MemoryMonitorProvider
 * - DataCacheProvider
 * - DevModeProvider
 *
 * It registers cleanup callbacks so the MemoryMonitor can trigger cleanup across all contexts.
 */
function MemoryCleanupIntegration() {
  const { registerCleanup } = useMemoryMonitor();
  const { performCleanup: cleanupCache, getCacheStats } = useDataCache();
  const { performCleanup: cleanupLogs, getLogStats, development } = useDevMode();

  useEffect(() => {
    // Register the data cache cleanup
    const unregisterCache = registerCleanup((params) => {
      cleanupCache(params);
    });

    // Register the dev mode logs cleanup (only if dev mode is enabled)
    let unregisterLogs = () => {};
    if (development) {
      unregisterLogs = registerCleanup((params) => {
        cleanupLogs(params);
      });
    }

    // Log initial stats
    const cacheStats = getCacheStats();
    const logStats = development ? getLogStats() : { count: 0 };
    console.log(`[MemoryCleanup] Initialized - Cache: ${cacheStats.totalEntries} entries, Logs: ${logStats.count} entries`);

    return () => {
      unregisterCache();
      unregisterLogs();
    };
  }, [registerCleanup, cleanupCache, cleanupLogs, getCacheStats, getLogStats, development]);

  // This component doesn't render anything
  return null;
}

export default MemoryCleanupIntegration;
