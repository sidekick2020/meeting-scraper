import React from 'react';

function Dashboard({ scrapingState }) {
  const { is_running, total_found, total_saved, current_source } = scrapingState;

  return (
    <div className="dashboard">
      <div className="dashboard-cards">
        <div className="card">
          <div className="card-icon">🔍</div>
          <div className="card-content">
            <span className="card-value">{total_found}</span>
            <span className="card-label">Meetings Found</span>
          </div>
        </div>

        <div className="card">
          <div className="card-icon">💾</div>
          <div className="card-content">
            <span className="card-value">{total_saved}</span>
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
      </div>

      {is_running && current_source && (
        <div className="progress-section">
          <div className="progress-header">
            <span>Currently scraping: {current_source}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill animated"></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
