import React, { useState, useEffect, useCallback } from 'react';
import MeetingMap from './MeetingMap';
import MeetingDetail from './MeetingDetail';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function MeetingsExplorer({ onAdminClick }) {
  const [meetings, setMeetings] = useState([]);
  const [filteredMeetings, setFilteredMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('map');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);

  // Get unique states from meetings
  const [availableStates, setAvailableStates] = useState([]);

  const fetchMeetings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings?limit=1000`);
      if (response.ok) {
        const data = await response.json();
        setMeetings(data.meetings || []);

        // Extract unique states
        const states = [...new Set(data.meetings.map(m => m.state).filter(Boolean))].sort();
        setAvailableStates(states);
      } else {
        setError('Failed to load meetings');
      }
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

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

    if (selectedDay !== '') {
      filtered = filtered.filter(m => m.day === parseInt(selectedDay));
    }

    if (showOnlineOnly) {
      filtered = filtered.filter(m => m.isOnline);
    }

    setFilteredMeetings(filtered);
  }, [meetings, searchQuery, selectedState, selectedDay, showOnlineOnly]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedState('');
    setSelectedDay('');
    setShowOnlineOnly(false);
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="meetings-explorer">
      <header className="explorer-header">
        <div className="explorer-header-content">
          <h1>12-Step Meeting Finder</h1>
          <p className="explorer-subtitle">Find AA meetings near you</p>
        </div>
        <button className="btn btn-ghost admin-link" onClick={onAdminClick}>
          Admin
        </button>
      </header>

      <div className="explorer-main">
        {/* Search and Filters */}
        <div className="explorer-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search meetings by name, location, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-row">
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

            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="filter-select"
            >
              <option value="">All Days</option>
              {dayNames.map((day, index) => (
                <option key={day} value={index}>{day}</option>
              ))}
            </select>

            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={showOnlineOnly}
                onChange={(e) => setShowOnlineOnly(e.target.checked)}
              />
              <span>Online Only</span>
            </label>

            {(searchQuery || selectedState || selectedDay || showOnlineOnly) && (
              <button className="btn btn-ghost btn-small" onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>

          <div className="filter-stats">
            Showing {filteredMeetings.length} of {meetings.length} meetings
          </div>
        </div>

        {/* View Toggle */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${activeView === 'map' ? 'active' : ''}`}
            onClick={() => setActiveView('map')}
          >
            Map View
          </button>
          <button
            className={`toggle-btn ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
          >
            List View
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="explorer-loading">
            <div className="loading-spinner"></div>
            <p>Loading meetings...</p>
          </div>
        ) : error ? (
          <div className="explorer-error">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={fetchMeetings}>
              Try Again
            </button>
          </div>
        ) : activeView === 'map' ? (
          <MeetingMap
            meetings={filteredMeetings}
            onSelectMeeting={setSelectedMeeting}
            showHeatmap={filteredMeetings.length > 10}
          />
        ) : (
          <div className="explorer-list">
            {filteredMeetings.length > 0 ? (
              filteredMeetings.map((meeting, index) => (
                <div
                  key={meeting.objectId || index}
                  className="explorer-meeting-card"
                  onClick={() => setSelectedMeeting(meeting)}
                >
                  <div className="meeting-card-header">
                    <h3>{meeting.name || 'Unnamed Meeting'}</h3>
                    <div className="meeting-card-badges">
                      <span className="badge badge-primary">{meeting.meetingType}</span>
                      {meeting.isOnline && (
                        <span className="badge badge-success">
                          {meeting.isHybrid ? 'Hybrid' : 'Online'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="meeting-card-details">
                    <div className="meeting-card-row">
                      <span className="meeting-card-icon">📅</span>
                      <span>{dayNames[meeting.day]} at {formatTime(meeting.time)}</span>
                    </div>

                    {meeting.locationName && (
                      <div className="meeting-card-row">
                        <span className="meeting-card-icon">🏢</span>
                        <span>{meeting.locationName}</span>
                      </div>
                    )}

                    {(meeting.city || meeting.state) && (
                      <div className="meeting-card-row">
                        <span className="meeting-card-icon">📍</span>
                        <span>
                          {[meeting.city, meeting.state].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="explorer-empty">
                <p>No meetings found matching your filters.</p>
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedMeeting && (
        <MeetingDetail
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </div>
  );
}

export default MeetingsExplorer;
