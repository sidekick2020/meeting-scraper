import React, { useState, useEffect, useRef, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

/**
 * User-friendly deployment indicator for the public site.
 *
 * States:
 * - 'stable': Backend is up, no changes detected (hidden)
 * - 'deploying': Backend is down, deployment likely in progress (visible)
 * - 'ready': New version detected, about to refresh (visible)
 *
 * Features:
 * - Shows friendly message when deployment is in progress
 * - Automatically refreshes when new version is available
 * - Non-intrusive bottom banner design
 * - Adaptive polling: slower when stable, faster during deployment
 */
function DeploymentIndicator() {
  const [state, setState] = useState('stable'); // 'stable', 'deploying', 'ready'
  const [countdown, setCountdown] = useState(null);
  const initialVersionRef = useRef(null);
  const consecutiveFailsRef = useRef(0);
  const deploymentStartTimeRef = useRef(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const handleFailure = useCallback(() => {
    consecutiveFailsRef.current += 1;

    // After 2 consecutive failures (~10-20 seconds), show deploying state
    // Only if we've seen a successful connection before (initialVersionRef is set)
    if (consecutiveFailsRef.current >= 2 && initialVersionRef.current && state !== 'ready') {
      if (state !== 'deploying') {
        deploymentStartTimeRef.current = Date.now();
      }
      setState('deploying');
    }
  }, [state]);

  const checkVersion = useCallback(async () => {
    try {
      const controller = new AbortController();
      // 10 second timeout (shorter during deployment checks)
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${BACKEND_URL}/api/version`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        consecutiveFailsRef.current = 0;

        if (!initialVersionRef.current) {
          // First successful check - store initial version
          initialVersionRef.current = data.version;
          return;
        }

        if (data.version !== initialVersionRef.current) {
          // New version detected! Show ready state and refresh
          setState('ready');
          deploymentStartTimeRef.current = null;
          setCountdown(3);
        } else if (state === 'deploying') {
          // Backend is back up but same version (false alarm or rollback)
          setState('stable');
          deploymentStartTimeRef.current = null;
        }
      } else {
        handleFailure();
      }
    } catch {
      handleFailure();
    }
  }, [state, handleFailure]);

  // Main polling effect
  useEffect(() => {
    // Initial check
    checkVersion();

    // Adaptive polling: faster during deployment, slower when stable
    const getInterval = () => {
      if (state === 'deploying') return 5000;  // 5 seconds during deployment
      if (state === 'ready') return null;       // Stop polling when ready
      return 60000;                             // 60 seconds when stable
    };

    const interval = getInterval();
    if (!interval) return;

    const intervalId = setInterval(checkVersion, interval);
    return () => clearInterval(intervalId);
  }, [state, checkVersion]);

  // Countdown effect for auto-refresh
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      window.location.reload();
      return;
    }

    const timeoutId = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [countdown]);

  // Elapsed time tracker during deployment
  useEffect(() => {
    if (state !== 'deploying' || !deploymentStartTimeRef.current) {
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedTime(Math.floor((Date.now() - deploymentStartTimeRef.current) / 1000));
    };

    updateElapsed();
    const intervalId = setInterval(updateElapsed, 1000);
    return () => clearInterval(intervalId);
  }, [state]);

  // Don't show anything when stable
  if (state === 'stable') {
    return null;
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className={`deployment-public-indicator ${state}`}>
      <div className="deployment-public-content">
        {state === 'deploying' && (
          <>
            <div className="deployment-public-spinner" />
            <div className="deployment-public-text">
              <span className="deployment-public-title">Updating...</span>
              <span className="deployment-public-subtitle">
                A new version is being deployed. This usually takes 1-2 minutes.
                {elapsedTime > 0 && <span className="deployment-public-elapsed"> ({formatTime(elapsedTime)})</span>}
              </span>
            </div>
          </>
        )}
        {state === 'ready' && (
          <>
            <div className="deployment-public-check">✓</div>
            <div className="deployment-public-text">
              <span className="deployment-public-title">Update complete!</span>
              <span className="deployment-public-subtitle">
                Refreshing in {countdown}...
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DeploymentIndicator;
