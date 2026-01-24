import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Parse from 'parse';
import { useParseQueryLogger } from './ParseQueryLoggerContext';

const ParseContext = createContext(null);

// Parse configuration from environment variables
const PARSE_APP_ID = process.env.REACT_APP_BACK4APP_APP_ID;
const PARSE_JS_KEY = process.env.REACT_APP_BACK4APP_JS_KEY;
const PARSE_SERVER_URL = process.env.REACT_APP_PARSE_SERVER_URL || 'https://parseapi.back4app.com/';

/**
 * Initialize Parse SDK synchronously at module load time.
 * This is the recommended approach - initialize ONCE before any React components render.
 *
 * Benefits:
 * - Parse is ready immediately when components mount
 * - No race conditions with useEffect-based initialization
 * - Queries can be made from the first render
 * - No unnecessary connection test delays app startup
 */
let isInitialized = false;
let initializationError = null;
let initialConnectionStatus = 'not_configured';
let connectionTestPromise = null;
let lastConnectionError = null;

// Initialization log for diagnostics
const frontendInitLog = [];

function logInit(message, level = 'info') {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message
  };
  frontendInitLog.push(entry);
  console.log(`[PARSE-FRONTEND] [${level.toUpperCase()}] ${message}`);
}

logInit('Starting frontend Parse SDK initialization...');
logInit(`REACT_APP_BACK4APP_APP_ID: ${PARSE_APP_ID ? 'SET (' + PARSE_APP_ID.substring(0, 8) + '...)' : 'NOT SET'}`);
logInit(`REACT_APP_BACK4APP_JS_KEY: ${PARSE_JS_KEY ? 'SET (' + PARSE_JS_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
logInit(`PARSE_SERVER_URL: ${PARSE_SERVER_URL}`);

/**
 * Test the actual connection to Parse server
 * This performs a real query to verify network connectivity and credentials
 */
async function testParseConnection() {
  if (!isInitialized) {
    return { success: false, error: 'Parse SDK not initialized' };
  }

  try {
    logInit('Testing Parse connection with a real query...');
    const testQuery = new Parse.Query('Meetings');
    testQuery.limit(1);
    testQuery.select('objectId');

    // Set a reasonable timeout for the connection test
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection test timeout (10s)')), 10000)
    );

    const queryPromise = testQuery.find();
    await Promise.race([queryPromise, timeoutPromise]);

    logInit('Parse connection test SUCCESS', 'success');
    return { success: true };
  } catch (error) {
    const errorMessage = error.message || String(error);
    logInit(`Parse connection test FAILED: ${errorMessage}`, 'error');
    lastConnectionError = errorMessage;
    return { success: false, error: errorMessage };
  }
}

function initializeParse() {
  if (isInitialized) return true;

  if (!PARSE_APP_ID || !PARSE_JS_KEY) {
    logInit('Parse SDK not initialized: Missing environment variables', 'warning');
    logInit('App will continue via backend API proxy', 'info');
    initializationError = new Error('Missing Parse configuration');
    initialConnectionStatus = 'not_configured';
    return false;
  }

  try {
    logInit('Calling Parse.initialize()...');
    Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
    Parse.serverURL = PARSE_SERVER_URL;

    // Enable local datastore for offline caching (optional but recommended)
    Parse.enableLocalDatastore();

    isInitialized = true;
    // Set status to 'testing' until we verify the connection actually works
    initialConnectionStatus = 'testing';
    logInit('Parse SDK initialized, testing connection...', 'info');

    // Start the connection test (async, updates status when complete)
    connectionTestPromise = testParseConnection().then(result => {
      if (result.success) {
        initialConnectionStatus = 'connected';
        logInit('Connection verified - status set to connected', 'success');
      } else {
        initialConnectionStatus = 'error';
        initializationError = new Error(result.error);
        logInit(`Connection failed - status set to error: ${result.error}`, 'error');
      }
      return result;
    });

    return true;
  } catch (error) {
    logInit(`Failed to initialize Parse SDK: ${error.message}`, 'error');
    initializationError = error;
    initialConnectionStatus = 'error';
    return false;
  }
}

// Initialize immediately when this module is imported
// This ensures Parse is ready before any React component mounts
initializeParse();
logInit(`Initialization started. Initial status: ${initialConnectionStatus}`);

/**
 * ParseProvider - Provides Parse SDK access to React components
 *
 * Usage:
 * 1. Wrap your app with <ParseProvider>
 * 2. Use the useParse() hook in components to access Parse
 *
 * Example:
 *   const { Parse, isReady, query } = useParse();
 *   const meetings = await query('Meetings').equalTo('state', 'CA').find();
 */
export function ParseProvider({ children }) {
  const [isReady] = useState(isInitialized);
  const [error, setError] = useState(initializationError);
  // Connection status starts with the initial value but updates when async test completes
  const [connectionStatus, setConnectionStatus] = useState(initialConnectionStatus);

  // Get the query logger (will return no-op functions if provider not available)
  const queryLogger = useParseQueryLogger();

  // Monitor the connection test promise and update state when it completes
  useEffect(() => {
    if (connectionTestPromise) {
      connectionTestPromise.then(result => {
        // Update React state to match the module-level state
        setConnectionStatus(initialConnectionStatus);
        if (initializationError) {
          setError(initializationError);
        }
      });
    }
  }, []);

  /**
   * Helper to create a new Parse.Query with proper typing
   */
  const query = useCallback((className) => {
    if (!isInitialized) {
      throw new Error('Parse SDK not initialized');
    }
    return new Parse.Query(className);
  }, []);

  /**
   * Helper to get a Parse Object by className and id
   */
  const getObject = useCallback(async (className, objectId) => {
    if (!isInitialized) {
      throw new Error('Parse SDK not initialized');
    }
    const query = new Parse.Query(className);
    return await query.get(objectId);
  }, []);

  /**
   * Helper for running cloud functions
   */
  const runCloud = useCallback(async (functionName, params = {}) => {
    if (!isInitialized) {
      throw new Error('Parse SDK not initialized');
    }
    return await Parse.Cloud.run(functionName, params);
  }, []);

  /**
   * Fetch meetings with filters - replaces /api/meetings backend call
   * @param {Object} options - Query options
   * @param {number} options.limit - Max results (default 50)
   * @param {number} options.skip - Pagination offset (default 0)
   * @param {string} options.state - Filter by state code
   * @param {number} options.day - Filter by day (0-6)
   * @param {string} options.search - Search in meeting name
   * @param {string} options.type - Filter by meetingType (AA/NA)
   * @param {string} options.city - Filter by city
   * @param {boolean} options.online - Filter online meetings
   * @param {boolean} options.hybrid - Filter hybrid meetings
   * @param {string} options.format - Filter by format
   * @param {Object} options.bounds - Geographic bounds {north, south, east, west}
   * @param {Object} options.center - Center point for distance sorting {lat, lng}
   * @returns {Promise<{meetings: Array, total: number}>}
   */
  const fetchMeetings = useCallback(async (options = {}) => {
    const {
      limit = 50,
      skip = 0,
      state,
      day,
      search,
      type,
      city,
      online,
      hybrid,
      format,
      bounds,
      center
    } = options;

    // Build params object for logging
    const queryParams = {
      limit, skip, state, day, search, type, city,
      online, hybrid, format, bounds, center
    };

    // Start logging the query
    const log = queryLogger.logQuery({
      operation: 'fetchMeetings',
      className: 'Meetings',
      params: queryParams,
      step: 'Starting query with filters'
    });

    if (!isInitialized) {
      log.error(new Error('Parse not initialized'), { reason: 'SDK not initialized' });
      console.warn('Parse not initialized, returning empty results');
      return { meetings: [], total: 0 };
    }

    try {
      log.updateStep('Building Parse query');
      const meetingQuery = new Parse.Query('Meetings');

      // Apply filters
      if (state) meetingQuery.equalTo('state', state);
      if (day !== undefined && day !== null && day !== '') {
        meetingQuery.equalTo('day', parseInt(day, 10));
      }
      if (type) meetingQuery.equalTo('meetingType', type);
      if (city) meetingQuery.equalTo('city', city);
      if (online) meetingQuery.equalTo('isOnline', true);
      if (hybrid) meetingQuery.equalTo('isHybrid', true);
      if (format) meetingQuery.equalTo('format', format);
      if (search) {
        meetingQuery.matches('name', new RegExp(search, 'i'));
      }

      // Geographic bounds
      if (bounds && bounds.north && bounds.south && bounds.east && bounds.west) {
        meetingQuery.greaterThanOrEqualTo('latitude', bounds.south);
        meetingQuery.lessThanOrEqualTo('latitude', bounds.north);
        meetingQuery.greaterThanOrEqualTo('longitude', bounds.west);
        meetingQuery.lessThanOrEqualTo('longitude', bounds.east);
      }

      // Field projection - only fetch needed fields
      meetingQuery.select(
        'objectId', 'name', 'day', 'time', 'city', 'state',
        'latitude', 'longitude', 'locationName', 'meetingType',
        'isOnline', 'isHybrid', 'format', 'address', 'thumbnailUrl'
      );

      meetingQuery.limit(limit);
      meetingQuery.skip(skip);
      meetingQuery.descending('createdAt');

      // Execute query
      log.updateStep('Executing find() query on Meetings table');
      const results = await meetingQuery.find();
      let meetings = results.map(m => m.toJSON());

      // Sort by distance from center if provided
      if (center && center.lat && center.lng) {
        log.updateStep('Sorting by distance from center');
        meetings.sort((a, b) => {
          const distA = a.latitude && a.longitude
            ? Math.pow(a.latitude - center.lat, 2) + Math.pow((a.longitude - center.lng) * Math.cos(center.lat * Math.PI / 180), 2)
            : Infinity;
          const distB = b.latitude && b.longitude
            ? Math.pow(b.latitude - center.lat, 2) + Math.pow((b.longitude - center.lng) * Math.cos(center.lat * Math.PI / 180), 2)
            : Infinity;
          return distA - distB;
        });
      }

      // Get total count if we hit the limit (might be more)
      let total = meetings.length;
      if (meetings.length === limit) {
        log.updateStep('Running count() query for pagination');
        const countQuery = new Parse.Query('Meetings');
        // Reapply filters for count
        if (state) countQuery.equalTo('state', state);
        if (day !== undefined && day !== null && day !== '') {
          countQuery.equalTo('day', parseInt(day, 10));
        }
        if (type) countQuery.equalTo('meetingType', type);
        if (city) countQuery.equalTo('city', city);
        if (online) countQuery.equalTo('isOnline', true);
        if (hybrid) countQuery.equalTo('isHybrid', true);
        if (format) countQuery.equalTo('format', format);
        if (search) countQuery.matches('name', new RegExp(search, 'i'));
        if (bounds && bounds.north && bounds.south && bounds.east && bounds.west) {
          countQuery.greaterThanOrEqualTo('latitude', bounds.south);
          countQuery.lessThanOrEqualTo('latitude', bounds.north);
          countQuery.greaterThanOrEqualTo('longitude', bounds.west);
          countQuery.lessThanOrEqualTo('longitude', bounds.east);
        }
        total = await countQuery.count();
      }

      log.success({ count: meetings.length, data: meetings, total });
      return { meetings, total };
    } catch (error) {
      log.error(error, { operation: 'fetchMeetings' });
      console.error('ParseContext fetchMeetings error:', error);
      return { meetings: [], total: 0, error: error.message };
    }
  }, [queryLogger]);

  /**
   * Fetch meeting counts by state - replaces /api/meetings/by-state backend call
   * @param {Object} options - Filter options (same as fetchMeetings)
   * @returns {Promise<{states: Array<{state, count, lat, lng}>, total: number}>}
   */
  const fetchMeetingsByState = useCallback(async (options = {}) => {
    const { day, type, online, hybrid, format } = options;

    // Build params object for logging
    const queryParams = { day, type, online, hybrid, format };

    // Start logging the query
    const log = queryLogger.logQuery({
      operation: 'fetchMeetingsByState',
      className: 'Meetings',
      params: queryParams,
      step: 'Starting state aggregation query'
    });

    if (!isInitialized) {
      log.error(new Error('Parse not initialized'), { reason: 'SDK not initialized' });
      return { states: [], total: 0 };
    }

    try {
      // Fetch all meetings with just the state field for aggregation
      const allStates = {};
      let skip = 0;
      const batchSize = 1000;
      let totalMeetings = 0;
      let batchCount = 0;

      while (true) {
        batchCount++;
        log.updateStep(`Fetching batch ${batchCount} (skip=${skip}, limit=${batchSize})`);

        const batchQuery = new Parse.Query('Meetings');
        batchQuery.select('state');
        batchQuery.limit(batchSize);
        batchQuery.skip(skip);

        // Apply filters
        if (day !== undefined && day !== null && day !== '') {
          batchQuery.equalTo('day', parseInt(day, 10));
        }
        if (type) batchQuery.equalTo('meetingType', type);
        if (online) batchQuery.equalTo('isOnline', true);
        if (hybrid) batchQuery.equalTo('isHybrid', true);
        if (format) batchQuery.equalTo('format', format);

        const results = await batchQuery.find();
        if (results.length === 0) break;

        results.forEach(m => {
          const state = m.get('state');
          if (state) {
            allStates[state] = (allStates[state] || 0) + 1;
            totalMeetings++;
          }
        });

        skip += batchSize;
        if (results.length < batchSize) break;
      }

      log.updateStep(`Aggregating ${Object.keys(allStates).length} states from ${totalMeetings} meetings`);

      // Convert to array format with approximate center coordinates
      const STATE_CENTERS = {
        'AL': [32.806671, -86.791130], 'AK': [61.370716, -152.404419], 'AZ': [33.729759, -111.431221],
        'AR': [34.969704, -92.373123], 'CA': [36.116203, -119.681564], 'CO': [39.059811, -105.311104],
        'CT': [41.597782, -72.755371], 'DE': [39.318523, -75.507141], 'FL': [27.766279, -81.686783],
        'GA': [33.040619, -83.643074], 'HI': [21.094318, -157.498337], 'ID': [44.240459, -114.478828],
        'IL': [40.349457, -88.986137], 'IN': [39.849426, -86.258278], 'IA': [42.011539, -93.210526],
        'KS': [38.526600, -96.726486], 'KY': [37.668140, -84.670067], 'LA': [31.169546, -91.867805],
        'ME': [44.693947, -69.381927], 'MD': [39.063946, -76.802101], 'MA': [42.230171, -71.530106],
        'MI': [43.326618, -84.536095], 'MN': [45.694454, -93.900192], 'MS': [32.741646, -89.678696],
        'MO': [38.456085, -92.288368], 'MT': [46.921925, -110.454353], 'NE': [41.125370, -98.268082],
        'NV': [38.313515, -117.055374], 'NH': [43.452492, -71.563896], 'NJ': [40.298904, -74.521011],
        'NM': [34.840515, -106.248482], 'NY': [42.165726, -74.948051], 'NC': [35.630066, -79.806419],
        'ND': [47.528912, -99.784012], 'OH': [40.388783, -82.764915], 'OK': [35.565342, -96.928917],
        'OR': [44.572021, -122.070938], 'PA': [40.590752, -77.209755], 'RI': [41.680893, -71.511780],
        'SC': [33.856892, -80.945007], 'SD': [44.299782, -99.438828], 'TN': [35.747845, -86.692345],
        'TX': [31.054487, -97.563461], 'UT': [40.150032, -111.862434], 'VT': [44.045876, -72.710686],
        'VA': [37.769337, -78.169968], 'WA': [47.400902, -121.490494], 'WV': [38.491226, -80.954453],
        'WI': [44.268543, -89.616508], 'WY': [42.755966, -107.302490], 'DC': [38.897438, -77.026817]
      };

      const states = Object.entries(allStates).map(([state, count]) => ({
        state,
        count,
        lat: STATE_CENTERS[state]?.[0] || 39.8283,
        lng: STATE_CENTERS[state]?.[1] || -98.5795
      }));

      log.success({
        count: states.length,
        data: states,
        totalMeetings,
        batchCount
      });

      return { states, total: totalMeetings };
    } catch (error) {
      log.error(error, { operation: 'fetchMeetingsByState' });
      console.error('ParseContext fetchMeetingsByState error:', error);
      return { states: [], total: 0, error: error.message };
    }
  }, [queryLogger]);

  /**
   * Fetch coverage analysis data directly from Back4app
   * This replaces the /api/coverage backend call
   * @returns {Promise<Object>} Coverage analysis data
   */
  const fetchCoverageAnalysis = useCallback(async () => {
    const log = queryLogger.logQuery({
      operation: 'fetchCoverageAnalysis',
      className: 'Meetings',
      params: {},
      step: 'Starting coverage analysis query'
    });

    if (!isInitialized) {
      log.error(new Error('Parse not initialized'), { reason: 'SDK not initialized' });
      return null;
    }

    // US State populations (in thousands) - matches backend
    const US_STATE_POPULATION = {
      'AL': 5024, 'AK': 733, 'AZ': 7151, 'AR': 3011, 'CA': 39538, 'CO': 5773,
      'CT': 3606, 'DE': 989, 'FL': 21538, 'GA': 10711, 'HI': 1455, 'ID': 1839,
      'IL': 12812, 'IN': 6786, 'IA': 3190, 'KS': 2937, 'KY': 4505, 'LA': 4657,
      'ME': 1362, 'MD': 6177, 'MA': 7029, 'MI': 10077, 'MN': 5706, 'MS': 2961,
      'MO': 6154, 'MT': 1084, 'NE': 1961, 'NV': 3104, 'NH': 1377, 'NJ': 9288,
      'NM': 2117, 'NY': 20201, 'NC': 10439, 'ND': 779, 'OH': 11799, 'OK': 3959,
      'OR': 4237, 'PA': 13002, 'RI': 1097, 'SC': 5118, 'SD': 886, 'TN': 6910,
      'TX': 29145, 'UT': 3271, 'VT': 643, 'VA': 8631, 'WA': 7614, 'WV': 1793,
      'WI': 5893, 'WY': 577, 'DC': 689
    };

    const US_STATE_NAMES = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
      'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
      'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
      'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
      'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
      'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
      'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
      'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
      'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
      'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
      'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
    };

    try {
      // Count meetings by state using batch queries
      const meetingsByState = {};
      let skip = 0;
      const batchSize = 1000;
      let totalMeetings = 0;
      let batchCount = 0;

      while (true) {
        batchCount++;
        log.updateStep(`Fetching batch ${batchCount} (skip=${skip}, limit=${batchSize})`);

        const batchQuery = new Parse.Query('Meetings');
        batchQuery.select('state');
        batchQuery.exists('state');
        batchQuery.limit(batchSize);
        batchQuery.skip(skip);

        const results = await batchQuery.find();
        if (results.length === 0) break;

        results.forEach(m => {
          const state = m.get('state');
          if (state) {
            meetingsByState[state] = (meetingsByState[state] || 0) + 1;
            totalMeetings++;
          }
        });

        skip += batchSize;
        if (results.length < batchSize) break;

        // Safety limit
        if (skip > 500000) {
          console.warn('Hit safety limit of 500k meetings');
          break;
        }
      }

      log.updateStep(`Processing ${totalMeetings} meetings across ${Object.keys(meetingsByState).length} states`);

      // Calculate coverage metrics
      const totalUSPopulation = Object.values(US_STATE_POPULATION).reduce((a, b) => a + b, 0);
      const coverageData = [];

      for (const [stateCode, population] of Object.entries(US_STATE_POPULATION)) {
        const meetings = meetingsByState[stateCode] || 0;
        const coveragePer100k = population > 0 ? (meetings / population * 100) : 0;

        coverageData.push({
          state: stateCode,
          stateName: US_STATE_NAMES[stateCode] || stateCode,
          population: population * 1000,
          meetings,
          coveragePer100k: Math.round(coveragePer100k * 100) / 100,
          hasFeed: false // Will be determined by backend if needed
        });
      }

      // Sort by coverage (lowest first)
      coverageData.sort((a, b) => a.coveragePer100k - b.coveragePer100k);

      // Calculate summary stats
      const statesWithMeetings = coverageData.filter(s => s.meetings > 0);
      const statesWithoutMeetings = coverageData.filter(s => s.meetings === 0);

      let avgCoverage = 0;
      if (statesWithMeetings.length > 0) {
        avgCoverage = statesWithMeetings.reduce((sum, s) => sum + s.coveragePer100k, 0) / statesWithMeetings.length;
      }

      // Identify priority states (high population, low coverage)
      const priorityStates = coverageData.filter(
        s => s.population > 2000000 && s.coveragePer100k < avgCoverage
      );

      const result = {
        summary: {
          totalMeetings,
          statesWithMeetings: statesWithMeetings.length,
          statesWithoutMeetings: statesWithoutMeetings.length,
          averageCoveragePer100k: Math.round(avgCoverage * 100) / 100,
          totalUSPopulation: totalUSPopulation * 1000
        },
        coverage: coverageData,
        priorityStates: priorityStates.slice(0, 10),
        statesWithoutCoverage: statesWithoutMeetings,
        source: 'parse-direct'
      };

      log.success({ count: coverageData.length, totalMeetings, data: result });
      return result;
    } catch (error) {
      log.error(error, { operation: 'fetchCoverageAnalysis' });
      console.error('ParseContext fetchCoverageAnalysis error:', error);
      return null;
    }
  }, [queryLogger]);

  // Connection is resolved when we know the final state (success, error, or not configured)
  // This allows components to wait for connection check to complete before making API calls
  const isConnectionReady = connectionStatus === 'connected' ||
                            connectionStatus === 'error' ||
                            connectionStatus === 'not_configured';

  const value = {
    // The Parse SDK instance (use for advanced operations)
    Parse: isInitialized ? Parse : null,

    // Status flags
    isReady,
    isInitialized,
    connectionStatus,
    isConnectionReady, // True when connection check is complete (regardless of result)
    error,

    // Helper functions for common operations
    query,
    getObject,
    runCloud,

    // High-level data fetching (direct Parse queries, bypasses backend)
    fetchMeetings,          // Query meetings with filters
    fetchMeetingsByState,   // Get counts per state for map
    fetchCoverageAnalysis,  // Get coverage analysis by state

    // Configuration info (useful for debugging)
    config: {
      serverUrl: PARSE_SERVER_URL,
      hasAppId: !!PARSE_APP_ID,
      hasJsKey: !!PARSE_JS_KEY,
    }
  };

  return (
    <ParseContext.Provider value={value}>
      {children}
    </ParseContext.Provider>
  );
}

/**
 * Hook to access Parse SDK and helpers
 *
 * @returns {Object} Parse context with SDK instance and helpers
 * @throws {Error} If used outside of ParseProvider
 *
 * @example
 * function MeetingsList() {
 *   const { Parse, isReady, query } = useParse();
 *   const [meetings, setMeetings] = useState([]);
 *
 *   useEffect(() => {
 *     if (!isReady) return;
 *
 *     async function loadMeetings() {
 *       const results = await query('Meetings')
 *         .equalTo('state', 'CA')
 *         .limit(100)
 *         .find();
 *       setMeetings(results.map(m => m.toJSON()));
 *     }
 *     loadMeetings();
 *   }, [isReady, query]);
 *
 *   return <div>{meetings.map(m => <div key={m.objectId}>{m.name}</div>)}</div>;
 * }
 */
export function useParse() {
  const context = useContext(ParseContext);
  if (!context) {
    throw new Error('useParse must be used within a ParseProvider');
  }
  return context;
}

/**
 * Check if Parse SDK is available without using hooks
 * Useful for utility functions outside of React components
 */
export function isParseAvailable() {
  return isInitialized;
}

/**
 * Get the Parse instance directly (for use outside React components)
 * Returns null if not initialized
 */
export function getParseInstance() {
  return isInitialized ? Parse : null;
}

/**
 * Wait for the initial connection test to complete
 * Returns the connection test promise if one is in progress, or null if not
 */
export function waitForConnectionTest() {
  return connectionTestPromise;
}

/**
 * Retry the Parse connection test
 * Useful for recovery after network issues
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function retryConnection() {
  if (!isInitialized) {
    return { success: false, error: 'Parse SDK not initialized' };
  }

  logInit('Retrying Parse connection test...');
  const result = await testParseConnection();

  if (result.success) {
    initialConnectionStatus = 'connected';
    lastConnectionError = null;
  } else {
    initialConnectionStatus = 'error';
    lastConnectionError = result.error;
  }

  return result;
}

/**
 * Get frontend initialization log for diagnostics
 */
export function getFrontendInitLog() {
  return {
    log: [...frontendInitLog],
    state: {
      isInitialized,
      connectionStatus: initialConnectionStatus,
      error: initializationError?.message || null,
      lastConnectionError: lastConnectionError,
      config: {
        hasAppId: !!PARSE_APP_ID,
        hasJsKey: !!PARSE_JS_KEY,
        serverUrl: PARSE_SERVER_URL,
        appIdPrefix: PARSE_APP_ID ? PARSE_APP_ID.substring(0, 8) + '...' : null,
        jsKeyPrefix: PARSE_JS_KEY ? PARSE_JS_KEY.substring(0, 8) + '...' : null,
      }
    }
  };
}

export default ParseContext;
