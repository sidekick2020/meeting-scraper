import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import * as amplitude from '@amplitude/analytics-browser';

const AnalyticsContext = createContext(null);

// Amplitude API key - set via environment variable
const AMPLITUDE_API_KEY = process.env.REACT_APP_AMPLITUDE_API_KEY || '';

// Event name constants for consistency
export const ANALYTICS_EVENTS = {
  // Page & Session Events
  PAGE_VIEW: 'page_view',
  SESSION_START: 'session_start',
  APP_LOADED: 'app_loaded',

  // Search & Discovery
  SEARCH_INITIATED: 'search_initiated',
  SEARCH_COMPLETED: 'search_completed',
  SEARCH_SUGGESTION_SELECTED: 'search_suggestion_selected',
  LOCATION_SELECTED: 'location_selected',
  SEARCH_CLEARED: 'search_cleared',
  RECENT_SEARCH_CLICKED: 'recent_search_clicked',

  // Map Interactions
  MAP_BOUNDS_CHANGED: 'map_bounds_changed',
  MAP_MARKER_CLICKED: 'map_marker_clicked',
  MAP_CLUSTER_CLICKED: 'map_cluster_clicked',
  MAP_ZOOM_CHANGED: 'map_zoom_changed',
  MAP_LOCATED_USER: 'map_located_user',

  // Filtering
  FILTER_APPLIED: 'filter_applied',
  FILTER_STATE_CHANGED: 'filter_state_changed',
  FILTER_CITY_CHANGED: 'filter_city_changed',
  FILTER_DAY_CHANGED: 'filter_day_changed',
  FILTER_TYPE_CHANGED: 'filter_type_changed',
  FILTER_FORMAT_CHANGED: 'filter_format_changed',
  FILTER_ACCESSIBILITY_CHANGED: 'filter_accessibility_changed',
  FILTER_CLEARED: 'filter_cleared',
  FILTER_TODAY_TOGGLED: 'filter_today_toggled',

  // Meeting Views
  MEETING_VIEWED: 'meeting_viewed',
  MEETING_DETAIL_OPENED: 'meeting_detail_opened',
  MEETING_DETAIL_CLOSED: 'meeting_detail_closed',
  MEETING_PAGE_VIEWED: 'meeting_page_viewed',
  MEETING_COPIED: 'meeting_copied',
  MEETING_SHARED: 'meeting_shared',
  MEETING_DIRECTIONS_CLICKED: 'meeting_directions_clicked',
  MEETING_ONLINE_LINK_CLICKED: 'meeting_online_link_clicked',
  MEETING_PHONE_CLICKED: 'meeting_phone_clicked',

  // List & Pagination
  MEETINGS_LOADED: 'meetings_loaded',
  MEETINGS_LOAD_MORE: 'meetings_load_more',
  MEETINGS_SCROLL: 'meetings_scroll',

  // Online Meetings Page
  ONLINE_MEETING_SELECTED: 'online_meeting_selected',
  ONLINE_FELLOWSHIP_FILTERED: 'online_fellowship_filtered',
  ONLINE_TIME_FILTERED: 'online_time_filtered',
  ONLINE_HYBRID_TOGGLED: 'online_hybrid_toggled',

  // Navigation
  NAVIGATION_CLICKED: 'navigation_clicked',
  SIDEBAR_TOGGLED: 'sidebar_toggled',
  THEME_TOGGLED: 'theme_toggled',

  // Authentication
  ADMIN_SIGNIN_CLICKED: 'admin_signin_clicked',
  ADMIN_SIGNIN_SUCCESS: 'admin_signin_success',
  ADMIN_SIGNIN_FAILED: 'admin_signin_failed',
  ADMIN_SIGNOUT: 'admin_signout',

  // Admin Panel
  ADMIN_TAB_VIEWED: 'admin_tab_viewed',
  ADMIN_VIEW_ENTERED: 'admin_view_entered',
  ADMIN_VIEW_EXITED: 'admin_view_exited',

  // Scraper Control
  SCRAPE_STARTED: 'scrape_started',
  SCRAPE_STOPPED: 'scrape_stopped',
  SCRAPE_RESET: 'scrape_reset',

  // User Management
  USER_INVITED: 'user_invited',
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_REMOVED: 'user_removed',

  // Source Management
  SOURCE_ADDED: 'source_added',
  SOURCE_DELETED: 'source_deleted',
  SOURCE_VIEWED: 'source_viewed',

  // Settings
  SETTINGS_OPENED: 'settings_opened',
  SETTINGS_TAB_CHANGED: 'settings_tab_changed',
  API_VERSION_SWITCHED: 'api_version_switched',
  CHANGELOG_VIEWED: 'changelog_viewed',

  // Coverage & Heatmap
  COVERAGE_ANALYSIS_VIEWED: 'coverage_analysis_viewed',
  STATE_HEATMAP_OPENED: 'state_heatmap_opened',
  HEATMAP_GENERATION_STARTED: 'heatmap_generation_started',

  // Download Page
  DOWNLOAD_PAGE_VIEWED: 'download_page_viewed',
  DOWNLOAD_INITIATED: 'download_initiated',

  // Docs Page
  DOCS_PAGE_VIEWED: 'docs_page_viewed',
  DOCS_SECTION_VIEWED: 'docs_section_viewed',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
  SEARCH_ERROR: 'search_error',

  // Performance
  API_REQUEST_COMPLETED: 'api_request_completed',
  CACHE_HIT: 'cache_hit',
  CACHE_MISS: 'cache_miss',
};

export function AnalyticsProvider({ children }) {
  const isInitialized = useRef(false);
  const sessionProperties = useRef({});

  // Initialize Amplitude
  useEffect(() => {
    if (!AMPLITUDE_API_KEY) {
      console.warn('Amplitude API key not configured. Analytics will be disabled.');
      return;
    }

    if (isInitialized.current) return;

    amplitude.init(AMPLITUDE_API_KEY, {
      defaultTracking: {
        sessions: true,
        pageViews: true,
        formInteractions: true,
        fileDownloads: true,
      },
      // Flush events every 10 seconds or when 10 events are queued
      flushIntervalMillis: 10000,
      flushQueueSize: 10,
    });

    isInitialized.current = true;

    // Set initial session properties
    const deviceType = getDeviceType();
    sessionProperties.current = {
      device_type: deviceType,
      app_version: process.env.REACT_APP_VERSION || 'unknown',
      environment: process.env.NODE_ENV,
    };

    // Set user properties that persist
    amplitude.setGroup('app', 'meeting-scraper');

    // Track app loaded
    amplitude.track(ANALYTICS_EVENTS.APP_LOADED, {
      ...sessionProperties.current,
      referrer: document.referrer,
      url: window.location.href,
    });

  }, []);

  // Identify user (call when user signs in)
  const identify = useCallback((userId, userProperties = {}) => {
    if (!AMPLITUDE_API_KEY) return;

    amplitude.setUserId(userId);

    const identifyEvent = new amplitude.Identify();
    Object.entries(userProperties).forEach(([key, value]) => {
      identifyEvent.set(key, value);
    });
    amplitude.identify(identifyEvent);
  }, []);

  // Reset user (call when user signs out)
  const resetUser = useCallback(() => {
    if (!AMPLITUDE_API_KEY) return;
    amplitude.reset();
  }, []);

  // Track event with optional properties
  const track = useCallback((eventName, properties = {}) => {
    if (!AMPLITUDE_API_KEY) {
      // Log to console in development when Amplitude is not configured
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Analytics] ${eventName}`, properties);
      }
      return;
    }

    amplitude.track(eventName, {
      ...sessionProperties.current,
      ...properties,
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Track page view
  const trackPageView = useCallback((pageName, properties = {}) => {
    track(ANALYTICS_EVENTS.PAGE_VIEW, {
      page_name: pageName,
      page_path: window.location.pathname,
      page_url: window.location.href,
      ...properties,
    });
  }, [track]);

  // Track search events
  const trackSearch = useCallback((query, properties = {}) => {
    track(ANALYTICS_EVENTS.SEARCH_INITIATED, {
      search_query: query,
      query_length: query?.length || 0,
      ...properties,
    });
  }, [track]);

  const trackSearchCompleted = useCallback((query, resultsCount, properties = {}) => {
    track(ANALYTICS_EVENTS.SEARCH_COMPLETED, {
      search_query: query,
      results_count: resultsCount,
      has_results: resultsCount > 0,
      ...properties,
    });
  }, [track]);

  // Track filter events
  const trackFilterChange = useCallback((filterType, filterValue, properties = {}) => {
    track(ANALYTICS_EVENTS.FILTER_APPLIED, {
      filter_type: filterType,
      filter_value: filterValue,
      ...properties,
    });
  }, [track]);

  // Track meeting views
  const trackMeetingViewed = useCallback((meeting, properties = {}) => {
    track(ANALYTICS_EVENTS.MEETING_VIEWED, {
      meeting_id: meeting?.objectId || meeting?.id,
      meeting_name: meeting?.name,
      meeting_fellowship: meeting?.fellowship,
      meeting_day: meeting?.day,
      meeting_city: meeting?.city,
      meeting_state: meeting?.state,
      is_online: meeting?.isOnline,
      is_hybrid: meeting?.isHybrid,
      ...properties,
    });
  }, [track]);

  // Track map interactions
  const trackMapInteraction = useCallback((eventName, properties = {}) => {
    track(eventName, {
      ...properties,
    });
  }, [track]);

  // Track navigation
  const trackNavigation = useCallback((destination, properties = {}) => {
    track(ANALYTICS_EVENTS.NAVIGATION_CLICKED, {
      destination,
      from_page: window.location.pathname,
      ...properties,
    });
  }, [track]);

  // Track admin actions
  const trackAdminAction = useCallback((action, properties = {}) => {
    track(action, {
      is_admin_action: true,
      ...properties,
    });
  }, [track]);

  // Track errors
  const trackError = useCallback((errorType, errorMessage, properties = {}) => {
    track(ANALYTICS_EVENTS.ERROR_OCCURRED, {
      error_type: errorType,
      error_message: errorMessage,
      page_path: window.location.pathname,
      ...properties,
    });
  }, [track]);

  // Track API performance
  const trackApiRequest = useCallback((endpoint, duration, success, properties = {}) => {
    track(ANALYTICS_EVENTS.API_REQUEST_COMPLETED, {
      endpoint,
      duration_ms: duration,
      success,
      ...properties,
    });
  }, [track]);

  // Set user properties (without identifying)
  const setUserProperties = useCallback((properties) => {
    if (!AMPLITUDE_API_KEY) return;

    const identifyEvent = new amplitude.Identify();
    Object.entries(properties).forEach(([key, value]) => {
      identifyEvent.set(key, value);
    });
    amplitude.identify(identifyEvent);
  }, []);

  // Increment user property
  const incrementUserProperty = useCallback((property, value = 1) => {
    if (!AMPLITUDE_API_KEY) return;

    const identifyEvent = new amplitude.Identify();
    identifyEvent.add(property, value);
    amplitude.identify(identifyEvent);
  }, []);

  const value = {
    // Core tracking
    track,
    identify,
    resetUser,
    setUserProperties,
    incrementUserProperty,

    // Convenience methods
    trackPageView,
    trackSearch,
    trackSearchCompleted,
    trackFilterChange,
    trackMeetingViewed,
    trackMapInteraction,
    trackNavigation,
    trackAdminAction,
    trackError,
    trackApiRequest,

    // Event constants
    events: ANALYTICS_EVENTS,

    // Check if analytics is enabled
    isEnabled: !!AMPLITUDE_API_KEY,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

// Helper function to determine device type
function getDeviceType() {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

// Custom hook for tracking page views on route change
export function usePageViewTracking(pageName, properties = {}) {
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView(pageName, properties);
  }, [pageName, trackPageView, JSON.stringify(properties)]);
}

// Custom hook for tracking with debounce (useful for scroll, resize, etc.)
export function useDebouncedTracking(delay = 500) {
  const { track } = useAnalytics();
  const timeoutRef = useRef(null);

  const debouncedTrack = useCallback((eventName, properties = {}) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      track(eventName, properties);
    }, delay);
  }, [track, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedTrack;
}

export default AnalyticsContext;
