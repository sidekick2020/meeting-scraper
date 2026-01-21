import React from 'react';

function MeetingsList({ meetings, onSelectMeeting }) {
  const formatDay = (day) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  };

  return (
    <div className="meetings-panel">
      <h3>Recently Added Meetings</h3>

      <div className="meetings-list">
        {meetings.length > 0 ? (
          meetings.map((meeting, index) => (
            <div
              key={meeting.objectId || index}
              className="meeting-card clickable"
              onClick={() => onSelectMeeting && onSelectMeeting(meeting)}
            >
              <div className="meeting-header">
                <span className={`meeting-type type-${meeting.meetingType?.toLowerCase().replace('-', '')}`}>
                  {meeting.meetingType}
                </span>
                <span className="meeting-state">{meeting.state}</span>
              </div>

              <h4 className="meeting-name">{meeting.name || 'Unnamed Meeting'}</h4>

              <div className="meeting-details">
                {meeting.locationName && (
                  <p className="meeting-location">{meeting.locationName}</p>
                )}

                {meeting.address && (
                  <p className="meeting-address">
                    {meeting.address}
                    {meeting.city && `, ${meeting.city}`}
                    {meeting.postalCode && ` ${meeting.postalCode}`}
                  </p>
                )}

                <p className="meeting-schedule">
                  {formatDay(meeting.day)} at {meeting.time || 'TBD'}
                </p>

                {meeting.isOnline && (
                  <span className="online-badge">Online Available</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="no-meetings-placeholder">
            <div className="placeholder-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
                <path d="M8 14h.01"></path>
                <path d="M12 14h.01"></path>
                <path d="M16 14h.01"></path>
                <path d="M8 18h.01"></path>
                <path d="M12 18h.01"></path>
              </svg>
            </div>
            <h4 className="placeholder-title">No Meetings Yet</h4>
            <p className="placeholder-text">
              Once you start a new scrape, recently added meetings will populate here.
            </p>
            <div className="placeholder-hint">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>Click "Start Scraping" above to begin</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MeetingsList;
