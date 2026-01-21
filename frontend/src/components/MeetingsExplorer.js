import React, { useState, useEffect, useCallback, useRef } from 'react';
import MeetingMap from './MeetingMap';
import MeetingDetail from './MeetingDetail';
import ThemeToggle from './ThemeToggle';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function MeetingsExplorer({ onAdminClick }) {
  const [meetings, setMeetings] = useState([]);
  const [filteredMeetings, setFilteredMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [hoveredMeeting, setHoveredMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configStatus, setConfigStatus] = useState(null); // null, 'checking', 'configured', 'not_configured', 'unreachable'
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [showHybridOnly, setShowHybridOnly] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedAccessibility, setSelectedAccessibility] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [totalMeetings, setTotalMeetings] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  // Map bounds for dynamic loading
  const [mapBounds, setMapBounds] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  // Get unique values from meetings
  const [availableStates, setAvailableStates] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [availableFormats, setAvailableFormats] = useState([]);

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
  const searchInputRef = useRef(null);

  const listRef = useRef(null);
  const boundsTimeoutRef = useRef(null);
  const thumbnailRequestsRef = useRef(new Set());
  const initialFetchDoneRef = useRef(false);
  const meetingsRef = useRef([]);

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

  const fetchMeetings = useCallback(async (options = {}) => {
    const { bounds = null, loadMore = false } = options;

    if (loadMore) {
      setIsLoadingMore(true);
    } else if (bounds) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Use ref for skip to avoid dependency on meetings.length
      const skip = loadMore ? meetingsRef.current.length : 0;
      const limit = bounds ? 100 : PAGE_SIZE;
      let url = `${BACKEND_URL}/api/meetings?limit=${limit}&skip=${skip}`;

      // Add bounds parameters if provided
      if (bounds) {
        url += `&north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const newMeetings = data.meetings || [];
        const total = data.total || newMeetings.length;

        setTotalMeetings(total);
        setHasMore(skip + newMeetings.length < total);

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
          // Merge new meetings with existing ones, avoiding duplicates
          setMeetings(prev => {
            const existingIds = new Set(prev.map(m => m.objectId));
            const uniqueNew = newMeetings.filter(m => !existingIds.has(m.objectId));
            const updated = [...prev, ...uniqueNew];
            meetingsRef.current = updated;
            return updated;
          });
        } else {
          meetingsRef.current = newMeetings;
          setMeetings(newMeetings);
          setCurrentPage(0);
        }

        // Extract unique values (only on initial load or reset)
        if (!bounds && !loadMore) {
          const states = [...new Set(newMeetings.map(m => m.state).filter(Boolean))].sort();
          setAvailableStates(states);

          const cities = [...new Set(newMeetings.map(m => m.city).filter(Boolean))].sort();
          setAvailableCities(cities);

          const types = [...new Set(newMeetings.map(m => m.meetingType).filter(Boolean))].sort();
          setAvailableTypes(types);

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
  }, [PAGE_SIZE]);

  const loadMoreMeetings = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchMeetings({ loadMore: true });
    }
  }, [fetchMeetings, isLoadingMore, hasMore]);

  // Check backend configuration status
  const checkBackendConfig = useCallback(async () => {
    setConfigStatus('checking');
    try {
      const response = await fetch(`${BACKEND_URL}/api/config`);
      if (response.ok) {
        const data = await response.json();
        if (data.configured) {
          setConfigStatus('configured');
        } else {
          setConfigStatus('not_configured');
        }
      } else {
        setConfigStatus('unreachable');
      }
    } catch (err) {
      setConfigStatus('unreachable');
    }
  }, []);

  // Initial data fetch - run only once on mount
  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    checkBackendConfig();
    fetchMeetings();
  }, [fetchMeetings, checkBackendConfig]);

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

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name?.toLowerCase().includes(query) ||
        m.locationName?.toLowerCase().includes(query) ||
        m.city?.toLowerCase().includes(query) ||
        m.address?.toLowerCase().includes(query)
      );
    }

    if (selectedState) {
      filtered = filtered.filter(m => m.state === selectedState);
    }

    if (selectedCity) {
      filtered = filtered.filter(m => m.city === selectedCity);
    }

    if (selectedDay !== '') {
      filtered = filtered.filter(m => m.day === parseInt(selectedDay));
    }

    if (selectedType) {
      filtered = filtered.filter(m => m.meetingType === selectedType);
    }

    if (showOnlineOnly) {
      filtered = filtered.filter(m => m.isOnline);
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
  }, [meetings, searchQuery, selectedState, selectedCity, selectedDay, selectedType, showOnlineOnly, showHybridOnly, selectedFormat, selectedAccessibility]);

  // Update available cities when state changes
  useEffect(() => {
    if (selectedState) {
      const citiesInState = [...new Set(
        meetings
          .filter(m => m.state === selectedState)
          .map(m => m.city)
          .filter(Boolean)
      )].sort();
      setAvailableCities(citiesInState);
    } else {
      const allCities = [...new Set(meetings.map(m => m.city).filter(Boolean))].sort();
      setAvailableCities(allCities);
    }
    setSelectedCity('');
  }, [selectedState, meetings]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedState('');
    setSelectedCity('');
    setSelectedDay('');
    setSelectedType('');
    setShowOnlineOnly(false);
    setShowHybridOnly(false);
    setSelectedFormat('');
    setSelectedAccessibility([]);
  };

  const toggleAccessibility = (key) => {
    setSelectedAccessibility(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const hasActiveFilters = searchQuery || selectedState || selectedCity || selectedDay || selectedType || showOnlineOnly || showHybridOnly || selectedFormat || selectedAccessibility.length > 0;

  // Compute autocomplete suggestions
  const computeSuggestions = useCallback((query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = [];
    const seen = new Set();

    // Add matching cities
    availableCities.forEach(city => {
      if (city && city.toLowerCase().includes(lowerQuery) && !seen.has(city.toLowerCase())) {
        seen.add(city.toLowerCase());
        results.push({ type: 'city', value: city, label: city });
      }
    });

    // Add matching states
    availableStates.forEach(state => {
      if (state && state.toLowerCase().includes(lowerQuery) && !seen.has(state.toLowerCase())) {
        seen.add(state.toLowerCase());
        results.push({ type: 'state', value: state, label: state });
      }
    });

    // Add matching location names from meetings
    meetings.forEach(m => {
      if (m.locationName && m.locationName.toLowerCase().includes(lowerQuery)) {
        const key = m.locationName.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type: 'location',
            value: m.locationName,
            label: m.locationName,
            subLabel: m.city ? `${m.city}, ${m.state}` : m.state
          });
        }
      }
    });

    // Limit to top 8 suggestions
    setSuggestions(results.slice(0, 8));
  }, [availableCities, availableStates, meetings]);

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    computeSuggestions(value);
    setShowSuggestions(value.length >= 2);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.value);
    setShowSuggestions(false);

    // If it's a state, also set the state filter
    if (suggestion.type === 'state') {
      setSelectedState(suggestion.value);
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

  return (
    <div className="airbnb-explorer">
      {/* Top Navigation Bar */}
      <header className="airbnb-header">
        <div className="airbnb-logo" onClick={() => window.location.reload()}>
          <img
            src={currentTheme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'}
            alt="Sober Sidekick"
            className="logo-icon"
          />
          <div className="logo-text">
            <span className="logo-brand">Sober Sidekick</span>
            <span className="logo-tagline">You're Never Alone</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="airbnb-search-bar">
          <div className="search-section search-location" ref={searchInputRef}>
            <label>Where</label>
            <input
              type="text"
              placeholder="Search locations..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="search-suggestions">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.value}-${index}`}
                    className="suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <span className={`suggestion-icon suggestion-${suggestion.type}`}>
                      {suggestion.type === 'city' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                      )}
                      {suggestion.type === 'state' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <path d="M3 9h18"/>
                          <path d="M9 21V9"/>
                        </svg>
                      )}
                      {suggestion.type === 'location' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9,22 9,12 15,12 15,22"/>
                        </svg>
                      )}
                    </span>
                    <span className="suggestion-text">
                      <span className="suggestion-label">{suggestion.label}</span>
                      {suggestion.subLabel && (
                        <span className="suggestion-sublabel">{suggestion.subLabel}</span>
                      )}
                    </span>
                    <span className="suggestion-type-badge">{suggestion.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="search-divider" />
          <div className="search-section search-when">
            <label>When</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              <option value="">Any day</option>
              {dayNames.map((day, index) => (
                <option key={day} value={index}>{day}</option>
              ))}
            </select>
          </div>
          <div className="search-divider" />
          <div className="search-section search-type">
            <label>Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">Any type</option>
              {availableTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <button className="search-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
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
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="filter-chip-select"
          >
            <option value="">All States</option>
            {availableStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>

          {selectedState && (
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
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
            isLoading ? (
              <div className="map-loading">
                <div className="loading-spinner"></div>
                <p>Loading map...</p>
              </div>
            ) : (
              <>
                <MeetingMap
                  onSelectMeeting={handleMapMarkerClick}
                  showHeatmap={true}
                />
                {isLoadingMore && (
                  <div className="map-loading-overlay">
                    <div className="loading-spinner small"></div>
                    <span>Loading meetings in this area...</span>
                  </div>
                )}
              </>
            )
          )}
        </div>

        {/* List Panel (Right) */}
        <div className={`airbnb-list-panel ${isMapCollapsed ? 'expanded' : ''}`} ref={listRef}>
          {isLoading ? (
            <div className="list-loading">
              <div className="loading-spinner"></div>
              <p>Loading meetings...</p>
            </div>
          ) : error || configStatus === 'not_configured' || configStatus === 'unreachable' ? (
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
              <button className="btn btn-primary" onClick={() => { checkBackendConfig(); fetchMeetings(); }}>
                Try Again
              </button>
            </div>
          ) : filteredMeetings.length === 0 ? (
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
                <h2>Meetings in {selectedState || selectedCity || 'all areas'}</h2>
                <p>{filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''} available</p>
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
                      {meeting.thumbnailUrl ? (
                        <img
                          src={meeting.thumbnailUrl}
                          alt={meeting.name || 'Meeting thumbnail'}
                          className="meeting-card-thumbnail"
                          loading="lazy"
                        />
                      ) : (
                        <div className="meeting-card-icon">
                          {meeting.isOnline ? (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="3" width="20" height="14" rx="2"/>
                              <path d="M8 21h8"/>
                              <path d="M12 17v4"/>
                            </svg>
                          ) : (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                          )}
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
              </div>

              {/* Load More Button */}
              {hasMore && !hasActiveFilters && (
                <div className="load-more-container">
                  <button
                    className="btn btn-secondary load-more-btn"
                    onClick={loadMoreMeetings}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <span className="loading-spinner-small"></span>
                        Loading...
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
                      className={`filter-quick-btn ${selectedType === type ? 'active' : ''}`}
                      onClick={() => setSelectedType(selectedType === type ? '' : type)}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v8"/>
                        <path d="M8 12h8"/>
                      </svg>
                      <span>{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Meeting Type */}
              <div className="filter-section">
                <h3>Meeting type</h3>
                <div className="filter-segment-control">
                  <button
                    className={`filter-segment-btn ${selectedType === '' ? 'active' : ''}`}
                    onClick={() => setSelectedType('')}
                  >
                    Any type
                  </button>
                  {availableTypes.map(type => (
                    <button
                      key={type}
                      className={`filter-segment-btn ${selectedType === type ? 'active' : ''}`}
                      onClick={() => setSelectedType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day of Week */}
              <div className="filter-section">
                <h3>Day of week</h3>
                <div className="filter-day-grid">
                  <button
                    className={`filter-day-btn ${selectedDay === '' ? 'active' : ''}`}
                    onClick={() => setSelectedDay('')}
                  >
                    Any
                  </button>
                  {dayNames.map((day, index) => (
                    <button
                      key={day}
                      className={`filter-day-btn ${selectedDay === String(index) ? 'active' : ''}`}
                      onClick={() => setSelectedDay(selectedDay === String(index) ? '' : String(index))}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="filter-section">
                <h3>Location</h3>
                <div className="filter-location-selects">
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All States</option>
                    {availableStates.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  {selectedState && (
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
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
