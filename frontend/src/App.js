import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';
import Dashboard from './components/Dashboard';
import ConfigModal from './components/ConfigModal';
import Stats from './components/Stats';
import MeetingsList from './components/MeetingsList';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [scrapingState, setScrapingState] = useState({
    is_running: false,
    total_found: 0,
    total_saved: 0,
    current_source: '',
    errors: [],
    meetings_by_state: {},
    meetings_by_type: { AA: 0, NA: 0, 'Al-Anon': 0, Other: 0 }
  });
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    appId: localStorage.getItem('back4app_app_id') || '',
    restKey: localStorage.getItem('back4app_rest_key') || ''
  });

  useEffect(() => {
    // Initialize Socket.IO connection
    const newSocket = io(BACKEND_URL);
    
    newSocket.on('connect', () => {
      console.log('Connected to backend');
      setIsConnected(true);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from backend');
      setIsConnected(false);
    });
    
    newSocket.on('status_update', (data) => {
      setScrapingState(data);
    });
    
    newSocket.on('scraper_started', (data) => {
      console.log('Scraper started:', data.message);
    });
    
    newSocket.on('progress_update', (data) => {
      setScrapingState(prev => ({
        ...prev,
        current_source: data.source
      }));
    });
    
    newSocket.on('meeting_saved', (data) => {
      setScrapingState(prev => ({
        ...prev,
        total_saved: data.total_saved,
        meetings_by_state: data.stats.by_state,
        meetings_by_type: data.stats.by_type
      }));
      
      // Add to recent meetings list (keep last 10)
      setRecentMeetings(prev => [data.meeting, ...prev].slice(0, 10));
    });
    
    newSocket.on('scraper_completed', (data) => {
      console.log('Scraper completed:', data);
      setScrapingState(prev => ({
        ...prev,
        is_running: false,
        total_found: data.total_found,
        total_saved: data.total_saved,
        meetings_by_state: data.stats.by_state,
        meetings_by_type: data.stats.by_type
      }));
      alert(`Scraping completed! Found ${data.total_found} meetings, saved ${data.total_saved}.`);
    });
    
    newSocket.on('scraper_error', (data) => {
      console.error('Scraper error:', data.error);
      setScrapingState(prev => ({
        ...prev,
        is_running: false,
        errors: [...prev.errors, data.error]
      }));
      alert(`Error: ${data.error}`);
    });
    
    setSocket(newSocket);
    
    return () => newSocket.close();
  }, []);

  const startScraping = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Scraping started');
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
      const response = await fetch(`${BACKEND_URL}/api/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('Scraping stopped');
    } catch (error) {
      console.error('Error stopping scraper:', error);
    }
  };

  const saveConfig = async (newConfig) => {
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
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>🔍 12-Step Meeting Scraper</h1>
          <div className="header-controls">
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '● Connected' : '○ Disconnected'}
            </span>
            <button onClick={() => setShowConfig(true)} className="btn btn-secondary">
              ⚙️ Configure
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
                disabled={!config.appId || !config.restKey}
              >
                ▶️ Start Scraping
              </button>
            ) : (
              <button 
                onClick={stopScraping} 
                className="btn btn-danger btn-large"
              >
                ⏸ Stop Scraping
              </button>
            )}
          </div>
          
          {(!config.appId || !config.restKey) && (
            <div className="warning-box">
              ⚠️ Please configure your Back4app credentials before starting
            </div>
          )}
        </div>

        <Dashboard scrapingState={scrapingState} />
        
        <div className="grid-container">
          <Stats 
            byState={scrapingState.meetings_by_state} 
            byType={scrapingState.meetings_by_type} 
          />
          <MeetingsList meetings={recentMeetings} />
        </div>

        {scrapingState.errors.length > 0 && (
          <div className="errors-section">
            <h3>❌ Errors</h3>
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
        />
      )}
    </div>
  );
}

export default App;
