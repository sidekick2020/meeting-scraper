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

function MeetingDetail({ meeting, onClose, isSidebar = false }) {
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

  // Sidebar mode rendering
  if (isSidebar) {
    return (
      <>
        {/* Overlay when sidebar is open */}
        <div
          className={`sidebar-overlay ${meeting ? 'active' : ''}`}
          onClick={onClose}
        />

        {/* Sidebar panel */}
        <div className={`detail-sidebar ${meeting ? 'open' : ''}`}>
          {meeting && (
            <>
              <div className="sidebar-detail-header">
                <h2>{meeting.name}</h2>
                <button className="sidebar-close" onClick={onClose}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <div className="sidebar-detail-body">
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
                    <span className="detail-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <path d="M16 2v4M8 2v4M3 10h18"/>
                      </svg>
                    </span>
                    <span>{dayNames[meeting.day] || 'Day not specified'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                      </svg>
                    </span>
                    <span>
                      {formatTime(meeting.time)}
                      {meeting.endTime && ` - ${formatTime(meeting.endTime)}`}
                    </span>
                  </div>
                  {meeting.timezone && (
                    <div className="detail-row">
                      <span className="detail-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                      </span>
                      <span>{meeting.timezone}</span>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="detail-section">
                  <h4>Location</h4>
                  {meeting.locationName && (
                    <div className="detail-row">
                      <span className="detail-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9,22 9,12 15,12 15,22"/>
                        </svg>
                      </span>
                      <span>{meeting.locationName}</span>
                    </div>
                  )}
                  {meeting.address && (
                    <div className="detail-row">
                      <span className="detail-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                      </span>
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
                      <span className="detail-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                          <line x1="8" y1="2" x2="8" y2="18"/>
                          <line x1="16" y1="6" x2="16" y2="22"/>
                        </svg>
                      </span>
                      <span>
                        {meeting.region}
                        {meeting.subRegion && ` / ${meeting.subRegion}`}
                      </span>
                    </div>
                  )}
                  {meeting.locationNotes && (
                    <div className="detail-row detail-notes">
                      <span className="detail-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 16v-4M12 8h.01"/>
                        </svg>
                      </span>
                      <span>{meeting.locationNotes}</span>
                    </div>
                  )}
                  {meeting.latitude && meeting.longitude && (
                    <button className="btn btn-secondary btn-small" onClick={openInMaps}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15,3 21,3 21,9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
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
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2"/>
                            <path d="M8 21h8M12 17v4"/>
                          </svg>
                        </span>
                        <a href={meeting.onlineUrl} target="_blank" rel="noopener noreferrer">
                          Join Online Meeting
                        </a>
                      </div>
                    )}
                    {meeting.onlineUrlNotes && (
                      <div className="detail-row detail-notes">
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                        </span>
                        <span>{meeting.onlineUrlNotes}</span>
                      </div>
                    )}
                    {meeting.conferencePhone && (
                      <div className="detail-row">
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                        </span>
                        <a href={`tel:${meeting.conferencePhone}`}>{meeting.conferencePhone}</a>
                      </div>
                    )}
                    {meeting.conferencePhoneNotes && (
                      <div className="detail-row detail-notes">
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                        </span>
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
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                        </span>
                        <span>{meeting.group}</span>
                      </div>
                    )}
                    {meeting.groupNotes && (
                      <div className="detail-row detail-notes">
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                        </span>
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
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                        </span>
                        <span>{meeting.contactName}</span>
                      </div>
                    )}
                    {meeting.contactEmail && (
                      <div className="detail-row">
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                        </span>
                        <a href={`mailto:${meeting.contactEmail}`}>{meeting.contactEmail}</a>
                      </div>
                    )}
                    {meeting.contactPhone && (
                      <div className="detail-row">
                        <span className="detail-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="5" y="2" width="14" height="20" rx="2"/>
                            <line x1="12" y1="18" x2="12.01" y2="18"/>
                          </svg>
                        </span>
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
            </>
          )}
        </div>
      </>
    );
  }

  // Original modal mode (for backwards compatibility)
  if (!meeting) return null;

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
