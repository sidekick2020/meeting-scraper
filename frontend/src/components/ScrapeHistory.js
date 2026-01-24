import React, { useState, useEffect, useCallback } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';
import ScrapeHistorySidebar from './ScrapeHistorySidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Cache key and TTL
const HISTORY_CACHE_KEY = 'scrapeHistory:data';
const HISTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function ScrapeHistory({ onViewProgress }) {
  const { getCache, setCache } = useDataCache();
  const cachedHistory = getCache(HISTORY_CACHE_KEY);

  const [history, setHistory] = useState(cachedHistory?.data || []);
  const [isLoading, setIsLoading] = useState(!cachedHistory?.data);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const openSidebar = (entry) => {
    setSelectedEntry(entry);
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    // Delay clearing selectedEntry to allow closing animation
    setTimeout(() => setSelectedEntry(null), 300);
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
              className={`history-entry ${selectedEntry?.id === entry.id ? 'selected' : ''}`}
              onClick={() => openSidebar(entry)}
            >
              <div className="history-entry-header">
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ScrapeHistorySidebar
        entry={selectedEntry}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onViewProgress={onViewProgress}
      />
    </div>
  );
}

export default ScrapeHistory;
