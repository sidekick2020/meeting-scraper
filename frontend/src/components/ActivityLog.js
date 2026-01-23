import React, { useEffect, useRef, useState } from 'react';

// Clean SVG icons for log entries
const InfoIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SuccessIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 8l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1.5l6.5 12H1.5L8 1.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M8 6v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error': return <ErrorIcon />;
      case 'warning': return <WarningIcon />;
      case 'success': return <SuccessIcon />;
      default: return <InfoIcon />;
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
