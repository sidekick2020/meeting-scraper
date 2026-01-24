import React, { useState, useEffect, useCallback } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Cache key and TTL
const HISTORY_CACHE_KEY = 'scrapeHistory:data';
const HISTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function ScrapeHistory({ onViewProgress }) {
  const { getCache, setCache } = useDataCache();
  const cachedHistory = getCache(HISTORY_CACHE_KEY);

  const [history, setHistory] = useState(cachedHistory?.data || []);
  const [isLoading, setIsLoading] = useState(!cachedHistory?.data);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedFailedSaves, setExpandedFailedSaves] = useState({});
  const [expandedFailedItem, setExpandedFailedItem] = useState(null);
  const [expandedDuplicates, setExpandedDuplicates] = useState({});
  const [expandedDuplicateItem, setExpandedDuplicateItem] = useState(null);
  const [expandedSavedMeetings, setExpandedSavedMeetings] = useState({});
  const [expandedSavedItem, setExpandedSavedItem] = useState(null);

  const fetchHistory = useCallback(async (forceRefresh = false) => {
    // Skip if we have cached data and not forcing refresh
    if (!forceRefresh && cachedHistory?.data && cachedHistory.data.length > 0) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${BACKEND_URL}/api/history`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const historyData = data.history || [];
        setHistory(historyData);
        // Cache the data
        setCache(HISTORY_CACHE_KEY, historyData, HISTORY_CACHE_TTL);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name !== 'AbortError') {
        console.error('Error fetching history:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cachedHistory, setCache]);

  useEffect(() => {
    fetchHistory();
    // Refresh history every 30 seconds (but will use cache if available)
    const interval = setInterval(() => fetchHistory(true), 30000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

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

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleFailedSaves = (entryId) => {
    setExpandedFailedSaves(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const toggleFailedItem = (itemKey) => {
    setExpandedFailedItem(expandedFailedItem === itemKey ? null : itemKey);
  };

  const toggleDuplicates = (entryId) => {
    setExpandedDuplicates(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const toggleDuplicateItem = (itemKey) => {
    setExpandedDuplicateItem(expandedDuplicateItem === itemKey ? null : itemKey);
  };

  const toggleSavedMeetings = (entryId) => {
    setExpandedSavedMeetings(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const toggleSavedItem = (itemKey) => {
    setExpandedSavedItem(expandedSavedItem === itemKey ? null : itemKey);
  };

  const copyToClipboard = (data) => {
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  if (isLoading) {
    return (
      <div className="scrape-history">
        <div className="history-header">
          <h3>Scrape History</h3>
        </div>
        <div className="skeleton-history-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-history-entry">
              <div className="skeleton-history-header">
                <div className="skeleton-history-main">
                  <div className="skeleton-history-status"></div>
                  <div className="skeleton-history-date"></div>
                </div>
                <div className="skeleton-history-stats">
                  <div className="skeleton-history-stat"></div>
                  <div className="skeleton-history-stat"></div>
                  <div className="skeleton-history-stat"></div>
                  <div className="skeleton-history-expand"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="scrape-history">
      <div className="history-header">
        <h3>Scrape History</h3>
        <button className="btn btn-ghost btn-small" onClick={() => fetchHistory(true)}>
          Refresh
        </button>
      </div>

      {history.length === 0 ? (
        <div className="history-empty">
          <p>No scrape history yet.</p>
          <p>Run the scraper to see history appear here.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((entry) => (
            <div
              key={entry.id}
              className={`history-entry ${expandedId === entry.id ? 'expanded' : ''}`}
            >
              <div
                className="history-entry-header"
                onClick={() => toggleExpand(entry.id)}
              >
                <div className="history-entry-main">
                  <span className={`history-status status-${entry.status}`}>
                    {entry.status === 'completed' ? 'Completed' :
                     entry.status === 'in_progress' ? 'In Progress' :
                     entry.status === 'stopped' ? 'Stopped' : entry.status}
                  </span>
                  <span className="history-date">
                    {entry.status === 'in_progress'
                      ? `Started ${formatDate(entry.started_at)}`
                      : formatDate(entry.completed_at)}
                  </span>
                </div>
                <div className="history-entry-stats">
                  <span className="history-stat">
                    <strong>{entry.total_found}</strong> found
                  </span>
                  <span className="history-stat">
                    <strong>{entry.total_saved}</strong> saved
                  </span>
                  <span className="history-stat">
                    <strong>{entry.feeds_processed}</strong> feeds
                  </span>
                  {entry.status === 'in_progress' && onViewProgress && (
                    <button
                      className="btn btn-small btn-primary view-progress-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewProgress();
                      }}
                    >
                      View Progress
                    </button>
                  )}
                  <span className="history-expand-icon">
                    {expandedId === entry.id ? '−' : '+'}
                  </span>
                </div>
              </div>

              {expandedId === entry.id && (
                <div className="history-entry-details">
                  <div className="history-detail-row">
                    <span className="detail-label">Started:</span>
                    <span>{formatDate(entry.started_at)}</span>
                  </div>
                  <div className="history-detail-row">
                    <span className="detail-label">Duration:</span>
                    <span>{formatDuration(entry.started_at, entry.completed_at)}</span>
                  </div>

                  {entry.meetings_by_state && Object.keys(entry.meetings_by_state).length > 0 && (
                    <div className="history-detail-section">
                      <span className="detail-label">By State:</span>
                      <div className="history-state-tags">
                        {Object.entries(entry.meetings_by_state).map(([state, count]) => (
                          <span key={state} className="state-tag">
                            {state}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.errors && entry.errors.length > 0 && (
                    <div className="history-detail-section">
                      <span className="detail-label">Errors ({entry.errors.length}):</span>
                      <ul className="history-errors">
                        {entry.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Saved Meetings Section */}
                  {entry.saved_meetings && entry.saved_meetings.length > 0 && (
                    <div className="history-detail-section saved-meetings-section">
                      <div
                        className="saved-meetings-header"
                        onClick={() => toggleSavedMeetings(entry.id)}
                      >
                        <span className="detail-label saved-label">
                          Saved Successfully ({entry.saved_meetings.length})
                        </span>
                        <span className="saved-meetings-toggle">
                          {expandedSavedMeetings[entry.id] ? '▼' : '▶'}
                        </span>
                      </div>

                      {expandedSavedMeetings[entry.id] && (
                        <div className="saved-meetings-list">
                          {entry.saved_meetings.map((saved, idx) => {
                            const itemKey = `saved-${entry.id}-${idx}`;
                            const isItemExpanded = expandedSavedItem === itemKey;
                            return (
                              <div key={idx} className="saved-meeting-item">
                                <div
                                  className="saved-meeting-summary"
                                  onClick={() => toggleSavedItem(itemKey)}
                                >
                                  <span className="saved-meeting-toggle">
                                    {isItemExpanded ? '▼' : '▶'}
                                  </span>
                                  <span className="saved-meeting-name">
                                    {saved.name || 'Unknown Meeting'}
                                  </span>
                                  <span className="saved-meeting-location">
                                    {[saved.city, saved.state].filter(Boolean).join(', ')}
                                  </span>
                                  <span className="saved-meeting-feed">{saved.feed}</span>
                                </div>

                                {isItemExpanded && (
                                  <div className="saved-meeting-details">
                                    <div className="saved-meeting-info">
                                      <div className="saved-meeting-row">
                                        <span className="label">Day/Time:</span>
                                        <span>{saved.day} {saved.time}</span>
                                      </div>
                                      <div className="saved-meeting-row">
                                        <span className="label">Address:</span>
                                        <span>{saved.address || 'N/A'}</span>
                                      </div>
                                      <div className="saved-meeting-row">
                                        <span className="label">Type:</span>
                                        <span>{saved.meetingType || 'N/A'}</span>
                                      </div>
                                      <div className="saved-meeting-row">
                                        <span className="label">Unique Key:</span>
                                        <span className="unique-key">{saved.uniqueKey || 'N/A'}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duplicate Meetings Section */}
                  {entry.duplicate_meetings && entry.duplicate_meetings.length > 0 && (
                    <div className="history-detail-section duplicates-section">
                      <div
                        className="duplicates-header"
                        onClick={() => toggleDuplicates(entry.id)}
                      >
                        <span className="detail-label duplicates-label">
                          Duplicates Skipped ({entry.duplicate_meetings.length})
                        </span>
                        <span className="duplicates-toggle">
                          {expandedDuplicates[entry.id] ? '▼' : '▶'}
                        </span>
                      </div>

                      {expandedDuplicates[entry.id] && (
                        <div className="duplicates-list">
                          {entry.duplicate_meetings.map((dup, idx) => {
                            const itemKey = `dup-${entry.id}-${idx}`;
                            const isItemExpanded = expandedDuplicateItem === itemKey;
                            return (
                              <div key={idx} className="duplicate-item">
                                <div
                                  className="duplicate-summary"
                                  onClick={() => toggleDuplicateItem(itemKey)}
                                >
                                  <span className="duplicate-toggle">
                                    {isItemExpanded ? '▼' : '▶'}
                                  </span>
                                  <span className="duplicate-name">
                                    {dup.name || 'Unknown Meeting'}
                                  </span>
                                  <span className="duplicate-location">
                                    {[dup.city, dup.state].filter(Boolean).join(', ')}
                                  </span>
                                  <span className="duplicate-feed">{dup.feed}</span>
                                </div>

                                {isItemExpanded && (
                                  <div className="duplicate-details">
                                    <div className="duplicate-info">
                                      <div className="duplicate-row">
                                        <span className="label">Day/Time:</span>
                                        <span>{dup.day} {dup.time}</span>
                                      </div>
                                      <div className="duplicate-row">
                                        <span className="label">Address:</span>
                                        <span>{dup.address || 'N/A'}</span>
                                      </div>
                                      <div className="duplicate-row">
                                        <span className="label">Type:</span>
                                        <span>{dup.meetingType || 'N/A'}</span>
                                      </div>
                                      <div className="duplicate-row">
                                        <span className="label">Unique Key:</span>
                                        <span className="unique-key">{dup.uniqueKey || 'N/A'}</span>
                                      </div>
                                      <div className="duplicate-row reason-row">
                                        <span className="label">Reason:</span>
                                        <span className="reason-message">{dup.reason}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {entry.failed_saves && entry.failed_saves.length > 0 && (
                    <div className="history-detail-section failed-saves-section">
                      <div
                        className="failed-saves-header"
                        onClick={() => toggleFailedSaves(entry.id)}
                      >
                        <span className="detail-label">
                          Failed Saves ({entry.failed_saves.length})
                        </span>
                        <span className="failed-saves-toggle">
                          {expandedFailedSaves[entry.id] ? '▼' : '▶'}
                        </span>
                      </div>

                      {expandedFailedSaves[entry.id] && (
                        <div className="failed-saves-list">
                          {entry.failed_saves.map((failed, idx) => {
                            const itemKey = `${entry.id}-${idx}`;
                            const isItemExpanded = expandedFailedItem === itemKey;
                            return (
                              <div key={idx} className="failed-save-item">
                                <div
                                  className="failed-save-summary"
                                  onClick={() => toggleFailedItem(itemKey)}
                                >
                                  <span className="failed-save-toggle">
                                    {isItemExpanded ? '▼' : '▶'}
                                  </span>
                                  <span className="failed-save-name">
                                    {failed.name || 'Unknown Meeting'}
                                  </span>
                                  <span className="failed-save-location">
                                    {[failed.city, failed.state].filter(Boolean).join(', ')}
                                  </span>
                                  <span className="failed-save-feed">{failed.feed}</span>
                                </div>

                                {isItemExpanded && (
                                  <div className="failed-save-details">
                                    <div className="failed-save-info">
                                      <div className="failed-save-row">
                                        <span className="label">Day/Time:</span>
                                        <span>{failed.day} {failed.time}</span>
                                      </div>
                                      <div className="failed-save-row">
                                        <span className="label">Address:</span>
                                        <span>{failed.address || 'N/A'}</span>
                                      </div>
                                      <div className="failed-save-row">
                                        <span className="label">Type:</span>
                                        <span>{failed.meetingType || 'N/A'}</span>
                                      </div>
                                      <div className="failed-save-row error-row">
                                        <span className="label">Error:</span>
                                        <span className="error-message">
                                          {typeof failed.error === 'object'
                                            ? (failed.error.message || failed.error.detail || JSON.stringify(failed.error))
                                            : failed.error}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="failed-save-actions">
                                      <button
                                        className="btn btn-small btn-ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(failed.full_data || failed);
                                        }}
                                      >
                                        Copy Full Data
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScrapeHistory;
