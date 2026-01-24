import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { useParse } from '../contexts/ParseContext';
import SettingsModal from './SettingsModal';
import Stats from './Stats';
import ParseQueryLog from './ParseQueryLog';
import MeetingDetail from './MeetingDetail';
import ScrapeHistory from './ScrapeHistory';
import ScrapePanel from './ScrapePanel';
import CoverageAnalysis from './CoverageAnalysis';
import DevDocs from './DevDocs';
import FeedDetailPanel from './FeedDetailPanel';
import SourcesPage from './SourcesPage';
import ClusteringProgressSidebar from './ClusteringProgressSidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Heatmap Indicator Job Controls Component
function HeatmapJobControls() {
  const [jobStatus, setJobStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSchedulerLoading, setIsSchedulerLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showProgressSidebar, setShowProgressSidebar] = useState(false);
  const logsEndRef = useRef(null);

  // Fetch job status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/heatmap-indicators/status`);
      if (response.ok) {
        const data = await response.json();
        setJobStatus(data);
      }
    } catch (err) {
      console.error('Error fetching heatmap job status:', err);
    }
  }, []);

  // Poll status when job is running (faster polling during job execution)
  useEffect(() => {
    fetchStatus();
    const pollInterval = jobStatus?.is_running ? 1000 : 5000;
    const interval = setInterval(() => {
      fetchStatus();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, jobStatus?.is_running]);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showLogs, jobStatus?.logs?.length]);

  // Start the job
  const startJob = async (incremental = false) => {
    setIsLoading(true);
    setError(null);
    setShowLogs(true);  // Auto-show logs when starting job
    setShowProgressSidebar(true);  // Auto-show progress sidebar when starting job
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/heatmap-indicators/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_state_filters: true, incremental })
      });
      const data = await response.json();
      if (data.success) {
        fetchStatus();
      } else {
        setError(data.error || 'Failed to start job');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle scheduler
  const toggleScheduler = async () => {
    setIsSchedulerLoading(true);
    setError(null);
    try {
      const endpoint = jobStatus?.scheduler_enabled
        ? '/api/admin/heatmap-indicators/scheduler/stop'
        : '/api/admin/heatmap-indicators/scheduler/start';
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        fetchStatus();
      } else {
        setError(data.error || 'Failed to toggle scheduler');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSchedulerLoading(false);
    }
  };

  // Format relative time
  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    return `${diffDays}d ago`;
  };

  return (
    <div className="heatmap-job-controls">
      <div className="heatmap-job-header">
        <h3>Map Indicator Job</h3>
        <p className="heatmap-job-description">
          Pre-compute clustered map data for faster map loading
        </p>
      </div>

      <div className="heatmap-job-status">
        {jobStatus?.is_running ? (
          <div className="job-running">
            <div className="job-progress-bar">
              <div
                className="job-progress-fill"
                style={{ width: `${jobStatus.progress || 0}%` }}
              />
            </div>
            <div className="job-progress-info">
              <span className="job-phase">{jobStatus.current_phase}</span>
              <span className="job-percent">{jobStatus.progress}%</span>
            </div>
            {jobStatus.phase_detail && (
              <div className="job-phase-detail">{jobStatus.phase_detail}</div>
            )}
            {jobStatus.mode === 'incremental' && (
              <div className="job-mode-badge">Incremental</div>
            )}
          </div>
        ) : jobStatus?.last_completed_at ? (
          <div className="job-completed">
            <span className="job-completed-label">Last run:</span>
            <span className="job-completed-time">
              {formatRelativeTime(jobStatus.last_completed_at)}
            </span>
            {jobStatus.last_duration_seconds && (
              <span className="job-duration">
                ({jobStatus.last_duration_seconds}s)
              </span>
            )}
          </div>
        ) : (
          <div className="job-never-run">
            <span>Never run</span>
          </div>
        )}
      </div>

      {error && (
        <div className="job-error">
          {error}
        </div>
      )}

      <div className="heatmap-job-actions">
        <button
          className="btn btn-primary"
          onClick={() => startJob(false)}
          disabled={isLoading || jobStatus?.is_running}
          title="Regenerate all indicators from scratch"
        >
          {isLoading ? (
            <>
              <span className="btn-spinner"></span>
              Starting...
            </>
          ) : jobStatus?.is_running ? (
            'Running...'
          ) : (
            'Full Rebuild'
          )}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => startJob(true)}
          disabled={isLoading || jobStatus?.is_running}
          title="Only process new meetings (faster)"
        >
          Incremental
        </button>
        <button
          className={`btn ${jobStatus?.scheduler_enabled ? 'btn-danger' : 'btn-ghost'}`}
          onClick={toggleScheduler}
          disabled={isSchedulerLoading || jobStatus?.is_running}
          title={jobStatus?.scheduler_enabled ? 'Stop daily auto-run' : 'Enable daily auto-run at 3 AM UTC'}
        >
          {isSchedulerLoading ? (
            <span className="btn-spinner"></span>
          ) : jobStatus?.scheduler_enabled ? (
            'Stop Daily'
          ) : (
            'Enable Daily'
          )}
        </button>
      </div>

      {jobStatus?.scheduler_enabled && jobStatus?.next_scheduled_run && (
        <div className="job-schedule-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
          <span>Next run: {new Date(jobStatus.next_scheduled_run).toLocaleString()}</span>
        </div>
      )}

      {jobStatus?.indicators_created > 0 && !jobStatus?.is_running && (
        <div className="job-stats">
          <span>{jobStatus.indicators_created.toLocaleString()} indicators</span>
          <span className="stat-divider">·</span>
          <span>{jobStatus.meetings_updated.toLocaleString()} meetings updated</span>
        </div>
      )}

      {/* Show Progress Button - visible when job is running or has logs */}
      {(jobStatus?.is_running || (jobStatus?.logs && jobStatus.logs.length > 0)) && (
        <button
          className="btn-show-progress"
          onClick={() => setShowProgressSidebar(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="19" cy="6" r="2"/>
            <circle cx="5" cy="6" r="2"/>
            <circle cx="19" cy="18" r="2"/>
            <circle cx="5" cy="18" r="2"/>
            <path d="M12 9V6M12 15v3M9 12H6M15 12h3"/>
          </svg>
          <span>Show Progress</span>
          {jobStatus?.is_running && (
            <div className="progress-mini">
              <div className="progress-mini-fill" style={{ width: `${jobStatus.progress || 0}%` }} />
            </div>
          )}
        </button>
      )}

      {/* Job Logs */}
      {(jobStatus?.is_running || (jobStatus?.logs && jobStatus.logs.length > 0)) && (
        <div className="heatmap-job-logs">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? 'Hide Logs' : `Show Logs (${jobStatus?.logs?.length || 0})`}
          </button>
          {showLogs && (
            <div className="job-logs-container">
              {jobStatus?.logs?.map((log, idx) => (
                <div key={idx} className={`job-log-entry job-log-${log.level}`}>
                  <span className="job-log-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="job-log-message">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Job History */}
      {jobStatus?.history && jobStatus.history.length > 0 && (
        <div className="heatmap-job-history">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : `Show History (${jobStatus.history.length})`}
          </button>
          {showHistory && (
            <div className="job-history-list">
              {jobStatus.history.map((entry, idx) => (
                <div key={idx} className="job-history-item">
                  <span className="job-time">
                    {formatRelativeTime(entry.completed_at)}
                    {entry.mode === 'incremental' && (
                      <span className="job-mode-tag">inc</span>
                    )}
                  </span>
                  <span className="job-result">
                    {entry.success ? (
                      <>
                        <span className="success">✓</span>
                        {entry.indicators_created > 0 && (
                          <span>{entry.indicators_created} ind</span>
                        )}
                        {entry.meetings_updated > 0 && (
                          <span>{entry.meetings_updated} mtgs</span>
                        )}
                        {entry.new_meetings > 0 && entry.mode === 'incremental' && (
                          <span>{entry.new_meetings} new</span>
                        )}
                        <span>{entry.duration_seconds}s</span>
                      </>
                    ) : (
                      <span className="error">✗ {entry.error || 'Failed'}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clustering Progress Sidebar */}
      <ClusteringProgressSidebar
        isOpen={showProgressSidebar}
        onClose={() => setShowProgressSidebar(false)}
        jobStatus={jobStatus}
      />
    </div>
  );
}

const POLL_INTERVAL_ACTIVE = 500;
const POLL_INTERVAL_IDLE = 2000;

// Cache keys for AdminPanel
const ADMIN_CACHE_KEYS = {
  FEEDS: 'admin:feeds',
  AVAILABLE_STATES: 'admin:availableStates',
  DIRECTORY_MEETINGS: 'admin:directoryMeetings',
  DIRECTORY_TOTAL: 'admin:directoryTotal',
  SCRAPING_STATE: 'admin:scrapingState'
};

// Cache TTL: 5 minutes for admin data
const ADMIN_CACHE_TTL = 5 * 60 * 1000;

// Calculate distance between two lat/lng points using Haversine formula
// Returns distance in miles
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return Infinity;
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Calculate bounding box from center point and radius in miles
const calculateBoundingBox = (centerLat, centerLng, radiusMiles) => {
  const R = 3959; // Earth's radius in miles
  const lat = centerLat * Math.PI / 180;
  const deltaLat = radiusMiles / R;
  const deltaLng = radiusMiles / (R * Math.cos(lat));

  return {
    north: centerLat + (deltaLat * 180 / Math.PI),
    south: centerLat - (deltaLat * 180 / Math.PI),
    east: centerLng + (deltaLng * 180 / Math.PI),
    west: centerLng - (deltaLng * 180 / Math.PI)
  };
};

function AdminPanel({ onBackToPublic }) {
  const { user, signOut } = useAuth();
  const { getCache, setCache } = useDataCache();
  const { isInitialized: parseInitialized, config: parseConfig } = useParse();

  // Initialize from cache
  const cachedFeeds = getCache(ADMIN_CACHE_KEYS.FEEDS);
  const cachedStates = getCache(ADMIN_CACHE_KEYS.AVAILABLE_STATES);
  const cachedDirectory = getCache(ADMIN_CACHE_KEYS.DIRECTORY_MEETINGS);
  const cachedDirectoryTotal = getCache(ADMIN_CACHE_KEYS.DIRECTORY_TOTAL);
  const cachedScrapingState = getCache(ADMIN_CACHE_KEYS.SCRAPING_STATE);

  // Connection status derived from Parse initialization - once connected, stays connected
  const isConnected = parseInitialized && parseConfig.hasAppId && parseConfig.hasJsKey;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuTimeoutRef = useRef(null);

  // Handlers for user menu hover with delay to prevent accidental closing
  const handleUserMenuEnter = useCallback(() => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
      userMenuTimeoutRef.current = null;
    }
    setShowUserMenu(true);
  }, []);

  const handleUserMenuLeave = useCallback(() => {
    userMenuTimeoutRef.current = setTimeout(() => {
      setShowUserMenu(false);
    }, 150); // 150ms delay before closing
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userMenuTimeoutRef.current) {
        clearTimeout(userMenuTimeoutRef.current);
      }
    };
  }, []);

  const [activeSection, setActiveSection] = useState('scraper');
  const [expandedSubmenu, setExpandedSubmenu] = useState(null);
  const [showScrapePanel, setShowScrapePanel] = useState(false);
  const [scrapingState, setScrapingState] = useState(cachedScrapingState?.data || {
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
  const [showSettings, setShowSettings] = useState(false);
  // Derive backendConfigured from Parse context
  const backendConfigured = parseInitialized && parseConfig.hasAppId && parseConfig.hasJsKey;
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [unfinishedScrape, setUnfinishedScrape] = useState(null);
  const [checkedUnfinished, setCheckedUnfinished] = useState(false);
  const [showScrapeChoiceModal, setShowScrapeChoiceModal] = useState(false);
  const [feeds, setFeeds] = useState(cachedFeeds?.data || []);
  const [selectedFeeds, setSelectedFeeds] = useState([]);
  const [showFeedSelector, setShowFeedSelector] = useState(false);
  const [isStartingScrape, setIsStartingScrape] = useState(false);
  const [scrapeError, setScrapeError] = useState(null);
  const [shouldAbandonOld, setShouldAbandonOld] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  // Sources search and filter state
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [sourceLastScrapeFilter, setSourceLastScrapeFilter] = useState('');
  const [sourceStateFilter, setSourceStateFilter] = useState('');
  const [sourceSortColumn, setSourceSortColumn] = useState('name');
  const [sourceSortDirection, setSourceSortDirection] = useState('asc');
  const [expandedFeed, setExpandedFeed] = useState(null);
  // Progressive feed loading state
  const [feedsLoading, setFeedsLoading] = useState(!cachedFeeds?.data);
  const [visibleFeedCount, setVisibleFeedCount] = useState(20);
  const FEEDS_PER_PAGE = 20;
  const [savedConfigs, setSavedConfigs] = useState(() => {
    const saved = localStorage.getItem('scrape_configurations');
    return saved ? JSON.parse(saved) : [];
  });
  const [showSaveConfigInput, setShowSaveConfigInput] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');

  // Directory state - initialize from cache
  const [directoryMeetings, setDirectoryMeetings] = useState(cachedDirectory?.data || []);
  const [directoryLoading, setDirectoryLoading] = useState(!cachedDirectory?.data);
  const [directoryLoadingMore, setDirectoryLoadingMore] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryState, setDirectoryState] = useState('');
  const [directoryDay, setDirectoryDay] = useState('');
  const [directoryType, setDirectoryType] = useState('');
  const [directoryOnline, setDirectoryOnline] = useState('');
  const [directoryTotal, setDirectoryTotal] = useState(cachedDirectoryTotal?.data || 0);
  const [directoryHasMore, setDirectoryHasMore] = useState(true);
  const [availableStates, setAvailableStates] = useState(cachedStates?.data || []);
  const DIRECTORY_PAGE_SIZE = 25;

  // Location filter state
  const [directoryLocation, setDirectoryLocation] = useState(null); // { lat, lng, name }
  const [directoryLocationSearch, setDirectoryLocationSearch] = useState('');
  const [directoryLocationResults, setDirectoryLocationResults] = useState([]);
  const [directoryLocationSearching, setDirectoryLocationSearching] = useState(false);
  const [directoryRadius, setDirectoryRadius] = useState(25); // miles
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationSearchTimeoutRef = useRef(null);
  const locationDropdownRef = useRef(null);

  // Sorting state
  const [directorySort, setDirectorySort] = useState({ column: null, direction: 'asc' });

  const isRunningRef = useRef(false);
  const pollIntervalRef = useRef(null);
  const statusFetchInProgressRef = useRef(false);
  const statusAbortControllerRef = useRef(null);

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

  // Backend config status is now derived from ParseContext (no fetch needed)

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
    setFeedsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/feeds`);
      if (response.ok) {
        const data = await response.json();
        const feedList = data.feeds || [];
        setFeeds(feedList);
        // Reset visible count when feeds are refreshed
        setVisibleFeedCount(FEEDS_PER_PAGE);
        // Default to feeds that have never been scraped
        const neverScrapedFeeds = feedList.filter(f => !f.lastScraped);
        // If there are never-scraped feeds, select those; otherwise select all
        setSelectedFeeds(neverScrapedFeeds.length > 0
          ? neverScrapedFeeds.map(f => f.name)
          : feedList.map(f => f.name)
        );
        // Cache the feeds
        setCache(ADMIN_CACHE_KEYS.FEEDS, feedList, ADMIN_CACHE_TTL);
      }
    } catch (error) {
      console.error('Error fetching feeds:', error);
    } finally {
      setFeedsLoading(false);
    }
  }, [setCache]);

  // Fetch available states for directory filter
  const fetchAvailableStates = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings/by-state`);
      if (response.ok) {
        const data = await response.json();
        const states = (data.states || []).map(s => s.state).filter(Boolean).sort();
        setAvailableStates(states);
      }
    } catch (error) {
      console.error('Error fetching available states:', error);
    }
  }, []);

  // Fetch directory meetings (initial load or filter change)
  const fetchDirectoryMeetings = useCallback(async (search = '', state = '', day = '', type = '', online = '', location = null, radius = 25) => {
    setDirectoryLoading(true);
    setDirectoryMeetings([]);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      let url = `${BACKEND_URL}/api/meetings?limit=${DIRECTORY_PAGE_SIZE}&skip=0`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (state) url += `&state=${encodeURIComponent(state)}`;
      if (day !== '') url += `&day=${encodeURIComponent(day)}`;
      if (type) url += `&type=${encodeURIComponent(type)}`;
      if (online === 'online') url += `&online=true`;
      if (online === 'hybrid') url += `&hybrid=true`;
      if (online === 'in-person') url += `&online=false`;

      // Add location bounds if location is set
      if (location && location.lat && location.lng) {
        const bounds = calculateBoundingBox(location.lat, location.lng, radius);
        url += `&north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`;
        url += `&center_lat=${location.lat}&center_lng=${location.lng}`;
      }

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
      if (directoryDay !== '') url += `&day=${encodeURIComponent(directoryDay)}`;
      if (directoryType) url += `&type=${encodeURIComponent(directoryType)}`;
      if (directoryOnline === 'online') url += `&online=true`;
      if (directoryOnline === 'hybrid') url += `&hybrid=true`;
      if (directoryOnline === 'in-person') url += `&online=false`;

      // Add location bounds if location is set
      if (directoryLocation && directoryLocation.lat && directoryLocation.lng) {
        const bounds = calculateBoundingBox(directoryLocation.lat, directoryLocation.lng, directoryRadius);
        url += `&north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`;
        url += `&center_lat=${directoryLocation.lat}&center_lng=${directoryLocation.lng}`;
      }

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
  }, [directoryMeetings.length, directorySearch, directoryState, directoryDay, directoryType, directoryOnline, directoryLoadingMore, directoryHasMore, directoryLocation, directoryRadius, DIRECTORY_PAGE_SIZE]);

  // Search for locations using Nominatim
  const searchLocations = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setDirectoryLocationResults([]);
      return;
    }

    // Clear any pending search
    if (locationSearchTimeoutRef.current) {
      clearTimeout(locationSearchTimeoutRef.current);
    }

    // Debounce the API call
    locationSearchTimeoutRef.current = setTimeout(async () => {
      setDirectoryLocationSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'MeetingScraper/1.0'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const locations = data.map(item => ({
            value: item.display_name.split(',').slice(0, 2).join(',').trim(),
            fullLabel: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            city: item.address?.city || item.address?.town || item.address?.village || '',
            state: item.address?.state || ''
          }));
          setDirectoryLocationResults(locations);
        }
      } catch (error) {
        console.error('Location search error:', error);
      } finally {
        setDirectoryLocationSearching(false);
      }
    }, 300);
  }, []);

  // Handle location selection
  const handleLocationSelect = useCallback((location) => {
    setDirectoryLocation({
      lat: location.lat,
      lng: location.lng,
      name: location.value
    });
    setDirectoryLocationSearch(location.value);
    setShowLocationDropdown(false);
    setDirectoryLocationResults([]);
  }, []);

  // Clear location filter
  const clearLocationFilter = useCallback(() => {
    setDirectoryLocation(null);
    setDirectoryLocationSearch('');
    setDirectoryLocationResults([]);
    setShowLocationDropdown(false);
  }, []);

  // Handle click outside location dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup location search timeout
  useEffect(() => {
    return () => {
      if (locationSearchTimeoutRef.current) {
        clearTimeout(locationSearchTimeoutRef.current);
      }
    };
  }, []);

  // Poll scraping state from backend (for scraper progress updates only)
  const fetchScrapingState = useCallback(async () => {
    // Skip if a request is already in progress to prevent pile-up
    if (statusFetchInProgressRef.current) {
      return;
    }

    statusFetchInProgressRef.current = true;

    // Cancel any previous request that might still be pending
    if (statusAbortControllerRef.current) {
      statusAbortControllerRef.current.abort();
    }
    statusAbortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${BACKEND_URL}/api/status`, {
        signal: statusAbortControllerRef.current.signal
      });
      if (response.ok) {
        const data = await response.json();

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
      }
    } catch (error) {
      // Silently ignore aborted requests and other errors
      // Scraper status is optional, Parse connection is primary
    } finally {
      statusFetchInProgressRef.current = false;
    }
  }, []);

  // Keep fetchScrapingState ref updated for use in polling
  const fetchScrapingStateRef = useRef(fetchScrapingState);
  useEffect(() => {
    fetchScrapingStateRef.current = fetchScrapingState;
  }, [fetchScrapingState]);

  // Initial setup effect - runs once on mount
  // Uses refs to avoid re-running when callbacks change
  const initialSetupDoneRef = useRef(false);
  useEffect(() => {
    if (initialSetupDoneRef.current) return;
    initialSetupDoneRef.current = true;

    fetchScrapingState();
    checkUnfinishedScrape();
    // Only fetch feeds if not cached
    if (!cachedFeeds?.data || cachedFeeds.data.length === 0) {
      fetchFeeds();
    }

    return () => {
      // Abort any pending status request on unmount
      if (statusAbortControllerRef.current) {
        statusAbortControllerRef.current.abort();
      }
    };
  }, [fetchScrapingState, checkUnfinishedScrape, fetchFeeds, cachedFeeds]);

  // Polling effect - adjusts interval based on scraper running state
  // CRITICAL: Use ref for fetchScrapingState to avoid recreating interval on callback change
  useEffect(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const interval = scrapingState.is_running ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
    pollIntervalRef.current = setInterval(() => {
      fetchScrapingStateRef.current?.();
    }, interval);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [scrapingState.is_running]); // Removed fetchScrapingState - use ref instead

  // Fetch available states on mount (skip if cached)
  useEffect(() => {
    if (!cachedStates?.data || cachedStates.data.length === 0) {
      fetchAvailableStates();
    }
  }, [fetchAvailableStates, cachedStates]);

  // Fetch directory meetings when section is active or filters change
  // Use a ref to track if we've done initial fetch to avoid loops
  const initialDirectoryFetchRef = useRef(false);

  useEffect(() => {
    if (activeSection === 'directory') {
      const hasFilters = directorySearch || directoryState || directoryDay || directoryType || directoryOnline || directoryLocation;
      // Fetch if:
      // 1. We have no meetings and haven't done initial fetch yet, OR
      // 2. Filters changed (hasFilters is truthy means user set a filter)
      const needsInitialFetch = directoryMeetings.length === 0 && !initialDirectoryFetchRef.current;

      if (needsInitialFetch || hasFilters) {
        initialDirectoryFetchRef.current = true;
        fetchDirectoryMeetings(directorySearch, directoryState, directoryDay, directoryType, directoryOnline, directoryLocation, directoryRadius);
      }
    } else {
      // Reset the ref when leaving directory section so next visit fetches fresh
      initialDirectoryFetchRef.current = false;
    }
  }, [activeSection, directorySearch, directoryState, directoryDay, directoryType, directoryOnline, directoryLocation, directoryRadius, fetchDirectoryMeetings, directoryMeetings.length]);

  // Cache feeds when they change
  useEffect(() => {
    if (feeds.length > 0) {
      setCache(ADMIN_CACHE_KEYS.FEEDS, feeds, ADMIN_CACHE_TTL);
    }
  }, [feeds, setCache]);

  // Cache available states
  useEffect(() => {
    if (availableStates.length > 0) {
      setCache(ADMIN_CACHE_KEYS.AVAILABLE_STATES, availableStates, ADMIN_CACHE_TTL);
    }
  }, [availableStates, setCache]);

  // Cache directory meetings
  useEffect(() => {
    if (directoryMeetings.length > 0) {
      setCache(ADMIN_CACHE_KEYS.DIRECTORY_MEETINGS, directoryMeetings, ADMIN_CACHE_TTL);
    }
  }, [directoryMeetings, setCache]);

  // Cache directory total
  useEffect(() => {
    if (directoryTotal > 0) {
      setCache(ADMIN_CACHE_KEYS.DIRECTORY_TOTAL, directoryTotal, ADMIN_CACHE_TTL);
    }
  }, [directoryTotal, setCache]);

  // Backend configured status is now derived from ParseContext - no caching needed

  // Cache scraping state (but only non-running states to avoid stale running states)
  useEffect(() => {
    if (!scrapingState.is_running) {
      setCache(ADMIN_CACHE_KEYS.SCRAPING_STATE, scrapingState, ADMIN_CACHE_TTL);
    }
  }, [scrapingState, setCache]);

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

  const selectNeedsScrape = () => {
    const needsScrapeFeeds = feeds.filter(f => {
      if (!f.lastScraped) return true;
      const daysSinceLastScrape = (new Date() - new Date(f.lastScraped)) / (1000 * 60 * 60 * 24);
      return daysSinceLastScrape > 7;
    });
    setSelectedFeeds(needsScrapeFeeds.map(f => f.name));
  };

  const selectNeverScraped = () => {
    const neverScrapedFeeds = feeds.filter(f => !f.lastScraped);
    setSelectedFeeds(neverScrapedFeeds.map(f => f.name));
  };

  const saveConfiguration = (name) => {
    if (!name.trim()) return;
    const newConfig = {
      id: Date.now(),
      name: name.trim(),
      feeds: selectedFeeds,
      createdAt: new Date().toISOString()
    };
    const updated = [...savedConfigs.filter(c => c.name !== name.trim()), newConfig];
    setSavedConfigs(updated);
    localStorage.setItem('scrape_configurations', JSON.stringify(updated));
    setShowSaveConfigInput(false);
    setNewConfigName('');
  };

  const loadConfiguration = (config) => {
    // Only select feeds that still exist
    const validFeeds = config.feeds.filter(f => feeds.some(feed => feed.name === f));
    setSelectedFeeds(validFeeds);
  };

  const deleteConfiguration = (configId) => {
    const updated = savedConfigs.filter(c => c.id !== configId);
    setSavedConfigs(updated);
    localStorage.setItem('scrape_configurations', JSON.stringify(updated));
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
        setShowScrapePanel(true); // Open scrape panel automatically
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
        setShowScrapePanel(true); // Open scrape panel automatically
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

  const menuItems = [
    { id: 'scraper', label: 'Scraper', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    )},
    { id: 'performance', label: 'Performance', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ), children: [
      { id: 'statistics', label: 'Statistics', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      )},
      { id: 'parse-logs', label: 'Parse Logs', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
      )},
    ]},
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
                  <button onClick={() => { resumeScraping(); setShowScrapePanel(true); }} className="btn btn-primary">
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
                    Start Scrape
                  </button>
                ) : (
                  <>
                    <button onClick={() => setShowScrapePanel(true)} className="btn btn-primary btn-large">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      View Progress
                    </button>
                    <button onClick={() => setShowScrapeChoiceModal(true)} className="btn btn-danger">
                      Stop
                    </button>
                  </>
                )}
                <button onClick={resetScraper} className="btn btn-ghost" title="Reset scraper if stuck">
                  Reset
                </button>
              </div>

              {/* Active scrape status indicator */}
              {scrapingState.is_running && (
                <div className="scrape-status-indicator">
                  <span className="status-dot running"></span>
                  <span className="status-text">
                    Scraping {scrapingState.current_source || 'Starting...'} -
                    {' '}{scrapingState.total_found} found, {scrapingState.total_saved} saved
                  </span>
                </div>
              )}

              {!backendConfigured && (
                <div className="error-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Back4app not configured. Set REACT_APP_BACK4APP_APP_ID and REACT_APP_BACK4APP_JS_KEY environment variables.
                </div>
              )}

              {isConnected && feeds.length > 0 && !scrapingState.is_running && !showFeedSelector && (
                <p className="sources-hint">
                  {feeds.length} source{feeds.length !== 1 ? 's' : ''} available to scrape
                </p>
              )}

              {backendConfigured && !showFeedSelector && !scrapingState.is_running && (
                <div className="success-box">
                  Back4app configured via environment variables
                </div>
              )}
            </div>

            {/* Scrape History - Always visible */}
            <ScrapeHistory onViewProgress={() => setShowScrapePanel(true)} />
          </>
        );

      case 'parse-logs':
        return <ParseQueryLog />;

      case 'statistics':
        return (
          <>
            <HeatmapJobControls />
            <CoverageAnalysis />
            <Stats
              byState={scrapingState.meetings_by_state}
              byType={scrapingState.meetings_by_type}
            />
          </>
        );

      case 'sources':
        return (
          <SourcesPage
            feeds={feeds}
            feedsLoading={feedsLoading}
            onSelectSource={setSelectedSource}
            onRefreshFeeds={fetchFeeds}
          />
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

        // Check if any filters are active
        const hasActiveFilters = directorySearch || directoryState || directoryDay !== '' || directoryType || directoryOnline || directoryLocation;

        // Clear all filters
        const clearAllFilters = () => {
          setDirectorySearch('');
          setDirectoryState('');
          setDirectoryDay('');
          setDirectoryType('');
          setDirectoryOnline('');
          clearLocationFilter();
        };

        // Handle column sorting
        const handleSort = (column) => {
          setDirectorySort(prev => ({
            column,
            direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
          }));
        };

        // Get sort indicator
        const getSortIndicator = (column) => {
          if (directorySort.column !== column) return null;
          return directorySort.direction === 'asc' ? ' ↑' : ' ↓';
        };

        // Sort meetings client-side
        const sortedMeetings = [...directoryMeetings].sort((a, b) => {
          if (!directorySort.column) {
            // If location is set and no explicit sort, sort by distance
            if (directoryLocation) {
              const distA = calculateDistance(directoryLocation.lat, directoryLocation.lng, a.latitude, a.longitude);
              const distB = calculateDistance(directoryLocation.lat, directoryLocation.lng, b.latitude, b.longitude);
              return distA - distB;
            }
            return 0;
          }

          let aVal, bVal;
          switch (directorySort.column) {
            case 'name':
              aVal = (a.name || '').toLowerCase();
              bVal = (b.name || '').toLowerCase();
              break;
            case 'location':
              aVal = (a.locationName || a.address || '').toLowerCase();
              bVal = (b.locationName || b.address || '').toLowerCase();
              break;
            case 'day':
              aVal = a.day ?? 7;
              bVal = b.day ?? 7;
              break;
            case 'time':
              aVal = a.time || '';
              bVal = b.time || '';
              break;
            case 'type':
              aVal = (a.meetingType || '').toLowerCase();
              bVal = (b.meetingType || '').toLowerCase();
              break;
            case 'state':
              aVal = (a.state || '').toLowerCase();
              bVal = (b.state || '').toLowerCase();
              break;
            case 'distance':
              aVal = directoryLocation ? calculateDistance(directoryLocation.lat, directoryLocation.lng, a.latitude, a.longitude) : 0;
              bVal = directoryLocation ? calculateDistance(directoryLocation.lat, directoryLocation.lng, b.latitude, b.longitude) : 0;
              break;
            default:
              return 0;
          }

          if (aVal < bVal) return directorySort.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return directorySort.direction === 'asc' ? 1 : -1;
          return 0;
        });

        // Format distance for display
        const formatDistance = (meeting) => {
          if (!directoryLocation || !meeting.latitude || !meeting.longitude) return '—';
          const dist = calculateDistance(directoryLocation.lat, directoryLocation.lng, meeting.latitude, meeting.longitude);
          if (dist === Infinity) return '—';
          return dist < 1 ? `${(dist * 5280).toFixed(0)} ft` : `${dist.toFixed(1)} mi`;
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
                {availableStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <select
                className="directory-filter"
                value={directoryDay}
                onChange={(e) => setDirectoryDay(e.target.value)}
              >
                <option value="">All Days</option>
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
              <select
                className="directory-filter"
                value={directoryType}
                onChange={(e) => setDirectoryType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="AA">AA</option>
                <option value="NA">NA</option>
                <option value="Al-Anon">Al-Anon</option>
              </select>
              <select
                className="directory-filter"
                value={directoryOnline}
                onChange={(e) => setDirectoryOnline(e.target.value)}
              >
                <option value="">All Formats</option>
                <option value="in-person">In-Person</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
              {hasActiveFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
                  Clear Filters
                </button>
              )}
            </div>
            <div className="directory-toolbar directory-toolbar-location">
              <div className="location-filter-group" ref={locationDropdownRef}>
                <div className="directory-search location-search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search location..."
                    value={directoryLocationSearch}
                    onChange={(e) => {
                      setDirectoryLocationSearch(e.target.value);
                      searchLocations(e.target.value);
                      setShowLocationDropdown(true);
                    }}
                    onFocus={() => {
                      if (directoryLocationResults.length > 0) {
                        setShowLocationDropdown(true);
                      }
                    }}
                  />
                  {directoryLocation && (
                    <button
                      className="location-clear-btn"
                      onClick={clearLocationFilter}
                      title="Clear location"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
                {showLocationDropdown && directoryLocationResults.length > 0 && (
                  <div className="location-dropdown">
                    {directoryLocationSearching && (
                      <div className="location-dropdown-item loading">Searching...</div>
                    )}
                    {directoryLocationResults.map((location, idx) => (
                      <div
                        key={idx}
                        className="location-dropdown-item"
                        onClick={() => handleLocationSelect(location)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>{location.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {directoryLocation && (
                <div className="radius-filter-group">
                  <label>Radius:</label>
                  <select
                    className="directory-filter radius-select"
                    value={directoryRadius}
                    onChange={(e) => setDirectoryRadius(Number(e.target.value))}
                  >
                    <option value="5">5 miles</option>
                    <option value="10">10 miles</option>
                    <option value="25">25 miles</option>
                    <option value="50">50 miles</option>
                    <option value="100">100 miles</option>
                  </select>
                </div>
              )}
            </div>
            <div className="directory-count-row">
              <div className="directory-count">
                {directoryMeetings.length} of {directoryTotal} meeting{directoryTotal !== 1 ? 's' : ''}
              </div>
            </div>

            {directoryLoading ? (
              <div className="skeleton-directory-container">
                <div className="skeleton-directory-table">
                  <div className="skeleton-directory-header">
                    <div className="skeleton-directory-header-cell"></div>
                    <div className="skeleton-directory-header-cell"></div>
                    <div className="skeleton-directory-header-cell"></div>
                    <div className="skeleton-directory-header-cell"></div>
                    <div className="skeleton-directory-header-cell"></div>
                    <div className="skeleton-directory-header-cell"></div>
                  </div>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="skeleton-directory-row">
                      <div className="skeleton-directory-cell name"></div>
                      <div className="skeleton-directory-cell location"></div>
                      <div className="skeleton-directory-cell day"></div>
                      <div className="skeleton-directory-cell time"></div>
                      <div className="skeleton-directory-cell type"></div>
                      <div className="skeleton-directory-cell state"></div>
                    </div>
                  ))}
                </div>
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
                        <th className="sortable-header" onClick={() => handleSort('name')}>
                          Name{getSortIndicator('name')}
                        </th>
                        <th className="sortable-header" onClick={() => handleSort('location')}>
                          Location{getSortIndicator('location')}
                        </th>
                        {directoryLocation && (
                          <th className="sortable-header distance-col" onClick={() => handleSort('distance')}>
                            Distance{getSortIndicator('distance')}
                          </th>
                        )}
                        <th className="sortable-header" onClick={() => handleSort('day')}>
                          Day{getSortIndicator('day')}
                        </th>
                        <th className="sortable-header" onClick={() => handleSort('time')}>
                          Time{getSortIndicator('time')}
                        </th>
                        <th className="sortable-header" onClick={() => handleSort('type')}>
                          Type{getSortIndicator('type')}
                        </th>
                        <th className="sortable-header" onClick={() => handleSort('state')}>
                          State{getSortIndicator('state')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMeetings.map((meeting, index) => (
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
                          {directoryLocation && (
                            <td className="distance-cell">{formatDistance(meeting)}</td>
                          )}
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
              src="/logo.png"
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
            ) : item.children ? (
              <div key={item.id} className="sidebar-nav-group">
                <button
                  className={`sidebar-nav-item sidebar-nav-parent ${expandedSubmenu === item.id || item.children.some(child => child.id === activeSection) ? 'expanded' : ''}`}
                  onClick={() => setExpandedSubmenu(expandedSubmenu === item.id ? null : item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="submenu-chevron"
                  >
                    <polyline points="6,9 12,15 18,9"/>
                  </svg>
                </button>
                {(expandedSubmenu === item.id || item.children.some(child => child.id === activeSection)) && (
                  <div className="sidebar-submenu">
                    {item.children.map(child => (
                      <button
                        key={child.id}
                        className={`sidebar-nav-item sidebar-submenu-item ${activeSection === child.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(child.id)}
                      >
                        {child.icon}
                        <span>{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
          <button className="sidebar-nav-item" onClick={() => setShowSettings(true)}>
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
            onMouseEnter={handleUserMenuEnter}
            onMouseLeave={handleUserMenuLeave}
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
                {isConnected ? 'Connected' : 'Not Configured'}
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
                  href="https://dashboard.render.com/project/prj-d5n7urje5dus73f07fr0"
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
                <a
                  href="/download"
                  className="dropdown-item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Mac App
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
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
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

      {selectedSource && (
        <FeedDetailPanel
          feed={selectedSource}
          isOpen={!!selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}

      {showDocs && (
        <DevDocs onClose={() => setShowDocs(false)} />
      )}

      {/* Scrape Choice Sidebar Overlay */}
      {showScrapeChoiceModal && (
        <div className="sidebar-overlay" onClick={() => setShowScrapeChoiceModal(false)} />
      )}

      {/* Scrape Choice Sidebar */}
      <div className={`scrape-choice-sidebar ${showScrapeChoiceModal ? 'open' : ''}`}>
        <div className="scrape-choice-sidebar-header">
          <h2>{scrapingState.is_running ? 'Scraper Running' : 'Unfinished Scrape'}</h2>
          <button
            className="sidebar-close-btn"
            onClick={() => setShowScrapeChoiceModal(false)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="scrape-choice-sidebar-content">
          {scrapingState.is_running ? (
            <>
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
                <div className="stat-item">
                  <span className="stat-value">{scrapingState.total_duplicates || 0}</span>
                  <span className="stat-label">duplicates</span>
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
                  <span className="stat-label">saved</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{unfinishedScrape.total_duplicates || 0}</span>
                  <span className="stat-label">duplicates</span>
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

      {/* Feed Selector Sidebar */}
      <div className={`feed-selector-sidebar ${showFeedSelector ? 'open' : ''}`}>
        <div className="feed-selector-sidebar-header">
          <h2>Select Sources to Scrape</h2>
          <button
            className="sidebar-close-btn"
            onClick={() => { setShowFeedSelector(false); setScrapeError(null); setShouldAbandonOld(false); setFeedSearchQuery(''); setExpandedFeed(null); }}
            disabled={isStartingScrape}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p className="feed-selector-info">
          Choose which data sources to include in this scrape.
        </p>

        {scrapeError && (
          <div className="error-box">
            {scrapeError}
          </div>
        )}

        {/* Search Bar */}
        <div className="feed-search-container">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search sources..."
            value={feedSearchQuery}
            onChange={(e) => setFeedSearchQuery(e.target.value)}
            className="feed-search-input"
            disabled={isStartingScrape}
          />
          {feedSearchQuery && (
            <button
              className="feed-search-clear"
              onClick={() => setFeedSearchQuery('')}
              disabled={isStartingScrape}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="feed-selector-actions">
          <button onClick={selectNeverScraped} className="btn btn-ghost btn-sm" disabled={isStartingScrape} title="Select sources that have never been scraped">
            Never Scraped
          </button>
          <button onClick={selectNeedsScrape} className="btn btn-ghost btn-sm" disabled={isStartingScrape} title="Select sources that need to be scraped (never scraped or >7 days old)">
            Needs Scrape
          </button>
          <button onClick={selectAllFeeds} className="btn btn-ghost btn-sm" disabled={isStartingScrape}>
            All
          </button>
          <button onClick={selectNoFeeds} className="btn btn-ghost btn-sm" disabled={isStartingScrape}>
            None
          </button>
          <span className="selected-count-inline">
            {selectedFeeds.length} of {feeds.length}
          </span>
        </div>

        {/* Saved Configurations */}
        <div className="feed-config-section">
          {savedConfigs.length > 0 && (
            <div className="saved-configs-dropdown">
              <select
                className="config-select"
                onChange={(e) => {
                  const config = savedConfigs.find(c => c.id === parseInt(e.target.value));
                  if (config) loadConfiguration(config);
                  e.target.value = '';
                }}
                disabled={isStartingScrape}
                defaultValue=""
              >
                <option value="" disabled>Load saved config...</option>
                {savedConfigs.map(config => (
                  <option key={config.id} value={config.id}>
                    {config.name} ({config.feeds.length} sources)
                  </option>
                ))}
              </select>
              {savedConfigs.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm config-delete-btn"
                  onClick={() => {
                    const configToDelete = savedConfigs[savedConfigs.length - 1];
                    if (window.confirm(`Delete "${configToDelete.name}"?`)) {
                      deleteConfiguration(configToDelete.id);
                    }
                  }}
                  disabled={isStartingScrape}
                  title="Delete most recent config"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              )}
            </div>
          )}

          {showSaveConfigInput ? (
            <div className="save-config-input-row">
              <input
                type="text"
                placeholder="Config name..."
                value={newConfigName}
                onChange={(e) => setNewConfigName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveConfiguration(newConfigName);
                  if (e.key === 'Escape') { setShowSaveConfigInput(false); setNewConfigName(''); }
                }}
                className="config-name-input"
                autoFocus
                disabled={isStartingScrape}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => saveConfiguration(newConfigName)}
                disabled={!newConfigName.trim() || isStartingScrape}
              >
                Save
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowSaveConfigInput(false); setNewConfigName(''); }}
                disabled={isStartingScrape}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm save-config-btn"
              onClick={() => setShowSaveConfigInput(true)}
              disabled={selectedFeeds.length === 0 || isStartingScrape}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
              Save Selection
            </button>
          )}
        </div>

        <div className="feed-selector-list">
          {feedsLoading && feeds.length === 0 ? (
            <div className="feed-selector-loading">
              <div className="feeds-loading-skeleton">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="feed-skeleton-item">
                    <div className="skeleton-checkbox"></div>
                    <div className="skeleton-content">
                      <div className="skeleton-title"></div>
                      <div className="skeleton-subtitle"></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="feeds-loading-message">Loading sources...</div>
            </div>
          ) : !feedsLoading && feeds.length === 0 ? (
            <div className="feed-selector-empty">
              <p>No data sources available</p>
              <p className="hint">Check backend connection</p>
            </div>
          ) : (
            (() => {
              const filteredFeeds = feeds.filter(feed =>
                feed.name.toLowerCase().includes(feedSearchQuery.toLowerCase()) ||
                feed.state.toLowerCase().includes(feedSearchQuery.toLowerCase())
              );

              if (filteredFeeds.length === 0) {
                return (
                  <div className="feed-selector-empty">
                    <p>No sources match "{feedSearchQuery}"</p>
                    <button className="btn btn-ghost btn-sm" onClick={() => setFeedSearchQuery('')}>
                      Clear search
                    </button>
                  </div>
                );
              }

              // Progressive loading: only show up to visibleFeedCount feeds
              const visibleFeeds = feedSearchQuery ? filteredFeeds : filteredFeeds.slice(0, visibleFeedCount);
              const hasMoreFeeds = !feedSearchQuery && filteredFeeds.length > visibleFeedCount;
              const loadMoreFeeds = () => setVisibleFeedCount(prev => prev + FEEDS_PER_PAGE);

              return (
                <>
                  {/* Loading progress indicator */}
                  {!feedSearchQuery && (
                    <div className="feeds-progress-bar">
                      <div className="feeds-progress-info">
                        <span>Showing {Math.min(visibleFeedCount, filteredFeeds.length)} of {filteredFeeds.length} sources</span>
                        {feedsLoading && (
                          <span className="feeds-refreshing-indicator">
                            <span className="refresh-spinner"></span>
                            Refreshing...
                          </span>
                        )}
                      </div>
                      <div className="feeds-progress-track">
                        <div
                          className="feeds-progress-fill"
                          style={{ width: `${Math.min(100, (visibleFeedCount / filteredFeeds.length) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {visibleFeeds.map((feed) => {
                const formatLastScraped = (dateStr) => {
                  if (!dateStr) return 'Never';
                  const date = new Date(dateStr);
                  const now = new Date();
                  const diffMs = now - date;
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

                  if (diffHours < 1) return 'Just now';
                  if (diffHours < 24) return `${diffHours}h ago`;
                  if (diffDays === 1) return 'Yesterday';
                  if (diffDays < 7) return `${diffDays}d ago`;
                  return date.toLocaleDateString();
                };

                const needsScrape = !feed.lastScraped ||
                  (new Date() - new Date(feed.lastScraped)) > (7 * 24 * 60 * 60 * 1000); // 7 days

                const isExpanded = expandedFeed === feed.name;

                return (
                  <div key={feed.name} className={`feed-selector-item-subtle ${isStartingScrape ? 'disabled' : ''} ${selectedFeeds.includes(feed.name) ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}>
                    <div className="feed-item-row">
                      <label className="feed-item-checkbox-area">
                        <input
                          type="checkbox"
                          checked={selectedFeeds.includes(feed.name)}
                          onChange={() => toggleFeedSelection(feed.name)}
                          disabled={isStartingScrape}
                        />
                        <span className="feed-checkbox-subtle"></span>
                      </label>
                      <div className="feed-item-main" onClick={() => setExpandedFeed(isExpanded ? null : feed.name)}>
                        <div className="feed-item-title">
                          <span className="feed-item-name-subtle">{feed.name}</span>
                          <span className="feed-item-state-tag">{feed.state}</span>
                        </div>
                        <div className="feed-item-stats">
                          <span className="feed-stat-subtle">
                            {feed.meetingCount > 0 ? `${feed.meetingCount.toLocaleString()} meetings` : 'No data'}
                          </span>
                          <span className="feed-stat-divider">·</span>
                          <span className={`feed-stat-subtle ${needsScrape ? 'stale' : ''}`}>
                            {formatLastScraped(feed.lastScraped)}
                          </span>
                        </div>
                      </div>
                      <button
                        className="feed-expand-btn"
                        onClick={() => setExpandedFeed(isExpanded ? null : feed.name)}
                        disabled={isStartingScrape}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isExpanded ? 'rotated' : ''}>
                          <polyline points="6,9 12,15 18,9"/>
                        </svg>
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="feed-item-details">
                        <div className="feed-detail-row">
                          <span className="feed-detail-label">Type</span>
                          <span className="feed-detail-value">{feed.type === 'tsml' ? 'AA Meeting Guide (TSML)' : feed.type === 'bmlt' ? 'NA (BMLT)' : feed.type}</span>
                        </div>
                        <div className="feed-detail-row">
                          <span className="feed-detail-label">Meetings</span>
                          <span className="feed-detail-value">{feed.meetingCount > 0 ? feed.meetingCount.toLocaleString() : 'Not yet scraped'}</span>
                        </div>
                        <div className="feed-detail-row">
                          <span className="feed-detail-label">Last Scraped</span>
                          <span className="feed-detail-value">
                            {feed.lastScraped ? new Date(feed.lastScraped).toLocaleString() : 'Never'}
                          </span>
                        </div>
                        <div className="feed-detail-row">
                          <span className="feed-detail-label">Status</span>
                          <span className={`feed-detail-value ${needsScrape ? 'status-stale' : 'status-fresh'}`}>
                            {needsScrape ? 'Needs refresh' : 'Up to date'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Load More button */}
              {hasMoreFeeds && (
                <button
                  className="feed-load-more-btn"
                  onClick={loadMoreFeeds}
                  disabled={isStartingScrape}
                >
                  Load {Math.min(FEEDS_PER_PAGE, filteredFeeds.length - visibleFeedCount)} more sources
                  <span className="load-more-remaining">
                    ({filteredFeeds.length - visibleFeedCount} remaining)
                  </span>
                </button>
              )}
              {!hasMoreFeeds && filteredFeeds.length > FEEDS_PER_PAGE && !feedSearchQuery && (
                <div className="feeds-all-loaded">All {filteredFeeds.length} sources loaded</div>
              )}
            </>
              );
            })()
          )}
        </div>

        <div className="feed-selector-footer">
          <button
            onClick={() => startScraping()}
            className="btn btn-primary btn-large btn-full"
            disabled={selectedFeeds.length === 0 || isStartingScrape}
          >
            {isStartingScrape ? (
              <>
                <span className="btn-spinner"></span>
                Starting...
              </>
            ) : (
              `Start Scraping (${selectedFeeds.length} source${selectedFeeds.length !== 1 ? 's' : ''})`
            )}
          </button>
        </div>
      </div>

      {/* Scrape Panel Sidebar */}
      <ScrapePanel
        isOpen={showScrapePanel}
        onClose={() => setShowScrapePanel(false)}
        scrapingState={scrapingState}
        recentMeetings={recentMeetings}
        onSelectMeeting={setSelectedMeeting}
        onStopScraping={() => setShowScrapeChoiceModal(true)}
        onStartNew={handleStartClick}
        onReset={resetScraper}
        isConnected={isConnected}
      />

      {/* Overlay for scrape panel */}
      {showScrapePanel && (
        <div
          className="sidebar-overlay"
          onClick={() => setShowScrapePanel(false)}
        />
      )}

      {/* Overlay for feed selector */}
      {showFeedSelector && (
        <div
          className="sidebar-overlay"
          onClick={() => { setShowFeedSelector(false); setScrapeError(null); setShouldAbandonOld(false); setFeedSearchQuery(''); setExpandedFeed(null); }}
        />
      )}
    </div>
  );
}

export default AdminPanel;
