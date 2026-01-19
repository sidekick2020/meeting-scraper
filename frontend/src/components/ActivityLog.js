import React, { useEffect, useRef } from 'react';

function ActivityLog({ logs }) {
  const containerRef = useRef(null);

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
        <div className="activity-log-empty">
          No activity yet. Start scraping to see real-time updates.
        </div>
      </div>
    );
  }

  // Reverse to show newest at bottom (for natural scroll)
  const sortedLogs = [...logs].reverse();

  return (
    <div className="activity-log">
      <h3>Activity Log</h3>
      <div className="activity-log-container" ref={containerRef}>
        {sortedLogs.map((log, index) => (
          <div key={index} className={`log-entry log-${log.level}`}>
            <span className="log-icon">{getLevelIcon(log.level)}</span>
            <span className="log-time">{formatTime(log.timestamp)}</span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityLog;
