import React, { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const CHECK_INTERVAL = 5000; // Check every 5 seconds
const FAILURE_THRESHOLD = 3; // Number of consecutive failures before showing deploying

function DeploymentIndicator() {
  const [backendStatus, setBackendStatus] = useState('stable'); // 'stable', 'deploying', 'updating'
  const [frontendStatus, setFrontendStatus] = useState('stable'); // 'stable', 'updating'
  const [expanded, setExpanded] = useState(false);

  const initialBackendVersionRef = useRef(null);
  const initialFrontendVersionRef = useRef(null);
  const backendFailsRef = useRef(0);
  const frontendFailsRef = useRef(0);

  // Check backend status
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${BACKEND_URL}/api/version`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          backendFailsRef.current = 0;

          if (!initialBackendVersionRef.current) {
            initialBackendVersionRef.current = data.version;
            setBackendStatus('stable');
            return;
          }

          if (data.version !== initialBackendVersionRef.current) {
            setBackendStatus('updating');
            // Auto-refresh after a short delay to load new version
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          } else {
            // Backend is responding and version matches - always reset to stable
            setBackendStatus('stable');
          }
        } else {
          handleBackendFailure();
        }
      } catch (error) {
        handleBackendFailure();
      }
    };

    const handleBackendFailure = () => {
      backendFailsRef.current += 1;
      if (backendFailsRef.current >= FAILURE_THRESHOLD && initialBackendVersionRef.current) {
        setBackendStatus('deploying');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []); // Remove backendStatus from deps to avoid stale closures

  // Check frontend status
  useEffect(() => {
    const checkFrontend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Add cache-busting to always get fresh version
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          signal: controller.signal,
          cache: 'no-store'
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          frontendFailsRef.current = 0;

          if (!initialFrontendVersionRef.current) {
            initialFrontendVersionRef.current = data.buildTime;
            setFrontendStatus('stable');
            return;
          }

          if (data.buildTime !== initialFrontendVersionRef.current) {
            setFrontendStatus('updating');
            // A new frontend is available - refresh to get it
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          } else {
            // Frontend is responding and version matches - always reset to stable
            setFrontendStatus('stable');
          }
        } else {
          // Frontend version check failed - might be deploying
          frontendFailsRef.current += 1;
          if (frontendFailsRef.current >= FAILURE_THRESHOLD && initialFrontendVersionRef.current) {
            setFrontendStatus('updating');
          }
        }
      } catch (error) {
        frontendFailsRef.current += 1;
        if (frontendFailsRef.current >= FAILURE_THRESHOLD && initialFrontendVersionRef.current) {
          setFrontendStatus('updating');
        }
      }
    };

    checkFrontend();
    const interval = setInterval(checkFrontend, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []); // Remove frontendStatus from deps to avoid stale closures

  const isDeploying = backendStatus !== 'stable' || frontendStatus !== 'stable';

  if (!isDeploying) {
    return null;
  }

  const getStatusIcon = (status) => {
    if (status === 'deploying') return '🔄';
    if (status === 'updating') return '✨';
    return '✓';
  };

  const getStatusText = (type, status) => {
    if (status === 'deploying') return `${type} deploying...`;
    if (status === 'updating') return `${type} update ready`;
    return `${type} stable`;
  };

  return (
    <div
      className={`deployment-indicator ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="deployment-indicator-header">
        <div className="deployment-indicator-spinner"></div>
        <span className="deployment-indicator-title">Deployment in progress</span>
        <span className="deployment-indicator-expand">{expanded ? '▼' : '▲'}</span>
      </div>

      {expanded && (
        <div className="deployment-indicator-details">
          <div className={`deployment-status-row ${backendStatus}`}>
            <span className="status-icon">{getStatusIcon(backendStatus)}</span>
            <span className="status-text">{getStatusText('Backend', backendStatus)}</span>
          </div>
          <div className={`deployment-status-row ${frontendStatus}`}>
            <span className="status-icon">{getStatusIcon(frontendStatus)}</span>
            <span className="status-text">{getStatusText('Frontend', frontendStatus)}</span>
          </div>
          <div className="deployment-indicator-note">
            Page will refresh when ready
          </div>
        </div>
      )}
    </div>
  );
}

export default DeploymentIndicator;
