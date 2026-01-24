import React from 'react';

// Format seconds into human-readable duration
function formatDuration(seconds) {
  if (seconds == null || seconds < 0) return '--';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${secs}s`;
  }
}

function Dashboard({ scrapingState }) {
  const {
    is_running,
    total_found,
    total_saved,
    total_duplicates = 0,
    total_errors = 0,
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

  // Get meeting types with non-zero counts
  const activeTypes = meetings_by_type ? [
    { key: 'AA', label: 'AA', count: meetings_by_type.AA || 0 },
    { key: 'NA', label: 'NA', count: meetings_by_type.NA || 0 },
    { key: 'Al-Anon', label: 'Al-Anon', count: meetings_by_type['Al-Anon'] || 0 },
    { key: 'Other', label: 'Other', count: meetings_by_type.Other || 0 },
  ].filter(t => t.count > 0) : [];

  return (
    <div className="dashboard-compact">
      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-item stat-found">
          <span className="stat-value">{total_found.toLocaleString()}</span>
          <span className="stat-label">found</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item stat-saved">
          <span className="stat-value">{total_saved.toLocaleString()}</span>
          <span className="stat-label">saved</span>
        </div>
        {total_duplicates > 0 && (
          <>
            <div className="stat-divider" />
            <div className="stat-item stat-duplicates">
              <span className="stat-value">{total_duplicates.toLocaleString()}</span>
              <span className="stat-label">duplicates</span>
            </div>
          </>
        )}
        {total_errors > 0 && (
          <>
            <div className="stat-divider" />
            <div className="stat-item stat-errors">
              <span className="stat-value">{total_errors.toLocaleString()}</span>
              <span className="stat-label">errors</span>
            </div>
          </>
        )}
        {is_running && (
          <>
            <div className="stat-divider" />
            <div className="stat-item stat-feeds">
              <span className="stat-value">{current_feed_index + 1}<span className="stat-total">/{total_feeds}</span></span>
              <span className="stat-label">feeds</span>
            </div>
            {elapsed_seconds != null && (
              <>
                <div className="stat-divider" />
                <div className="stat-item stat-time">
                  <span className="stat-value">{formatDuration(elapsed_seconds)}</span>
                  <span className="stat-label">
                    {estimated_remaining_seconds != null && estimated_remaining_seconds > 0
                      ? `${formatDuration(estimated_remaining_seconds)} left`
                      : 'elapsed'}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Type breakdown - only show if there are counts */}
      {activeTypes.length > 0 && (
        <div className="type-chips">
          {activeTypes.map(type => (
            <span key={type.key} className={`type-chip type-chip-${type.key.toLowerCase().replace('-', '')}`}>
              {type.label} {type.count.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      {/* Progress Section */}
      {is_running && (
        <div className="progress-compact">
          <div className="progress-info">
            <span className="progress-source-name">{current_source || 'Starting...'}</span>
            <span className="progress-stats">
              {items_per_second != null && items_per_second > 0 && (
                <span className="progress-velocity">{items_per_second.toFixed(1)}/s</span>
              )}
              <span className="progress-pct">{overallProgress}%</span>
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${overallProgress}%` }} />
          </div>
          {current_feed_total > 0 && (
            <div className="progress-detail">
              {progress_message || `${current_feed_progress.toLocaleString()} / ${current_feed_total.toLocaleString()}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
