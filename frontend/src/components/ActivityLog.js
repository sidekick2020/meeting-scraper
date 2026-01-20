import React, { useEffect, useRef, useState } from 'react';

function ActivityLog({ logs, currentMeeting }) {
  const containerRef = useRef(null);
  const [errorsOnly, setErrorsOnly] = useState(false);

  // Auto-scroll log container (not page) to bottom when new logs arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  };

  if (!logs || logs.length === 0) {
    return (
      <div className="activity-log">
        <h3>Activity Log</h3>
        {currentMeeting && (
          <div className="current-meeting-banner">
            <span className="processing-indicator"></span>
            <span className="current-meeting-text">
              Processing: <strong>{currentMeeting.name}</strong>
              {currentMeeting.city && ` (${currentMeeting.city})`}
              <span className="current-meeting-progress">
                {currentMeeting.index} of {currentMeeting.total}
              </span>
            </span>
          </div>
        )}
        <div className="activity-log-empty">
          No activity yet. Start scraping to see real-time updates.
        </div>
      </div>
    );
  }

  // Reverse to show newest at bottom (for natural scroll)
  const sortedLogs = [...logs].reverse();

  // Filter logs if errorsOnly is enabled
  const filteredLogs = errorsOnly
    ? sortedLogs.filter(log => log.level === 'error')
    : sortedLogs;

  const errorCount = logs.filter(log => log.level === 'error').length;

  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <h3>Activity Log</h3>
        <label className="errors-only-toggle">
          <input
            type="checkbox"
            checked={errorsOnly}
            onChange={(e) => setErrorsOnly(e.target.checked)}
          />
          <span>Errors only {errorCount > 0 && `(${errorCount})`}</span>
        </label>
      </div>
      {currentMeeting && (
        <div className="current-meeting-banner">
          <span className="processing-indicator"></span>
          <span className="current-meeting-text">
            Processing: <strong>{currentMeeting.name}</strong>
            {currentMeeting.city && ` (${currentMeeting.city})`}
            <span className="current-meeting-progress">
              {currentMeeting.index} of {currentMeeting.total}
            </span>
          </span>
        </div>
      )}
      <div className="activity-log-container" ref={containerRef}>
        {filteredLogs.length === 0 && errorsOnly ? (
          <div className="activity-log-empty">No errors logged.</div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className={`log-entry log-${log.level}`}>
              <span className="log-icon">{getLevelIcon(log.level)}</span>
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ActivityLog;
