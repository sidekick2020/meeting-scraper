import React, { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function DeploymentBanner() {
  const [deploymentState, setDeploymentState] = useState('stable'); // 'stable', 'deploying', 'restarting'
  const [message, setMessage] = useState('');
  const initialVersionRef = useRef(null);
  const consecutiveFailsRef = useRef(0);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/version`, { timeout: 5000 });

        if (response.ok) {
          const data = await response.json();
          consecutiveFailsRef.current = 0;

          // Store initial version on first successful response
          if (!initialVersionRef.current) {
            initialVersionRef.current = data.version;
            setDeploymentState('stable');
            return;
          }

          // Check if version changed (new deployment completed)
          if (data.version !== initialVersionRef.current) {
            setDeploymentState('restarting');
            setMessage('New version deployed! Refreshing...');
            // Auto-refresh after showing message
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else if (deploymentState !== 'stable') {
            // Backend is back up with same version
            setDeploymentState('stable');
          }
        } else {
          handleConnectionFailure();
        }
      } catch (error) {
        handleConnectionFailure();
      }
    };

    const handleConnectionFailure = () => {
      consecutiveFailsRef.current += 1;

      // After 3 consecutive failures (6 seconds), show deploying banner
      if (consecutiveFailsRef.current >= 3 && initialVersionRef.current) {
        setDeploymentState('deploying');
        setMessage('Deployment in progress... The app will refresh when ready.');
      }
    };

    // Check version every 2 seconds
    checkVersion();
    const interval = setInterval(checkVersion, 2000);

    return () => clearInterval(interval);
  }, [deploymentState]);

  if (deploymentState === 'stable') {
    return null;
  }

  return (
    <div className={`deployment-banner ${deploymentState}`}>
      <div className="deployment-content">
        <div className="deployment-spinner"></div>
        <span>{message}</span>
      </div>
    </div>
  );
}

export default DeploymentBanner;
