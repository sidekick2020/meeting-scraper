import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Dashboard from './Dashboard';
import SettingsModal from './SettingsModal';
import Stats from './Stats';
import MeetingsList from './MeetingsList';
import ActivityLog from './ActivityLog';
import MeetingMap from './MeetingMap';
import MeetingDetail from './MeetingDetail';
import ScrapeHistory from './ScrapeHistory';
import CoverageAnalysis from './CoverageAnalysis';
import DevDocs from './DevDocs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const POLL_INTERVAL_ACTIVE = 500;
const POLL_INTERVAL_IDLE = 2000;

function AdminPanel({ onBackToPublic }) {
  const { user, signOut } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSection, setActiveSection] = useState('scraper');
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
    current_meeting: null,
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
  const [showDocs, setShowDocs] = useState(false);
  const [unfinishedScrape, setUnfinishedScrape] = useState(null);
  const [checkedUnfinished, setCheckedUnfinished] = useState(false);
  const [showScrapeChoiceModal, setShowScrapeChoiceModal] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [selectedFeeds, setSelectedFeeds] = useState([]);
  const [showFeedSelector, setShowFeedSelector] = useState(false);
  const [isStartingScrape, setIsStartingScrape] = useState(false);
  const [scrapeError, setScrapeError] = useState(null);
  const [shouldAbandonOld, setShouldAbandonOld] = useState(false);

  // Directory state
  const [directoryMeetings, setDirectoryMeetings] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryLoadingMore, setDirectoryLoadingMore] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryState, setDirectoryState] = useState('');
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [directoryHasMore, setDirectoryHasMore] = useState(true);
  const DIRECTORY_PAGE_SIZE = 25;

  const isRunningRef = useRef(false);
  const pollIntervalRef = useRef(null);

  // Theme detection and toggle
  const [currentTheme, setCurrentTheme] = useState(
    document.documentElement.getAttribute('data-theme') ||
    localStorage.getItem('theme') ||
    'dark'
  );

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setCurrentTheme(newTheme);
  }, [currentTheme]);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    setCurrentTheme(savedTheme);
  }, []);

  // Listen for theme changes (from other tabs or external changes)
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          setCurrentTheme(document.documentElement.getAttribute('data-theme') || 'dark');
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

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

  // Check for unfinished scrapes on load
  const checkUnfinishedScrape = useCallback(async () => {
    if (checkedUnfinished) return; // Only check once
    try {
      const response = await fetch(`${BACKEND_URL}/api/check-unfinished`);
      if (response.ok) {
        const data = await response.json();
        if (data.hasUnfinished && data.scrape) {
          setUnfinishedScrape(data.scrape);
        }
        setCheckedUnfinished(true);
      }
    } catch (error) {
      console.error('Error checking for unfinished scrapes:', error);
      setCheckedUnfinished(true);
    }
  }, [checkedUnfinished]);

  // Fetch configured feeds
  const fetchFeeds = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/feeds`);
      if (response.ok) {
        const data = await response.json();
        const feedList = data.feeds || [];
        setFeeds(feedList);
        // Initialize all feeds as selected
        setSelectedFeeds(feedList.map(f => f.name));
      }
    } catch (error) {
      console.error('Error fetching feeds:', error);
    }
  }, []);

  // Fetch directory meetings (initial load or filter change)
  const fetchDirectoryMeetings = useCallback(async (search = '', state = '') => {
    setDirectoryLoading(true);
    setDirectoryMeetings([]);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      let url = `${BACKEND_URL}/api/meetings?limit=${DIRECTORY_PAGE_SIZE}&skip=0`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (state) url += `&state=${encodeURIComponent(state)}`;

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const meetings = data.meetings || [];
        setDirectoryMeetings(meetings);
        setDirectoryTotal(data.total || 0);
        setDirectoryHasMore(meetings.length < (data.total || 0));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name !== 'AbortError') {
        console.error('Error fetching directory meetings:', error);
      }
    } finally {
      setDirectoryLoading(false);
    }
  }, [DIRECTORY_PAGE_SIZE]);

  // Load more directory meetings (append to existing)
  const loadMoreDirectoryMeetings = useCallback(async () => {
    if (directoryLoadingMore || !directoryHasMore) return;

    setDirectoryLoadingMore(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const skip = directoryMeetings.length;
      let url = `${BACKEND_URL}/api/meetings?limit=${DIRECTORY_PAGE_SIZE}&skip=${skip}`;
      if (directorySearch) url += `&search=${encodeURIComponent(directorySearch)}`;
      if (directoryState) url += `&state=${encodeURIComponent(directoryState)}`;

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const newMeetings = data.meetings || [];
        setDirectoryMeetings(prev => [...prev, ...newMeetings]);
        setDirectoryTotal(data.total || 0);
        setDirectoryHasMore(skip + newMeetings.length < (data.total || 0));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name !== 'AbortError') {
        console.error('Error loading more directory meetings:', error);
      }
    } finally {
      setDirectoryLoadingMore(false);
    }
  }, [directoryMeetings.length, directorySearch, directoryState, directoryLoadingMore, directoryHasMore, DIRECTORY_PAGE_SIZE]);

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/status`);
      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);

        // Only update state if values have actually changed to prevent scroll reset
        setScrapingState(prev => {
          // Check if any key values changed
          const hasChanges =
            prev.is_running !== data.is_running ||
            prev.total_found !== data.total_found ||
            prev.total_saved !== data.total_saved ||
            prev.current_source !== data.current_source ||
            prev.current_feed_index !== data.current_feed_index ||
            prev.current_feed_progress !== data.current_feed_progress ||
            prev.progress_message !== data.progress_message ||
            prev.activity_log?.length !== data.activity_log?.length ||
            prev.errors?.length !== data.errors?.length;

          if (hasChanges) {
            return { ...prev, ...data };
          }
          return prev; // Return same reference to avoid re-render
        });

        // Only update recent meetings if they changed
        if (data.recent_meetings) {
          setRecentMeetings(prev => {
            if (prev.length !== data.recent_meetings.length ||
                (prev[0]?.objectId !== data.recent_meetings[0]?.objectId)) {
              return data.recent_meetings;
            }
            return prev;
          });
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
    checkUnfinishedScrape();
    fetchFeeds();
    pollIntervalRef.current = setInterval(checkConnection, POLL_INTERVAL_IDLE);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [checkConnection, checkBackendConfig, checkUnfinishedScrape, fetchFeeds]);

  useEffect(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const interval = scrapingState.is_running ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
    pollIntervalRef.current = setInterval(checkConnection, interval);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [scrapingState.is_running, checkConnection]);

  // Fetch directory meetings when section is active or filters change
  useEffect(() => {
    if (activeSection === 'directory') {
      fetchDirectoryMeetings(directorySearch, directoryState);
    }
  }, [activeSection, directorySearch, directoryState, fetchDirectoryMeetings]);

  const handleStartClick = () => {
    // If scraper is currently running OR there's an unfinished scrape, show choice modal
    if (scrapingState.is_running || unfinishedScrape) {
      setShowScrapeChoiceModal(true);
    } else {
      // Show feed selector for new scrape
      setShowFeedSelector(true);
    }
  };

  const toggleFeedSelection = (feedName) => {
    setSelectedFeeds(prev =>
      prev.includes(feedName)
        ? prev.filter(f => f !== feedName)
        : [...prev, feedName]
    );
  };

  const selectAllFeeds = () => {
    setSelectedFeeds(feeds.map(f => f.name));
  };

  const selectNoFeeds = () => {
    setSelectedFeeds([]);
  };

  const startScraping = async () => {
    setIsStartingScrape(true);
    setScrapeError(null);

    try {
      const body = shouldAbandonOld && unfinishedScrape
        ? { abandon_scrape_id: unfinishedScrape.objectId, force: true, selected_feeds: selectedFeeds }
        : { force: true, selected_feeds: selectedFeeds };  // Always force to handle stuck state

      const response = await fetch(`${BACKEND_URL}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.success) {
        // Reset local state - backend runs in background thread
        // Frontend will receive updates via polling /api/status
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
          current_meeting: null,
          activity_log: [{
            type: 'success',
            message: `Scraping started with ${selectedFeeds.length} source${selectedFeeds.length !== 1 ? 's' : ''}`,
            timestamp: new Date().toISOString()
          }]
        }));
        setRecentMeetings([]);
        setUnfinishedScrape(null); // Clear any unfinished scrape notice
        setShowScrapeChoiceModal(false);
        setShowFeedSelector(false);
        setShouldAbandonOld(false); // Reset abandon flag
        isRunningRef.current = true;
      } else {
        setScrapeError(data.message || 'Failed to start scraping');
      }
    } catch (error) {
      console.error('Error starting scraper:', error);
      setScrapeError(`Failed to start scraper: ${error.message}`);
    } finally {
      setIsStartingScrape(false);
    }
  };

  const resumeScraping = async () => {
    if (!unfinishedScrape) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_scrape_id: unfinishedScrape.id,
          resume_object_id: unfinishedScrape.objectId,
          resume_feeds_processed: unfinishedScrape.feeds_processed,
          resume_total_found: unfinishedScrape.total_found,
          resume_total_saved: unfinishedScrape.total_saved,
          resume_started_at: unfinishedScrape.started_at,
          resume_meetings_by_state: unfinishedScrape.meetings_by_state
        })
      });
      const data = await response.json();
      if (data.success) {
        setScrapingState(prev => ({
          ...prev,
          is_running: true,
          total_found: unfinishedScrape.total_found,
          total_saved: unfinishedScrape.total_saved,
          meetings_by_state: unfinishedScrape.meetings_by_state || {},
          current_feed_index: unfinishedScrape.feeds_processed,
          current_meeting: null,
          activity_log: []
        }));
        setUnfinishedScrape(null);
        setShowScrapeChoiceModal(false);
        isRunningRef.current = true;
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error resuming scraper:', error);
      alert('Failed to resume scraper');
    }
  };

  const dismissUnfinished = () => {
    setUnfinishedScrape(null);
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

  const resetScraper = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      setScrapingState({
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
        current_meeting: null,
        activity_log: []
      });
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

  const menuItems = [
    { id: 'scraper', label: 'Scraper', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    )},
    { id: 'history', label: 'History', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
    )},
    { id: 'statistics', label: 'Statistics', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )},
    { id: 'sources', label: 'Sources', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    )},
    { id: 'directory', label: 'Directory', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    )},
    { id: 'public', label: 'Public', external: true, icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
    )},
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'scraper':
        return (
          <>
            {/* Unfinished Scrape Banner */}
            {unfinishedScrape && !scrapingState.is_running && (
              <div className="unfinished-scrape-banner">
                <div className="unfinished-info">
                  <strong>Unfinished scrape detected</strong>
                  <span>
                    Started {new Date(unfinishedScrape.started_at).toLocaleString()} -
                    {' '}{unfinishedScrape.feeds_processed} of {unfinishedScrape.total_feeds} feeds completed,
                    {' '}{unfinishedScrape.total_saved} meetings saved
                  </span>
                </div>
                <div className="unfinished-actions">
                  <button onClick={resumeScraping} className="btn btn-primary">
                    Resume Scraping
                  </button>
                  <button onClick={dismissUnfinished} className="btn btn-ghost">
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div className="controls-section">
              <div className="control-buttons">
                {!scrapingState.is_running ? (
                  <button
                    onClick={handleStartClick}
                    className="btn btn-primary btn-large"
                    disabled={!isConnected}
                  >
                    Select Sources & Start
                  </button>
                ) : (
                  <>
                    <button onClick={() => setShowScrapeChoiceModal(true)} className="btn btn-danger btn-large">
                      Stop Scraping
                    </button>
                    <button onClick={handleStartClick} className="btn btn-secondary btn-large">
                      Start New
                    </button>
                  </>
                )}
                <button onClick={resetScraper} className="btn btn-ghost" title="Reset scraper if stuck">
                  Reset
                </button>
              </div>

              {!isConnected && (
                <div className="connecting-box">
                  <span className="connecting-spinner"></span>
                  Connecting to backend...
                </div>
              )}

              {isConnected && feeds.length > 0 && !scrapingState.is_running && (
                <p className="sources-hint">
                  {feeds.length} source{feeds.length !== 1 ? 's' : ''} available to scrape
                </p>
              )}

              {isConnected && !backendConfigured && !config.appId && !config.restKey && (
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
            <ActivityLog logs={scrapingState.activity_log} currentMeeting={scrapingState.current_meeting} />

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
                onSelectMeeting={setSelectedMeeting}
              />
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
          </>
        );

      case 'history':
        return <ScrapeHistory />;

      case 'statistics':
        return (
          <>
            <CoverageAnalysis />
            <Stats
              byState={scrapingState.meetings_by_state}
              byType={scrapingState.meetings_by_type}
            />
          </>
        );

      case 'sources':
        return (
          <div className="sources-section">
            <div className="sources-header">
              <h2>Configured Data Sources</h2>
              <p>These are the meeting feeds currently configured for scraping.</p>
            </div>
            <div className="sources-list">
              {feeds.length === 0 ? (
                <div className="sources-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                  <p>Loading sources...</p>
                </div>
              ) : (
                feeds.map((feed, index) => (
                  <div key={index} className="source-card">
                    <div className="source-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M2 12h20"/>
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                      </svg>
                    </div>
                    <div className="source-info">
                      <h3>{feed.name}</h3>
                      <span className="source-state">{feed.state}</span>
                    </div>
                    <div className="source-status">
                      <span className="status-badge status-active">Active</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="sources-footer">
              <p className="sources-note">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                To add more sources, edit the <code>AA_FEEDS</code> configuration in <code>backend/app.py</code>
              </p>
            </div>
          </div>
        );

      case 'directory':
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const formatTime = (time) => {
          if (!time) return '';
          const [hours, minutes] = time.split(':');
          const hour = parseInt(hours, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${ampm}`;
        };

        // Highlight search terms in text
        const highlightText = (text, search) => {
          if (!text || !search || search.length < 2) return text;
          try {
            const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            const parts = text.split(regex);
            return parts.map((part, i) =>
              regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
            );
          } catch {
            return text;
          }
        };

        return (
          <div className="directory-section">
            <div className="directory-toolbar">
              <div className="directory-search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search meetings..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                />
              </div>
              <select
                className="directory-filter"
                value={directoryState}
                onChange={(e) => setDirectoryState(e.target.value)}
              >
                <option value="">All States</option>
                <option value="AZ">Arizona</option>
                <option value="CA">California</option>
              </select>
              <div className="directory-count">
                {directoryMeetings.length} of {directoryTotal} meeting{directoryTotal !== 1 ? 's' : ''}
              </div>
            </div>

            {directoryLoading ? (
              <div className="directory-loading">
                <div className="loading-spinner"></div>
                <p>Loading meetings...</p>
              </div>
            ) : directoryMeetings.length === 0 ? (
              <div className="directory-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <p>No meetings found</p>
              </div>
            ) : (
              <>
                <div className="directory-table-wrapper">
                  <table className="directory-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Location</th>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Type</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directoryMeetings.map((meeting, index) => (
                        <tr
                          key={meeting.objectId || index}
                          onClick={() => setSelectedMeeting(meeting)}
                          className="directory-row"
                        >
                          <td className="meeting-name-cell">
                            <span className="meeting-name">
                              {highlightText(meeting.name || 'Unnamed', directorySearch)}
                            </span>
                            {meeting.isOnline && (
                              <span className="online-badge">
                                {meeting.isHybrid ? 'Hybrid' : 'Online'}
                              </span>
                            )}
                          </td>
                          <td className="location-cell">
                            {highlightText(meeting.locationName || meeting.address || '—', directorySearch)}
                          </td>
                          <td>{meeting.day !== undefined ? dayNames[meeting.day] : '—'}</td>
                          <td>{formatTime(meeting.time) || '—'}</td>
                          <td>
                            <span className="type-badge">{meeting.meetingType || '—'}</span>
                          </td>
                          <td>{meeting.state || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {directoryHasMore && (
                  <div className="directory-load-more">
                    <button
                      className="btn btn-primary load-more-btn"
                      onClick={loadMoreDirectoryMeetings}
                      disabled={directoryLoadingMore}
                    >
                      {directoryLoadingMore ? (
                        <>
                          <span className="btn-spinner"></span>
                          Loading...
                        </>
                      ) : (
                        `Load More Meetings (${directoryMeetings.length} of ${directoryTotal})`
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img
              src={currentTheme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'}
              alt="Sober Sidekick"
              className="sidebar-logo-icon"
            />
            <span>Sober Sidekick</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            item.external ? (
              <a
                key={item.id}
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="sidebar-nav-item"
              >
                {item.icon}
                <span>{item.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="external-icon">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15,3 21,3 21,9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ) : (
              <button
                key={item.id}
                className={`sidebar-nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-nav-item" onClick={() => setShowConfig(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            <span>Settings</span>
          </button>
          <button className="sidebar-nav-item" onClick={() => setShowDocs(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span>Docs</span>
          </button>

          <div className="sidebar-divider"></div>

          <div
            className="sidebar-profile"
            onMouseEnter={() => setShowUserMenu(true)}
            onMouseLeave={() => setShowUserMenu(false)}
          >
            {user?.picture ? (
              <img src={user.picture} alt="" className="profile-avatar" />
            ) : (
              <div className="profile-avatar-placeholder">
                {user?.name?.[0] || 'U'}
              </div>
            )}
            <div className="profile-info">
              <span className="profile-name">{user?.name || 'User'}</span>
              <span className="profile-status">
                <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {showUserMenu && (
              <div className="profile-dropdown">
                <button onClick={onBackToPublic} className="dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
                    <polyline points="10,17 15,12 10,7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Public View
                </button>
                <a
                  href="https://dashboard.render.com"
                  className="dropdown-item"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18"/>
                    <path d="M9 21V9"/>
                  </svg>
                  Server Logs
                </a>
                <div className="dropdown-divider"></div>
                <button onClick={toggleTheme} className="dropdown-item theme-toggle-item">
                  {currentTheme === 'dark' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/>
                      <line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                  )}
                  {currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </button>
                <div className="dropdown-divider"></div>
                <button onClick={signOut} className="dropdown-item dropdown-item-danger">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-content">
        <header className="admin-content-header">
          <h1>{menuItems.find(m => m.id === activeSection)?.label || 'Dashboard'}</h1>
        </header>
        <div className="admin-content-body">
          {renderContent()}
        </div>
      </main>

      {/* Modals */}
      {showConfig && (
        <SettingsModal
          config={config}
          onSave={saveConfig}
          onClose={() => setShowConfig(false)}
          isSaving={isSavingConfig}
          currentUser={{
            email: user?.email,
            name: user?.name,
            role: 'admin',
            isOwner: user?.email === 'chris.thompson@sobersidekick.com'
          }}
        />
      )}

      {selectedMeeting && (
        <MeetingDetail
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          isSidebar={true}
        />
      )}

      {showDocs && (
        <DevDocs onClose={() => setShowDocs(false)} />
      )}

      {showScrapeChoiceModal && (
        <div className="modal-overlay">
          <div className="modal scrape-choice-modal">
            {scrapingState.is_running ? (
              <>
                <h2>Scraper Currently Running</h2>
                <p className="scrape-choice-info">
                  A scrape is currently in progress.
                </p>
                <div className="scrape-choice-stats">
                  <div className="stat-item">
                    <span className="stat-value">{scrapingState.total_found}</span>
                    <span className="stat-label">found</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{scrapingState.total_saved}</span>
                    <span className="stat-label">saved</span>
                  </div>
                </div>
                <p className="scrape-choice-question">What would you like to do?</p>
                <div className="scrape-choice-buttons">
                  <button onClick={() => { stopScraping(); setShowScrapeChoiceModal(false); }} className="btn btn-danger">
                    Stop Current Scrape
                  </button>
                  <button onClick={() => { stopScraping(); setShouldAbandonOld(true); setShowScrapeChoiceModal(false); setShowFeedSelector(true); }} className="btn btn-secondary">
                    Cancel &amp; Start New
                  </button>
                  <button onClick={() => setShowScrapeChoiceModal(false)} className="btn btn-ghost">
                    Keep Running
                  </button>
                </div>
              </>
            ) : unfinishedScrape ? (
              <>
                <h2>Unfinished Scrape Detected</h2>
                <p className="scrape-choice-info">
                  There's an unfinished scrape from{' '}
                  <strong>{new Date(unfinishedScrape.started_at).toLocaleString()}</strong>
                </p>
                <div className="scrape-choice-stats">
                  <div className="stat-item">
                    <span className="stat-value">{unfinishedScrape.feeds_processed}</span>
                    <span className="stat-label">of {unfinishedScrape.total_feeds || 3} feeds</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{unfinishedScrape.total_saved}</span>
                    <span className="stat-label">meetings saved</span>
                  </div>
                </div>
                <p className="scrape-choice-question">What would you like to do?</p>
                <div className="scrape-choice-buttons">
                  <button onClick={resumeScraping} className="btn btn-primary">
                    Resume Previous Scrape
                  </button>
                  <button onClick={() => { setShouldAbandonOld(true); setShowScrapeChoiceModal(false); setShowFeedSelector(true); }} className="btn btn-secondary">
                    Start New Scrape
                  </button>
                  <button onClick={() => setShowScrapeChoiceModal(false)} className="btn btn-ghost">
                    Cancel
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {showFeedSelector && (
        <div className="modal-overlay">
          <div className="modal feed-selector-modal">
            <h2>Select Sources to Scrape</h2>
            <p className="feed-selector-info">
              Choose which data sources to include in this scrape.
            </p>

            {scrapeError && (
              <div className="error-box">
                {scrapeError}
              </div>
            )}

            <div className="feed-selector-actions">
              <button onClick={selectAllFeeds} className="btn btn-ghost btn-sm" disabled={isStartingScrape}>
                Select All
              </button>
              <button onClick={selectNoFeeds} className="btn btn-ghost btn-sm" disabled={isStartingScrape}>
                Select None
              </button>
            </div>

            <div className="feed-selector-list">
              {feeds.length === 0 ? (
                <div className="feed-selector-empty">
                  <p>No data sources available</p>
                  <p className="hint">Check backend connection</p>
                </div>
              ) : (
                feeds.map((feed) => (
                  <label key={feed.name} className={`feed-selector-item ${isStartingScrape ? 'disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedFeeds.includes(feed.name)}
                      onChange={() => toggleFeedSelection(feed.name)}
                      disabled={isStartingScrape}
                    />
                    <span className="feed-checkbox"></span>
                    <div className="feed-item-info">
                      <span className="feed-item-name">{feed.name}</span>
                      <span className="feed-item-state">{feed.state}</span>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="feed-selector-footer">
              <span className="selected-count">
                {selectedFeeds.length} of {feeds.length} selected
              </span>
              <div className="feed-selector-buttons">
                <button
                  onClick={() => { setShowFeedSelector(false); setScrapeError(null); setShouldAbandonOld(false); }}
                  className="btn btn-ghost"
                  disabled={isStartingScrape}
                >
                  Cancel
                </button>
                <button
                  onClick={() => startScraping()}
                  className="btn btn-primary"
                  disabled={selectedFeeds.length === 0 || isStartingScrape}
                >
                  {isStartingScrape ? (
                    <>
                      <span className="btn-spinner"></span>
                      Starting...
                    </>
                  ) : (
                    'Start Scraping'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
