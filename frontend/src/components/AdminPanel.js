import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Dashboard from './Dashboard';
import ConfigModal from './ConfigModal';
import Stats from './Stats';
import MeetingsList from './MeetingsList';
import ActivityLog from './ActivityLog';
import MeetingMap from './MeetingMap';
import MeetingDetail from './MeetingDetail';
import ScrapeHistory from './ScrapeHistory';
import CoverageAnalysis from './CoverageAnalysis';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const POLL_INTERVAL_ACTIVE = 500;
const POLL_INTERVAL_IDLE = 2000;

function AdminPanel({ onBackToPublic }) {
  const { user, signOut } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [scrapingState, setScrapingState] = useState({
    is_running: false,
    total_found: 0,
    total_saved: 0,
    current_source: '',
    errors: [],
    meetings_by_state: {},
    meetings_by_type: { AA: 0, NA: 0, 'Al-Anon': 0, Other: 0 },
    progress_message: '',
    current_feed_index: 0,
    total_feeds: 3,
    current_feed_progress: 0,
    current_feed_total: 0,
    activity_log: []
  });
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [config, setConfig] = useState({
    appId: localStorage.getItem('back4app_app_id') || '',
    restKey: localStorage.getItem('back4app_rest_key') || ''
  });
  const [backendConfigured, setBackendConfigured] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [activeView, setActiveView] = useState('list');

  const isRunningRef = useRef(false);
  const pollIntervalRef = useRef(null);

  // Check if backend has Back4app configured via env vars
  const checkBackendConfig = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/config`);
      if (response.ok) {
        const data = await response.json();
        setBackendConfigured(data.configured);
      }
    } catch (error) {
      console.error('Error checking config:', error);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/status`);
      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);
        setScrapingState(prev => ({ ...prev, ...data }));
        if (data.recent_meetings) {
          setRecentMeetings(data.recent_meetings);
        }
        isRunningRef.current = data.is_running;
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    checkBackendConfig();
    pollIntervalRef.current = setInterval(checkConnection, POLL_INTERVAL_IDLE);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [checkConnection, checkBackendConfig]);

  useEffect(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const interval = scrapingState.is_running ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
    pollIntervalRef.current = setInterval(checkConnection, interval);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [scrapingState.is_running, checkConnection]);

  const processNextFeed = useCallback(async (feedIndex) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/scrape-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_index: feedIndex })
      });
      const data = await response.json();
      if (data.success && !data.done) {
        setTimeout(() => processNextFeed(data.feed_index), 500);
      }
    } catch (error) {
      console.error('Error processing feed:', error);
      setScrapingState(prev => ({
        ...prev,
        is_running: false,
        errors: [...prev.errors, error.message]
      }));
    }
  }, []);

  const startScraping = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setScrapingState(prev => ({
          ...prev,
          is_running: true,
          total_found: 0,
          total_saved: 0,
          errors: [],
          meetings_by_state: {},
          meetings_by_type: { AA: 0, NA: 0, 'Al-Anon': 0, Other: 0 },
          current_feed_index: 0,
          current_feed_progress: 0,
          current_feed_total: 0,
          activity_log: []
        }));
        setRecentMeetings([]);
        isRunningRef.current = true;
        processNextFeed(0);
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error starting scraper:', error);
      alert('Failed to start scraper');
    }
  };

  const stopScraping = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      setScrapingState(prev => ({ ...prev, is_running: false }));
      isRunningRef.current = false;
    } catch (error) {
      console.error('Error stopping scraper:', error);
    }
  };

  const saveConfig = async (newConfig) => {
    setIsSavingConfig(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      const data = await response.json();
      if (data.success) {
        setConfig(newConfig);
        localStorage.setItem('back4app_app_id', newConfig.appId);
        localStorage.setItem('back4app_rest_key', newConfig.restKey);
        setShowConfig(false);
        alert('Configuration saved!');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="admin-panel">
      <header className="App-header">
        <div className="header-content">
          <div className="header-left">
            <button className="btn btn-ghost" onClick={onBackToPublic}>
              &larr; Back to Public View
            </button>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="header-controls">
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <button onClick={() => setShowConfig(true)} className="btn btn-secondary">
              Configure
            </button>
            <div className="user-info">
              {user?.picture && (
                <img src={user.picture} alt="" className="user-avatar" />
              )}
              <span className="user-name">{user?.name}</span>
              <button onClick={signOut} className="btn btn-ghost btn-small">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="App-main">
        <div className="controls-section">
          <div className="control-buttons">
            {!scrapingState.is_running ? (
              <button
                onClick={startScraping}
                className="btn btn-primary btn-large"
                disabled={!isConnected}
              >
                Start Scraping
              </button>
            ) : (
              <button onClick={stopScraping} className="btn btn-danger btn-large">
                Stop Scraping
              </button>
            )}
          </div>

          {!backendConfigured && !config.appId && !config.restKey && (
            <div className="warning-box">
              Configure Back4app credentials to save meetings to database
            </div>
          )}
          {backendConfigured && (
            <div className="success-box">
              Back4app configured via environment variables
            </div>
          )}
        </div>

        <Dashboard scrapingState={scrapingState} />
        <ActivityLog logs={scrapingState.activity_log} />
        <CoverageAnalysis />
        <ScrapeHistory />

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
          <div className="grid-container">
            <Stats
              byState={scrapingState.meetings_by_state}
              byType={scrapingState.meetings_by_type}
            />
            <MeetingsList
              meetings={recentMeetings}
              onSelectMeeting={setSelectedMeeting}
            />
          </div>
        ) : (
          <MeetingMap
            meetings={recentMeetings}
            onSelectMeeting={setSelectedMeeting}
            showHeatmap={true}
          />
        )}

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
      </main>

      {showConfig && (
        <ConfigModal
          config={config}
          onSave={saveConfig}
          onClose={() => setShowConfig(false)}
          isSaving={isSavingConfig}
        />
      )}

      {selectedMeeting && (
        <MeetingDetail
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </div>
  );
}

export default AdminPanel;
