import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Parse from 'parse';

const ParseContext = createContext(null);

// Parse configuration from environment variables
const PARSE_APP_ID = process.env.REACT_APP_BACK4APP_APP_ID;
const PARSE_JS_KEY = process.env.REACT_APP_BACK4APP_JS_KEY;
const PARSE_SERVER_URL = process.env.REACT_APP_PARSE_SERVER_URL || 'https://parseapi.back4app.com';

/**
 * Initialize Parse SDK synchronously at module load time.
 * This is the recommended approach - initialize ONCE before any React components render.
 *
 * Benefits:
 * - Parse is ready immediately when components mount
 * - No race conditions with useEffect-based initialization
 * - Queries can be made from the first render
 * - Connection is established early, reducing perceived latency
 */
let isInitialized = false;
let initializationError = null;

function initializeParse() {
  if (isInitialized) return true;

  if (!PARSE_APP_ID || !PARSE_JS_KEY) {
    console.warn(
      'Parse SDK not initialized: Missing REACT_APP_BACK4APP_APP_ID or REACT_APP_BACK4APP_JS_KEY environment variables. ' +
      'The app will continue to work via the backend API proxy.'
    );
    initializationError = new Error('Missing Parse configuration');
    return false;
  }

  try {
    Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
    Parse.serverURL = PARSE_SERVER_URL;

    // Enable local datastore for offline caching (optional but recommended)
    Parse.enableLocalDatastore();

    isInitialized = true;
    console.log('Parse SDK initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Parse SDK:', error);
    initializationError = error;
    return false;
  }
}

// Initialize immediately when this module is imported
// This ensures Parse is ready before any React component mounts
initializeParse();

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
  const [isReady, setIsReady] = useState(isInitialized);
  const [error, setError] = useState(initializationError);
  const [connectionStatus, setConnectionStatus] = useState('unknown');

  // Test connection on mount
  useEffect(() => {
    if (!isInitialized) {
      setConnectionStatus('not_configured');
      return;
    }

    async function testConnection() {
      try {
        setConnectionStatus('connecting');
        // Simple health check - query with limit 0 to minimize data transfer
        const query = new Parse.Query('Meetings');
        query.limit(0);
        await query.count();
        setConnectionStatus('connected');
      } catch (err) {
        console.warn('Parse connection test failed:', err.message);
        setConnectionStatus('error');
        // Don't set error state here - Parse might still work for some operations
      }
    }

    testConnection();
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

  const value = {
    // The Parse SDK instance (use for advanced operations)
    Parse: isInitialized ? Parse : null,

    // Status flags
    isReady,
    isInitialized,
    connectionStatus,
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

export default ParseContext;
