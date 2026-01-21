import React, { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const RENDER_DASHBOARD_URL = process.env.REACT_APP_RENDER_DASHBOARD_URL || 'https://dashboard.render.com';
const CHECK_INTERVAL = 5000; // Check every 5 seconds
const FAILURE_THRESHOLD = 3; // Number of consecutive failures before showing deploying
const TYPICAL_DEPLOY_TIME = 120; // Typical deployment takes ~2 minutes

function DeploymentIndicator() {
  const [backendStatus, setBackendStatus] = useState('stable'); // 'stable', 'deploying', 'updating'
  const [frontendStatus, setFrontendStatus] = useState('stable'); // 'stable', 'updating'
  const [expanded, setExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTask, setCurrentTask] = useState('Monitoring services...');

  const initialBackendVersionRef = useRef(null);
  const initialFrontendVersionRef = useRef(null);
  const backendFailsRef = useRef(0);
  const frontendFailsRef = useRef(0);
  const deployStartTimeRef = useRef(null);

  // Track elapsed time when deploying
  useEffect(() => {
    const isDeploying = backendStatus !== 'stable' || frontendStatus !== 'stable';

    if (isDeploying && !deployStartTimeRef.current) {
      deployStartTimeRef.current = Date.now();
    } else if (!isDeploying) {
      deployStartTimeRef.current = null;
      setElapsedTime(0);
    }

    if (isDeploying) {
      const timer = setInterval(() => {
        if (deployStartTimeRef.current) {
          setElapsedTime(Math.floor((Date.now() - deployStartTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [backendStatus, frontendStatus]);

  // Update current task based on status
  useEffect(() => {
    if (backendStatus === 'deploying') {
      setCurrentTask('Waiting for backend to restart...');
    } else if (backendStatus === 'updating') {
      setCurrentTask('New backend version detected, refreshing...');
    } else if (frontendStatus === 'updating') {
      setCurrentTask('New frontend version detected, refreshing...');
    } else if (backendStatus === 'stable' && frontendStatus === 'stable') {
      setCurrentTask('All services stable');
    } else {
      setCurrentTask('Checking deployment status...');
    }
  }, [backendStatus, frontendStatus]);

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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getProgress = () => {
    // Estimate progress based on typical deploy time
    const progress = Math.min((elapsedTime / TYPICAL_DEPLOY_TIME) * 100, 95);
    return Math.round(progress);
  };

  const getEstimatedRemaining = () => {
    const remaining = Math.max(TYPICAL_DEPLOY_TIME - elapsedTime, 5);
    return formatTime(remaining);
  };

  return (
    <div
      className={`deployment-indicator ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="deployment-indicator-header">
        <div className="deployment-indicator-spinner"></div>
        <span className="deployment-indicator-title">Deployment in progress</span>
        <span className="deployment-indicator-time">{formatTime(elapsedTime)}</span>
        <span className="deployment-indicator-expand">{expanded ? '▼' : '▲'}</span>
      </div>

      {expanded && (
        <div className="deployment-indicator-details">
          {/* Current Task */}
          <div className="deployment-current-task">
            <span className="task-label">Current:</span>
            <span className="task-name">{currentTask}</span>
          </div>

          {/* Progress Bar */}
          <div className="deployment-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${getProgress()}%` }}
              ></div>
            </div>
            <span className="progress-text">{getProgress()}%</span>
          </div>

          {/* Service Status */}
          <div className={`deployment-status-row ${backendStatus}`}>
            <span className="status-icon">{getStatusIcon(backendStatus)}</span>
            <span className="status-text">{getStatusText('Backend', backendStatus)}</span>
          </div>
          <div className={`deployment-status-row ${frontendStatus}`}>
            <span className="status-icon">{getStatusIcon(frontendStatus)}</span>
            <span className="status-text">{getStatusText('Frontend', frontendStatus)}</span>
          </div>

          {/* Estimated Time */}
          <div className="deployment-indicator-note">
            ~{getEstimatedRemaining()} remaining • Page will refresh when ready
          </div>

          {/* Build Logs Link */}
          <a
            href={RENDER_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="deployment-logs-link"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View build logs in Render
          </a>
        </div>
      )}
    </div>
  );
}

export default DeploymentIndicator;
