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
  BATCH_CONFIG,
};

export default networkSpeedUtils;
