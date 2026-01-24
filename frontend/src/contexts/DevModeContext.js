import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const DevModeContext = createContext(null);

// Determine if we're in development mode based on hostname
const isDevelopmentMode = () => {
  const hostname = window.location.hostname;
  // Production URL - not in development mode
  if (hostname === 'meetings.sobersidekick.com') {
    return false;
  }
  // Render preview URLs, localhost, or any other URL - development mode
  return true;
};

// Global development flag
export const development = isDevelopmentMode();

// Max number of logs to keep
const MAX_LOGS = 100;

export function DevModeProvider({ children }) {
  const [logs, setLogs] = useState([]);
  const [isEnabled, setIsEnabled] = useState(development);
  const logIdRef = useRef(0);
  const originalFetchRef = useRef(null);

  // Add a new log entry
  const addLog = useCallback((entry) => {
    const id = ++logIdRef.current;
    const logEntry = {
      id,
      timestamp: new Date(),
      ...entry
    };

    setLogs(prev => {
      const newLogs = [logEntry, ...prev];
      // Keep only the last MAX_LOGS entries
      return newLogs.slice(0, MAX_LOGS);
    });

    return id;
  }, []);

  // Update an existing log entry (for when response comes back)
  const updateLog = useCallback((id, updates) => {
    setLogs(prev => prev.map(log =>
      log.id === id ? { ...log, ...updates } : log
    ));
  }, []);

  // Clear all logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Intercept fetch calls when in development mode
  useEffect(() => {
    if (!isEnabled) return;

    // Store original fetch if not already stored
    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch;
    }

    const originalFetch = originalFetchRef.current;

    // Create intercepted fetch
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = init.method || 'GET';

      // Only log API requests (skip static assets, etc.)
      const isApiRequest = url.includes('/api/') || url.includes('parseapi.back4app.com');

      if (!isApiRequest) {
        return originalFetch(input, init);
      }

      const startTime = Date.now();
      const logId = addLog({
        url,
        method,
        requestHeaders: init.headers || {},
        requestBody: init.body ? tryParseJson(init.body) : null,
        status: 'pending',
        duration: null,
        response: null,
        error: null
      });

      try {
        const response = await originalFetch(input, init);
        const duration = Date.now() - startTime;

        // Clone response to read body without consuming it
        const clonedResponse = response.clone();
        let responseBody = null;

        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            responseBody = await clonedResponse.json();
          } else {
            responseBody = await clonedResponse.text();
          }
        } catch {
          responseBody = '[Could not parse response body]';
        }

        updateLog(logId, {
          status: response.ok ? 'success' : 'error',
          statusCode: response.status,
          statusText: response.statusText,
          duration,
          response: responseBody,
          responseHeaders: Object.fromEntries(response.headers.entries())
        });

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        updateLog(logId, {
          status: 'error',
          duration,
          error: error.message || 'Network error'
        });

        throw error;
      }
    };

    // Cleanup: restore original fetch
    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, [isEnabled, addLog, updateLog]);

  const value = {
    development: isEnabled,
    logs,
    addLog,
    updateLog,
    clearLogs,
    setIsEnabled
  };

  return (
    <DevModeContext.Provider value={value}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (!context) {
    throw new Error('useDevMode must be used within a DevModeProvider');
  }
  return context;
}

// Helper to try parsing JSON
function tryParseJson(str) {
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export default DevModeContext;
