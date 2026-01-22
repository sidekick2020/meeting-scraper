import React, { useState, useEffect, useCallback } from 'react';
import { useParse } from '../contexts/ParseContext';

function LoadingOverlay({ onReady }) {
  const [logs, setLogs] = useState([]);
  const { isInitialized, connectionStatus, isConnectionReady, config, error } = useParse();

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  // Initialize logs on mount
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs([{ timestamp, message: 'Initializing application...', type: 'info' }]);

    if (!config.hasAppId || !config.hasJsKey) {
      addLog('Parse SDK not configured - check environment variables', 'warning');
    } else if (isInitialized) {
      addLog('Parse SDK initialized', 'success');
    }
  }, [isInitialized, config.hasAppId, config.hasJsKey, addLog]);

  // Handle connection status changes
  useEffect(() => {
    switch (connectionStatus) {
      case 'connecting':
        addLog('Testing connection to Back4app...', 'info');
        break;
      case 'connected':
        addLog('Connected to Back4app', 'success');
        addLog('Application ready', 'success');
        if (onReady) {
          onReady();
        }
        break;
      case 'error':
        addLog('Connection to Back4app failed', 'error');
        if (error) {
          addLog(`Error: ${error.message}`, 'error');
        }
        // Still call onReady - app can work via backend proxy
        addLog('Falling back to backend API proxy', 'warning');
        if (onReady) {
          onReady();
        }
        break;
      case 'not_configured':
        addLog('Parse not configured - using backend API proxy', 'warning');
        addLog('Application ready', 'success');
        if (onReady) {
          onReady();
        }
        break;
      default:
        break;
    }
  }, [connectionStatus, error, onReady, addLog]);

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
              ? 'Connection Issue'
              : isLoading
                ? 'Connecting to Backend'
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
