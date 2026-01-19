import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ConfigModal from './components/ConfigModal';
import Stats from './components/Stats';
import MeetingsList from './components/MeetingsList';
import ActivityLog from './components/ActivityLog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Polling intervals
const POLL_INTERVAL_ACTIVE = 500;  // 500ms when scraping
const POLL_INTERVAL_IDLE = 2000;   // 2s when idle

function App() {
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

  // Use refs to track state without causing re-renders
  const isRunningRef = useRef(false);
  const pollIntervalRef = useRef(null);

  // Check connection to backend
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/status`);
      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);

        // Update state, preserving is_running from server
        setScrapingState(prev => ({
          ...prev,
          ...data
        }));

        if (data.recent_meetings) {
          setRecentMeetings(data.recent_meetings);
        }

        // Update ref for polling logic
        isRunningRef.current = data.is_running;
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      setIsConnected(false);
    }
  }, []);

  // Set up polling - use ref to avoid recreating interval on every state change
  useEffect(() => {
    checkConnection();

    // Start with idle polling
    pollIntervalRef.current = setInterval(checkConnection, POLL_INTERVAL_IDLE);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [checkConnection]);

  // Adjust polling speed based on running state
  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const interval = scrapingState.is_running ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
    pollIntervalRef.current = setInterval(checkConnection, interval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [scrapingState.is_running, checkConnection]);

  // Process feeds one at a time
  const processNextFeed = useCallback(async (feedIndex) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/scrape-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_index: feedIndex })
      });

      const data = await response.json();

      if (data.success) {
        if (!data.done) {
          // Process next feed after a short delay
          setTimeout(() => processNextFeed(data.feed_index), 500);
        }
        // Status updates come from polling, no need to set state here
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
        // Set running state immediately for responsive UI
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

        // Start processing feeds
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

      setScrapingState(prev => ({
        ...prev,
        is_running: false
      }));
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
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>12-Step Meeting Scraper</h1>
          <div className="header-controls">
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <button onClick={() => setShowConfig(true)} className="btn btn-secondary">
              Configure
            </button>
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
              <button
                onClick={stopScraping}
                className="btn btn-danger btn-large"
              >
                Stop Scraping
              </button>
            )}
          </div>

          {!config.appId && !config.restKey && (
            <div className="warning-box">
              Configure Back4app credentials to save meetings to database (optional for testing)
            </div>
          )}
        </div>

        <Dashboard scrapingState={scrapingState} />

        <ActivityLog logs={scrapingState.activity_log} />

        <div className="grid-container">
          <Stats
            byState={scrapingState.meetings_by_state}
            byType={scrapingState.meetings_by_type}
          />
          <MeetingsList meetings={recentMeetings} />
        </div>

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
    </div>
  );
}

export default App;
