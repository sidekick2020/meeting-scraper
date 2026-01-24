import React from 'react';

// Clean SVG icons for dashboard cards
const SearchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35"/>
  </svg>
);

const SaveIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
    <polyline points="17,21 17,13 7,13 7,21"/>
    <polyline points="7,3 7,8 15,8"/>
  </svg>
);

const RunningIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-spin">
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
  </svg>
);

const IdleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="10" y1="15" x2="10" y2="9"/>
    <line x1="14" y1="15" x2="14" y2="9"/>
  </svg>
);

const FeedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11a9 9 0 019 9"/>
    <path d="M4 4a16 16 0 0116 16"/>
    <circle cx="5" cy="19" r="1"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
);

// Format seconds into human-readable duration
function formatDuration(seconds) {
  if (seconds == null || seconds < 0) return '--';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function Dashboard({ scrapingState }) {
  const {
    is_running,
    total_found,
    total_saved,
    current_source,
    progress_message,
    current_feed_index,
    total_feeds,
    current_feed_progress,
    current_feed_total,
    meetings_by_type,
    elapsed_seconds,
    estimated_remaining_seconds,
    items_per_second
  } = scrapingState;

  // Calculate progress percentage for current feed
  const feedProgress = current_feed_total > 0
    ? Math.round((current_feed_progress / current_feed_total) * 100)
    : 0;

  // Calculate overall progress (which feed we're on)
  const overallProgress = total_feeds > 0
    ? Math.round(((current_feed_index + (feedProgress / 100)) / total_feeds) * 100)
    : 0;

  return (
    <div className="dashboard">
      <div className="dashboard-cards">
        <div className="card card-found">
          <div className="card-icon">
            <SearchIcon />
          </div>
          <div className="card-content">
            <span className="card-value">{total_found.toLocaleString()}</span>
            <span className="card-label">Found</span>
          </div>
        </div>

        <div className="card card-saved">
          <div className="card-icon">
            <SaveIcon />
          </div>
          <div className="card-content">
            <span className="card-value">{total_saved.toLocaleString()}</span>
            <span className="card-label">Saved</span>
          </div>
        </div>

        <div className={`card card-status ${is_running ? 'card-running' : 'card-idle'}`}>
          <div className="card-icon">
            {is_running ? <RunningIcon /> : <IdleIcon />}
          </div>
          <div className="card-content">
            <span className="card-value">{is_running ? 'Running' : 'Idle'}</span>
            <span className="card-label">Status</span>
          </div>
        </div>

        {is_running && (
          <div className="card card-feeds">
            <div className="card-icon">
              <FeedIcon />
            </div>
            <div className="card-content">
              <span className="card-value">{current_feed_index + 1}/{total_feeds}</span>
              <span className="card-label">Feeds</span>
            </div>
          </div>
        )}

        {is_running && elapsed_seconds != null && (
          <div className="card card-time">
            <div className="card-icon">
              <ClockIcon />
            </div>
            <div className="card-content">
              <span className="card-value">
                {estimated_remaining_seconds != null
                  ? formatDuration(estimated_remaining_seconds)
                  : '--'}
              </span>
              <span className="card-label">
                {elapsed_seconds != null ? `${formatDuration(elapsed_seconds)} elapsed` : 'Time'}
              </span>
            </div>
          </div>
        )}
      </div>

      {is_running && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-source">
              {current_source || 'Starting...'}
            </span>
            <span className="progress-percent">{overallProgress}%</span>
          </div>

          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {current_feed_total > 0 && (
            <div className="feed-progress">
              <div className="feed-progress-header">
                <span>{current_feed_progress.toLocaleString()} / {current_feed_total.toLocaleString()} items</span>
                <span>{feedProgress}%</span>
              </div>
              <div className="progress-bar progress-bar-small">
                <div
                  className="progress-bar-fill progress-bar-fill-secondary"
                  style={{ width: `${feedProgress}%` }}
                />
              </div>
            </div>
          )}

          {progress_message && (
            <div className="progress-message">
              {progress_message}
              {items_per_second != null && items_per_second > 0 && (
                <span className="velocity-info"> ({items_per_second.toFixed(1)}/sec)</span>
              )}
            </div>
          )}
        </div>
      )}

      {total_saved > 0 && meetings_by_type && (
        <div className="type-breakdown">
          <div className="type-breakdown-items">
            <div className="type-item">
              <span className="type-badge type-aa">AA</span>
              <span className="type-count">{(meetings_by_type.AA || 0).toLocaleString()}</span>
            </div>
            <div className="type-item">
              <span className="type-badge type-na">NA</span>
              <span className="type-count">{(meetings_by_type.NA || 0).toLocaleString()}</span>
            </div>
            <div className="type-item">
              <span className="type-badge type-alanon">Al-Anon</span>
              <span className="type-count">{(meetings_by_type['Al-Anon'] || 0).toLocaleString()}</span>
            </div>
            <div className="type-item">
              <span className="type-badge type-other">Other</span>
              <span className="type-count">{(meetings_by_type.Other || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
