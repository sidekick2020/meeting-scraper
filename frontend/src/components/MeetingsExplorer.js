import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import MeetingMap from './MeetingMap';
import MeetingDetail from './MeetingDetail';
import ParseDiagnostics from './ParseDiagnostics';
import { SidebarToggleButton } from './PublicSidebar';
import { useDataCache } from '../contexts/DataCacheContext';
import { useParse } from '../contexts/ParseContext';
import { fetchThumbnailsThrottled, getCachedThumbnails } from '../utils/networkSpeed';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Cache keys
const CACHE_KEYS = {
  MEETINGS: 'explorer:meetings',
  TOTAL: 'explorer:total',
  AVAILABLE_STATES: 'explorer:availableStates',
  AVAILABLE_CITIES: 'explorer:availableCities',
  AVAILABLE_TYPES: 'explorer:availableTypes',
  AVAILABLE_FORMATS: 'explorer:availableFormats',
  FILTER_STATE: 'explorer:filterState'
};

// Cache TTL: 10 minutes for meetings data
const MEETINGS_CACHE_TTL = 10 * 60 * 1000;

/**
 * Apply cached thumbnails to meetings that don't have them
 * This prevents re-fetching thumbnails that were already loaded
 */
const applyCachedThumbnails = (meetings) => {
  const meetingIds = meetings.filter(m => !m.thumbnailUrl && m.objectId).map(m => m.objectId);
  if (meetingIds.length === 0) return meetings;

  const cached = getCachedThumbnails(meetingIds);
  if (cached.size === 0) return meetings;

  return meetings.map(m => {
    if (!m.thumbnailUrl && m.objectId && cached.has(m.objectId)) {
      return { ...m, thumbnailUrl: cached.get(m.objectId) };
    }
    return m;
  });
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayAbbrev = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

// Meeting type definitions with icons and full names
const MEETING_TYPES = {
  'AA': { name: 'Alcoholics Anonymous', shortName: 'Alcohol', icon: 'bottle' },
  'NA': { name: 'Narcotics Anonymous', shortName: 'Narcotics', icon: 'pill' },
  'CA': { name: 'Cocaine Anonymous', shortName: 'Cocaine', icon: 'snowflake' },
  'MA': { name: 'Marijuana Anonymous', shortName: 'Marijuana', icon: 'leaf' },
  'OA': { name: 'Overeaters Anonymous', shortName: 'Overeating', icon: 'utensils' },
  'GA': { name: 'Gamblers Anonymous', shortName: 'Gambling', icon: 'dice' },
  'Al-Anon': { name: 'Al-Anon Family Groups', shortName: 'Family Support', icon: 'family' },
  'SLAA': { name: 'Sex & Love Addicts Anonymous', shortName: 'Sex & Love', icon: 'heart' },
  'HA': { name: 'Heroin Anonymous', shortName: 'Heroin', icon: 'syringe' },
  'SA': { name: 'Sexaholics Anonymous', shortName: 'Sex Addiction', icon: 'link' },
  'CMA': { name: 'Crystal Meth Anonymous', shortName: 'Meth', icon: 'crystal' },
  'ACA': { name: 'Adult Children of Alcoholics', shortName: 'Adult Children', icon: 'users' },
  'Other': { name: 'Other Programs', shortName: 'Other', icon: 'circle' },
};

// SVG icon paths for meeting types
const MeetingTypeIcon = ({ type, size = 16 }) => {
  const iconMap = {
    bottle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 11h1a3 3 0 0 1 0 6h-1"/>
        <path d="M9 12v6"/>
        <path d="M13 12v6"/>
        <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1 3 1 1.5-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-1 0-1.5-.5-2.5-.5z"/>
        <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>
      </svg>
    ),
    pill: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
        <path d="m8.5 8.5 7 7"/>
      </svg>
    ),
    snowflake: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" x2="22" y1="12" y2="12"/>
        <line x1="12" x2="12" y1="2" y2="22"/>
        <path d="m20 16-4-4 4-4"/>
        <path d="m4 8 4 4-4 4"/>
        <path d="m16 4-4 4-4-4"/>
        <path d="m8 20 4-4 4 4"/>
      </svg>
    ),
    leaf: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
      </svg>
    ),
    utensils: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
        <path d="M7 2v20"/>
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
      </svg>
    ),
    dice: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="12" height="12" x="2" y="10" rx="2" ry="2"/>
        <path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/>
        <path d="M6 18h.01"/>
        <path d="M10 14h.01"/>
        <path d="M15 6h.01"/>
        <path d="M18 9h.01"/>
      </svg>
    ),
    family: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    heart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      </svg>
    ),
    syringe: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m18 2 4 4"/>
        <path d="m17 7 3-3"/>
        <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/>
        <path d="m9 11 4 4"/>
        <path d="m5 19-3 3"/>
        <path d="m14 4 6 6"/>
      </svg>
    ),
    link: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
    crystal: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 13L2 9Z"/>
        <path d="M11 3 8 9l4 13 4-13-3-6"/>
        <path d="M2 9h20"/>
      </svg>
    ),
    users: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    circle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  };

  const typeInfo = MEETING_TYPES[type];
  const iconKey = typeInfo?.icon || 'circle';
  return iconMap[iconKey] || iconMap.circle;
};

function MeetingsExplorer({ sidebarOpen, onSidebarToggle, onMobileNavChange }) {
  // Data cache context for persisting data across navigation
  const { getCache, setCache } = useDataCache();

  // Parse SDK context for connection status and direct data fetching
  const {
    connectionStatus: parseConnectionStatus,
    isConnectionReady,
    isInitialized: parseInitialized,
    config: parseConfig,
    fetchMeetings: parseFetchMeetings
  } = useParse();

  // Initialize state from cache if available
  const cachedMeetings = getCache(CACHE_KEYS.MEETINGS);
  const cachedTotal = getCache(CACHE_KEYS.TOTAL);
  const cachedStates = getCache(CACHE_KEYS.AVAILABLE_STATES);
  const cachedCities = getCache(CACHE_KEYS.AVAILABLE_CITIES);
  const cachedTypes = getCache(CACHE_KEYS.AVAILABLE_TYPES);
  const cachedFormats = getCache(CACHE_KEYS.AVAILABLE_FORMATS);
  const cachedFilterState = getCache(CACHE_KEYS.FILTER_STATE);

  const [meetings, setMeetings] = useState(cachedMeetings?.data || []);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [hoveredMeeting, setHoveredMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(!cachedMeetings?.data);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null); // Detailed error info for debugging
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showErrorLogs, setShowErrorLogs] = useState(false); // Toggle for detailed error logs

  // Derive configStatus from Parse context (maps to legacy status values for UI compatibility)
  const configStatus = useMemo(() => {
    if (!parseConfig.hasAppId || !parseConfig.hasJsKey) return 'not_configured';
    switch (parseConnectionStatus) {
      case 'connecting': return 'checking';
      case 'connected': return 'configured';
      case 'error': return 'unreachable';
      case 'not_configured': return 'not_configured';
      default: return null;
    }
  }, [parseConnectionStatus, parseConfig.hasAppId, parseConfig.hasJsKey]);

  // Filters - restore from cache if available
  const [searchQuery, setSearchQuery] = useState(cachedFilterState?.data?.searchQuery || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(cachedFilterState?.data?.searchQuery || '');
  const searchDebounceRef = useRef(null);
  const [selectedStates, setSelectedStates] = useState(cachedFilterState?.data?.selectedStates || []);
  const [selectedCity, setSelectedCity] = useState(cachedFilterState?.data?.selectedCity || '');
  const [selectedDays, setSelectedDays] = useState(cachedFilterState?.data?.selectedDays || []); // Changed to array for multi-select
  const [selectedTypes, setSelectedTypes] = useState(cachedFilterState?.data?.selectedTypes || []); // Changed to array for multi-select
  const [showOnlineOnly, setShowOnlineOnly] = useState(cachedFilterState?.data?.showOnlineOnly || false);
  const [showTodayOnly, setShowTodayOnly] = useState(cachedFilterState?.data?.showTodayOnly || false);
  const [showHybridOnly, setShowHybridOnly] = useState(cachedFilterState?.data?.showHybridOnly || false);
  const [selectedFormat, setSelectedFormat] = useState(cachedFilterState?.data?.selectedFormat || '');
  const [selectedAccessibility, setSelectedAccessibility] = useState(cachedFilterState?.data?.selectedAccessibility || []);
  const [showFilters, setShowFilters] = useState(false);
  const [showStatesDropdown, setShowStatesDropdown] = useState(false);
  const [showDaysDropdown, setShowDaysDropdown] = useState(false);
  const [showTypesDropdown, setShowTypesDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('recentMeetingSearches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const statesDropdownRef = useRef(null);
  const daysDropdownRef = useRef(null);
  const typesDropdownRef = useRef(null);

  // Pagination - simple limit of 50
  const [totalMeetings, setTotalMeetings] = useState(cachedTotal?.data || 0);

  // Map bounds for dynamic loading
  const [mapBounds, setMapBounds] = useState(null);
  // Target location for map pan/zoom when user selects a location from search
  const [targetLocation, setTargetLocation] = useState(null);
  // Map center location name from reverse geocoding
  const [mapCenterLocation, setMapCenterLocation] = useState(null);
  const reverseGeocodeTimeoutRef = useRef(null);
  // Flag to track if map movement is from programmatic pan (vs user drag)
  const isProgrammaticPanRef = useRef(false);
  // Timeout ref for debouncing the programmatic pan flag reset
  const programmaticPanTimeoutRef = useRef(null);
  // Track meeting count from map for list/map sync
  const [mapMeetingCount, setMapMeetingCount] = useState(0);

  // Theme detection for logo switching
  const [currentTheme, setCurrentTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'dark'
  );

  // Listen for theme changes
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

  // Get unique values from meetings - restore from cache if available
  const [availableStates, setAvailableStates] = useState(cachedStates?.data || []);
  const [availableCities, setAvailableCities] = useState(cachedCities?.data || []);
  const [availableTypes, setAvailableTypes] = useState(cachedTypes?.data || []);
  const [availableFormats, setAvailableFormats] = useState(cachedFormats?.data || []);

  // Accessibility options
  const accessibilityOptions = [
    { key: 'wheelchairAccessible', label: 'Wheelchair Accessible', icon: '♿' },
    { key: 'hasChildcare', label: 'Childcare Available', icon: '👶' },
    { key: 'signLanguageAvailable', label: 'Sign Language', icon: '🤟' },
    { key: 'hasParking', label: 'Parking Available', icon: '🅿️' },
  ];

  // Search autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [locationResults, setLocationResults] = useState([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const searchInputRef = useRef(null);
  const locationSearchTimeout = useRef(null);

  const listRef = useRef(null);
  const thumbnailRequestsRef = useRef(new Set());
  const ipLocationAttemptedRef = useRef(false);

  // Stable meeting IDs string - only changes when actual meeting list changes (not thumbnails)
  // This prevents scroll restoration from triggering on thumbnail updates
  const meetingIdsKey = useMemo(() => {
    return meetings.map(m => m.objectId).filter(Boolean).join(',');
  }, [meetings]);

  // Debounce search query for filtering - prevents excessive re-filtering on every keystroke
  // When search is cleared (empty), immediately clear the debounced value to show all meetings
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Immediately clear filter when search is empty
    if (!searchQuery) {
      setDebouncedSearchQuery('');
      return;
    }

    // Debounce non-empty search queries by 300ms
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  // Apply client-side filters (search query and accessibility only - rest handled server-side)
  // IMPORTANT: Use useMemo instead of useEffect to prevent flicker when meetings change
  // useEffect runs AFTER render, causing a frame where old filteredMeetings is shown
  const filteredMeetings = useMemo(() => {
    let filtered = meetings;

    // Search query - filter client-side for instant feedback (uses debounced value)
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name?.toLowerCase().includes(query) ||
        m.locationName?.toLowerCase().includes(query) ||
        m.city?.toLowerCase().includes(query) ||
        m.address?.toLowerCase().includes(query)
      );
    }

    // Accessibility - client-side only (not supported server-side)
    if (selectedAccessibility.length > 0) {
      filtered = filtered.filter(m =>
        selectedAccessibility.every(key => m[key] === true)
      );
    }

    return filtered;
  }, [meetings, debouncedSearchQuery, selectedAccessibility]);

  // Stable filtered meeting IDs - only changes when filter results change
  const filteredMeetingIdsKey = useMemo(() => {
    return filteredMeetings.map(m => m.objectId).filter(Boolean).join(',');
  }, [filteredMeetings]);

  // Scroll position preservation using meeting ID anchor (prevents scroll reset when thumbnails load)
  const anchorMeetingIdRef = useRef(null);      // ID of meeting at top of viewport
  const anchorOffsetRef = useRef(0);            // Offset of anchor meeting from top of list
  const isRestoringScrollRef = useRef(false);
  const lastMeetingIdsRef = useRef('');         // Track meeting IDs as string key (stable comparison)
  const scrollRafRef = useRef(null);            // RAF handle for throttled scroll handler

  // Refs for request optimization - prevents duplicate API calls
  const filtersRef = useRef({
    selectedStates: [],
    selectedDays: [],
    selectedTypes: [],
    selectedCity: '',
    showOnlineOnly: false,
    showHybridOnly: false,
    showTodayOnly: false,
    selectedFormat: ''
  });
  const filterFetchTimeoutRef = useRef(null);
  const pendingFetchRef = useRef(null);
  const lastFetchKeyRef = useRef(null);
  const fetchMeetingsRef = useRef(null);

  // Abort controller for thumbnail requests
  const thumbnailAbortRef = useRef(null);

  // Request thumbnails for meetings without them (throttled to prevent connection exhaustion)
  const requestMissingThumbnails = useCallback(async (meetingsList) => {
    const meetingsWithoutThumbnails = meetingsList
      .filter(m => !m.thumbnailUrl && m.objectId && !thumbnailRequestsRef.current.has(m.objectId))
      .slice(0, 20);

    if (meetingsWithoutThumbnails.length === 0) return;

    // Mark all as in-flight to prevent duplicate requests
    meetingsWithoutThumbnails.forEach(m => thumbnailRequestsRef.current.add(m.objectId));

    // Cancel any previous thumbnail fetch
    if (thumbnailAbortRef.current) {
      thumbnailAbortRef.current.abort();
    }
    thumbnailAbortRef.current = new AbortController();

    const meetingIds = meetingsWithoutThumbnails.map(m => m.objectId);

    try {
      // Use throttled fetcher that respects browser connection limits
      // IMPORTANT: Do NOT use onResult callback - it causes rapid state updates
      // that trigger scroll restoration 20+ times, causing scroll position resets.
      // Instead, batch all thumbnail updates into a single state update at the end.
      const results = await fetchThumbnailsThrottled(meetingIds, BACKEND_URL, {
        signal: thumbnailAbortRef.current.signal,
        timeout: 10000
        // No onResult callback - see comment above
      });

      // Single batch update for all thumbnails - prevents scroll reset cascade
      if (results.size > 0) {
        setMeetings(prev => prev.map(m => {
          const thumbnailUrl = results.get(m.objectId);
          return thumbnailUrl ? { ...m, thumbnailUrl } : m;
        }));
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching thumbnails:', error);
      }
    }
  }, []);

  // Keep filtersRef updated - allows fetchMeetings to have stable reference
  useEffect(() => {
    filtersRef.current = {
      selectedStates,
      selectedDays,
      selectedTypes,
      selectedCity,
      showOnlineOnly,
      showHybridOnly,
      showTodayOnly,
      selectedFormat
    };
  }, [selectedStates, selectedDays, selectedTypes, selectedCity, showOnlineOnly, showHybridOnly, showTodayOnly, selectedFormat]);

  // Simple fetch function - fetches meetings based on bounds and filters, limit 50
  // Uses refs for filters to maintain stable function reference and prevent duplicate calls
  // Uses Parse SDK directly when available, falls back to backend API
  const fetchMeetings = useCallback(async (bounds) => {
    if (!bounds) return;

    const filters = filtersRef.current;

    // Create request key for deduplication - includes bounds and all filter values
    const requestKey = `${bounds.north.toFixed(3)}-${bounds.south.toFixed(3)}-${bounds.east.toFixed(3)}-${bounds.west.toFixed(3)}-${JSON.stringify(filters)}`;

    // Skip if identical request was just made
    if (lastFetchKeyRef.current === requestKey) {
      return;
    }
    lastFetchKeyRef.current = requestKey;

    // Cancel any pending fetch to prevent race conditions
    if (pendingFetchRef.current) {
      pendingFetchRef.current.abort();
    }
    pendingFetchRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setErrorDetails(null);

    // Build filter options for Parse SDK
    const filterOptions = {
      limit: 50,
      bounds: {
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west
      },
      center: bounds.center_lat !== undefined ? { lat: bounds.center_lat, lng: bounds.center_lng } : undefined,
      state: selectedStates.length > 0 ? selectedStates[0] : undefined,
      day: showTodayOnly ? new Date().getDay() : (selectedDays.length === 1 ? selectedDays[0] : undefined),
      type: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
      city: selectedCity || undefined,
      online: showOnlineOnly || undefined,
      hybrid: showHybridOnly || undefined,
      format: selectedFormat || undefined
    };

    try {
      // Use Parse SDK directly if initialized (bypasses backend, reduces Render load)
      if (parseInitialized) {
        const result = await parseFetchMeetings(filterOptions);

        if (result.error) {
          setError('Failed to load meetings from database');
          setErrorDetails({
            timestamp: new Date().toISOString(),
            type: 'parse_error',
            errorMessage: result.error,
            filters: filterOptions
          });
        } else {
          const newMeetings = result.meetings || [];
          const total = result.total || newMeetings.length;

          setTotalMeetings(total);
          // Apply cached thumbnails to avoid re-fetching already-loaded thumbnails
          setMeetings(applyCachedThumbnails(newMeetings));

          // Update available cities from results
          const cities = [...new Set(newMeetings.map(m => m.city).filter(Boolean))].sort();
          setAvailableCities(cities);

          // Set available types (all defined types)
          const allTypes = Object.keys(MEETING_TYPES).filter(t => t !== 'Other');
          allTypes.push('Other');
          setAvailableTypes(allTypes);

          // Don't show error for empty results in a specific area - that's normal
          // Only store debug info for diagnostics
          if (newMeetings.length === 0) {
            setErrorDetails({
              timestamp: new Date().toISOString(),
              type: 'empty_results_info',
              filters: filterOptions,
              bounds: bounds,
              note: 'Empty results in a specific area is normal behavior.'
            });
          }
        }
      } else {
        // Fallback to backend API if Parse not configured
        let url = `${BACKEND_URL}/api/meetings?limit=50`;
        url += `&north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`;

        if (bounds.center_lat !== undefined && bounds.center_lng !== undefined) {
          url += `&center_lat=${bounds.center_lat}&center_lng=${bounds.center_lng}`;
        }
        if (selectedStates.length > 0) url += `&state=${encodeURIComponent(selectedStates[0])}`;
        if (showTodayOnly) {
          url += `&day=${new Date().getDay()}`;
        } else if (selectedDays.length === 1) {
          url += `&day=${selectedDays[0]}`;
        }
        if (selectedTypes.length === 1) url += `&type=${encodeURIComponent(selectedTypes[0])}`;
        if (selectedCity) url += `&city=${encodeURIComponent(selectedCity)}`;
        if (showOnlineOnly) url += `&online=true`;
        if (showHybridOnly) url += `&hybrid=true`;
        if (selectedFormat) url += `&format=${encodeURIComponent(selectedFormat)}`;

        const response = await fetch(url, {
          signal: pendingFetchRef.current.signal
        });
        const data = await response.json();

        if (response.ok) {
          const newMeetings = data.meetings || [];
          const total = data.total || newMeetings.length;

          setTotalMeetings(total);
          // Apply cached thumbnails to avoid re-fetching already-loaded thumbnails
          setMeetings(applyCachedThumbnails(newMeetings));

          const cities = [...new Set(newMeetings.map(m => m.city).filter(Boolean))].sort();
          setAvailableCities(cities);

          const allTypes = Object.keys(MEETING_TYPES).filter(t => t !== 'Other');
          allTypes.push('Other');
          setAvailableTypes(allTypes);

          // Store debug info if present (for diagnostics) but don't show error for normal empty results
          // Debug info indicates potential config issues only when initial load returns 0 across entire database
          if (data.debug) {
            setErrorDetails({
              timestamp: new Date().toISOString(),
              type: 'empty_results_debug_info',
              debug: data.debug,
              requestUrl: url.replace(BACKEND_URL, ''),
              bounds: bounds,
              note: 'This is debug info, not necessarily an error. Empty results in a specific area is normal.'
            });
          }
        } else {
          setError(data.error || 'Failed to load meetings');
          setErrorDetails({
            timestamp: new Date().toISOString(),
            type: 'api_error',
            httpStatus: response.status,
            errorMessage: data.error,
            errorDetails: data.error_details,
            requestUrl: url.replace(BACKEND_URL, '')
          });
        }
      }
    } catch (err) {
      // Ignore abort errors - they're expected when cancelling stale requests
      if (err.name === 'AbortError') {
        return;
      }
      setError('Unable to connect to server');
      setErrorDetails({
        timestamp: new Date().toISOString(),
        type: 'network_error',
        errorMessage: err.message,
        errorName: err.name,
        source: parseInitialized ? 'Parse SDK' : 'Backend API'
      });
    } finally {
      setIsLoading(false);
    }
  }, [parseInitialized, parseFetchMeetings, selectedStates, selectedDays, selectedTypes, selectedCity, showOnlineOnly, showHybridOnly, showTodayOnly, selectedFormat]); // Filter deps needed for fallback API path; deduplication prevents duplicate calls

  // Keep fetchMeetingsRef updated for use in callbacks
  useEffect(() => {
    fetchMeetingsRef.current = fetchMeetings;
  }, [fetchMeetings]);

  // Fetch meetings when bounds change (map pan/zoom)
  // CRITICAL: Use ref to avoid dependency on fetchMeetings callback reference
  // Including fetchMeetings in deps causes infinite loops when filters change:
  // filter change -> callback recreated -> effect re-runs -> duplicate API calls
  useEffect(() => {
    if (mapBounds) {
      fetchMeetingsRef.current?.(mapBounds);
    }
  }, [mapBounds]); // Removed fetchMeetings - use ref instead

  // Debounced fetch when filters change - prevents rapid API calls during filter updates
  // CRITICAL: Use ref to avoid dependency on fetchMeetings callback reference
  // Including fetchMeetings in deps causes cascade of duplicate API calls when filters change
  useEffect(() => {
    // Only trigger debounced fetch if we have bounds (map is initialized)
    if (!mapBounds) return;

    // Clear any pending debounced fetch
    if (filterFetchTimeoutRef.current) {
      clearTimeout(filterFetchTimeoutRef.current);
    }

    // Reset the request key to force a new fetch when filters change
    lastFetchKeyRef.current = null;

    // Debounce the fetch - 300ms matches MeetingMap.js debounce timing
    // Use ref to call the function to avoid dependency issues
    filterFetchTimeoutRef.current = setTimeout(() => {
      fetchMeetingsRef.current?.(mapBounds);
    }, 300);

    return () => {
      if (filterFetchTimeoutRef.current) {
        clearTimeout(filterFetchTimeoutRef.current);
      }
    };
  }, [selectedStates, selectedDays, selectedTypes, selectedCity, showOnlineOnly, showHybridOnly, showTodayOnly, selectedFormat, mapBounds]); // Removed fetchMeetings - use ref instead

  // Cleanup on unmount - abort pending requests and clear timeouts
  useEffect(() => {
    return () => {
      if (pendingFetchRef.current) {
        pendingFetchRef.current.abort();
      }
      if (filterFetchTimeoutRef.current) {
        clearTimeout(filterFetchTimeoutRef.current);
      }
    };
  }, []);

  // Cache meetings data when it changes
  useEffect(() => {
    if (meetings.length > 0) {
      setCache(CACHE_KEYS.MEETINGS, meetings, MEETINGS_CACHE_TTL);
    }
  }, [meetings, setCache]);

  // Cache total meetings count
  useEffect(() => {
    if (totalMeetings > 0) {
      setCache(CACHE_KEYS.TOTAL, totalMeetings, MEETINGS_CACHE_TTL);
    }
  }, [totalMeetings, setCache]);

  // Cache available filter options
  useEffect(() => {
    if (availableStates.length > 0) {
      setCache(CACHE_KEYS.AVAILABLE_STATES, availableStates, MEETINGS_CACHE_TTL);
    }
  }, [availableStates, setCache]);

  useEffect(() => {
    if (availableCities.length > 0) {
      setCache(CACHE_KEYS.AVAILABLE_CITIES, availableCities, MEETINGS_CACHE_TTL);
    }
  }, [availableCities, setCache]);

  useEffect(() => {
    if (availableTypes.length > 0) {
      setCache(CACHE_KEYS.AVAILABLE_TYPES, availableTypes, MEETINGS_CACHE_TTL);
    }
  }, [availableTypes, setCache]);

  useEffect(() => {
    if (availableFormats.length > 0) {
      setCache(CACHE_KEYS.AVAILABLE_FORMATS, availableFormats, MEETINGS_CACHE_TTL);
    }
  }, [availableFormats, setCache]);

  // Config status is now derived from ParseContext - no caching needed

  // Cache filter state when it changes
  useEffect(() => {
    const filterState = {
      searchQuery,
      selectedStates,
      selectedCity,
      selectedDays,
      selectedTypes,
      showOnlineOnly,
      showTodayOnly,
      showHybridOnly,
      selectedFormat,
      selectedAccessibility
    };
    setCache(CACHE_KEYS.FILTER_STATE, filterState, MEETINGS_CACHE_TTL);
  }, [searchQuery, selectedStates, selectedCity, selectedDays, selectedTypes, showOnlineOnly, showTodayOnly, showHybridOnly, selectedFormat, selectedAccessibility, setCache]);

  // Request thumbnails for visible meetings that don't have them
  useEffect(() => {
    if (filteredMeetings.length > 0) {
      const timer = setTimeout(() => {
        requestMissingThumbnails(filteredMeetings);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filteredMeetings, requestMissingThumbnails]);

  // Cleanup reverse geocode timeout and programmatic pan timeout on unmount
  useEffect(() => {
    return () => {
      if (reverseGeocodeTimeoutRef.current) {
        clearTimeout(reverseGeocodeTimeoutRef.current);
      }
      if (programmaticPanTimeoutRef.current) {
        clearTimeout(programmaticPanTimeoutRef.current);
      }
    };
  }, []);

  // Prefill location from user's IP address on first load
  // Only runs if there's no cached search query (user hasn't searched before)
  useEffect(() => {
    // Only attempt once per session
    if (ipLocationAttemptedRef.current) return;
    ipLocationAttemptedRef.current = true;

    // Don't prefill if user already has a search query (from cache)
    if (cachedFilterState?.data?.searchQuery) return;

    // Don't prefill if user already has filters applied
    if (cachedFilterState?.data?.selectedStates?.length > 0) return;
    if (cachedFilterState?.data?.selectedCity) return;

    const fetchIPLocation = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/location-from-ip`);
        if (!response.ok) return;

        const data = await response.json();
        if (!data.success) return;

        // Only prefill for US locations (this is a US meeting finder)
        if (data.countryCode !== 'US') return;

        // Set the search query to the formatted location
        if (data.formatted) {
          setSearchQuery(data.formatted);
        }

        // Pan the map to the user's location
        if (data.lat && data.lon) {
          isProgrammaticPanRef.current = true;
          setTargetLocation({
            lat: data.lat,
            lng: data.lon,
            zoom: 10 // City-level zoom
          });
        }
      } catch (error) {
        // Silently fail - IP location is a nice-to-have, not critical
        console.debug('IP location prefill failed:', error);
      }
    };

    fetchIPLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll position preservation - track which meeting is at the top of viewport
  // Uses RAF throttling to prevent performance issues during fast scrolling
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const updateAnchor = () => {
      // Don't save position while we're restoring it
      if (isRestoringScrollRef.current) return;

      // Find the meeting card at the top of the visible area
      const cards = listElement.querySelectorAll('[data-meeting-id]');
      const listRect = listElement.getBoundingClientRect();

      for (const card of cards) {
        const cardRect = card.getBoundingClientRect();
        // Find the first card whose bottom is below the list top (partially or fully visible)
        if (cardRect.bottom > listRect.top) {
          anchorMeetingIdRef.current = card.getAttribute('data-meeting-id');
          anchorOffsetRef.current = cardRect.top - listRect.top;
          break;
        }
      }
      scrollRafRef.current = null;
    };

    const handleScroll = () => {
      // Throttle using requestAnimationFrame for smooth scrolling
      if (scrollRafRef.current) return;
      scrollRafRef.current = requestAnimationFrame(updateAnchor);
    };

    listElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      listElement.removeEventListener('scroll', handleScroll);
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Restore scroll position after filteredMeetings changes (using useLayoutEffect to run before paint)
  // Uses meeting ID anchor to handle filter/search changes without scroll jumping
  // IMPORTANT: Uses stable ID keys as dependencies to prevent running on thumbnail updates
  useLayoutEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    // Check if this is the first render or meeting IDs have changed
    const previousKey = lastMeetingIdsRef.current;
    const hasNewMeetings = previousKey !== meetingIdsKey;

    // Update ref to current key
    lastMeetingIdsRef.current = meetingIdsKey;

    if (hasNewMeetings) {
      // Actually new data fetched - scroll to top and reset anchor
      listElement.scrollTop = 0;
      anchorMeetingIdRef.current = null;
      anchorOffsetRef.current = 0;
      return;
    }

    // Same meetings - this effect only runs when filteredMeetingIdsKey changes
    // (i.e., search/filter changed), not when thumbnails load
    if (!anchorMeetingIdRef.current) return;

    // Set flag to prevent scroll handler from overwriting during restoration
    isRestoringScrollRef.current = true;

    // Find the anchor meeting and scroll to keep it in the same position
    requestAnimationFrame(() => {
      const anchorCard = listElement.querySelector(`[data-meeting-id="${anchorMeetingIdRef.current}"]`);
      if (anchorCard) {
        const listRect = listElement.getBoundingClientRect();
        const cardRect = anchorCard.getBoundingClientRect();
        const currentOffset = cardRect.top - listRect.top;
        const scrollAdjustment = currentOffset - anchorOffsetRef.current;

        if (Math.abs(scrollAdjustment) > 1) {
          listElement.scrollTop += scrollAdjustment;
        }
      }

      // Reset flag after restoration
      requestAnimationFrame(() => {
        isRestoringScrollRef.current = false;
      });
    });
  }, [filteredMeetingIdsKey, meetingIdsKey]);

  // Update available cities when states change
  useEffect(() => {
    if (selectedStates.length > 0) {
      const citiesInStates = [...new Set(
        meetings
          .filter(m => selectedStates.includes(m.state))
          .map(m => m.city)
          .filter(Boolean)
      )].sort();
      setAvailableCities(citiesInStates);
    } else {
      const allCities = [...new Set(meetings.map(m => m.city).filter(Boolean))].sort();
      setAvailableCities(allCities);
    }
    setSelectedCity('');
  }, [selectedStates, meetings]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedStates([]);
    setSelectedCity('');
    setSelectedDays([]);
    setSelectedTypes([]);
    setShowOnlineOnly(false);
    setShowTodayOnly(false);
    setShowHybridOnly(false);
    setSelectedFormat('');
    setSelectedAccessibility([]);
  }, []);

  // Toggle functions for multi-select
  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const toggleType = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // Save recent search
  const saveRecentSearch = (query) => {
    if (!query || query.length < 2) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem('recentMeetingSearches', JSON.stringify(updated));
    } catch (e) {
      // Ignore storage errors
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('recentMeetingSearches');
    } catch (e) {
      // Ignore storage errors
    }
  };

  const toggleAccessibility = (key) => {
    setSelectedAccessibility(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const toggleState = (state) => {
    setSelectedStates(prev =>
      prev.includes(state)
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const hasActiveFilters = searchQuery || selectedStates.length > 0 || selectedCity || selectedDays.length > 0 || selectedTypes.length > 0 || showOnlineOnly || showTodayOnly || showHybridOnly || selectedFormat || selectedAccessibility.length > 0;

  // Count the number of active filters for the badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedStates.length > 0) count++;
    if (selectedCity) count++;
    if (selectedDays.length > 0) count++;
    if (selectedTypes.length > 0) count++;
    if (showOnlineOnly) count++;
    if (showTodayOnly) count++;
    if (showHybridOnly) count++;
    if (selectedFormat) count++;
    if (selectedAccessibility.length > 0) count++;
    return count;
  }, [searchQuery, selectedStates, selectedCity, selectedDays, selectedTypes, showOnlineOnly, showTodayOnly, showHybridOnly, selectedFormat, selectedAccessibility]);

  // Expose mobile navigation state to parent for sidebar menu
  useEffect(() => {
    if (onMobileNavChange) {
      onMobileNavChange({
        // Search
        searchQuery,
        onSearchChange: setSearchQuery,
        onSearchSubmit: () => {
          // Trigger search/filter update - uses ref to avoid dependency on fetchMeetings
          if (mapBounds && fetchMeetingsRef.current) {
            fetchMeetingsRef.current(mapBounds);
          }
        },
        // Quick filters
        showTodayOnly,
        onTodayToggle: () => setShowTodayOnly(prev => !prev),
        showOnlineOnly,
        onOnlineToggle: () => setShowOnlineOnly(prev => !prev),
        showHybridOnly,
        onHybridToggle: () => setShowHybridOnly(prev => !prev),
        // Days
        selectedDays,
        onDayToggle: (dayIndex) => {
          setSelectedDays(prev =>
            prev.includes(dayIndex)
              ? prev.filter(d => d !== dayIndex)
              : [...prev, dayIndex]
          );
        },
        onDaysPreset: (days) => setSelectedDays(days),
        // Types
        selectedTypes,
        availableTypes,
        onTypeToggle: (type) => {
          setSelectedTypes(prev =>
            prev.includes(type)
              ? prev.filter(t => t !== type)
              : [...prev, type]
          );
        },
        onClearTypes: () => setSelectedTypes([]),
        // States
        selectedStates,
        availableStates,
        onStateToggle: (state) => {
          setSelectedStates(prev =>
            prev.includes(state)
              ? prev.filter(s => s !== state)
              : [...prev, state]
          );
        },
        onClearStates: () => setSelectedStates([]),
        // Clear all
        hasActiveFilters,
        onClearAllFilters: clearFilters,
      });
    }
  }, [
    onMobileNavChange,
    searchQuery,
    showTodayOnly,
    showOnlineOnly,
    showHybridOnly,
    selectedDays,
    selectedTypes,
    availableTypes,
    selectedStates,
    availableStates,
    hasActiveFilters,
    clearFilters,
    mapBounds
    // Note: fetchMeetings removed - using fetchMeetingsRef instead to prevent effect re-runs
  ]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statesDropdownRef.current && !statesDropdownRef.current.contains(e.target)) {
        setShowStatesDropdown(false);
      }
      if (daysDropdownRef.current && !daysDropdownRef.current.contains(e.target)) {
        setShowDaysDropdown(false);
      }
      if (typesDropdownRef.current && !typesDropdownRef.current.contains(e.target)) {
        setShowTypesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search locations using Nominatim API
  const searchLocations = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setLocationResults([]);
      return;
    }

    // Clear any pending search
    if (locationSearchTimeout.current) {
      clearTimeout(locationSearchTimeout.current);
    }

    // Debounce the API call
    locationSearchTimeout.current = setTimeout(async () => {
      setIsSearchingLocations(true);
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
            type: 'nominatim',
            value: item.display_name.split(',').slice(0, 2).join(','),
            label: item.display_name.split(',').slice(0, 2).join(','),
            fullLabel: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            city: item.address?.city || item.address?.town || item.address?.village || '',
            state: item.address?.state || '',
            group: 'places'
          }));
          setLocationResults(locations);

          // Auto-pan to the first result immediately
          if (locations.length > 0) {
            const firstResult = locations[0];
            // Mark as programmatic pan so handleBoundsChange doesn't clear filters
            isProgrammaticPanRef.current = true;
            setTargetLocation({
              lat: firstResult.lat,
              lng: firstResult.lon,
              zoom: 12
            });

            // Clear the text search query since we're using geographic filters
            // The full location string (e.g., "Bentonville, Benton County") doesn't
            // match meeting city fields, causing list to show 0 meetings while map shows many
            setSearchQuery('');

            // State abbreviation mapping for filter sync
            const stateAbbreviations = {
              'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
              'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
              'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
              'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
              'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
              'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
              'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
              'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
              'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
              'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
              'District of Columbia': 'DC'
            };

            // Set state filter if we have state info
            if (firstResult.state) {
              const stateAbbr = stateAbbreviations[firstResult.state];
              if (stateAbbr) {
                setSelectedStates([stateAbbr]);
              }
            }

            // Set city filter if we have city info
            if (firstResult.city) {
              setSelectedCity(firstResult.city);
            }

            // Update mapCenterLocation to sync with the searched location
            // This ensures the header shows the correct location name
            const city = firstResult.city;
            const state = firstResult.state;
            if (city && state) {
              setMapCenterLocation(`${city}, ${state}`);
            } else if (city) {
              setMapCenterLocation(city);
            } else if (state) {
              setMapCenterLocation(state);
            } else if (firstResult.label) {
              setMapCenterLocation(firstResult.label);
            }
          }
        }
      } catch (error) {
        console.error('Location search error:', error);
      } finally {
        setIsSearchingLocations(false);
      }
    }, 300);
  }, []);

  // Geocode a location query and pan the map to that location
  const geocodeAndPanMap = useCallback(async (query, stateHint = null) => {
    if (!query || query.length < 2) return;

    try {
      // Build search query - include state hint for better accuracy
      const searchQuery = stateHint ? `${query}, ${stateHint}, USA` : `${query}, USA`;

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=us&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'MeetingScraper/1.0'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const location = data[0];
          setTargetLocation({
            lat: parseFloat(location.lat),
            lng: parseFloat(location.lon),
            zoom: 12 // City-level zoom
          });
          // Update mapCenterLocation from geocoding result to sync header with searched location
          const city = location.address?.city || location.address?.town || location.address?.village || '';
          const state = location.address?.state || '';
          if (city && state) {
            setMapCenterLocation(`${city}, ${state}`);
          } else if (city) {
            setMapCenterLocation(city);
          } else if (state) {
            setMapCenterLocation(state);
          } else {
            // Fallback to the original query
            setMapCenterLocation(query);
          }
        }
      }
    } catch (error) {
      console.error('Geocode error:', error);
    }
  }, []);

  // Reverse geocode map center to get location name
  // Adjusts detail level based on map zoom
  const reverseGeocodeMapCenter = useCallback(async (lat, lng, mapZoom = 10) => {
    if (lat === undefined || lng === undefined) return;

    // Clear any pending reverse geocode
    if (reverseGeocodeTimeoutRef.current) {
      clearTimeout(reverseGeocodeTimeoutRef.current);
    }

    // Debounce reverse geocoding to avoid too many API calls
    reverseGeocodeTimeoutRef.current = setTimeout(async () => {
      try {
        // Map zoom to Nominatim zoom for appropriate detail level
        // Map zoom 4-6: show country/state, 7-9: show state, 10-12: show city, 13+: show neighborhood
        const nominatimZoom = mapZoom < 7 ? 5 : mapZoom < 10 ? 8 : mapZoom < 13 ? 10 : 14;

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?` +
          `format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=${nominatimZoom}`,
          {
            headers: {
              'User-Agent': 'MeetingScraper/1.0'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data && data.address) {
            // Build location string based on map zoom level
            const neighborhood = data.address.suburb || data.address.neighbourhood || '';
            const city = data.address.city || data.address.town || data.address.village || '';
            const county = data.address.county || '';
            const state = data.address.state || '';
            const country = data.address.country || '';

            let locationName = null;

            if (mapZoom >= 13 && neighborhood) {
              // High zoom: show neighborhood + city
              locationName = city ? `${neighborhood}, ${city}` : neighborhood;
            } else if (mapZoom >= 10 && city) {
              // Medium zoom: show city + state
              locationName = state ? `${city}, ${state}` : city;
            } else if (mapZoom >= 7 && (city || county || state)) {
              // Low-medium zoom: show city with state, fallback to county with state
              if (city && state) {
                locationName = `${city}, ${state}`;
              } else if (county && state) {
                locationName = `${county}, ${state}`;
              } else {
                locationName = city || county || state;
              }
            } else if (state) {
              // Low zoom: show state or country
              locationName = country && country !== 'United States' ? `${state}, ${country}` : state;
            } else if (country) {
              locationName = country;
            }

            setMapCenterLocation(locationName);
          } else {
            setMapCenterLocation(null);
          }
        }
      } catch (error) {
        console.error('Reverse geocode error:', error);
        setMapCenterLocation(null);
      }
    }, 800); // Longer debounce for reverse geocoding to reduce API calls
  }, []);

  // Compute autocomplete suggestions with grouping
  const computeSuggestions = useCallback((query, showRecent = false) => {
    const results = [];
    const seen = new Set();

    // If no query but showing suggestions (focus), show recent searches
    if ((!query || query.length === 0) && showRecent && recentSearches.length > 0) {
      recentSearches.forEach(recent => {
        results.push({ type: 'recent', value: recent, label: recent, group: 'recent' });
      });
      setSuggestions(results);
      return;
    }

    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }

    const lowerQuery = query.toLowerCase();

    // Helper to highlight matching text
    const highlightMatch = (text) => {
      const index = text.toLowerCase().indexOf(lowerQuery);
      if (index === -1) return { before: text, match: '', after: '' };
      return {
        before: text.slice(0, index),
        match: text.slice(index, index + query.length),
        after: text.slice(index + query.length)
      };
    };

    // Add matching recent searches first
    recentSearches.forEach(recent => {
      if (recent.toLowerCase().includes(lowerQuery) && !seen.has(recent.toLowerCase())) {
        seen.add(recent.toLowerCase());
        results.push({
          type: 'recent',
          value: recent,
          label: recent,
          group: 'recent',
          highlight: highlightMatch(recent)
        });
      }
    });

    // Add matching cities
    const cityResults = [];
    availableCities.forEach(city => {
      if (city && city.toLowerCase().includes(lowerQuery) && !seen.has(city.toLowerCase())) {
        seen.add(city.toLowerCase());
        // Find a meeting with coordinates for this city
        const meetingWithCity = meetings.find(m => m.city === city && m.latitude && m.longitude);
        const meetingForState = meetingWithCity || meetings.find(m => m.city === city);
        cityResults.push({
          type: 'city',
          value: city,
          label: city,
          subLabel: meetingForState?.state || '',
          group: 'cities',
          highlight: highlightMatch(city),
          // Include coordinates for instant panning
          lat: meetingWithCity?.latitude,
          lng: meetingWithCity?.longitude
        });
      }
    });
    results.push(...cityResults.slice(0, 4));

    // Add matching states
    const stateResults = [];
    availableStates.forEach(state => {
      if (state && state.toLowerCase().includes(lowerQuery) && !seen.has(state.toLowerCase())) {
        seen.add(state.toLowerCase());
        stateResults.push({
          type: 'state',
          value: state,
          label: state,
          group: 'states',
          highlight: highlightMatch(state)
        });
      }
    });
    results.push(...stateResults.slice(0, 3));

    // Add matching location names from meetings
    const locationResults = [];
    meetings.forEach(m => {
      if (m.locationName && m.locationName.toLowerCase().includes(lowerQuery)) {
        const key = m.locationName.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          locationResults.push({
            type: 'location',
            value: m.locationName,
            label: m.locationName,
            subLabel: m.city ? `${m.city}, ${m.state}` : m.state,
            group: 'locations',
            highlight: highlightMatch(m.locationName),
            // Include coordinates for instant panning
            lat: m.latitude,
            lng: m.longitude,
            city: m.city,
            state: m.state
          });
        }
      }
    });
    results.push(...locationResults.slice(0, 4));

    // Limit to top 10 suggestions
    setSuggestions(results.slice(0, 10));
  }, [availableCities, availableStates, meetings, recentSearches]);

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    computeSuggestions(value, false);
    searchLocations(value);
    setShowSuggestions(value.length >= 1 || recentSearches.length > 0);
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    if (searchQuery.length >= 1) {
      computeSuggestions(searchQuery, false);
      setShowSuggestions(true);
    } else if (recentSearches.length > 0) {
      computeSuggestions('', true);
      setShowSuggestions(true);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.value);
    setShowSuggestions(false);
    setLocationResults([]);
    saveRecentSearch(suggestion.value);

    // If it's a state, also set the state filter
    if (suggestion.type === 'state') {
      setSelectedStates([suggestion.value]);
      // Clear target location - state selection doesn't need map pan
      setTargetLocation(null);
    }

    // If it's a recent search, geocode and pan to the location
    if (suggestion.type === 'recent') {
      // Clear state/city filter so meeting list matches the searched location
      setSelectedStates([]);
      setSelectedCity('');
      // Mark as programmatic pan so handleBoundsChange doesn't clear filters
      isProgrammaticPanRef.current = true;
      // Geocode the search string and pan the map
      geocodeAndPanMap(suggestion.value, null);
    }

    // If it's a Nominatim place, pan/zoom map to that location and set filters
    if (suggestion.type === 'nominatim' && suggestion.lat && suggestion.lon) {
      // Clear the search query since we're using city/state filters instead
      // The full Nominatim display name (e.g., "Los Angeles, Los Angeles County")
      // doesn't match meeting city fields, so we rely on geographic filters
      setSearchQuery('');

      // Mark as programmatic pan so handleBoundsChange doesn't clear filters
      isProgrammaticPanRef.current = true;
      // Set target location to pan/zoom the map
      setTargetLocation({
        lat: suggestion.lat,
        lng: suggestion.lon,
        zoom: 12 // City-level zoom
      });

      // Extract state abbreviation from full state name if available
      const stateAbbreviations = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
        'District of Columbia': 'DC'
      };

      // Set the state filter if we have state info
      if (suggestion.state) {
        const stateAbbr = stateAbbreviations[suggestion.state];
        if (stateAbbr) {
          setSelectedStates([stateAbbr]);
        }
      }

      // Set the city filter if we have city info
      if (suggestion.city) {
        setSelectedCity(suggestion.city);
      }
    }

    // If it's a city from the meeting data, set city filter and pan map
    if (suggestion.type === 'city') {
      setSelectedCity(suggestion.value);
      // Also set state if available
      if (suggestion.subLabel) {
        setSelectedStates([suggestion.subLabel]);
      }
      // Mark as programmatic pan so handleBoundsChange doesn't clear filters
      isProgrammaticPanRef.current = true;
      // Use local coordinates for instant panning if available
      if (suggestion.lat && suggestion.lng) {
        setTargetLocation({
          lat: suggestion.lat,
          lng: suggestion.lng,
          zoom: 12
        });
      } else {
        // Fall back to geocoding if no local coordinates
        geocodeAndPanMap(suggestion.value, suggestion.subLabel);
      }
    }

    // If it's a meeting location, set filters and pan to coordinates
    if (suggestion.type === 'location') {
      if (suggestion.city) {
        setSelectedCity(suggestion.city);
      }
      if (suggestion.state) {
        setSelectedStates([suggestion.state]);
      }
      // Use coordinates for instant panning (zoom in more for specific locations)
      if (suggestion.lat && suggestion.lng) {
        // Mark as programmatic pan so handleBoundsChange doesn't clear filters
        isProgrammaticPanRef.current = true;
        setTargetLocation({
          lat: suggestion.lat,
          lng: suggestion.lng,
          zoom: 15
        });
      }
    }
  };

  // Handle search submit (pressing enter or clicking search button)
  const handleSearchSubmit = () => {
    if (searchQuery) {
      saveRecentSearch(searchQuery);
      // Clear state filter so meeting list matches the searched location
      // This ensures the list shows meetings from the new area, not filtered by old state
      setSelectedStates([]);
      setSelectedCity('');
      // Mark as programmatic pan so handleBoundsChange doesn't clear filters
      isProgrammaticPanRef.current = true;
      // Geocode and pan map to the searched location - this will trigger bounds change and fetch
      geocodeAndPanMap(searchQuery, null);
    }
    setShowSuggestions(false);
  };

  // Handle city dropdown selection - pans map immediately
  const handleCityChange = (city) => {
    setSelectedCity(city);
    if (city) {
      // Find a meeting with coordinates for this city to pan the map
      const meetingWithCoords = meetings.find(m => m.city === city && m.latitude && m.longitude);
      if (meetingWithCoords) {
        // Mark as programmatic pan so handleBoundsChange doesn't clear filters
        isProgrammaticPanRef.current = true;
        setTargetLocation({
          lat: meetingWithCoords.latitude,
          lng: meetingWithCoords.longitude,
          zoom: 12
        });
      }
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleMeetingHover = (meeting) => {
    setHoveredMeeting(meeting);
  };

  const handleMapMarkerClick = (meeting) => {
    setSelectedMeeting(meeting);
    // Scroll list to the meeting card
    if (listRef.current) {
      const cardElement = listRef.current.querySelector(`[data-meeting-id="${meeting.objectId}"]`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Handle meeting card click from list - show detail and zoom map to location
  const handleMeetingCardClick = (meeting) => {
    setSelectedMeeting(meeting);
    // Zoom the map to the meeting location if it has coordinates
    if (meeting.latitude && meeting.longitude) {
      isProgrammaticPanRef.current = true;
      setTargetLocation({
        lat: meeting.latitude,
        lng: meeting.longitude,
        zoom: 15 // Zoom in to street level
      });
    }
  };

  // Handle map bounds change - fetch meetings for the visible area
  // Handle map bounds change - just update state, effect handles fetching
  const handleMapBoundsChange = useCallback((bounds) => {
    setMapBounds(bounds);

    // Only update location display when user manually pans the map
    // Use debounced reset to handle multiple rapid events (moveend + zoomend can both fire)
    if (isProgrammaticPanRef.current) {
      // Clear any pending reset timeout
      if (programmaticPanTimeoutRef.current) {
        clearTimeout(programmaticPanTimeoutRef.current);
      }
      // Reset flag after a short delay to catch all events from the same programmatic pan
      programmaticPanTimeoutRef.current = setTimeout(() => {
        isProgrammaticPanRef.current = false;
      }, 500);
    } else {
      // User manually dragged the map - clear state/city filters and reverse geocode
      setSelectedStates([]);
      setSelectedCity('');
      if (bounds.center_lat !== undefined && bounds.center_lng !== undefined) {
        reverseGeocodeMapCenter(bounds.center_lat, bounds.center_lng, bounds.zoom);
      }
    }
  }, [reverseGeocodeMapCenter]);

  // Build filters object to pass to the map
  const mapFilters = useMemo(() => {
    const filters = {};
    // For "Today" filter, convert to day number
    if (showTodayOnly) {
      filters.day = new Date().getDay();
    } else if (selectedDays.length === 1) {
      // If single day selected, pass it to the map (selectedDays contains numeric indices 0-6)
      filters.day = selectedDays[0];
    }
    // Pass meeting type filter
    if (selectedTypes.length === 1) {
      filters.type = selectedTypes[0];
    }
    // Pass state filter
    if (selectedStates.length === 1) {
      filters.state = selectedStates[0];
    }
    // Pass online/hybrid filters
    if (showOnlineOnly) {
      filters.online = true;
    }
    if (showHybridOnly) {
      filters.hybrid = true;
    }
    // Pass city filter
    if (selectedCity) {
      filters.city = selectedCity;
    }
    // Pass format filter
    if (selectedFormat) {
      filters.format = selectedFormat;
    }
    return filters;
  }, [showTodayOnly, selectedDays, selectedTypes, selectedStates, showOnlineOnly, showHybridOnly, selectedCity, selectedFormat]);

  return (
    <div className="airbnb-explorer">
      {/* Top Navigation Bar */}
      <header className="airbnb-header">
        <div className="airbnb-header-left">
          <SidebarToggleButton
            isOpen={sidebarOpen}
            onClick={onSidebarToggle}
            className="header-sidebar-toggle"
          />
          <div className="airbnb-logo" onClick={() => window.location.reload()}>
            <img
              src="/logo.png"
              alt="Sober Sidekick"
              className="logo-icon"
            />
            <div className="logo-text">
              <span className="logo-brand">Sober Sidekick</span>
              <span className="logo-tagline">You're Never Alone</span>
            </div>
          </div>
        </div>

        {/* Search Bar - Clean Design */}
        <div className="airbnb-search-bar">
          {/* Location Section */}
          <div className="search-section search-location" ref={searchInputRef}>
            <div className="search-section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div className="search-section-content">
              <label>Where</label>
              <input
                type="text"
                placeholder="Search locations..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }}
                  aria-label="Clear search"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
            {showSuggestions && (suggestions.length > 0 || locationResults.length > 0 || isSearchingLocations) && (
              <div className="search-suggestions">
                {/* Group: Recent Searches */}
                {suggestions.some(s => s.group === 'recent') && (
                  <div className="suggestion-group">
                    <div className="suggestion-group-header">
                      <span>Recent</span>
                      <button className="suggestion-clear-recent" onClick={(e) => { e.stopPropagation(); clearRecentSearches(); setShowSuggestions(false); }}>
                        Clear
                      </button>
                    </div>
                    {suggestions.filter(s => s.group === 'recent').map((suggestion, index) => (
                      <button
                        key={`recent-${suggestion.value}-${index}`}
                        className="suggestion-item"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <span className="suggestion-icon suggestion-recent">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                        </span>
                        <span className="suggestion-text">
                          <span className="suggestion-label">
                            {suggestion.highlight ? (
                              <>{suggestion.highlight.before}<strong>{suggestion.highlight.match}</strong>{suggestion.highlight.after}</>
                            ) : suggestion.label}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Group: Places (from Nominatim API - searches all US locations) */}
                {(locationResults.length > 0 || isSearchingLocations) && (
                  <div className="suggestion-group suggestion-group-places">
                    <div className="suggestion-group-header">
                      Search US Locations
                      {isSearchingLocations && <span className="suggestion-loading"></span>}
                    </div>
                    {locationResults.map((location, index) => (
                      <button
                        key={`place-${location.lat}-${location.lon}-${index}`}
                        className="suggestion-item"
                        onClick={() => handleSuggestionClick(location)}
                      >
                        <span className="suggestion-icon suggestion-place">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                            <path d="M2 12h20"/>
                          </svg>
                        </span>
                        <span className="suggestion-text">
                          <span className="suggestion-label">{location.label}</span>
                          {location.state && (
                            <span className="suggestion-sublabel">{location.state}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Group: Cities */}
                {suggestions.some(s => s.group === 'cities') && (
                  <div className="suggestion-group">
                    <div className="suggestion-group-header">Cities</div>
                    {suggestions.filter(s => s.group === 'cities').map((suggestion, index) => (
                      <button
                        key={`city-${suggestion.value}-${index}`}
                        className="suggestion-item"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <span className="suggestion-icon suggestion-city">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                        </span>
                        <span className="suggestion-text">
                          <span className="suggestion-label">
                            {suggestion.highlight ? (
                              <>{suggestion.highlight.before}<strong>{suggestion.highlight.match}</strong>{suggestion.highlight.after}</>
                            ) : suggestion.label}
                          </span>
                          {suggestion.subLabel && (
                            <span className="suggestion-sublabel">{suggestion.subLabel}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Group: States */}
                {suggestions.some(s => s.group === 'states') && (
                  <div className="suggestion-group">
                    <div className="suggestion-group-header">States</div>
                    {suggestions.filter(s => s.group === 'states').map((suggestion, index) => (
                      <button
                        key={`state-${suggestion.value}-${index}`}
                        className="suggestion-item"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <span className="suggestion-icon suggestion-state">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M3 9h18"/>
                            <path d="M9 21V9"/>
                          </svg>
                        </span>
                        <span className="suggestion-text">
                          <span className="suggestion-label">
                            {suggestion.highlight ? (
                              <>{suggestion.highlight.before}<strong>{suggestion.highlight.match}</strong>{suggestion.highlight.after}</>
                            ) : suggestion.label}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Group: Locations */}
                {suggestions.some(s => s.group === 'locations') && (
                  <div className="suggestion-group">
                    <div className="suggestion-group-header">Locations</div>
                    {suggestions.filter(s => s.group === 'locations').map((suggestion, index) => (
                      <button
                        key={`location-${suggestion.value}-${index}`}
                        className="suggestion-item"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <span className="suggestion-icon suggestion-location">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9,22 9,12 15,12 15,22"/>
                          </svg>
                        </span>
                        <span className="suggestion-text">
                          <span className="suggestion-label">
                            {suggestion.highlight ? (
                              <>{suggestion.highlight.before}<strong>{suggestion.highlight.match}</strong>{suggestion.highlight.after}</>
                            ) : suggestion.label}
                          </span>
                          {suggestion.subLabel && (
                            <span className="suggestion-sublabel">{suggestion.subLabel}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Days Section - Multi-select */}
          <div className="search-section search-when" ref={daysDropdownRef}>
            <div className="search-section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div
              className={`search-section-content search-section-clickable ${showDaysDropdown ? 'active' : ''}`}
              onClick={() => setShowDaysDropdown(!showDaysDropdown)}
            >
              <label>When</label>
              <div className="search-section-value">
                {selectedDays.length === 0
                  ? 'Any day'
                  : selectedDays.length === 7
                    ? 'Every day'
                    : selectedDays.map(d => dayAbbrev[d]).join(', ')}
                <svg className={`dropdown-chevron ${showDaysDropdown ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
            {selectedDays.length > 0 && (
              <button
                className="search-clear-btn"
                onClick={(e) => { e.stopPropagation(); setSelectedDays([]); }}
                aria-label="Clear days"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
            {showDaysDropdown && (
              <div className="days-dropdown">
                <div className="days-dropdown-header">
                  <span>Select Days</span>
                  {selectedDays.length > 0 && (
                    <button className="days-clear-btn" onClick={() => setSelectedDays([])}>Clear</button>
                  )}
                </div>
                <div className="days-grid">
                  {dayAbbrev.map((day, index) => (
                    <button
                      key={day}
                      className={`day-chip ${selectedDays.includes(index) ? 'selected' : ''}`}
                      onClick={() => toggleDay(index)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="days-presets">
                  <button
                    className={`days-preset ${selectedDays.length === 5 && [1,2,3,4,5].every(d => selectedDays.includes(d)) ? 'active' : ''}`}
                    onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                  >
                    Weekdays
                  </button>
                  <button
                    className={`days-preset ${selectedDays.length === 2 && selectedDays.includes(0) && selectedDays.includes(6) ? 'active' : ''}`}
                    onClick={() => setSelectedDays([0, 6])}
                  >
                    Weekends
                  </button>
                  <button
                    className={`days-preset ${selectedDays.length === 7 ? 'active' : ''}`}
                    onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                  >
                    Every day
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Type Section - Multi-select with icons */}
          <div className="search-section search-type" ref={typesDropdownRef}>
            <div className="search-section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div
              className={`search-section-content search-section-clickable ${showTypesDropdown ? 'active' : ''}`}
              onClick={() => setShowTypesDropdown(!showTypesDropdown)}
            >
              <label>Type</label>
              <div className="search-section-value">
                {selectedTypes.length === 0
                  ? 'Any type'
                  : selectedTypes.length === 1
                    ? selectedTypes[0]
                    : `${selectedTypes.length} types`}
                <svg className={`dropdown-chevron ${showTypesDropdown ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
            {selectedTypes.length > 0 && (
              <button
                className="search-clear-btn"
                onClick={(e) => { e.stopPropagation(); setSelectedTypes([]); }}
                aria-label="Clear types"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
            {showTypesDropdown && (
              <div className="types-dropdown">
                <div className="types-dropdown-header">
                  <span>Select Meeting Types</span>
                  {selectedTypes.length > 0 && (
                    <button className="types-clear-btn" onClick={() => setSelectedTypes([])}>Clear</button>
                  )}
                </div>
                <div className="types-grid">
                  {availableTypes.map(type => {
                    const typeInfo = MEETING_TYPES[type] || MEETING_TYPES['Other'];
                    return (
                      <button
                        key={type}
                        className={`type-chip ${selectedTypes.includes(type) ? 'selected' : ''}`}
                        onClick={() => toggleType(type)}
                        title={typeInfo.name}
                      >
                        <span className={`type-chip-icon type-icon-${type.toLowerCase().replace('-', '')}`}>
                          <MeetingTypeIcon type={type} size={18} />
                        </span>
                        <span className="type-chip-label">{type}</span>
                        {selectedTypes.includes(type) && (
                          <span className="type-chip-check">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="types-legend">
                  {selectedTypes.length > 0 && (
                    <div className="types-selected-info">
                      {selectedTypes.map(type => MEETING_TYPES[type]?.name || type).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search Button */}
          <button
            className={`search-button ${hasActiveFilters ? 'has-filters' : ''}`}
            onClick={handleSearchSubmit}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            {hasActiveFilters && <span className="search-button-text">Search</span>}
          </button>
        </div>

      </header>

      {/* Secondary Filter Bar */}
      <div className="airbnb-filters">
        <div className="filter-chips">
          {/* Multi-select States Dropdown */}
          <div className="multi-select-dropdown" ref={statesDropdownRef}>
            <button
              className={`filter-chip-select multi-select-trigger ${selectedStates.length > 0 ? 'has-selection' : ''}`}
              onClick={() => setShowStatesDropdown(!showStatesDropdown)}
            >
              <span className="multi-select-label">
                {selectedStates.length === 0
                  ? 'All States'
                  : selectedStates.length === 1
                    ? selectedStates[0]
                    : `${selectedStates.length} states`}
              </span>
              <svg className={`dropdown-chevron ${showStatesDropdown ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showStatesDropdown && (
              <div className="multi-select-menu">
                <div className="multi-select-header">
                  <span>Select States</span>
                  {selectedStates.length > 0 && (
                    <button className="multi-select-clear" onClick={() => setSelectedStates([])}>
                      Clear
                    </button>
                  )}
                </div>
                <div className="multi-select-options">
                  {availableStates.map(state => (
                    <label key={state} className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={selectedStates.includes(state)}
                        onChange={() => toggleState(state)}
                      />
                      <span className="checkbox-custom"></span>
                      <span className="option-label">{state}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedStates.length > 0 && (
            <select
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className="filter-chip-select"
            >
              <option value="">All Cities</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          )}

          <button
            className={`filter-chip ${showOnlineOnly ? 'active' : ''}`}
            onClick={() => setShowOnlineOnly(!showOnlineOnly)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8"/>
              <path d="M12 17v4"/>
            </svg>
            Online
          </button>

          <button
            className={`filter-chip ${showTodayOnly ? 'active' : ''}`}
            onClick={() => setShowTodayOnly(!showTodayOnly)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <circle cx="12" cy="15" r="2" fill="currentColor"/>
            </svg>
            Today
          </button>

          <button
            className={`filter-chip ${showFilters ? 'active' : ''} ${activeFilterCount > 0 ? 'has-count' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="18" x2="20" y2="18"/>
              <circle cx="8" cy="6" r="2" fill="currentColor"/>
              <circle cx="16" cy="12" r="2" fill="currentColor"/>
              <circle cx="10" cy="18" r="2" fill="currentColor"/>
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="filter-count-badge">{activeFilterCount}</span>
            )}
          </button>

          {hasActiveFilters && (
            <button className="filter-chip clear-filters" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>

        {/* Active Filter Tags - Show individual removable chips for each filter */}
        {hasActiveFilters && (
          <div className="active-filter-tags">
            {searchQuery && (
              <span className="active-filter-tag">
                <span className="tag-label">Search:</span> {searchQuery}
                <button
                  className="tag-remove"
                  onClick={() => setSearchQuery('')}
                  aria-label="Remove search filter"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )}
            {selectedStates.map(state => (
              <span key={`state-${state}`} className="active-filter-tag">
                <span className="tag-label">State:</span> {state}
                <button
                  className="tag-remove"
                  onClick={() => setSelectedStates(prev => prev.filter(s => s !== state))}
                  aria-label={`Remove ${state} filter`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            ))}
            {selectedCity && (
              <span className="active-filter-tag">
                <span className="tag-label">City:</span> {selectedCity}
                <button
                  className="tag-remove"
                  onClick={() => setSelectedCity('')}
                  aria-label="Remove city filter"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )}
            {selectedDays.map(day => (
              <span key={`day-${day}`} className="active-filter-tag">
                <span className="tag-label">Day:</span> {dayNames[day]}
                <button
                  className="tag-remove"
                  onClick={() => setSelectedDays(prev => prev.filter(d => d !== day))}
                  aria-label={`Remove ${dayNames[day]} filter`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            ))}
            {selectedTypes.map(type => (
              <span key={`type-${type}`} className="active-filter-tag">
                <span className="tag-label">Type:</span> {type}
                <button
                  className="tag-remove"
                  onClick={() => setSelectedTypes(prev => prev.filter(t => t !== type))}
                  aria-label={`Remove ${type} filter`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            ))}
            {showOnlineOnly && (
              <span className="active-filter-tag">
                Online Only
                <button
                  className="tag-remove"
                  onClick={() => setShowOnlineOnly(false)}
                  aria-label="Remove online only filter"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )}
            {showTodayOnly && (
              <span className="active-filter-tag">
                Today Only
                <button
                  className="tag-remove"
                  onClick={() => setShowTodayOnly(false)}
                  aria-label="Remove today only filter"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )}
            {showHybridOnly && (
              <span className="active-filter-tag">
                Hybrid Only
                <button
                  className="tag-remove"
                  onClick={() => setShowHybridOnly(false)}
                  aria-label="Remove hybrid only filter"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )}
            {selectedFormat && (
              <span className="active-filter-tag">
                <span className="tag-label">Format:</span> {selectedFormat.replace(/_/g, ' ')}
                <button
                  className="tag-remove"
                  onClick={() => setSelectedFormat('')}
                  aria-label="Remove format filter"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )}
            {selectedAccessibility.map(acc => {
              const option = accessibilityOptions.find(o => o.key === acc);
              return (
                <span key={`acc-${acc}`} className="active-filter-tag">
                  {option?.icon} {option?.label || acc}
                  <button
                    className="tag-remove"
                    onClick={() => setSelectedAccessibility(prev => prev.filter(a => a !== acc))}
                    aria-label={`Remove ${option?.label || acc} filter`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="filter-stats">
          {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="airbnb-main">
        {/* List Panel (Left) */}
        <div className={`airbnb-list-panel ${isMapCollapsed ? 'expanded' : ''}`} ref={listRef}>
          {error || configStatus === 'not_configured' || configStatus === 'unreachable' ? (
            <div className="list-error">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4"/>
                <path d="M12 16h.01"/>
              </svg>
              {configStatus === 'not_configured' ? (
                <>
                  <p><strong>Database Not Configured</strong></p>
                  <p className="error-detail">Back4App credentials are not set. Please configure BACK4APP_APP_ID and BACK4APP_REST_KEY environment variables on Render.</p>
                </>
              ) : configStatus === 'unreachable' ? (
                <>
                  <p><strong>Backend Unreachable</strong></p>
                  <p className="error-detail">Cannot connect to the backend server. It may be starting up or deploying.</p>
                </>
              ) : (
                <>
                  <p><strong>Failed to Load Meetings</strong></p>
                  <p className="error-detail">{error}</p>
                </>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => mapBounds && fetchMeetings(mapBounds)}>
                  Try Again
                </button>
                <button className="btn btn-secondary" onClick={() => setShowDiagnostics(true)}>
                  View Diagnostics
                </button>
                {process.env.NODE_ENV === 'development' && errorDetails && (
                  <button className="btn btn-secondary" onClick={() => setShowErrorLogs(!showErrorLogs)}>
                    {showErrorLogs ? 'Hide' : 'Show'} Error Logs
                  </button>
                )}
              </div>
              {/* Copyable Error Logs Section (development mode only) */}
              {process.env.NODE_ENV === 'development' && showErrorLogs && errorDetails && (
                <div className="error-logs-section" style={{ marginTop: '16px', textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Debug Logs</span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => {
                        const logText = JSON.stringify(errorDetails, null, 2);
                        navigator.clipboard.writeText(logText).then(() => {
                          alert('Error logs copied to clipboard');
                        }).catch(() => {
                          // Fallback for older browsers
                          const textarea = document.createElement('textarea');
                          textarea.value = logText;
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          alert('Error logs copied to clipboard');
                        });
                      }}
                    >
                      Copy Logs
                    </button>
                  </div>
                  <pre style={{
                    background: 'var(--bg-tertiary, #1a1a1a)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'var(--text-secondary)',
                    margin: 0
                  }}>
                    {JSON.stringify(errorDetails, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : filteredMeetings.length === 0 && mapMeetingCount === 0 && !isLoading ? (
            <div className="list-empty">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <h3>No meetings found</h3>
              <p>Try adjusting your filters or zooming out on the map</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                {hasActiveFilters && (
                  <button className="btn btn-secondary" onClick={clearFilters}>
                    Clear all filters
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setShowDiagnostics(true)}>
                  View Diagnostics
                </button>
              </div>
              {/* Show debug info if available (development mode only) */}
              {process.env.NODE_ENV === 'development' && errorDetails?.type === 'empty_results_debug_info' && (
                <div style={{ marginTop: '16px', textAlign: 'left', width: '100%' }}>
                  <details style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Debug Info (for troubleshooting)</summary>
                    <pre style={{
                      background: 'var(--bg-tertiary, #1a1a1a)',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      overflow: 'auto',
                      maxHeight: '200px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0
                    }}>
                      {JSON.stringify(errorDetails, null, 2)}
                    </pre>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', marginTop: '8px' }}
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
                        alert('Debug info copied to clipboard');
                      }}
                    >
                      Copy Debug Info
                    </button>
                  </details>
                </div>
              )}
            </div>
          ) : filteredMeetings.length === 0 && mapMeetingCount > 0 && isLoading ? (
            <div className="list-empty list-empty-loading">
              <div className="loading-spinner"></div>
              <h3>Loading meetings...</h3>
              <p>{mapMeetingCount.toLocaleString()} meetings on map</p>
            </div>
          ) : (
            <>
              <div className="list-header">
                <h2>Meetings in {selectedStates.length > 0 ? selectedStates.join(', ') : selectedCity || mapCenterLocation || 'this area'}</h2>
                <p>
                  {isLoading ? (
                    'Loading...'
                  ) : (
                    <>{filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}{filteredMeetings.length > 0 && totalMeetings > filteredMeetings.length && ` (showing ${filteredMeetings.length} of ${totalMeetings})`}</>
                  )}
                </p>
              </div>
              <div className="meeting-cards-grid">
                {filteredMeetings.map((meeting) => (
                  <div
                    key={meeting.objectId || `${meeting.latitude}-${meeting.longitude}-${meeting.name}-${meeting.day}-${meeting.time}`}
                    data-meeting-id={meeting.objectId}
                    className={`meeting-card ${hoveredMeeting?.objectId === meeting.objectId ? 'hovered' : ''}`}
                    onClick={() => handleMeetingCardClick(meeting)}
                    onMouseEnter={() => handleMeetingHover(meeting)}
                    onMouseLeave={() => handleMeetingHover(null)}
                  >
                    <div className="meeting-card-image">
                      {meeting.latitude && meeting.longitude && !meeting.isOnline ? (
                        <img
                          src={`https://a.tile.openstreetmap.org/15/${Math.floor((meeting.longitude + 180) / 360 * 32768)}/${Math.floor((1 - Math.log(Math.tan(meeting.latitude * Math.PI / 180) + 1 / Math.cos(meeting.latitude * Math.PI / 180)) / Math.PI) / 2 * 32768)}.png`}
                          alt={`Map of ${meeting.name || 'meeting location'}`}
                          className="meeting-card-map"
                          loading="lazy"
                        />
                      ) : meeting.isOnline ? (
                        <div className="meeting-card-icon meeting-card-icon-online">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2"/>
                            <path d="M8 21h8"/>
                            <path d="M12 17v4"/>
                          </svg>
                        </div>
                      ) : (
                        <div className="meeting-card-icon">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                        </div>
                      )}
                      <div className="meeting-card-type-badge">
                        {meeting.meetingType}
                      </div>
                      {meeting.isOnline && (
                        <div className="meeting-card-online-badge">
                          {meeting.isHybrid ? 'Hybrid' : 'Online'}
                        </div>
                      )}
                    </div>
                    <div className="meeting-card-content">
                      <div className="meeting-card-location">
                        {[meeting.city, meeting.state].filter(Boolean).join(', ') || 'Location TBD'}
                      </div>
                      <h3 className="meeting-card-title">{meeting.name || 'Unnamed Meeting'}</h3>
                      <div className="meeting-card-schedule">
                        <span className="schedule-day">{dayNames[meeting.day]}</span>
                        <span className="schedule-time">{formatTime(meeting.time)}</span>
                      </div>
                      {meeting.locationName && (
                        <div className="meeting-card-venue">{meeting.locationName}</div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Skeleton placeholders while loading */}
                {isLoading && meetings.length === 0 && (
                  [...Array(6)].map((_, index) => (
                    <div key={`skeleton-${index}`} className="skeleton-meeting-card">
                      <div className="skeleton-card-image">
                        <div className="skeleton-card-badge"></div>
                      </div>
                      <div className="skeleton-card-content">
                        <div className="skeleton-card-location"></div>
                        <div className="skeleton-card-title"></div>
                        <div className="skeleton-card-schedule">
                          <div className="skeleton-card-day"></div>
                          <div className="skeleton-card-time"></div>
                        </div>
                        <div className="skeleton-card-venue"></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Map Panel (Right) */}
        <div className={`airbnb-map-panel ${isMapCollapsed ? 'collapsed' : ''}`}>
          <button
            className="map-collapse-btn"
            onClick={() => setIsMapCollapsed(!isMapCollapsed)}
            title={isMapCollapsed ? 'Show map' : 'Hide map'}
          >
            {isMapCollapsed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </button>

          {!isMapCollapsed && (
            <>
              <MeetingMap
                onSelectMeeting={handleMapMarkerClick}
                onStateClick={(stateData) => {
                  // Mark this as a programmatic pan to prevent handleMapBoundsChange from clearing filters
                  isProgrammaticPanRef.current = true;
                  // Set the state filter to show meetings for this state
                  setSelectedStates([stateData.state]);
                  // Clear target location since we're clicking a state
                  setTargetLocation(null);
                  // Scroll to the meeting list
                  if (listRef.current) {
                    listRef.current.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                showHeatmap={true}
                targetLocation={targetLocation}
                filters={mapFilters}
                onBoundsChange={handleMapBoundsChange}
                onMapMeetingCount={setMapMeetingCount}
                hoveredMeeting={hoveredMeeting}
              />
            </>
          )}
        </div>
      </div>

      {/* Meeting Detail Sidebar */}
      <MeetingDetail
        meeting={selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        isSidebar={true}
      />

      {/* Filter Modal */}
      {showFilters && (
        <>
          <div className="filter-modal-backdrop" onClick={() => setShowFilters(false)} />
          <div className="filter-modal">
            <div className="filter-modal-header">
              <h2>Filters</h2>
              <button className="filter-modal-close" onClick={() => setShowFilters(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="filter-modal-content">
              {/* Quick Filters */}
              <div className="filter-section">
                <h3>Quick filters</h3>
                <div className="filter-quick-options">
                  <button
                    className={`filter-quick-btn ${showOnlineOnly ? 'active' : ''}`}
                    onClick={() => setShowOnlineOnly(!showOnlineOnly)}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <path d="M8 21h8"/>
                      <path d="M12 17v4"/>
                    </svg>
                    <span>Online</span>
                  </button>
                  {availableTypes.slice(0, 4).map(type => (
                    <button
                      key={type}
                      className={`filter-quick-btn ${selectedTypes.includes(type) ? 'active' : ''}`}
                      onClick={() => toggleType(type)}
                    >
                      <span className={`filter-quick-icon type-icon-${type.toLowerCase().replace('-', '')}`}>
                        <MeetingTypeIcon type={type} size={20} />
                      </span>
                      <span>{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Meeting Type */}
              <div className="filter-section">
                <h3>Meeting type</h3>
                <div className="filter-type-grid">
                  {availableTypes.map(type => {
                    const typeInfo = MEETING_TYPES[type] || MEETING_TYPES['Other'];
                    return (
                      <button
                        key={type}
                        className={`filter-type-btn ${selectedTypes.includes(type) ? 'active' : ''}`}
                        onClick={() => toggleType(type)}
                        title={typeInfo.name}
                      >
                        <span className={`filter-type-icon type-icon-${type.toLowerCase().replace('-', '')}`}>
                          <MeetingTypeIcon type={type} size={20} />
                        </span>
                        <span className="filter-type-label">{type}</span>
                        {selectedTypes.includes(type) && (
                          <span className="filter-type-check">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedTypes.length > 0 && (
                  <button className="filter-clear-selection" onClick={() => setSelectedTypes([])}>
                    Clear selection
                  </button>
                )}
              </div>

              {/* Day of Week */}
              <div className="filter-section">
                <h3>Day of week</h3>
                <div className="filter-day-grid">
                  <button
                    className={`filter-day-btn ${selectedDays.length === 0 ? 'active' : ''}`}
                    onClick={() => setSelectedDays([])}
                  >
                    Any
                  </button>
                  {dayNames.map((day, index) => (
                    <button
                      key={day}
                      className={`filter-day-btn ${selectedDays.includes(index) ? 'active' : ''}`}
                      onClick={() => toggleDay(index)}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <div className="filter-day-presets">
                  <button
                    className={`filter-preset-btn ${selectedDays.length === 5 && [1,2,3,4,5].every(d => selectedDays.includes(d)) ? 'active' : ''}`}
                    onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                  >
                    Weekdays
                  </button>
                  <button
                    className={`filter-preset-btn ${selectedDays.length === 2 && selectedDays.includes(0) && selectedDays.includes(6) ? 'active' : ''}`}
                    onClick={() => setSelectedDays([0, 6])}
                  >
                    Weekends
                  </button>
                </div>
              </div>

              {/* Location */}
              <div className="filter-section">
                <h3>Location</h3>
                <div className="filter-location-selects">
                  <div className="filter-states-grid">
                    {availableStates.map(state => (
                      <label key={state} className="filter-state-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedStates.includes(state)}
                          onChange={() => toggleState(state)}
                        />
                        <span className="checkbox-custom"></span>
                        <span>{state}</span>
                      </label>
                    ))}
                  </div>
                  {selectedStates.length > 0 && (
                    <select
                      value={selectedCity}
                      onChange={(e) => handleCityChange(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">All Cities</option>
                      {availableCities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Meeting Format */}
              {availableFormats.length > 0 && (
                <div className="filter-section">
                  <h3>Meeting format</h3>
                  <div className="filter-segment-control">
                    <button
                      className={`filter-segment-btn ${selectedFormat === '' ? 'active' : ''}`}
                      onClick={() => setSelectedFormat('')}
                    >
                      Any format
                    </button>
                    {availableFormats.map(format => (
                      <button
                        key={format}
                        className={`filter-segment-btn ${selectedFormat === format ? 'active' : ''}`}
                        onClick={() => setSelectedFormat(format)}
                      >
                        {format.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Online/Hybrid Options */}
              <div className="filter-section">
                <h3>Meeting mode</h3>
                <div className="filter-quick-options">
                  <button
                    className={`filter-quick-btn ${showOnlineOnly ? 'active' : ''}`}
                    onClick={() => { setShowOnlineOnly(!showOnlineOnly); setShowHybridOnly(false); }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <path d="M8 21h8"/>
                      <path d="M12 17v4"/>
                    </svg>
                    <span>Online Only</span>
                  </button>
                  <button
                    className={`filter-quick-btn ${showHybridOnly ? 'active' : ''}`}
                    onClick={() => { setShowHybridOnly(!showHybridOnly); setShowOnlineOnly(false); }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                      <path d="M2 3l20 18"/>
                    </svg>
                    <span>Hybrid</span>
                  </button>
                </div>
              </div>

              {/* Accessibility */}
              <div className="filter-section">
                <h3>Accessibility</h3>
                <div className="filter-accessibility-grid">
                  {accessibilityOptions.map(opt => (
                    <button
                      key={opt.key}
                      className={`filter-accessibility-btn ${selectedAccessibility.includes(opt.key) ? 'active' : ''}`}
                      onClick={() => toggleAccessibility(opt.key)}
                    >
                      <span className="accessibility-icon">{opt.icon}</span>
                      <span className="accessibility-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="filter-modal-footer">
              <button className="filter-clear-btn" onClick={clearFilters}>
                Clear all
              </button>
              <button className="filter-apply-btn" onClick={() => setShowFilters(false)}>
                Show {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Parse Diagnostics Modal */}
      <ParseDiagnostics
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
      />
    </div>
  );
}

export default MeetingsExplorer;
