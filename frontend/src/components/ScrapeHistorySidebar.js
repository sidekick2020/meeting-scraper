import React, { useState } from 'react';

function ScrapeHistorySidebar({ entry, isOpen, onClose, onViewProgress }) {
  const [expandedFailedSaves, setExpandedFailedSaves] = useState(false);
  const [expandedFailedItem, setExpandedFailedItem] = useState(null);

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (startedAt, completedAt) => {
    if (!startedAt || !completedAt) return 'N/A';
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end - start;
    const diffSec = Math.floor(diffMs / 1000);
    const minutes = Math.floor(diffSec / 60);
    const seconds = diffSec % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const toggleFailedItem = (itemKey) => {
    setExpandedFailedItem(expandedFailedItem === itemKey ? null : itemKey);
  };

  const copyToClipboard = (data) => {
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const handleClose = () => {
    setExpandedFailedSaves(false);
    setExpandedFailedItem(null);
    onClose();
  };

  if (!entry) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`scrape-history-sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={handleClose}
      />

      {/* Sidebar */}
      <div className={`scrape-history-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="scrape-history-sidebar-header">
          <div className="scrape-history-sidebar-title">
            <h3>Scrape Details</h3>
            <span className={`history-status status-${entry.status}`}>
              {entry.status === 'completed' ? 'Completed' :
               entry.status === 'in_progress' ? 'In Progress' :
               entry.status === 'stopped' ? 'Stopped' : entry.status}
            </span>
          </div>
          <button className="scrape-history-sidebar-close" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="scrape-history-sidebar-body">
          {/* Summary Stats */}
          <div className="sidebar-stats-grid">
            <div className="sidebar-stat-card">
              <span className="sidebar-stat-value">{entry.total_found}</span>
              <span className="sidebar-stat-label">Found</span>
            </div>
            <div className="sidebar-stat-card">
              <span className="sidebar-stat-value">{entry.total_saved}</span>
              <span className="sidebar-stat-label">Saved</span>
            </div>
            <div className="sidebar-stat-card">
              <span className="sidebar-stat-value">{entry.total_duplicates || 0}</span>
              <span className="sidebar-stat-label">Duplicates</span>
            </div>
            <div className="sidebar-stat-card">
              <span className="sidebar-stat-value">{entry.feeds_processed}</span>
              <span className="sidebar-stat-label">Feeds</span>
            </div>
          </div>

          {/* Time Info */}
          <div className="sidebar-section">
            <h4>Timing</h4>
            <div className="sidebar-detail-row">
              <span className="sidebar-detail-label">Started</span>
              <span className="sidebar-detail-value">{formatDate(entry.started_at)}</span>
            </div>
            {entry.status !== 'in_progress' && (
              <>
                <div className="sidebar-detail-row">
                  <span className="sidebar-detail-label">Completed</span>
                  <span className="sidebar-detail-value">{formatDate(entry.completed_at)}</span>
                </div>
                <div className="sidebar-detail-row">
                  <span className="sidebar-detail-label">Duration</span>
                  <span className="sidebar-detail-value">{formatDuration(entry.started_at, entry.completed_at)}</span>
                </div>
              </>
            )}
          </div>

          {/* Meetings by State */}
          {entry.meetings_by_state && Object.keys(entry.meetings_by_state).length > 0 && (
            <div className="sidebar-section">
              <h4>Meetings by State</h4>
              <div className="sidebar-state-tags">
                {Object.entries(entry.meetings_by_state)
                  .sort((a, b) => b[1] - a[1])
                  .map(([state, count]) => (
                    <span key={state} className="sidebar-state-tag">
                      <span className="state-code">{state}</span>
                      <span className="state-count">{count}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {entry.errors && entry.errors.length > 0 && (
            <div className="sidebar-section">
              <h4>Errors ({entry.errors.length})</h4>
              <ul className="sidebar-errors-list">
                {entry.errors.map((error, idx) => (
                  <li key={idx} className="sidebar-error-item">{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Failed Saves */}
          {entry.failed_saves && entry.failed_saves.length > 0 && (
            <div className="sidebar-section failed-saves-section">
              <div
                className="sidebar-section-header clickable"
                onClick={() => setExpandedFailedSaves(!expandedFailedSaves)}
              >
                <h4>Failed Saves ({entry.failed_saves.length})</h4>
                <span className="sidebar-toggle-icon">
                  {expandedFailedSaves ? '▼' : '▶'}
                </span>
              </div>

              {expandedFailedSaves && (
                <div className="sidebar-failed-saves-list">
                  {entry.failed_saves.map((failed, idx) => {
                    const itemKey = `${entry.id}-${idx}`;
                    const isItemExpanded = expandedFailedItem === itemKey;
                    return (
                      <div key={idx} className="sidebar-failed-save-item">
                        <div
                          className="sidebar-failed-save-summary"
                          onClick={() => toggleFailedItem(itemKey)}
                        >
                          <span className="failed-save-toggle">
                            {isItemExpanded ? '▼' : '▶'}
                          </span>
                          <div className="failed-save-info">
                            <span className="failed-save-name">
                              {failed.name || 'Unknown Meeting'}
                            </span>
                            <span className="failed-save-meta">
                              {[failed.city, failed.state].filter(Boolean).join(', ')}
                              {failed.feed && ` • ${failed.feed}`}
                            </span>
                          </div>
                        </div>

                        {isItemExpanded && (
                          <div className="sidebar-failed-save-details">
                            <div className="failed-detail-row">
                              <span className="label">Day/Time:</span>
                              <span>{failed.day} {failed.time}</span>
                            </div>
                            <div className="failed-detail-row">
                              <span className="label">Address:</span>
                              <span>{failed.address || 'N/A'}</span>
                            </div>
                            <div className="failed-detail-row">
                              <span className="label">Type:</span>
                              <span>{failed.meetingType || 'N/A'}</span>
                            </div>
                            <div className="failed-detail-row error-row">
                              <span className="label">Error:</span>
                              <span className="error-message">
                                {typeof failed.error === 'object'
                                  ? (failed.error.message || failed.error.detail || JSON.stringify(failed.error))
                                  : failed.error}
                              </span>
                            </div>

                            <div className="failed-save-actions">
                              <button
                                className="btn btn-small btn-ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(failed.full_data || failed);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                </svg>
                                Copy Data
                              </button>
                            </div>

                            {failed.full_data && (
                              <div className="failed-save-raw">
                                <details>
                                  <summary>Raw Meeting Data</summary>
                                  <pre>{JSON.stringify(failed.full_data, null, 2)}</pre>
                                </details>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="scrape-history-sidebar-footer">
          {entry.status === 'in_progress' && onViewProgress && (
            <button
              className="btn btn-primary"
              onClick={() => {
                handleClose();
                onViewProgress();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              View Progress
            </button>
          )}
          <button className="btn btn-ghost" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

export default ScrapeHistorySidebar;
