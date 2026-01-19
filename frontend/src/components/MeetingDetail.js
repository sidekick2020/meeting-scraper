import React from 'react';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Meeting type code descriptions
const typeDescriptions = {
  'O': 'Open',
  'C': 'Closed',
  'W': 'Women',
  'M': 'Men',
  'LGBTQ': 'LGBTQ+',
  'Y': 'Young People',
  'B': 'Big Book',
  'D': 'Discussion',
  'SP': 'Speaker',
  'ST': 'Step Study',
  'TR': 'Tradition Study',
  'BE': 'Beginner',
  'S': 'Spanish',
  'POL': 'Polish',
  'POR': 'Portuguese',
  'FR': 'French',
  'ASL': 'ASL',
  'X': 'Wheelchair Accessible',
  'BA': 'Babysitting',
  'TC': 'Location Temporarily Closed',
  'ONL': 'Online',
  'HY': 'Hybrid',
};

function MeetingDetail({ meeting, onClose }) {
  if (!meeting) return null;

  const formatTime = (time) => {
    if (!time) return 'Time not specified';
    // Convert 24h to 12h format
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getTypeLabel = (type) => {
    return typeDescriptions[type] || type;
  };

  const openInMaps = () => {
    const address = meeting.formattedAddress ||
      `${meeting.address}, ${meeting.city}, ${meeting.state} ${meeting.postalCode}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="meeting-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{meeting.name}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="meeting-detail-body">
          {/* Badges */}
          <div className="meeting-badges">
            <span className="badge badge-primary">{meeting.meetingType}</span>
            {meeting.isOnline && (
              <span className="badge badge-success">
                {meeting.isHybrid ? 'Hybrid' : 'Online'}
              </span>
            )}
            {meeting.types && meeting.types.length > 0 && (
              meeting.types.map((type, idx) => (
                <span key={idx} className="badge badge-secondary">
                  {getTypeLabel(type)}
                </span>
              ))
            )}
          </div>

          {/* Schedule */}
          <div className="detail-section">
            <h4>Schedule</h4>
            <div className="detail-row">
              <span className="detail-icon">📅</span>
              <span>{dayNames[meeting.day] || 'Day not specified'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-icon">🕐</span>
              <span>
                {formatTime(meeting.time)}
                {meeting.endTime && ` - ${formatTime(meeting.endTime)}`}
              </span>
            </div>
            {meeting.timezone && (
              <div className="detail-row">
                <span className="detail-icon">🌍</span>
                <span>{meeting.timezone}</span>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="detail-section">
            <h4>Location</h4>
            {meeting.locationName && (
              <div className="detail-row">
                <span className="detail-icon">🏢</span>
                <span>{meeting.locationName}</span>
              </div>
            )}
            {meeting.address && (
              <div className="detail-row">
                <span className="detail-icon">📍</span>
                <span>
                  {meeting.address}
                  {meeting.city && `, ${meeting.city}`}
                  {meeting.state && `, ${meeting.state}`}
                  {meeting.postalCode && ` ${meeting.postalCode}`}
                </span>
              </div>
            )}
            {meeting.region && (
              <div className="detail-row">
                <span className="detail-icon">🗺️</span>
                <span>
                  {meeting.region}
                  {meeting.subRegion && ` / ${meeting.subRegion}`}
                </span>
              </div>
            )}
            {meeting.locationNotes && (
              <div className="detail-row detail-notes">
                <span className="detail-icon">ℹ️</span>
                <span>{meeting.locationNotes}</span>
              </div>
            )}
            {meeting.latitude && meeting.longitude && (
              <button className="btn btn-secondary btn-small" onClick={openInMaps}>
                Open in Google Maps
              </button>
            )}
          </div>

          {/* Online Meeting Info */}
          {meeting.isOnline && (
            <div className="detail-section">
              <h4>Online Access</h4>
              {meeting.onlineUrl && (
                <div className="detail-row">
                  <span className="detail-icon">💻</span>
                  <a href={meeting.onlineUrl} target="_blank" rel="noopener noreferrer">
                    Join Online Meeting
                  </a>
                </div>
              )}
              {meeting.onlineUrlNotes && (
                <div className="detail-row detail-notes">
                  <span className="detail-icon">📝</span>
                  <span>{meeting.onlineUrlNotes}</span>
                </div>
              )}
              {meeting.conferencePhone && (
                <div className="detail-row">
                  <span className="detail-icon">📞</span>
                  <a href={`tel:${meeting.conferencePhone}`}>{meeting.conferencePhone}</a>
                </div>
              )}
              {meeting.conferencePhoneNotes && (
                <div className="detail-row detail-notes">
                  <span className="detail-icon">📝</span>
                  <span>{meeting.conferencePhoneNotes}</span>
                </div>
              )}
            </div>
          )}

          {/* Group Info */}
          {(meeting.group || meeting.groupNotes) && (
            <div className="detail-section">
              <h4>Group Information</h4>
              {meeting.group && (
                <div className="detail-row">
                  <span className="detail-icon">👥</span>
                  <span>{meeting.group}</span>
                </div>
              )}
              {meeting.groupNotes && (
                <div className="detail-row detail-notes">
                  <span className="detail-icon">📝</span>
                  <span>{meeting.groupNotes}</span>
                </div>
              )}
            </div>
          )}

          {/* Contact */}
          {(meeting.contactName || meeting.contactEmail || meeting.contactPhone) && (
            <div className="detail-section">
              <h4>Contact</h4>
              {meeting.contactName && (
                <div className="detail-row">
                  <span className="detail-icon">👤</span>
                  <span>{meeting.contactName}</span>
                </div>
              )}
              {meeting.contactEmail && (
                <div className="detail-row">
                  <span className="detail-icon">📧</span>
                  <a href={`mailto:${meeting.contactEmail}`}>{meeting.contactEmail}</a>
                </div>
              )}
              {meeting.contactPhone && (
                <div className="detail-row">
                  <span className="detail-icon">📱</span>
                  <a href={`tel:${meeting.contactPhone}`}>{meeting.contactPhone}</a>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {meeting.notes && (
            <div className="detail-section">
              <h4>Notes</h4>
              <div className="detail-notes-block">
                {meeting.notes}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="detail-section detail-metadata">
            <div className="metadata-row">
              <span>Source:</span>
              <span>{meeting.sourceFeed}</span>
            </div>
            {meeting.updatedAt && (
              <div className="metadata-row">
                <span>Last Updated:</span>
                <span>{new Date(meeting.updatedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default MeetingDetail;
