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
          <div className="no-meetings">
            <p>No meetings collected yet.</p>
            <p>Start the scraper to see meetings appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MeetingsList;
