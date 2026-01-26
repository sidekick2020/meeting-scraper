import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MeetingDetail from './MeetingDetail';
import { SidebarToggleButton } from './PublicSidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayAbbrevs = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Fellowship types for filtering
const fellowshipTypes = [
  { id: 'AA', label: 'AA', fullName: 'Alcoholics Anonymous' },
  { id: 'NA', label: 'NA', fullName: 'Narcotics Anonymous' },
  { id: 'Al-Anon', label: 'Al-Anon', fullName: 'Al-Anon Family Groups' },
  { id: 'CA', label: 'CA', fullName: 'Cocaine Anonymous' },
  { id: 'OA', label: 'OA', fullName: 'Overeaters Anonymous' },
  { id: 'GA', label: 'GA', fullName: 'Gamblers Anonymous' },
];

// Time of day filters with SVG icons
const timeOfDayFilters = [
  { id: 'morning', label: 'Morning', startHour: 5, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', startHour: 12, endHour: 17 },
  { id: 'evening', label: 'Evening', startHour: 17, endHour: 21 },
  { id: 'night', label: 'Night', startHour: 21, endHour: 5 },
];

// SVG Icons for time of day
const TimeOfDayIcon = ({ id, size = 20 }) => {
  const icons = {
    morning: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2"/>
        <path d="M12 20v2"/>
        <path d="m4.93 4.93 1.41 1.41"/>
        <path d="m17.66 17.66 1.41 1.41"/>
        <path d="M2 12h2"/>
        <path d="M20 12h2"/>
        <path d="m6.34 17.66-1.41 1.41"/>
        <path d="m19.07 4.93-1.41 1.41"/>
      </svg>
    ),
    afternoon: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2"/>
        <path d="M12 21v2"/>
        <path d="M4.22 4.22l1.42 1.42"/>
        <path d="M18.36 18.36l1.42 1.42"/>
        <path d="M1 12h2"/>
        <path d="M21 12h2"/>
        <path d="M4.22 19.78l1.42-1.42"/>
        <path d="M18.36 5.64l1.42-1.42"/>
      </svg>
    ),
    evening: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        <path d="M19 3v4"/>
        <path d="M21 5h-4"/>
      </svg>
    ),
    night: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    ),
  };
  return icons[id] || null;
};

// Checkmark icon for selected states
const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Close/remove icon
const CloseIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

// Format time from "HH:MM" to "h:mm AM/PM"
const formatTime = (time) => {
  if (!time) return 'Time TBD';
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours)) return time;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Convert time string to minutes since midnight for comparison
const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

// Get current time in minutes since midnight
const getCurrentTimeMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

function OnlineMeetings({ sidebarOpen, onSidebarToggle }) {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showBackToNow, setShowBackToNow] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalMeetings, setTotalMeetings] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    fellowships: [],
    days: [],
    timeOfDay: [],
    hybridOnly: false,
  });

  const containerRef = useRef(null);
  const nowMarkerRef = useRef(null);
  const todaySectionRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);
  const meetingsRef = useRef([]);
  const loadMoreSentinelRef = useRef(null);

  // Theme detection for logo
  const [currentTheme, setCurrentTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'dark'
  );

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

  // Fetch online meetings
  const fetchOnlineMeetings = useCallback(async (loadMore = false) => {
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const skip = loadMore ? meetingsRef.current.length : 0;
      const response = await fetch(`${BACKEND_URL}/api/meetings?online=true&limit=100&skip=${skip}`);

      if (!response.ok) {
        throw new Error('Failed to fetch meetings');
      }

      const data = await response.json();
      const newMeetings = data.meetings || [];

      setTotalMeetings(data.total || 0);
      setHasMore((skip + newMeetings.length) < (data.total || 0));

      if (loadMore) {
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
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchOnlineMeetings();
  }, [fetchOnlineMeetings]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return filters.fellowships.length +
           filters.days.length +
           filters.timeOfDay.length +
           (filters.hybridOnly ? 1 : 0);
  }, [filters]);

  // Build list of active filter items for display as removable pills
  const activeFilterItems = useMemo(() => {
    const items = [];

    filters.fellowships.forEach(f => {
      const fellowship = fellowshipTypes.find(ft => ft.id === f);
      if (fellowship) {
        items.push({
          type: 'fellowships',
          id: f,
          label: fellowship.label,
          fullLabel: fellowship.fullName,
        });
      }
    });

    filters.days.forEach(d => {
      items.push({
        type: 'days',
        id: d,
        label: dayAbbrevs[d],
        fullLabel: dayNames[d],
      });
    });

    filters.timeOfDay.forEach(t => {
      const tod = timeOfDayFilters.find(tf => tf.id === t);
      if (tod) {
        items.push({
          type: 'timeOfDay',
          id: t,
          label: tod.label,
          fullLabel: tod.label,
        });
      }
    });

    if (filters.hybridOnly) {
      items.push({
        type: 'hybridOnly',
        id: true,
        label: 'Hybrid',
        fullLabel: 'Hybrid Only',
      });
    }

    return items;
  }, [filters]);

  // Remove a single filter item
  const removeFilterItem = useCallback((type, id) => {
    if (type === 'hybridOnly') {
      setFilters(prev => ({ ...prev, hybridOnly: false }));
    } else {
      setFilters(prev => ({
        ...prev,
        [type]: prev[type].filter(v => v !== id),
      }));
    }
  }, []);

  // Calculate filter counts (how many meetings match each filter option)
  const filterCounts = useMemo(() => {
    const counts = {
      fellowships: {},
      days: {},
      timeOfDay: {},
      hybrid: 0,
    };

    // Count meetings per fellowship
    fellowshipTypes.forEach(f => {
      counts.fellowships[f.id] = meetings.filter(m =>
        (m.meetingType || 'AA').toUpperCase().includes(f.id.toUpperCase())
      ).length;
    });

    // Count meetings per day
    for (let i = 0; i < 7; i++) {
      counts.days[i] = meetings.filter(m => m.day === i).length;
    }

    // Count meetings per time of day
    timeOfDayFilters.forEach(tod => {
      counts.timeOfDay[tod.id] = meetings.filter(m => {
        if (!m.time) return false;
        const [hours] = m.time.split(':').map(Number);
        if (tod.id === 'night') {
          return hours >= tod.startHour || hours < tod.endHour;
        }
        return hours >= tod.startHour && hours < tod.endHour;
      }).length;
    });

    // Count hybrid meetings
    counts.hybrid = meetings.filter(m => m.isHybrid).length;

    return counts;
  }, [meetings]);

  // Helper to check if meeting time falls within time of day filter
  const isInTimeOfDay = useCallback((meetingTime, timeOfDayIds) => {
    if (timeOfDayIds.length === 0) return true;
    if (!meetingTime) return false;

    const [hours] = meetingTime.split(':').map(Number);

    return timeOfDayIds.some(todId => {
      const tod = timeOfDayFilters.find(t => t.id === todId);
      if (!tod) return false;

      // Handle night which wraps around midnight
      if (tod.id === 'night') {
        return hours >= tod.startHour || hours < tod.endHour;
      }
      return hours >= tod.startHour && hours < tod.endHour;
    });
  }, []);

  // Filter meetings based on search query and filters
  const filteredMeetings = useMemo(() => {
    let result = meetings;

    // Apply fellowship filter
    if (filters.fellowships.length > 0) {
      result = result.filter(meeting => {
        const meetingType = (meeting.meetingType || 'AA').toUpperCase();
        return filters.fellowships.some(f =>
          meetingType.includes(f.toUpperCase())
        );
      });
    }

    // Apply day filter
    if (filters.days.length > 0) {
      result = result.filter(meeting =>
        filters.days.includes(meeting.day)
      );
    }

    // Apply time of day filter
    if (filters.timeOfDay.length > 0) {
      result = result.filter(meeting =>
        isInTimeOfDay(meeting.time, filters.timeOfDay)
      );
    }

    // Apply hybrid filter
    if (filters.hybridOnly) {
      result = result.filter(meeting => meeting.isHybrid);
    }

    // Apply text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(meeting => {
        const name = (meeting.name || '').toLowerCase();
        const locationName = (meeting.locationName || '').toLowerCase();
        const meetingType = (meeting.meetingType || '').toLowerCase();
        const format = (meeting.format || '').toLowerCase();
        const notes = (meeting.notes || '').toLowerCase();

        return name.includes(query) ||
               locationName.includes(query) ||
               meetingType.includes(query) ||
               format.includes(query) ||
               notes.includes(query);
      });
    }

    return result;
  }, [meetings, searchQuery, filters, isInTimeOfDay]);

  // Toggle filter value
  const toggleFilter = useCallback((filterType, value) => {
    setFilters(prev => {
      const current = prev[filterType];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [filterType]: updated };
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      fellowships: [],
      days: [],
      timeOfDay: [],
      hybridOnly: false,
    });
    setSearchQuery('');
  }, []);

  // Group meetings by day, ordered starting from today
  const groupedMeetings = useMemo(() => {
    const today = new Date().getDay();
    const groups = {};

    // Initialize groups for all days in order starting from today
    for (let i = 0; i < 7; i++) {
      const dayIndex = (today + i) % 7;
      groups[dayIndex] = [];
    }

    // Group meetings by day
    filteredMeetings.forEach(meeting => {
      if (meeting.day !== undefined && groups[meeting.day]) {
        groups[meeting.day].push(meeting);
      }
    });

    // Sort meetings within each day by time
    Object.keys(groups).forEach(day => {
      groups[day].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    });

    // Convert to array format maintaining order from today
    const orderedDays = [];
    for (let i = 0; i < 7; i++) {
      const dayIndex = (today + i) % 7;
      if (groups[dayIndex].length > 0) {
        orderedDays.push({
          dayIndex,
          dayName: dayNames[dayIndex],
          isToday: dayIndex === today,
          meetings: groups[dayIndex]
        });
      }
    }

    return orderedDays;
  }, [filteredMeetings]);

  // Find the index of the next meeting (for today's section)
  const getNextMeetingIndex = useCallback((dayMeetings) => {
    const currentMinutes = getCurrentTimeMinutes();
    for (let i = 0; i < dayMeetings.length; i++) {
      if (timeToMinutes(dayMeetings[i].time) >= currentMinutes) {
        return i;
      }
    }
    return -1; // All meetings have passed
  }, []);

  // Auto-scroll to current time on initial load
  useEffect(() => {
    if (!isLoading && meetings.length > 0 && !hasAutoScrolledRef.current) {
      hasAutoScrolledRef.current = true;

      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (nowMarkerRef.current) {
          nowMarkerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (todaySectionRef.current) {
          todaySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [isLoading, meetings]);

  // Track scroll position to show/hide "back to now" button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (nowMarkerRef.current || todaySectionRef.current) {
        const targetElement = nowMarkerRef.current || todaySectionRef.current;
        const rect = targetElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Show button if target is not visible
        const isVisible = rect.top >= containerRect.top - 100 && rect.bottom <= containerRect.bottom + 100;
        setShowBackToNow(!isVisible);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToNow = () => {
    if (nowMarkerRef.current) {
      nowMarkerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (todaySectionRef.current) {
      todaySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleMeetingClick = (meeting) => {
    setSelectedMeeting(meeting);
  };

  const loadMoreMeetings = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchOnlineMeetings(true);
    }
  }, [isLoadingMore, hasMore, fetchOnlineMeetings]);

  // Infinite scroll - load more meetings when sentinel becomes visible
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMoreMeetings();
        }
      },
      {
        root: container,
        rootMargin: '200px',
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, isLoading, loadMoreMeetings]);

  return (
    <div className="online-meetings-page">
      {/* Header */}
      <header className="online-meetings-header">
        <div className="online-meetings-header-left">
          <SidebarToggleButton
            isOpen={sidebarOpen}
            onClick={onSidebarToggle}
            className="header-sidebar-toggle"
          />
          <div className="online-meetings-logo" onClick={() => navigate('/')}>
            <img
              src={currentTheme === 'light' ? '/sober-sidekick-logo-light.png' : '/sober-sidekick-logo-dark.png'}
              alt="Sober Sidekick"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span className="logo-fallback" style={{ display: 'none' }}>Sober Sidekick</span>
          </div>
        </div>
        <div className="online-meetings-header-right">
          {/* Spacer for layout balance */}
        </div>
      </header>

      {/* Airbnb-style Search Section */}
      <div className="online-meetings-search-section">
        <div className={`online-meetings-search-bar ${isSearchFocused ? 'focused' : ''}`}>
          <div className="search-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search online meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          {(searchQuery || activeFilterCount > 0) && (
            <button
              className="search-clear-btn"
              onClick={clearFilters}
              aria-label="Clear search and filters"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
          <button
            className={`filter-toggle-btn ${activeFilterCount > 0 ? 'has-filters' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle filters"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Results count */}
        <p className="online-meetings-count">
          {isLoading ? 'Loading...' :
           (searchQuery || activeFilterCount > 0)
             ? `${filteredMeetings.length} of ${totalMeetings} meeting${totalMeetings !== 1 ? 's' : ''}`
             : `${totalMeetings} online meeting${totalMeetings !== 1 ? 's' : ''} available`}
        </p>

        {/* Active Filter Pills - Removable tags showing current filters */}
        {activeFilterItems.length > 0 && (
          <div className="active-filter-pills">
            {activeFilterItems.map(item => (
              <button
                key={`${item.type}-${item.id}`}
                className="active-filter-pill"
                onClick={() => removeFilterItem(item.type, item.id)}
                title={`Remove ${item.fullLabel} filter`}
              >
                <span>{item.label}</span>
                <CloseIcon size={10} />
              </button>
            ))}
            {activeFilterItems.length > 1 && (
              <button
                className="clear-all-filters-btn"
                onClick={clearFilters}
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Filter Chips - Quick Access with Section Labels */}
        <div className="online-meetings-filter-chips">
          {/* Fellowship section */}
          <div className="filter-chip-group">
            <span className="filter-chip-label">Fellowship</span>
            <div className="filter-chip-options">
              {fellowshipTypes.map(fellowship => (
                <button
                  key={fellowship.id}
                  className={`filter-chip ${filters.fellowships.includes(fellowship.id) ? 'active' : ''}`}
                  onClick={() => toggleFilter('fellowships', fellowship.id)}
                  title={`${fellowship.fullName} (${filterCounts.fellowships[fellowship.id] || 0})`}
                >
                  {filters.fellowships.includes(fellowship.id) && (
                    <span className="filter-chip-check"><CheckIcon size={12} /></span>
                  )}
                  <span>{fellowship.label}</span>
                  <span className="filter-chip-count">{filterCounts.fellowships[fellowship.id] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <span className="filter-divider" />

          {/* Day section */}
          <div className="filter-chip-group">
            <span className="filter-chip-label">Day</span>
            <div className="filter-chip-options">
              {dayAbbrevs.map((day, index) => (
                <button
                  key={index}
                  className={`filter-chip day-chip ${filters.days.includes(index) ? 'active' : ''}`}
                  onClick={() => toggleFilter('days', index)}
                  title={`${dayNames[index]} (${filterCounts.days[index] || 0})`}
                >
                  {filters.days.includes(index) && (
                    <span className="filter-chip-check"><CheckIcon size={10} /></span>
                  )}
                  <span>{day}</span>
                </button>
              ))}
            </div>
          </div>

          <span className="filter-divider" />

          {/* Hybrid filter */}
          <div className="filter-chip-group">
            <span className="filter-chip-label">Type</span>
            <div className="filter-chip-options">
              <button
                className={`filter-chip ${filters.hybridOnly ? 'active' : ''}`}
                onClick={() => setFilters(prev => ({ ...prev, hybridOnly: !prev.hybridOnly }))}
                title={`Hybrid meetings (${filterCounts.hybrid || 0})`}
              >
                {filters.hybridOnly && (
                  <span className="filter-chip-check"><CheckIcon size={12} /></span>
                )}
                <span>Hybrid</span>
                <span className="filter-chip-count">{filterCounts.hybrid || 0}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Filters Panel */}
        {showFilters && (
          <div className="online-meetings-filters-panel">
            <div className="filters-panel-header">
              <h3>Filters</h3>
              <button
                className="filters-panel-close"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="filters-panel-section">
              <h4>Time of Day</h4>
              <div className="filter-options time-grid">
                {timeOfDayFilters.map(tod => (
                  <button
                    key={tod.id}
                    className={`filter-option time-option ${filters.timeOfDay.includes(tod.id) ? 'active' : ''}`}
                    onClick={() => toggleFilter('timeOfDay', tod.id)}
                  >
                    <span className="filter-option-icon">
                      <TimeOfDayIcon id={tod.id} size={24} />
                    </span>
                    <span className="filter-option-text">
                      <span className="filter-option-label">{tod.label}</span>
                      <span className="filter-option-count">{filterCounts.timeOfDay[tod.id] || 0} meetings</span>
                    </span>
                    {filters.timeOfDay.includes(tod.id) && (
                      <span className="filter-option-check"><CheckIcon size={16} /></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="filters-panel-section">
              <h4>Day of Week</h4>
              <div className="filter-options days-grid">
                {dayNames.map((day, index) => (
                  <button
                    key={index}
                    className={`filter-option day-option ${filters.days.includes(index) ? 'active' : ''}`}
                    onClick={() => toggleFilter('days', index)}
                  >
                    <span className="day-option-name">{day}</span>
                    <span className="day-option-count">{filterCounts.days[index] || 0}</span>
                    {filters.days.includes(index) && (
                      <span className="filter-option-check"><CheckIcon size={14} /></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="filters-panel-section">
              <h4>Fellowship</h4>
              <div className="filter-options fellowship-grid">
                {fellowshipTypes.map(fellowship => (
                  <button
                    key={fellowship.id}
                    className={`filter-option fellowship-option ${filters.fellowships.includes(fellowship.id) ? 'active' : ''}`}
                    onClick={() => toggleFilter('fellowships', fellowship.id)}
                  >
                    <span className="fellowship-option-content">
                      <span className="filter-option-label">{fellowship.label}</span>
                      <span className="filter-option-desc">{fellowship.fullName}</span>
                      <span className="filter-option-count">{filterCounts.fellowships[fellowship.id] || 0} meetings</span>
                    </span>
                    {filters.fellowships.includes(fellowship.id) && (
                      <span className="filter-option-check"><CheckIcon size={16} /></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="filters-panel-actions">
              <button className="btn btn-secondary" onClick={clearFilters} disabled={activeFilterCount === 0}>
                Clear All
              </button>
              <button className="btn btn-primary" onClick={() => setShowFilters(false)}>
                Show {filteredMeetings.length} Meeting{filteredMeetings.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="online-meetings-container" ref={containerRef}>
        {isLoading ? (
          <div className="online-meetings-loading">
            <div className="loading-spinner"></div>
            <p>Loading online meetings...</p>
          </div>
        ) : error ? (
          <div className="online-meetings-error">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h3>Error loading meetings</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => fetchOnlineMeetings()}>
              Try Again
            </button>
          </div>
        ) : meetings.length === 0 ? (
          <div className="online-meetings-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8"/>
              <path d="M12 17v4"/>
            </svg>
            <h3>No online meetings found</h3>
            <p>There are no online meetings available at this time.</p>
          </div>
        ) : filteredMeetings.length === 0 && searchQuery ? (
          <div className="online-meetings-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <h3>No meetings match "{searchQuery}"</h3>
            <p>Try a different search term or clear the search.</p>
            <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>
              Clear Search
            </button>
          </div>
        ) : (
          <div className="online-meetings-list">
            {groupedMeetings.map((dayGroup) => {
              const nextMeetingIndex = dayGroup.isToday ? getNextMeetingIndex(dayGroup.meetings) : -1;
              const currentMinutes = getCurrentTimeMinutes();

              return (
                <div
                  key={dayGroup.dayIndex}
                  className={`online-meetings-day-group ${dayGroup.isToday ? 'today' : ''}`}
                  ref={dayGroup.isToday ? todaySectionRef : null}
                >
                  <div className="online-meetings-day-header">
                    <h2>{dayGroup.dayName}</h2>
                    {dayGroup.isToday && <span className="today-badge">Today</span>}
                    <span className="meeting-count">{dayGroup.meetings.length} meeting{dayGroup.meetings.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="online-meetings-day-list">
                    {dayGroup.meetings.map((meeting, index) => {
                      const meetingMinutes = timeToMinutes(meeting.time);
                      const isNextMeeting = dayGroup.isToday && index === nextMeetingIndex;
                      const isPast = dayGroup.isToday && meetingMinutes < currentMinutes;

                      // Show "Now" marker before the next upcoming meeting
                      const showNowMarker = dayGroup.isToday && index === nextMeetingIndex && nextMeetingIndex > 0;

                      return (
                        <React.Fragment key={meeting.objectId || index}>
                          {showNowMarker && (
                            <div className="now-marker" ref={nowMarkerRef}>
                              <div className="now-marker-line"></div>
                              <span className="now-marker-label">Now</span>
                              <div className="now-marker-line"></div>
                            </div>
                          )}
                          <div
                            className={`online-meeting-card ${isPast ? 'past' : ''} ${isNextMeeting ? 'next-meeting' : ''}`}
                            onClick={() => handleMeetingClick(meeting)}
                            ref={isNextMeeting && nextMeetingIndex === 0 ? nowMarkerRef : null}
                          >
                            <div className="online-meeting-time">
                              <span className="time-display">{formatTime(meeting.time)}</span>
                              {meeting.duration && (
                                <span className="duration">{meeting.duration} min</span>
                              )}
                            </div>
                            <div className="online-meeting-info">
                              <h3 className="meeting-name">{meeting.name || 'Unnamed Meeting'}</h3>
                              <div className="meeting-meta">
                                <span className="meeting-type-badge">{meeting.meetingType || 'AA'}</span>
                                {meeting.isHybrid && <span className="hybrid-badge">Hybrid</span>}
                                {meeting.format && <span className="format-tag">{meeting.format}</span>}
                              </div>
                              {meeting.locationName && (
                                <p className="meeting-org">{meeting.locationName}</p>
                              )}
                            </div>
                            <div className="online-meeting-action">
                              {meeting.onlineUrl ? (
                                <button
                                  className="join-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(meeting.onlineUrl, '_blank');
                                  }}
                                >
                                  Join
                                </button>
                              ) : (
                                <span className="view-details">View</span>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Sentinel element for infinite scroll detection */}
            {hasMore && !isLoading && (
              <div ref={loadMoreSentinelRef} className="infinite-scroll-sentinel" aria-hidden="true" />
            )}

            {/* Load More - shown as fallback */}
            {hasMore && (
              <div className="online-meetings-load-more">
                <button
                  className="btn btn-secondary"
                  onClick={loadMoreMeetings}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <span className="loading-spinner-small"></span>
                      Loading...
                    </>
                  ) : (
                    <>Load More ({meetings.length} of {totalMeetings})</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating "Back to Now" button */}
      {showBackToNow && !isLoading && meetings.length > 0 && (
        <button className="back-to-now-btn" onClick={scrollToNow}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Back to Now
        </button>
      )}

      {/* Meeting Detail Sidebar */}
      <MeetingDetail
        meeting={selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        isSidebar={true}
      />
    </div>
  );
}

export default OnlineMeetings;
