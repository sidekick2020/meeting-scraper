import React, { useState } from 'react';
import Dashboard from './Dashboard';
import ActivityLog from './ActivityLog';
import MeetingsList from './MeetingsList';
import MeetingMap from './MeetingMap';

function ScrapePanel({
  isOpen,
  onClose,
  scrapingState,
  recentMeetings,
  onSelectMeeting,
  onStopScraping,
  onStartNew,
  onReset,
  isConnected
}) {
  const [activeView, setActiveView] = useState('list');

  return (
    <div className={`scrape-panel-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="scrape-panel-header">
        <h2>
          {scrapingState.is_running ? 'Scraping in Progress' : 'Scrape Details'}
        </h2>
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          title="Close panel"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="scrape-panel-content">
        {/* Control buttons - inline with header style */}
        {scrapingState.is_running && (
          <div className="scrape-panel-controls-compact">
            <button onClick={onStopScraping} className="btn-compact btn-stop">
              Stop
            </button>
            <button onClick={onStartNew} className="btn-compact btn-restart">
              Restart
            </button>
          </div>
        )}

        {/* Dashboard Stats */}
        <Dashboard scrapingState={scrapingState} />

        {/* Activity Log */}
        <ActivityLog
          logs={scrapingState.activity_log}
          currentMeeting={scrapingState.current_meeting}
        />

        {/* View Toggle */}
        {(scrapingState.total_found > 0 || recentMeetings.length > 0) && (
          <>
            <div className="view-toggle">
              <button
                className={`toggle-btn ${activeView === 'list' ? 'active' : ''}`}
                onClick={() => setActiveView('list')}
              >
                List View
              </button>
              <button
                className={`toggle-btn ${activeView === 'map' ? 'active' : ''}`}
                onClick={() => setActiveView('map')}
              >
                Map View
              </button>
            </div>

            {activeView === 'list' ? (
              <MeetingsList
                meetings={recentMeetings}
                onSelectMeeting={onSelectMeeting}
              />
            ) : (
              <MeetingMap
                meetings={recentMeetings}
                onSelectMeeting={onSelectMeeting}
                showHeatmap={true}
              />
            )}
          </>
        )}

        {/* Errors Section */}
        {scrapingState.errors.length > 0 && (
          <div className="errors-section">
            <h3>Errors</h3>
            <ul>
              {scrapingState.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScrapePanel;
