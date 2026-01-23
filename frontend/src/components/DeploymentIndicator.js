import React, { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const RENDER_DASHBOARD_URL = process.env.REACT_APP_RENDER_DASHBOARD_URL || 'https://dashboard.render.com';

/**
 * Simple deployment indicator - no polling loops.
 *
 * Philosophy: If the page loaded, we're connected. Only show indicator when
 * we detect a new version is available (via a single periodic check).
 *
 * No complex failure thresholds, no fast/slow intervals, no deployment detection.
 */
function DeploymentIndicator() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersionRef = useRef(null);

  // Single check on mount to capture initial version, then one periodic check
  useEffect(() => {
    let timeoutId = null;

    const checkVersion = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${BACKEND_URL}/api/version`, {
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();

          if (!initialVersionRef.current) {
            // First check - just store the version
            initialVersionRef.current = data.version;
          } else if (data.version !== initialVersionRef.current) {
            // New version detected
            setUpdateAvailable(true);
            setTimeout(() => window.location.reload(), 3000);
          }
        }
      } catch {
        // Silently ignore errors - no need to show deployment indicator
        // If the backend is down, other parts of the app will handle it
      }
    };

    // Initial check
    checkVersion();

    // Single periodic check every 60 seconds (not aggressive polling)
    const intervalId = setInterval(checkVersion, 60000);

    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Only show when update is available
  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="deployment-indicator">
      <div className="deployment-indicator-header">
        <div className="deployment-indicator-spinner"></div>
        <span className="deployment-indicator-title">Update available</span>
        <span className="deployment-indicator-time">Refreshing...</span>
      </div>
    </div>
  );
}

export default DeploymentIndicator;
