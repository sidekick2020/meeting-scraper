import React, { useState, useEffect, useCallback } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Cache key and TTL
const HISTORY_CACHE_KEY = 'scrapeHistory:data';
const HISTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function ScrapeHistory() {
  const { getCache, setCache } = useDataCache();
  const cachedHistory = getCache(HISTORY_CACHE_KEY);

  const [history, setHistory] = useState(cachedHistory?.data || []);
  const [isLoading, setIsLoading] = useState(!cachedHistory?.data);
  const [expandedId, setExpandedId] = useState(null);

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

  if (isLoading) {
    return (
      <div className="scrape-history">
        <h3>Scrape History</h3>
        <div className="history-loading">Loading history...</div>
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
