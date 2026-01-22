import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function LoadingOverlay({ onReady }) {
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  const checkBackendConnection = useCallback(async () => {
    setLogs([]);
    setConnectionStatus('connecting');

    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs([{ timestamp, message: 'Initializing application...', type: 'info' }]);

    try {
      // Single check - verify backend is up and get config status
      const configResponse = await fetch(`${BACKEND_URL}/api/config`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (configResponse.ok) {
        const configData = await configResponse.json();
        if (configData.configured) {
          addLog('Parse keys configured', 'success');
        } else {
          addLog('Parse keys not configured - setup required', 'warning');
        }

        addLog('Application ready', 'success');
        setConnectionStatus('ready');

        if (onReady) {
          onReady();
        }
      } else {
        throw new Error(`Backend returned status ${configResponse.status}`);
      }
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        addLog('Connection timed out', 'error');
      } else if (error.message.includes('fetch')) {
        addLog('Unable to reach backend server', 'error');
      } else {
        addLog(`Connection error: ${error.message}`, 'error');
      }

      setConnectionStatus('error');
    }
  }, [addLog, onReady]);

  useEffect(() => {
    checkBackendConnection();
  }, [checkBackendConnection]);

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

  return (
    <div className="loading-overlay">
      <div className="loading-overlay-backdrop"></div>
      <div className="loading-overlay-content">
        <div className="loading-overlay-spinner-container">
          <div className="loading-spinner"></div>
          <h2 className="loading-overlay-title">
            {connectionStatus === 'error' ? 'Connection Failed' : 'Connecting to Backend'}
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
          {connectionStatus === 'connecting' && (
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
        {connectionStatus === 'error' && (
          <button className="loading-retry-button" onClick={checkBackendConnection}>
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
}

export default LoadingOverlay;
