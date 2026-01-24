/**
 * Network Speed Detection and Adaptive Batch Loading Utility
 *
 * Detects network speed and calculates optimal batch sizes for meeting data loading.
 * Batch sizes range from 5-50 based on network conditions.
 */

// Batch size configuration
// Load meetings 5 at a time for better perceived performance,
// showing heatmaps immediately while individual meetings load progressively
const BATCH_CONFIG = {
  MIN_BATCH_SIZE: 5,
  MAX_BATCH_SIZE: 100,
  DEFAULT_BATCH_SIZE: 5,

  // Network speed thresholds (in Mbps)
  SLOW_THRESHOLD: 1,      // Below 1 Mbps = slow
  MEDIUM_THRESHOLD: 5,    // 1-5 Mbps = medium
  FAST_THRESHOLD: 10,     // 5-10 Mbps = fast
  // Above 10 Mbps = very fast
};

// Speed categories with corresponding batch sizes
// Dynamic batch sizes (5-50) based on connection quality
const SPEED_TO_BATCH = {
  'very-slow': 5,
  'slow': 5,
  'medium': 15,
  'fast': 30,
  'very-fast': 50,
};

// Store last known network speed for quick access
let cachedNetworkSpeed = null;
let lastSpeedCheck = 0;
const SPEED_CACHE_DURATION = 60000; // 60 seconds

/**
 * Measures network speed by timing a small data fetch
 * @param {string} testUrl - URL to use for speed test (should be fast and reliable)
 * @returns {Promise<number>} - Estimated speed in Mbps
 */
export async function measureNetworkSpeed(testUrl = null) {
  // Use cache if recent
  const now = Date.now();
  if (cachedNetworkSpeed !== null && (now - lastSpeedCheck) < SPEED_CACHE_DURATION) {
    return cachedNetworkSpeed;
  }

  try {
    // Method 1: Use Network Information API if available
    if (navigator.connection) {
      const connection = navigator.connection;
      if (connection.downlink) {
        cachedNetworkSpeed = connection.downlink;
        lastSpeedCheck = now;
        return cachedNetworkSpeed;
      }
    }

    // Method 2: Time a small request to estimate speed
    const startTime = performance.now();

    // Use a small API endpoint or a known small resource
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/config`, {
      cache: 'no-store',
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Speed test request failed');
    }

    const data = await response.text();
    const endTime = performance.now();

    // Calculate speed based on response size and time
    const durationSeconds = (endTime - startTime) / 1000;
    const bytesReceived = new Blob([data]).size;
    const bitsReceived = bytesReceived * 8;
    const speedMbps = (bitsReceived / durationSeconds) / 1000000;

    // Adjust estimate - small payloads underestimate speed due to latency overhead
    // Apply a multiplier to account for this
    const adjustedSpeed = speedMbps * 10; // Typical API responses are small

    cachedNetworkSpeed = Math.min(adjustedSpeed, 100); // Cap at 100 Mbps
    lastSpeedCheck = now;

    return cachedNetworkSpeed;
  } catch (error) {
    console.warn('Network speed detection failed, using default:', error.message);
    // Return a conservative default
    cachedNetworkSpeed = 5; // Assume medium speed
    lastSpeedCheck = now;
    return cachedNetworkSpeed;
  }
}

/**
 * Categorizes network speed into a tier
 * @param {number} speedMbps - Speed in Mbps
 * @returns {string} - Speed category
 */
export function categorizeSpeed(speedMbps) {
  if (speedMbps < 0.5) return 'very-slow';
  if (speedMbps < BATCH_CONFIG.SLOW_THRESHOLD) return 'slow';
  if (speedMbps < BATCH_CONFIG.MEDIUM_THRESHOLD) return 'medium';
  if (speedMbps < BATCH_CONFIG.FAST_THRESHOLD) return 'fast';
  return 'very-fast';
}

/**
 * Calculates optimal batch size based on network speed
 * @param {number} speedMbps - Speed in Mbps
 * @returns {number} - Optimal batch size (5-50)
 */
export function calculateBatchSize(speedMbps) {
  const category = categorizeSpeed(speedMbps);
  return SPEED_TO_BATCH[category] || BATCH_CONFIG.DEFAULT_BATCH_SIZE;
}

/**
 * Gets the optimal batch size for current network conditions
 * @returns {Promise<number>} - Optimal batch size
 */
export async function getOptimalBatchSize() {
  const speed = await measureNetworkSpeed();
  return calculateBatchSize(speed);
}

/**
 * Calculates the number of parallel requests based on network speed
 * Faster networks can handle more parallel requests
 * @param {number} speedMbps - Speed in Mbps
 * @returns {number} - Number of parallel requests (1-4)
 */
export function calculateParallelRequests(speedMbps) {
  const category = categorizeSpeed(speedMbps);
  switch (category) {
    case 'very-slow':
      return 1;
    case 'slow':
      return 1;
    case 'medium':
      return 2;
    case 'fast':
      return 3;
    case 'very-fast':
      return 4;
    default:
      return 2;
  }
}

/**
 * Creates a batch loading strategy based on current network conditions
 * @param {number} totalItems - Total items to load
 * @param {number} currentLoaded - Currently loaded items
 * @returns {Promise<Object>} - Loading strategy with batch size and parallel count
 */
export async function createLoadingStrategy(totalItems, currentLoaded = 0) {
  const speed = await measureNetworkSpeed();
  const batchSize = calculateBatchSize(speed);
  const parallelRequests = calculateParallelRequests(speed);
  const remainingItems = totalItems - currentLoaded;

  // Calculate how many batches we need
  const batchesNeeded = Math.ceil(remainingItems / batchSize);

  // Calculate total requests (batches / parallel requests)
  const totalRounds = Math.ceil(batchesNeeded / parallelRequests);

  return {
    batchSize,
    parallelRequests,
    remainingItems,
    batchesNeeded,
    totalRounds,
    speedMbps: speed,
    speedCategory: categorizeSpeed(speed),
  };
}

/**
 * Fetches data in optimized batches with parallel requests
 * @param {Function} fetchFn - Function to fetch a batch (receives skip, limit) returns Promise
 * @param {number} totalItems - Total items to fetch (or estimate)
 * @param {number} startSkip - Starting skip value
 * @param {Function} onProgress - Progress callback (loaded, total, batchSize)
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Array>} - All fetched items
 */
export async function fetchInBatches(fetchFn, totalItems, startSkip = 0, onProgress = null, signal = null) {
  const strategy = await createLoadingStrategy(totalItems, startSkip);
  const { batchSize, parallelRequests } = strategy;

  const allResults = [];
  let currentSkip = startSkip;
  let totalLoaded = startSkip;

  // Report initial progress
  if (onProgress) {
    onProgress(totalLoaded, totalItems, batchSize, strategy.speedCategory);
  }

  while (currentSkip < totalItems) {
    // Check for abort
    if (signal?.aborted) {
      throw new DOMException('Fetch aborted', 'AbortError');
    }

    // Create batch of parallel requests
    const batchPromises = [];
    for (let i = 0; i < parallelRequests && currentSkip < totalItems; i++) {
      const skip = currentSkip;
      const limit = Math.min(batchSize, totalItems - skip);

      if (limit > 0) {
        batchPromises.push(
          fetchFn(skip, limit, signal)
            .then(results => ({ skip, results }))
            .catch(error => {
              if (error.name === 'AbortError') throw error;
              console.warn(`Batch fetch failed at skip=${skip}:`, error);
              return { skip, results: [] };
            })
        );
        currentSkip += batchSize;
      }
    }

    if (batchPromises.length === 0) break;

    // Wait for all parallel requests to complete
    const batchResults = await Promise.all(batchPromises);

    // Sort by skip to maintain order and add to results
    const sortedResults = batchResults.sort((a, b) => a.skip - b.skip);
    for (const { results } of sortedResults) {
      if (Array.isArray(results)) {
        allResults.push(...results);
        totalLoaded += results.length;
      }
    }

    // Report progress
    if (onProgress) {
      onProgress(totalLoaded, totalItems, batchSize, strategy.speedCategory);
    }

    // If we got fewer results than expected, we've reached the end
    const lastBatchSize = batchResults.reduce((sum, { results }) =>
      sum + (Array.isArray(results) ? results.length : 0), 0);

    if (lastBatchSize < batchSize * parallelRequests) {
      break;
    }
  }

  return allResults;
}

/**
 * Updates network speed based on actual request performance
 * @param {number} bytesTransferred - Bytes transferred
 * @param {number} durationMs - Duration in milliseconds
 */
export function updateSpeedFromRequest(bytesTransferred, durationMs) {
  if (durationMs <= 0 || bytesTransferred <= 0) return;

  const durationSeconds = durationMs / 1000;
  const bitsTransferred = bytesTransferred * 8;
  const speedMbps = (bitsTransferred / durationSeconds) / 1000000;

  // Use exponential moving average to smooth speed estimates
  if (cachedNetworkSpeed === null) {
    cachedNetworkSpeed = speedMbps;
  } else {
    cachedNetworkSpeed = cachedNetworkSpeed * 0.7 + speedMbps * 0.3;
  }
  lastSpeedCheck = Date.now();
}

/**
 * Gets current cached speed without measuring
 * @returns {number|null} - Cached speed in Mbps or null if not measured
 */
export function getCachedSpeed() {
  return cachedNetworkSpeed;
}

/**
 * Clears the speed cache (useful for forcing re-measurement)
 */
export function clearSpeedCache() {
  cachedNetworkSpeed = null;
  lastSpeedCheck = 0;
}

/**
 * Hook-friendly function that returns current network info
 * @returns {Object} - Network information
 */
export function getNetworkInfo() {
  const speed = cachedNetworkSpeed || BATCH_CONFIG.DEFAULT_BATCH_SIZE / 2;
  return {
    speedMbps: speed,
    speedCategory: categorizeSpeed(speed),
    batchSize: calculateBatchSize(speed),
    parallelRequests: calculateParallelRequests(speed),
    isCached: cachedNetworkSpeed !== null,
    lastChecked: lastSpeedCheck ? new Date(lastSpeedCheck) : null,
  };
}

// =============================================================================
// REQUEST DEDUPLICATION & TIMEOUT UTILITIES
// =============================================================================

// In-flight request cache for deduplication
const inFlightRequests = new Map();

/**
 * Default timeout for fetch requests (15 seconds)
 */
const DEFAULT_FETCH_TIMEOUT = 15000;

/**
 * Fetches data with automatic timeout using AbortController
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default 15000)
 * @returns {Promise<Response>} - Fetch response
 */
export async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_FETCH_TIMEOUT) {
  const controller = new AbortController();
  const { signal: externalSignal, ...fetchOptions } = options;

  // Create timeout that aborts the request
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  // If external signal is provided, listen for its abort
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => {
      controller.abort();
      clearTimeout(timeoutId);
    });
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      // Check if it was a timeout or external abort
      if (externalSignal?.aborted) {
        throw new DOMException('Request cancelled', 'AbortError');
      }
      throw new DOMException(`Request timeout after ${timeout}ms`, 'TimeoutError');
    }
    throw error;
  }
}

/**
 * Fetches data with deduplication - reuses in-flight requests for same URL
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options (cannot include body for deduplication)
 * @param {number} timeout - Timeout in milliseconds (default 15000)
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function fetchWithDeduplication(url, options = {}, timeout = DEFAULT_FETCH_TIMEOUT) {
  // Only deduplicate GET requests without body
  const canDeduplicate = !options.method || options.method === 'GET';

  if (canDeduplicate && inFlightRequests.has(url)) {
    // Return existing promise for same URL
    return inFlightRequests.get(url);
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetchWithTimeout(url, options, timeout);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } finally {
      // Remove from in-flight cache when done
      if (canDeduplicate) {
        inFlightRequests.delete(url);
      }
    }
  })();

  if (canDeduplicate) {
    inFlightRequests.set(url, fetchPromise);
  }

  return fetchPromise;
}

/**
 * Calculates adaptive thumbnail batch size based on network speed
 * @param {number} speedMbps - Network speed in Mbps
 * @returns {number} - Optimal thumbnail batch size (20-100)
 */
export function calculateThumbnailBatchSize(speedMbps) {
  const category = categorizeSpeed(speedMbps);
  switch (category) {
    case 'very-slow':
      return 10;
    case 'slow':
      return 20;
    case 'medium':
      return 40;
    case 'fast':
      return 60;
    case 'very-fast':
      return 100;
    default:
      return 20;
  }
}

/**
 * Clears all in-flight request cache
 */
export function clearInFlightRequests() {
  inFlightRequests.clear();
}

// =============================================================================
// THUMBNAIL CACHE
// =============================================================================

const THUMBNAIL_CACHE_KEY = 'thumbnail_cache';
const THUMBNAIL_CACHE_MAX_SIZE = 500; // Max number of cached thumbnails

/**
 * In-memory thumbnail cache with sessionStorage persistence
 * Prevents reloading the same thumbnail multiple times
 */
class ThumbnailCache {
  constructor() {
    this.cache = new Map();
    this.loadFromStorage();
  }

  /**
   * Load cache from sessionStorage
   */
  loadFromStorage() {
    try {
      const stored = sessionStorage.getItem(THUMBNAIL_CACHE_KEY);
      if (stored) {
        const entries = JSON.parse(stored);
        // Only load valid entries (with both meetingId and url)
        entries.forEach(([meetingId, url]) => {
          if (meetingId && url) {
            this.cache.set(meetingId, url);
          }
        });
      }
    } catch (error) {
      // Silently fail - cache is optional
      console.warn('Failed to load thumbnail cache:', error.message);
    }
  }

  /**
   * Save cache to sessionStorage
   */
  saveToStorage() {
    try {
      const entries = Array.from(this.cache.entries());
      sessionStorage.setItem(THUMBNAIL_CACHE_KEY, JSON.stringify(entries));
    } catch (error) {
      // Silently fail - cache is optional (might hit quota)
      console.warn('Failed to save thumbnail cache:', error.message);
    }
  }

  /**
   * Get a cached thumbnail URL
   * @param {string} meetingId - Meeting ID
   * @returns {string|null} - Cached URL or null
   */
  get(meetingId) {
    return this.cache.get(meetingId) || null;
  }

  /**
   * Cache a thumbnail URL
   * @param {string} meetingId - Meeting ID
   * @param {string} url - Thumbnail URL
   */
  set(meetingId, url) {
    if (!meetingId || !url) return;

    // Evict oldest entries if cache is too large
    if (this.cache.size >= THUMBNAIL_CACHE_MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(meetingId, url);
    this.saveToStorage();
  }

  /**
   * Check if a thumbnail is cached
   * @param {string} meetingId - Meeting ID
   * @returns {boolean}
   */
  has(meetingId) {
    return this.cache.has(meetingId);
  }

  /**
   * Get multiple cached thumbnails
   * @param {Array<string>} meetingIds - Array of meeting IDs
   * @returns {Map<string, string>} - Map of meetingId to URL for cached items
   */
  getMultiple(meetingIds) {
    const result = new Map();
    meetingIds.forEach(id => {
      const url = this.cache.get(id);
      if (url) {
        result.set(id, url);
      }
    });
    return result;
  }

  /**
   * Cache multiple thumbnails at once
   * @param {Map<string, string>} thumbnails - Map of meetingId to URL
   */
  setMultiple(thumbnails) {
    if (!thumbnails || thumbnails.size === 0) return;

    thumbnails.forEach((url, meetingId) => {
      if (meetingId && url) {
        // Evict oldest if needed
        if (this.cache.size >= THUMBNAIL_CACHE_MAX_SIZE) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
        }
        this.cache.set(meetingId, url);
      }
    });

    this.saveToStorage();
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.clear();
    try {
      sessionStorage.removeItem(THUMBNAIL_CACHE_KEY);
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: THUMBNAIL_CACHE_MAX_SIZE,
    };
  }
}

// Singleton instance
const thumbnailCache = new ThumbnailCache();

/**
 * Get the thumbnail cache instance
 * @returns {ThumbnailCache}
 */
export function getThumbnailCache() {
  return thumbnailCache;
}

/**
 * Get cached thumbnails for meetings
 * @param {Array<string>} meetingIds - Meeting IDs
 * @returns {Map<string, string>} - Cached thumbnails
 */
export function getCachedThumbnails(meetingIds) {
  return thumbnailCache.getMultiple(meetingIds);
}

/**
 * Cache thumbnails
 * @param {Map<string, string>} thumbnails - Map of meetingId to URL
 */
export function cacheThumbnails(thumbnails) {
  thumbnailCache.setMultiple(thumbnails);
}

/**
 * Clear the thumbnail cache
 */
export function clearThumbnailCache() {
  thumbnailCache.clear();
}

// =============================================================================
// THROTTLED REQUEST QUEUE
// =============================================================================

/**
 * Creates a throttled request queue that limits concurrent requests
 * Prevents overwhelming browser connection limits (typically 6 per host)
 *
 * @param {number} maxConcurrent - Maximum concurrent requests (default: 3)
 * @returns {Object} - Queue controller with add() and clear() methods
 */
export function createThrottledQueue(maxConcurrent = 3) {
  const queue = [];
  let activeCount = 0;
  let isCleared = false;

  const processNext = async () => {
    if (isCleared || activeCount >= maxConcurrent || queue.length === 0) {
      return;
    }

    const { fn, resolve, reject } = queue.shift();
    activeCount++;

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      activeCount--;
      processNext();
    }
  };

  return {
    /**
     * Adds a request to the queue
     * @param {Function} fn - Async function to execute
     * @returns {Promise} - Resolves when the request completes
     */
    add(fn) {
      if (isCleared) {
        return Promise.reject(new DOMException('Queue cleared', 'AbortError'));
      }

      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        processNext();
      });
    },

    /**
     * Clears all pending requests in the queue
     */
    clear() {
      isCleared = true;
      while (queue.length > 0) {
        const { reject } = queue.shift();
        reject(new DOMException('Queue cleared', 'AbortError'));
      }
    },

    /**
     * Resets the queue for reuse
     */
    reset() {
      isCleared = false;
    },

    /**
     * Returns current queue stats
     */
    getStats() {
      return {
        pending: queue.length,
        active: activeCount,
        maxConcurrent,
      };
    },
  };
}

/**
 * Fetches thumbnails with proper throttling based on network speed
 * Limits concurrent requests to prevent browser connection pool exhaustion
 * Uses client-side cache to prevent reloading already-fetched thumbnails
 *
 * @param {Array<string>} meetingIds - Array of meeting IDs to fetch thumbnails for
 * @param {string} backendUrl - Backend URL
 * @param {Object} options - Options
 * @param {AbortSignal} options.signal - Abort signal
 * @param {Function} options.onResult - Callback for each result (meetingId, thumbnailUrl)
 * @param {number} options.timeout - Request timeout in ms (default: 10000)
 * @param {boolean} options.skipCache - Skip cache lookup (default: false)
 * @returns {Promise<Map<string, string>>} - Map of meetingId to thumbnailUrl
 */
export async function fetchThumbnailsThrottled(meetingIds, backendUrl, options = {}) {
  const { signal, onResult, timeout = 10000, skipCache = false } = options;

  const results = new Map();

  // Check cache first - return cached thumbnails immediately
  if (!skipCache) {
    const cachedThumbnails = thumbnailCache.getMultiple(meetingIds);
    cachedThumbnails.forEach((url, meetingId) => {
      results.set(meetingId, url);
      if (onResult) {
        onResult(meetingId, url);
      }
    });

    // Filter out already-cached meeting IDs
    meetingIds = meetingIds.filter(id => !cachedThumbnails.has(id));

    // If all thumbnails were cached, return immediately
    if (meetingIds.length === 0) {
      return results;
    }
  }

  // Get network-based concurrency limit (1-4 based on speed)
  const speed = await measureNetworkSpeed();
  const maxConcurrent = calculateParallelRequests(speed);

  const queue = createThrottledQueue(maxConcurrent);
  const newlyFetched = new Map();
  const errors = [];

  // Handle abort signal
  if (signal) {
    signal.addEventListener('abort', () => queue.clear());
  }

  // Create fetch promises for thumbnails not in cache
  const promises = meetingIds.map(meetingId =>
    queue.add(async () => {
      if (signal?.aborted) {
        throw new DOMException('Request cancelled', 'AbortError');
      }

      try {
        const response = await fetchWithTimeout(
          `${backendUrl}/api/thumbnail/${meetingId}`,
          { signal },
          timeout
        );

        if (response.ok) {
          const data = await response.json();
          if (data.thumbnailUrl) {
            results.set(meetingId, data.thumbnailUrl);
            newlyFetched.set(meetingId, data.thumbnailUrl);
            if (onResult) {
              onResult(meetingId, data.thumbnailUrl);
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          errors.push({ meetingId, error: error.message });
        }
        throw error;
      }
    }).catch(error => {
      // Silently handle individual failures - don't break the whole batch
      if (error.name !== 'AbortError') {
        console.warn(`Thumbnail fetch failed for ${meetingId}:`, error.message);
      }
    })
  );

  // Wait for all to complete (or fail)
  await Promise.allSettled(promises);

  // Cache newly fetched thumbnails for future use
  if (newlyFetched.size > 0) {
    thumbnailCache.setMultiple(newlyFetched);
  }

  return results;
}

const networkSpeedUtils = {
  measureNetworkSpeed,
  calculateBatchSize,
  getOptimalBatchSize,
  createLoadingStrategy,
  fetchInBatches,
  updateSpeedFromRequest,
  getCachedSpeed,
  clearSpeedCache,
  getNetworkInfo,
  categorizeSpeed,
  calculateParallelRequests,
  fetchWithTimeout,
  fetchWithDeduplication,
  calculateThumbnailBatchSize,
  clearInFlightRequests,
  createThrottledQueue,
  fetchThumbnailsThrottled,
  getThumbnailCache,
  getCachedThumbnails,
  cacheThumbnails,
  clearThumbnailCache,
  BATCH_CONFIG,
  DEFAULT_FETCH_TIMEOUT,
};

export default networkSpeedUtils;
