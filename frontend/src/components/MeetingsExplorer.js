import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MeetingMap from './MeetingMap';
import MeetingDetail from './MeetingDetail';
import ThemeToggle from './ThemeToggle';
import { SidebarToggleButton } from './PublicSidebar';
import { useDataCache } from '../contexts/DataCacheContext';
import { useParse } from '../contexts/ParseContext';
import {
  measureNetworkSpeed,
  calculateBatchSize,
  calculateParallelRequests,
  updateSpeedFromRequest,
  getNetworkInfo,
  categorizeSpeed,
} from '../utils/networkSpeed';

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

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayAbbrev = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function MeetingsExplorer({ onAdminClick, sidebarOpen, onSidebarToggle }) {
  // Data cache context for persisting data across navigation
  const { getCache, setCache } = useDataCache();

  // Parse SDK context for connection status
  const { connectionStatus: parseConnectionStatus, config: parseConfig } = useParse();

  // Initialize state from cache if available
  const cachedMeetings = getCache(CACHE_KEYS.MEETINGS);
  const cachedTotal = getCache(CACHE_KEYS.TOTAL);
  const cachedStates = getCache(CACHE_KEYS.AVAILABLE_STATES);
  const cachedCities = getCache(CACHE_KEYS.AVAILABLE_CITIES);
  const cachedTypes = getCache(CACHE_KEYS.AVAILABLE_TYPES);
  const cachedFormats = getCache(CACHE_KEYS.AVAILABLE_FORMATS);
  const cachedFilterState = getCache(CACHE_KEYS.FILTER_STATE);

  const [meetings, setMeetings] = useState(cachedMeetings?.data || []);
  const [filteredMeetings, setFilteredMeetings] = useState(cachedMeetings?.data || []);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [hoveredMeeting, setHoveredMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(!cachedMeetings?.data);
  const [error, setError] = useState(null);
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);

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

  // Pagination with adaptive batch sizing - restore total from cache
  const [totalMeetings, setTotalMeetings] = useState(cachedTotal?.data || 0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Network-adaptive batch loading state
  const [batchSize, setBatchSize] = useState(50); // Default, will be updated based on network
  const [networkSpeed, setNetworkSpeed] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0, percentage: 0 });
  const networkInitializedRef = useRef(false);

  // Map bounds for dynamic loading
  const [mapBounds, setMapBounds] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Target location for map pan/zoom when user selects a location from search
  const [targetLocation, setTargetLocation] = useState(null);

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
  const boundsTimeoutRef = useRef(null);
  const thumbnailRequestsRef = useRef(new Set());
  const initialFetchDoneRef = useRef(false);
  const meetingsRef = useRef(cachedMeetings?.data || []);
  const loadMoreSentinelRef = useRef(null);

  // Fetch thumbnail for a single meeting
  const fetchThumbnail = useCallback(async (meetingId) => {
    if (thumbnailRequestsRef.current.has(meetingId)) return null;
    thumbnailRequestsRef.current.add(meetingId);

    try {
      const response = await fetch(`${BACKEND_URL}/api/thumbnail/${meetingId}`);
      if (response.ok) {
        const data = await response.json();
        return { meetingId, thumbnailUrl: data.thumbnailUrl };
      }
    } catch (error) {
      console.error(`Error fetching thumbnail for ${meetingId}:`, error);
    }
    return null;
  }, []);

  // Request thumbnails for meetings without them (batched)
  const requestMissingThumbnails = useCallback(async (meetingsList) => {
    const meetingsWithoutThumbnails = meetingsList
      .filter(m => !m.thumbnailUrl && m.objectId && !thumbnailRequestsRef.current.has(m.objectId))
      .slice(0, 20); // Limit batch size

    if (meetingsWithoutThumbnails.length === 0) return;

    // Fetch thumbnails in parallel (with limit)
    const thumbnailPromises = meetingsWithoutThumbnails.map(m => fetchThumbnail(m.objectId));
    const results = await Promise.all(thumbnailPromises);

    // Update meetings with new thumbnails
    const thumbnailMap = {};
    results.forEach(result => {
      if (result?.thumbnailUrl) {
        thumbnailMap[result.meetingId] = result.thumbnailUrl;
      }
    });

    if (Object.keys(thumbnailMap).length > 0) {
      setMeetings(prev => prev.map(m =>
        thumbnailMap[m.objectId] ? { ...m, thumbnailUrl: thumbnailMap[m.objectId] } : m
      ));
    }
  }, [fetchThumbnail]);

  // Build URL with filters for meeting fetch
  const buildMeetingsUrl = useCallback((currentBatchSize, skip, bounds, stateFilter, filters) => {
    let url = `${BACKEND_URL}/api/meetings?limit=${currentBatchSize}&skip=${skip}`;

    // Add bounds parameters if provided (including center for distance-based sorting)
    if (bounds) {
      url += `&north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`;
      // Add center coordinates for prioritizing results by proximity
      if (bounds.center_lat !== undefined && bounds.center_lng !== undefined) {
        url += `&center_lat=${bounds.center_lat}&center_lng=${bounds.center_lng}`;
      }
    }

    // Add state filter if provided (from param or filters object)
    if (stateFilter && stateFilter.length > 0) {
      url += `&state=${encodeURIComponent(stateFilter[0])}`;
    } else if (filters.state) {
      url += `&state=${encodeURIComponent(filters.state)}`;
    }

    // Add day filter
    if (filters.day !== undefined && filters.day !== null) {
      url += `&day=${filters.day}`;
    }

    // Add type filter
    if (filters.type) {
      url += `&type=${encodeURIComponent(filters.type)}`;
    }

    // Add city filter
    if (filters.city) {
      url += `&city=${encodeURIComponent(filters.city)}`;
    }

    // Add online/hybrid filters
    if (filters.online) {
      url += `&online=true`;
    }
    if (filters.hybrid) {
      url += `&hybrid=true`;
    }

    return url;
  }, []);

  const fetchMeetings = useCallback(async (options = {}) => {
    const { bounds = null, loadMore = false, stateFilter = null, reset = false, filters = {}, bulkLoad = false } = options;

    if (loadMore) {
      setIsLoadingMore(true);
    } else if (bounds && !reset) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Get current network-optimized batch size
      const currentBatchSize = batchSize;

      // Use ref for skip to avoid dependency on meetings.length
      const skip = loadMore ? meetingsRef.current.length : 0;

      // For bulk loading, use parallel requests if network is fast enough
      if (bulkLoad && networkSpeed) {
        const parallelCount = calculateParallelRequests(networkSpeed);

        if (parallelCount > 1) {
          // Fetch multiple batches in parallel
          const batchPromises = [];
          for (let i = 0; i < parallelCount; i++) {
            const batchSkip = skip + (i * currentBatchSize);
            const url = buildMeetingsUrl(currentBatchSize, batchSkip, bounds, stateFilter, filters);
            const startTime = performance.now();
            batchPromises.push(
              fetch(url).then(async (response) => {
                const endTime = performance.now();
                if (response.ok) {
                  const data = await response.json();
                  // Update network speed estimate based on actual performance
                  const responseSize = JSON.stringify(data).length;
                  updateSpeedFromRequest(responseSize, endTime - startTime);
                  return { skip: batchSkip, data };
                }
                return { skip: batchSkip, data: { meetings: [], total: 0 } };
              }).catch(() => ({ skip: batchSkip, data: { meetings: [], total: 0 } }))
            );
          }

          const results = await Promise.all(batchPromises);
          // Sort by skip to maintain order
          results.sort((a, b) => a.skip - b.skip);

          // Combine all results
          const allNewMeetings = [];
          let total = 0;
          results.forEach(({ data }) => {
            allNewMeetings.push(...(data.meetings || []));
            total = Math.max(total, data.total || 0);
          });

          setTotalMeetings(total);
          const totalLoaded = skip + allNewMeetings.length;
          setHasMore(totalLoaded < total);

          // Update progress
          setLoadingProgress({
            loaded: totalLoaded,
            total,
            percentage: total > 0 ? Math.round((totalLoaded / total) * 100) : 0
          });

          if (loadMore) {
            setMeetings(prev => {
              const existingIds = new Set(prev.map(m => m.objectId));
              const uniqueNew = allNewMeetings.filter(m => !existingIds.has(m.objectId));
              const updated = [...prev, ...uniqueNew];
              meetingsRef.current = updated;
              return updated;
            });
            setCurrentPage(prev => prev + parallelCount);
          } else {
            meetingsRef.current = allNewMeetings;
            setMeetings(allNewMeetings);
            setCurrentPage(0);

            if (bounds) {
              const cities = [...new Set(allNewMeetings.map(m => m.city).filter(Boolean))].sort();
              setAvailableCities(cities);
            }
          }

          // Extract unique values (only on initial load without bounds)
          if (!bounds && !loadMore) {
            const states = [...new Set(allNewMeetings.map(m => m.state).filter(Boolean))].sort();
            setAvailableStates(states);

            const cities = [...new Set(allNewMeetings.map(m => m.city).filter(Boolean))].sort();
            setAvailableCities(cities);

            const allTypes = Object.keys(MEETING_TYPES).filter(t => t !== 'Other');
            allTypes.push('Other');
            setAvailableTypes(allTypes);

            const formats = [...new Set(allNewMeetings.map(m => m.format).filter(Boolean))].sort();
            setAvailableFormats(formats);
          }

          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }

      // Standard single batch fetch
      const url = buildMeetingsUrl(currentBatchSize, skip, bounds, stateFilter, filters);
      const startTime = performance.now();
      const response = await fetch(url);
      const endTime = performance.now();

      if (response.ok) {
        const data = await response.json();
        const newMeetings = data.meetings || [];
        const total = data.total || newMeetings.length;

        // Update network speed estimate based on actual performance
        const responseSize = JSON.stringify(data).length;
        updateSpeedFromRequest(responseSize, endTime - startTime);

        // Update batch size based on new speed estimate
        const networkInfo = getNetworkInfo();
        if (networkInfo.batchSize !== currentBatchSize) {
          setBatchSize(networkInfo.batchSize);
        }

        setTotalMeetings(total);
        setHasMore(skip + newMeetings.length < total);

        // Update progress
        setLoadingProgress({
          loaded: skip + newMeetings.length,
          total,
          percentage: total > 0 ? Math.round(((skip + newMeetings.length) / total) * 100) : 0
        });

        if (loadMore) {
          // Append new meetings
          setMeetings(prev => {
            const existingIds = new Set(prev.map(m => m.objectId));
            const uniqueNew = newMeetings.filter(m => !existingIds.has(m.objectId));
            const updated = [...prev, ...uniqueNew];
            meetingsRef.current = updated;
            return updated;
          });
          setCurrentPage(prev => prev + 1);
        } else if (bounds) {
          // Accumulate meetings when exploring new areas - merge with existing
          setMeetings(prev => {
            const existingIds = new Set(prev.map(m => m.objectId));
            const uniqueNew = newMeetings.filter(m => !existingIds.has(m.objectId));
            const updated = [...prev, ...uniqueNew];
            meetingsRef.current = updated;
            return updated;
          });

          // Update available cities from current results
          const cities = [...new Set(newMeetings.map(m => m.city).filter(Boolean))].sort();
          setAvailableCities(prev => {
            const combined = new Set([...prev, ...cities]);
            return [...combined].sort();
          });
        } else if (reset) {
          // Only reset when explicitly requested (not on bounds change)
          meetingsRef.current = newMeetings;
          setMeetings(newMeetings);
          setCurrentPage(0);
        } else {
          meetingsRef.current = newMeetings;
          setMeetings(newMeetings);
          setCurrentPage(0);
        }

        // Extract unique values (only on initial load without bounds)
        if (!bounds && !loadMore) {
          const states = [...new Set(newMeetings.map(m => m.state).filter(Boolean))].sort();
          setAvailableStates(states);

          const cities = [...new Set(newMeetings.map(m => m.city).filter(Boolean))].sort();
          setAvailableCities(cities);

          // Always show all defined meeting types, with 'Other' at the end
          const allTypes = Object.keys(MEETING_TYPES).filter(t => t !== 'Other');
          allTypes.push('Other');
          setAvailableTypes(allTypes);

          const formats = [...new Set(newMeetings.map(m => m.format).filter(Boolean))].sort();
          setAvailableFormats(formats);
        }
      } else {
        if (!bounds && !loadMore) setError('Failed to load meetings');
      }
    } catch (err) {
      if (!bounds && !loadMore) setError('Unable to connect to server');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [batchSize, networkSpeed, buildMeetingsUrl]);

  const loadMoreMeetings = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      // Build filters from current state
      const filters = {};
      if (showTodayOnly) {
        filters.day = new Date().getDay();
      } else if (selectedDays.length === 1) {
        const dayIndex = dayNames.indexOf(selectedDays[0]);
        if (dayIndex !== -1) filters.day = dayIndex;
      }
      if (selectedTypes.length === 1) filters.type = selectedTypes[0];
      if (selectedStates.length === 1) filters.state = selectedStates[0];
      if (showOnlineOnly) filters.online = true;
      if (showHybridOnly) filters.hybrid = true;
      if (selectedCity) filters.city = selectedCity;
      if (selectedFormat) filters.format = selectedFormat;

      // Use bulk loading with parallel requests for faster loading
      fetchMeetings({ loadMore: true, bounds: mapBounds, filters, bulkLoad: true });
    }
  }, [fetchMeetings, isLoadingMore, hasMore, mapBounds, showTodayOnly, selectedDays, selectedTypes, selectedStates, showOnlineOnly, showHybridOnly, selectedCity, selectedFormat]);

  // Initialize network speed detection
  useEffect(() => {
    if (networkInitializedRef.current) return;
    networkInitializedRef.current = true;

    const initNetworkSpeed = async () => {
      try {
        const speed = await measureNetworkSpeed();
        setNetworkSpeed(speed);
        const optimalBatch = calculateBatchSize(speed);
        setBatchSize(optimalBatch);
        console.log(`Network speed: ${speed.toFixed(2)} Mbps, using batch size: ${optimalBatch}`);
      } catch (err) {
        console.warn('Failed to measure network speed, using default batch size');
        setBatchSize(50);
      }
    };

    initNetworkSpeed();
  }, []);

  // Initial data fetch - run only once on mount, skip if cached
  // Note: Backend config status now comes from ParseContext (no separate fetch needed)
  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;

    // If we have cached meetings, don't fetch on initial load
    if (cachedMeetings?.data && cachedMeetings.data.length > 0) {
      return;
    }

    fetchMeetings();
  }, [fetchMeetings, cachedMeetings]);

  // Infinite scroll - load more meetings when sentinel becomes visible
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMoreMeetings();
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, isLoading, loadMoreMeetings]);

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

  // Fetch meetings when state filter changes (server-side filtering)
  const prevSelectedStatesRef = useRef([]);
  useEffect(() => {
    // Skip initial render
    if (!initialFetchDoneRef.current) return;

    // Check if selectedStates actually changed
    const prevStates = prevSelectedStatesRef.current;
    const statesChanged = selectedStates.length !== prevStates.length ||
      selectedStates.some((s, i) => s !== prevStates[i]);

    if (statesChanged) {
      prevSelectedStatesRef.current = selectedStates;
      if (selectedStates.length > 0) {
        // Fetch from server with state filter
        // Don't clear meetingsRef here - let fetchMeetings update it when new data arrives
        // This keeps the old data visible while loading
        fetchMeetings({ stateFilter: selectedStates });
      } else {
        // Reset to all meetings
        // Don't clear meetingsRef here - let fetchMeetings update it when new data arrives
        fetchMeetings();
      }
    }
  }, [selectedStates, fetchMeetings]);

  // Request thumbnails for visible meetings that don't have them
  useEffect(() => {
    if (filteredMeetings.length > 0) {
      // Small delay to avoid blocking initial render
      const timer = setTimeout(() => {
        requestMissingThumbnails(filteredMeetings);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filteredMeetings, requestMissingThumbnails]);

  // Track if first bounds change (skip fetching on initial map load)
  const firstBoundsChangeRef = useRef(true);

  // Handle map bounds change with debouncing
  const handleBoundsChange = useCallback((bounds) => {
    // Skip the first bounds change (initial map load) to avoid duplicate fetch
    if (firstBoundsChangeRef.current) {
      firstBoundsChangeRef.current = false;
      setMapBounds(bounds);
      return;
    }

    // Clear any pending timeout
    if (boundsTimeoutRef.current) {
      clearTimeout(boundsTimeoutRef.current);
    }

    // Debounce the fetch to avoid too many requests
    boundsTimeoutRef.current = setTimeout(() => {
      setMapBounds(bounds);
      // Fetch meetings for the new bounds
      fetchMeetings({ bounds });
    }, 500);
  }, [fetchMeetings]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (boundsTimeoutRef.current) {
        clearTimeout(boundsTimeoutRef.current);
      }
    };
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...meetings];

    // Filter by current map bounds - only show meetings in visible area
    if (mapBounds) {
      filtered = filtered.filter(m => {
        if (!m.latitude || !m.longitude) return true; // Keep online meetings without coords
        return (
          m.latitude >= mapBounds.south &&
          m.latitude <= mapBounds.north &&
          m.longitude >= mapBounds.west &&
          m.longitude <= mapBounds.east
        );
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name?.toLowerCase().includes(query) ||
        m.locationName?.toLowerCase().includes(query) ||
        m.city?.toLowerCase().includes(query) ||
        m.address?.toLowerCase().includes(query)
      );
    }

    if (selectedStates.length > 0) {
      filtered = filtered.filter(m => selectedStates.includes(m.state));
    }

    if (selectedCity) {
      filtered = filtered.filter(m => m.city === selectedCity);
    }

    if (selectedDays.length > 0) {
      filtered = filtered.filter(m => selectedDays.includes(m.day));
    }

    if (selectedTypes.length > 0) {
      filtered = filtered.filter(m => selectedTypes.includes(m.meetingType));
    }

    if (showOnlineOnly) {
      filtered = filtered.filter(m => m.isOnline);
    }

    if (showTodayOnly) {
      const today = new Date().getDay();
      filtered = filtered.filter(m => m.day === today);
    }

    if (showHybridOnly) {
      filtered = filtered.filter(m => m.isHybrid);
    }

    if (selectedFormat) {
      filtered = filtered.filter(m => m.format === selectedFormat);
    }

    if (selectedAccessibility.length > 0) {
      filtered = filtered.filter(m =>
        selectedAccessibility.every(key => m[key] === true)
      );
    }

    setFilteredMeetings(filtered);
  }, [meetings, mapBounds, searchQuery, selectedStates, selectedCity, selectedDays, selectedTypes, showOnlineOnly, showTodayOnly, showHybridOnly, selectedFormat, selectedAccessibility]);

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

  const clearFilters = () => {
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
  };

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
            setTargetLocation({
              lat: locations[0].lat,
              lng: locations[0].lon,
              zoom: 12
            });
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
        }
      }
    } catch (error) {
      console.error('Geocode error:', error);
    }
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

    // If it's a Nominatim place, pan/zoom map to that location and set filters
    if (suggestion.type === 'nominatim' && suggestion.lat && suggestion.lon) {
      // Clear the search query since we're using city/state filters instead
      // The full Nominatim display name (e.g., "Los Angeles, Los Angeles County")
      // doesn't match meeting city fields, so we rely on geographic filters
      setSearchQuery('');

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
      // Geocode and pan map to the searched location
      geocodeAndPanMap(searchQuery, selectedStates.length === 1 ? selectedStates[0] : null);
    }
    setShowSuggestions(false);
    // Re-fetch meetings with current filters
    fetchMeetings({ stateFilter: selectedStates.length > 0 ? selectedStates : undefined });
  };

  // Handle city dropdown selection - pans map immediately
  const handleCityChange = (city) => {
    setSelectedCity(city);
    if (city) {
      // Find a meeting with coordinates for this city to pan the map
      const meetingWithCoords = meetings.find(m => m.city === city && m.latitude && m.longitude);
      if (meetingWithCoords) {
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

  // Handle map bounds change - fetch meetings for the visible area
  const handleMapBoundsChange = useCallback((bounds) => {
    setMapBounds(bounds);
    // Clear selected states when panning - user is exploring a new area
    setSelectedStates([]);
    // Build filters from current state (excluding state since we just cleared it)
    const filters = {};
    if (showTodayOnly) {
      filters.day = new Date().getDay();
    } else if (selectedDays.length === 1) {
      const dayIndex = dayNames.indexOf(selectedDays[0]);
      if (dayIndex !== -1) filters.day = dayIndex;
    }
    if (selectedTypes.length === 1) filters.type = selectedTypes[0];
    if (showOnlineOnly) filters.online = true;
    if (showHybridOnly) filters.hybrid = true;
    if (selectedCity) filters.city = selectedCity;
    if (selectedFormat) filters.format = selectedFormat;

    // Fetch meetings for new area - accumulate with existing cache
    // Don't reset - let meetings accumulate as user explores
    setCurrentPage(0);
    fetchMeetings({ bounds, filters });
  }, [fetchMeetings, showTodayOnly, selectedDays, selectedTypes, showOnlineOnly, showHybridOnly, selectedCity, selectedFormat]);

  // Build filters object to pass to the map
  const mapFilters = useMemo(() => {
    const filters = {};
    // For "Today" filter, convert to day number
    if (showTodayOnly) {
      filters.day = new Date().getDay();
    } else if (selectedDays.length === 1) {
      // If single day selected, pass it to the map
      const dayIndex = dayNames.indexOf(selectedDays[0]);
      if (dayIndex !== -1) {
        filters.day = dayIndex;
      }
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

        <div className="airbnb-header-right">
          <ThemeToggle />
          <button className="btn btn-ghost admin-link" onClick={onAdminClick}>
            Admin
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
            className={`filter-chip ${showFilters ? 'active' : ''}`}
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
          </button>

          {hasActiveFilters && (
            <button className="filter-chip clear-filters" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>

        <div className="filter-stats">
          {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="airbnb-main">
        {/* Map Panel (Left) */}
        <div className={`airbnb-map-panel ${isMapCollapsed ? 'collapsed' : ''}`}>
          <button
            className="map-collapse-btn"
            onClick={() => setIsMapCollapsed(!isMapCollapsed)}
            title={isMapCollapsed ? 'Show map' : 'Hide map'}
          >
            {isMapCollapsed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            )}
          </button>

          {!isMapCollapsed && (
            <>
              <MeetingMap
                onSelectMeeting={handleMapMarkerClick}
                onStateClick={(stateData) => {
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
              />
              {isLoadingMore && (
                <div className="map-loading-overlay">
                  <div className="loading-spinner small"></div>
                  <span>Loading meetings in this area...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* List Panel (Right) */}
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
                <p>{error}</p>
              )}
              <button className="btn btn-primary" onClick={() => fetchMeetings()}>
                Try Again
              </button>
            </div>
          ) : filteredMeetings.length === 0 && !isLoading && !isLoadingMore && !hasMore ? (
            <div className="list-empty">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <h3>No meetings found</h3>
              <p>Try adjusting your filters or search terms</p>
              {hasActiveFilters && (
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="list-header">
                <h2>Meetings in {selectedStates.length > 0 ? selectedStates.join(', ') : selectedCity || 'all areas'}</h2>
                <p>
                  {isLoading || isLoadingMore ? (
                    <>Loading... {meetings.length > 0 && `(${filteredMeetings.length} of ${totalMeetings || '?'})`}</>
                  ) : (
                    <>{filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''} available</>
                  )}
                </p>
              </div>
              <div className="meeting-cards-grid">
                {filteredMeetings.map((meeting, index) => (
                  <div
                    key={meeting.objectId || index}
                    data-meeting-id={meeting.objectId}
                    className={`meeting-card ${hoveredMeeting?.objectId === meeting.objectId ? 'hovered' : ''}`}
                    onClick={() => setSelectedMeeting(meeting)}
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
                {/* Skeleton placeholders while loading more meetings */}
                {(isLoading || isLoadingMore) && (
                  [...Array(Math.min(batchSize, Math.max(6, (totalMeetings || 50) - meetings.length)))].map((_, index) => (
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

              {/* Sentinel element for infinite scroll detection */}
              {hasMore && !isLoading && (
                <div ref={loadMoreSentinelRef} className="infinite-scroll-sentinel" aria-hidden="true" />
              )}

              {/* Load More Button with Progress - shown as fallback */}
              {hasMore && (
                <div className="load-more-container">
                  {isLoadingMore && loadingProgress.total > 0 && (
                    <div className="loading-progress">
                      <div className="loading-progress-bar">
                        <div
                          className="loading-progress-fill"
                          style={{ width: `${loadingProgress.percentage}%` }}
                        />
                      </div>
                      <span className="loading-progress-text">
                        {loadingProgress.loaded} of {loadingProgress.total} ({loadingProgress.percentage}%)
                      </span>
                    </div>
                  )}
                  <button
                    className="btn btn-secondary load-more-btn"
                    onClick={loadMoreMeetings}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <span className="loading-spinner-small"></span>
                        Loading {batchSize} meetings...
                      </>
                    ) : (
                      <>
                        Load More Meetings
                        <span className="load-more-count">
                          ({meetings.length} of {totalMeetings})
                        </span>
                      </>
                    )}
                  </button>
                  {networkSpeed && (
                    <div className="network-info">
                      <span className={`network-speed-indicator ${categorizeSpeed(networkSpeed)}`}>
                        {categorizeSpeed(networkSpeed) === 'very-fast' ? 'Fast connection' :
                         categorizeSpeed(networkSpeed) === 'fast' ? 'Good connection' :
                         categorizeSpeed(networkSpeed) === 'medium' ? 'Moderate connection' :
                         'Slow connection'}
                      </span>
                      <span className="batch-size-info">Batch: {batchSize}</span>
                    </div>
                  )}
                </div>
              )}
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
    </div>
  );
}

export default MeetingsExplorer;
