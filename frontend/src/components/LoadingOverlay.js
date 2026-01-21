import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function LoadingOverlay({ onReady }) {
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('initializing'); // initializing, connecting, checking_api, ready, error

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkBackendConnection = async () => {
      addLog('Initializing application...', 'info');

      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!mounted) return;

      addLog('Checking backend connection...', 'info');
      setConnectionStatus('connecting');

      try {
        // First, check if backend is reachable
        const statusResponse = await fetch(`${BACKEND_URL}/api/status`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000)
        });

        if (!mounted) return;

        if (statusResponse.ok) {
          addLog('Backend connection established', 'success');

          // Check API version
          setConnectionStatus('checking_api');
          addLog('Verifying API status...', 'info');

          const versionResponse = await fetch(`${BACKEND_URL}/api/version`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });

          if (!mounted) return;

          if (versionResponse.ok) {
            const versionData = await versionResponse.json();
            addLog(`API version: ${versionData.version || 'unknown'}`, 'success');
          }

          // Check configuration
          addLog('Checking database configuration...', 'info');
          const configResponse = await fetch(`${BACKEND_URL}/api/config`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });

          if (!mounted) return;

          if (configResponse.ok) {
            const configData = await configResponse.json();
            if (configData.configured) {
              addLog('Database configured and ready', 'success');
            } else {
              addLog('Database not configured - some features may be limited', 'warning');
            }
          }

          addLog('Application ready', 'success');
          setConnectionStatus('ready');

          // Small delay to show the success message before transitioning
          await new Promise(resolve => setTimeout(resolve, 500));

          if (mounted && onReady) {
            onReady();
          }
        } else {
          throw new Error(`Backend returned status ${statusResponse.status}`);
        }
      } catch (error) {
        if (!mounted) return;

        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          addLog('Connection timed out - backend may be starting up', 'warning');
        } else if (error.message.includes('fetch')) {
          addLog('Unable to reach backend server', 'error');
        } else {
          addLog(`Connection error: ${error.message}`, 'error');
        }

        setConnectionStatus('error');
        addLog('Retrying connection in 3 seconds...', 'info');

        // Retry after delay
        setTimeout(() => {
          if (mounted) {
            setLogs([]);
            checkBackendConnection();
          }
        }, 3000);
      }
    };

    checkBackendConnection();

    return () => {
      mounted = false;
    };
  }, [addLog, onReady]);

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
          {connectionStatus !== 'ready' && connectionStatus !== 'error' && (
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
