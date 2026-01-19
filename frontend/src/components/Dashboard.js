import React from 'react';

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
    current_feed_total
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
        <div className="card">
          <div className="card-icon">🔍</div>
          <div className="card-content">
            <span className="card-value">{total_found.toLocaleString()}</span>
            <span className="card-label">Meetings Found</span>
          </div>
        </div>

        <div className="card">
          <div className="card-icon">💾</div>
          <div className="card-content">
            <span className="card-value">{total_saved.toLocaleString()}</span>
            <span className="card-label">Meetings Saved</span>
          </div>
        </div>

        <div className="card">
          <div className="card-icon">{is_running ? '🔄' : '⏸'}</div>
          <div className="card-content">
            <span className="card-value">{is_running ? 'Running' : 'Idle'}</span>
            <span className="card-label">Status</span>
          </div>
        </div>

        {is_running && (
          <div className="card">
            <div className="card-icon">📊</div>
            <div className="card-content">
              <span className="card-value">{current_feed_index + 1}/{total_feeds}</span>
              <span className="card-label">Feed Progress</span>
            </div>
          </div>
        )}
      </div>

      {is_running && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-source">
              {current_source ? `Processing: ${current_source}` : 'Starting...'}
            </span>
            <span className="progress-percent">{overallProgress}%</span>
          </div>

          {/* Overall progress bar */}
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>

          {/* Current feed progress */}
          {current_feed_total > 0 && (
            <div className="feed-progress">
              <div className="feed-progress-header">
                <span>Current feed: {current_feed_progress.toLocaleString()} / {current_feed_total.toLocaleString()}</span>
                <span>{feedProgress}%</span>
              </div>
              <div className="progress-bar progress-bar-small">
                <div
                  className="progress-bar-fill progress-bar-fill-secondary"
                  style={{ width: `${feedProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {progress_message && (
            <div className="progress-message">{progress_message}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
