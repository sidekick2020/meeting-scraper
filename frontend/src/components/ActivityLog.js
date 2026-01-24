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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getLevelIndicator = (level) => {
    const indicators = {
      error: 'log-dot-error',
      warning: 'log-dot-warning',
      success: 'log-dot-success',
      info: 'log-dot-info'
    };
    return indicators[level] || indicators.info;
  };

  // Reverse to show newest at bottom (for natural scroll)
  const sortedLogs = logs ? [...logs].reverse() : [];

  // Filter logs if errorsOnly is enabled
  const filteredLogs = errorsOnly
    ? sortedLogs.filter(log => log.level === 'error' || log.level === 'warning')
    : sortedLogs;

  const errorCount = logs ? logs.filter(log => log.level === 'error' || log.level === 'warning').length : 0;

  return (
    <div className="activity-log-compact">
      <div className="log-header">
        <span className="log-title">Activity</span>
        {errorCount > 0 && (
          <button
            className={`log-filter-btn ${errorsOnly ? 'active' : ''}`}
            onClick={() => setErrorsOnly(!errorsOnly)}
          >
            {errorCount} issue{errorCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>
      <div className="log-scroll" ref={containerRef}>
        {filteredLogs.length === 0 ? (
          <div className="log-empty">
            {errorsOnly ? 'No issues' : 'Waiting for activity...'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className={`log-row log-level-${log.level}`}>
              <span className={`log-dot ${getLevelIndicator(log.level)}`} />
              <span className="log-timestamp">{formatTime(log.timestamp)}</span>
              <span className="log-text">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ActivityLog;
