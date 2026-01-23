import React, { createContext, useContext, useState, useCallback } from 'react';
import Parse from 'parse';

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
    initialConnectionStatus = 'connected';
    logInit('Parse SDK initialized successfully', 'success');
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
logInit(`Initialization complete. Status: ${initialConnectionStatus}`);

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
  const [error] = useState(initializationError);
  // Connection status is determined synchronously at initialization - no async test needed
  const [connectionStatus] = useState(initialConnectionStatus);

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
 * Get frontend initialization log for diagnostics
 */
export function getFrontendInitLog() {
  return {
    log: [...frontendInitLog],
    state: {
      isInitialized,
      connectionStatus: initialConnectionStatus,
      error: initializationError?.message || null,
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
