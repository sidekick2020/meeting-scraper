import React, { useEffect, useRef } from 'react';
import { useParse } from '../contexts/ParseContext';

function LoadingOverlay({ onReady }) {
  const { isInitialized, connectionStatus, isConnectionReady, config, error } = useParse();
  const hasCalledOnReady = useRef(false);

  // Build logs based on current state (no async connection test needed)
  const logs = [];
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  logs.push({ timestamp, message: 'Initializing application...', type: 'info' });

  if (!config.hasAppId || !config.hasJsKey) {
    logs.push({ timestamp, message: 'Parse SDK not configured - using backend API proxy', type: 'warning' });
  } else if (isInitialized) {
    logs.push({ timestamp, message: 'Parse SDK initialized', type: 'success' });
  }

  if (connectionStatus === 'connected') {
    logs.push({ timestamp, message: 'Application ready', type: 'success' });
  } else if (connectionStatus === 'error') {
    logs.push({ timestamp, message: 'Parse initialization failed', type: 'error' });
    if (error) {
      logs.push({ timestamp, message: `Error: ${error.message}`, type: 'error' });
    }
    logs.push({ timestamp, message: 'Falling back to backend API proxy', type: 'warning' });
  } else if (connectionStatus === 'not_configured') {
    logs.push({ timestamp, message: 'Application ready', type: 'success' });
  }

  // Call onReady once when connection is ready
  useEffect(() => {
    if (isConnectionReady && onReady && !hasCalledOnReady.current) {
      hasCalledOnReady.current = true;
      onReady();
    }
  }, [isConnectionReady, onReady]);

  const getLogIcon = (type) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return '›';
    }
  };

  const isLoading = !isConnectionReady;
  const hasError = connectionStatus === 'error' && !isInitialized;

  return (
    <div className="loading-overlay">
      <div className="loading-overlay-backdrop"></div>
      <div className="loading-overlay-content">
        <div className="loading-overlay-spinner-container">
          {isLoading && <div className="loading-spinner"></div>}
          <h2 className="loading-overlay-title">
            {hasError
              ? 'Initialization Error'
              : isLoading
                ? 'Initializing...'
                : 'Ready'}
          </h2>
        </div>

        <div className="loading-overlay-logs">
          {logs.map((log, index) => (
            <div key={index} className={`loading-log-entry loading-log-${log.type}`}>
              <span className="loading-log-timestamp">{log.timestamp}</span>
              <span className="loading-log-icon">{getLogIcon(log.type)}</span>
              <span className="loading-log-message">{log.message}</span>
            </div>
          ))}
          {isLoading && (
            <div className="loading-log-entry loading-log-pending">
              <span className="loading-log-timestamp">
                {new Date().toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
              <span className="loading-log-icon loading-log-spinner"></span>
              <span className="loading-log-message">...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoadingOverlay;
