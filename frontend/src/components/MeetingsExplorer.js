import React, { useState, useEffect, useCallback, useRef } from 'react';
import MeetingMap from './MeetingMap';
import MeetingDetail from './MeetingDetail';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function MeetingsExplorer({ onAdminClick }) {
  const [meetings, setMeetings] = useState([]);
  const [filteredMeetings, setFilteredMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [hoveredMeeting, setHoveredMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Map bounds for dynamic loading
  const [mapBounds, setMapBounds] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Get unique values from meetings
  const [availableStates, setAvailableStates] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);

  // Search autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const searchInputRef = useRef(null);

  const listRef = useRef(null);
  const boundsTimeoutRef = useRef(null);

  const fetchMeetings = useCallback(async (bounds = null) => {
    if (bounds) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      let url = `${BACKEND_URL}/api/meetings?limit=1000`;

      // Add bounds parameters if provided
      if (bounds) {
        url += `&north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const newMeetings = data.meetings || [];

        if (bounds) {
          // Merge new meetings with existing ones, avoiding duplicates
          setMeetings(prev => {
            const existingIds = new Set(prev.map(m => m.objectId));
            const uniqueNew = newMeetings.filter(m => !existingIds.has(m.objectId));
            return [...prev, ...uniqueNew];
          });
        } else {
          setMeetings(newMeetings);
        }

        // Extract unique values (only on initial load)
        if (!bounds) {
          const states = [...new Set(newMeetings.map(m => m.state).filter(Boolean))].sort();
          setAvailableStates(states);

          const cities = [...new Set(newMeetings.map(m => m.city).filter(Boolean))].sort();
          setAvailableCities(cities);

          const types = [...new Set(newMeetings.map(m => m.meetingType).filter(Boolean))].sort();
          setAvailableTypes(types);
        }
      } else {
        if (!bounds) setError('Failed to load meetings');
      }
    } catch (err) {
      if (!bounds) setError('Unable to connect to server');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Handle map bounds change with debouncing
  const handleBoundsChange = useCallback((bounds) => {
    // Clear any pending timeout
    if (boundsTimeoutRef.current) {
      clearTimeout(boundsTimeoutRef.current);
    }

    // Debounce the fetch to avoid too many requests
    boundsTimeoutRef.current = setTimeout(() => {
      setMapBounds(bounds);
      // Fetch meetings for the new bounds
      fetchMeetings(bounds);
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

    setFilteredMeetings(filtered);
  }, [meetings, searchQuery, selectedState, selectedCity, selectedDay, selectedType, showOnlineOnly]);

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
  };

  const hasActiveFilters = searchQuery || selectedState || selectedCity || selectedDay || selectedType || showOnlineOnly;

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
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
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
                  meetings={filteredMeetings}
                  onSelectMeeting={handleMapMarkerClick}
                  hoveredMeeting={hoveredMeeting}
                  showHeatmap={filteredMeetings.length > 50}
                  onBoundsChange={handleBoundsChange}
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
          ) : error ? (
            <div className="list-error">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4"/>
                <path d="M12 16h.01"/>
              </svg>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={fetchMeetings}>
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
                      <div className="meeting-card-type-badge">
                        {meeting.meetingType}
                      </div>
                      {meeting.isOnline && (
                        <div className="meeting-card-online-badge">
                          {meeting.isHybrid ? 'Hybrid' : 'Online'}
                        </div>
                      )}
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
    </div>
  );
}

export default MeetingsExplorer;
