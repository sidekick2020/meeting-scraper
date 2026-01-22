import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Connection config - longer timeout for cold starts on free tier hosting
const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds for cold start
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff: 2s, 4s, 8s

function LoadingOverlay({ onReady }) {
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [retryCount, setRetryCount] = useState(0);

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  const attemptConnection = useCallback(async (attempt = 0) => {
    try {
      const configResponse = await fetch(`${BACKEND_URL}/api/config`, {
        method: 'GET',
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT_MS)
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
        return true;
      } else {
        throw new Error(`Backend returned status ${configResponse.status}`);
      }
    } catch (error) {
      // If we have retries left, try again
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        const nextAttempt = attempt + 1;

        if (error.name === 'TimeoutError') {
          addLog(`Backend slow to respond (cold start?) - retrying in ${delay / 1000}s...`, 'warning');
        } else {
          addLog(`Connection failed - retrying in ${delay / 1000}s... (${error.name})`, 'warning');
        }

        setRetryCount(nextAttempt);

        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptConnection(nextAttempt);
      }

      // No more retries - show error
      const url = `${BACKEND_URL}/api/config`;
      addLog(`URL: ${url || '(empty - using relative)'}`, 'error');
      addLog(`Error: ${error.name}: ${error.message}`, 'error');
      addLog(`Failed after ${MAX_RETRIES + 1} attempts`, 'error');

      setConnectionStatus('error');
      return false;
    }
  }, [addLog, onReady]);

  const checkBackendConnection = useCallback(async () => {
    setLogs([]);
    setConnectionStatus('connecting');
    setRetryCount(0);

    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs([{ timestamp, message: 'Initializing application...', type: 'info' }]);

    addLog('Connecting to backend (may take 30s on cold start)...', 'info');

    await attemptConnection(0);
  }, [addLog, attemptConnection]);

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
            {connectionStatus === 'error'
              ? 'Connection Failed'
              : retryCount > 0
                ? `Connecting to Backend (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`
                : 'Connecting to Backend'}
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
