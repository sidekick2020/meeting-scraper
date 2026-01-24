import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ParseQueryLoggerContext = createContext(null);

// Maximum number of log entries to keep
const MAX_LOG_ENTRIES = 100;

/**
 * Parse Query Logger Provider
 *
 * Captures and stores detailed logs of all Parse queries for debugging.
 * Each log entry includes:
 * - Caller information (function name, code location)
 * - Query parameters
 * - Results (count, sample data)
 * - Errors with full details
 * - Timing information
 */
export function ParseQueryLoggerProvider({ children }) {
  const [logs, setLogs] = useState([]);
  const logIdRef = useRef(0);

  /**
   * Get a stack trace snippet to identify the caller
   */
  const getCallerInfo = useCallback(() => {
    const stack = new Error().stack;
    if (!stack) return { caller: 'Unknown', codeSnippet: '' };

    const lines = stack.split('\n');
    // Skip first 3 lines (Error, getCallerInfo, logQuery)
    // Find first line that's not from this file or ParseContext
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      if (line &&
          !line.includes('ParseQueryLoggerContext') &&
          !line.includes('ParseContext') &&
          !line.includes('node_modules')) {
        // Extract function name and location
        const match = line.match(/at\s+(\S+)\s+\(([^)]+)\)/) ||
                      line.match(/at\s+([^(]+)\s*$/);
        if (match) {
          return {
            caller: match[1] || 'Anonymous',
            codeSnippet: line.trim()
          };
        }
      }
    }

    // Fallback: return the first meaningful line
    const fallbackLine = lines[3] || lines[2] || '';
    return {
      caller: 'Unknown',
      codeSnippet: fallbackLine.trim()
    };
  }, []);

  /**
   * Log a Parse query
   * @param {Object} options - Query log options
   * @param {string} options.operation - Operation type (e.g., 'fetchMeetings', 'query.find')
   * @param {string} options.className - Parse class being queried
   * @param {Object} options.params - Query parameters
   * @param {string} options.step - Current step description
   * @returns {Function} - Function to complete the log with results
   */
  const logQuery = useCallback((options) => {
    const { operation, className, params, step } = options;
    const startTime = Date.now();
    const callerInfo = getCallerInfo();
    const queryId = ++logIdRef.current;

    const logEntry = {
      id: queryId,
      timestamp: new Date().toISOString(),
      operation,
      className,
      params: JSON.parse(JSON.stringify(params || {})), // Deep clone
      step,
      caller: callerInfo.caller,
      codeSnippet: callerInfo.codeSnippet,
      status: 'pending',
      startTime,
      duration: null,
      resultCount: null,
      resultSample: null,
      error: null,
      errorDetails: null
    };

    // Add the pending entry
    setLogs(prev => [logEntry, ...prev].slice(0, MAX_LOG_ENTRIES));

    // Return a function to complete the log
    return {
      /**
       * Mark the query as successful
       * @param {Object} result - Query result
       * @param {number} result.count - Number of results
       * @param {Array} result.data - Sample data (first few items)
       */
      success: (result) => {
        const duration = Date.now() - startTime;
        setLogs(prev => prev.map(log =>
          log.id === queryId
            ? {
                ...log,
                status: 'success',
                duration,
                resultCount: result?.count ?? 0,
                resultSample: result?.data?.slice(0, 3) || null, // Keep first 3 for sample
                fullResult: result?.data || null
              }
            : log
        ));
      },

      /**
       * Mark the query as failed
       * @param {Error|string} error - The error that occurred
       * @param {Object} details - Additional error details
       */
      error: (error, details = {}) => {
        const duration = Date.now() - startTime;
        const errorMessage = error?.message || String(error);
        const errorStack = error?.stack || '';

        setLogs(prev => prev.map(log =>
          log.id === queryId
            ? {
                ...log,
                status: 'error',
                duration,
                error: errorMessage,
                errorDetails: {
                  code: error?.code,
                  stack: errorStack,
                  ...details
                }
              }
            : log
        ));
      },

      /**
       * Update the step description
       * @param {string} newStep - New step description
       */
      updateStep: (newStep) => {
        setLogs(prev => prev.map(log =>
          log.id === queryId
            ? { ...log, step: newStep }
            : log
        ));
      }
    };
  }, [getCallerInfo]);

  /**
   * Add an info/debug log entry (not tied to a query)
   */
  const logInfo = useCallback((message, details = {}) => {
    const callerInfo = getCallerInfo();
    const logEntry = {
      id: ++logIdRef.current,
      timestamp: new Date().toISOString(),
      operation: 'info',
      className: null,
      params: details,
      step: message,
      caller: callerInfo.caller,
      codeSnippet: callerInfo.codeSnippet,
      status: 'info',
      startTime: Date.now(),
      duration: null,
      resultCount: null,
      resultSample: null,
      error: null,
      errorDetails: null
    };

    setLogs(prev => [logEntry, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, [getCallerInfo]);

  /**
   * Add an error log entry (not tied to a query)
   */
  const logError = useCallback((message, error, details = {}) => {
    const callerInfo = getCallerInfo();
    const logEntry = {
      id: ++logIdRef.current,
      timestamp: new Date().toISOString(),
      operation: 'error',
      className: null,
      params: details,
      step: message,
      caller: callerInfo.caller,
      codeSnippet: callerInfo.codeSnippet,
      status: 'error',
      startTime: Date.now(),
      duration: null,
      resultCount: null,
      resultSample: null,
      error: error?.message || String(error),
      errorDetails: {
        code: error?.code,
        stack: error?.stack,
        ...details
      }
    };

    setLogs(prev => [logEntry, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, [getCallerInfo]);

  /**
   * Clear all logs
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  /**
   * Get logs filtered by status
   */
  const getLogsByStatus = useCallback((status) => {
    return logs.filter(log => log.status === status);
  }, [logs]);

  /**
   * Get error count
   */
  const errorCount = logs.filter(log => log.status === 'error').length;

  /**
   * Get pending count
   */
  const pendingCount = logs.filter(log => log.status === 'pending').length;

  const value = {
    logs,
    logQuery,
    logInfo,
    logError,
    clearLogs,
    getLogsByStatus,
    errorCount,
    pendingCount
  };

  return (
    <ParseQueryLoggerContext.Provider value={value}>
      {children}
    </ParseQueryLoggerContext.Provider>
  );
}

/**
 * Hook to access Parse query logger
 */
export function useParseQueryLogger() {
  const context = useContext(ParseQueryLoggerContext);
  if (!context) {
    // Return a no-op logger if not within provider (for backwards compatibility)
    return {
      logs: [],
      logQuery: () => ({ success: () => {}, error: () => {}, updateStep: () => {} }),
      logInfo: () => {},
      logError: () => {},
      clearLogs: () => {},
      getLogsByStatus: () => [],
      errorCount: 0,
      pendingCount: 0
    };
  }
  return context;
}

export default ParseQueryLoggerContext;
