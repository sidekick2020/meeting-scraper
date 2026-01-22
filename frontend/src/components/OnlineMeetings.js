import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MeetingDetail from './MeetingDetail';
import { SidebarToggleButton } from './PublicSidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  const containerRef = useRef(null);
  const nowMarkerRef = useRef(null);
  const todaySectionRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);
  const meetingsRef = useRef([]);

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
    meetings.forEach(meeting => {
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
  }, [meetings]);

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

  const loadMoreMeetings = () => {
    if (!isLoadingMore && hasMore) {
      fetchOnlineMeetings(true);
    }
  };

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
        <div className="online-meetings-header-center">
          <h1>Online Meetings</h1>
          <p className="online-meetings-count">
            {isLoading ? 'Loading...' : `${totalMeetings} online meeting${totalMeetings !== 1 ? 's' : ''} available`}
          </p>
        </div>
        <div className="online-meetings-header-right">
          {/* Placeholder for future actions */}
        </div>
      </header>

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

            {/* Load More */}
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
