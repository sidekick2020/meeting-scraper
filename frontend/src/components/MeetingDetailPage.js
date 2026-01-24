import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useParse } from '../contexts/ParseContext';
import SourceDetailPanel from './SourceDetailPanel';

// Generate static map tile URL from coordinates
const getMapTileUrl = (latitude, longitude) => {
  const zoom = 15;
  const n = Math.pow(2, zoom);
  const x = Math.floor((longitude + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(latitude * Math.PI / 180) + 1 / Math.cos(latitude * Math.PI / 180)) / Math.PI) / 2 * n);
  return `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
};

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

// Source feed metadata for preview
const feedMetadata = {
  "Palo Alto (Bay Area)": { type: "AA", format: "TSML", state: "CA" },
  "San Diego": { type: "AA", format: "TSML", state: "CA" },
  "Phoenix": { type: "AA", format: "TSML", state: "AZ" },
  "Birmingham AA": { type: "AA", format: "TSML", state: "AL" },
  "West Alabama AA": { type: "AA", format: "TSML", state: "AL" },
  "Richmond AA": { type: "AA", format: "TSML", state: "VA" },
  "Blue Ridge AA": { type: "AA", format: "TSML", state: "VA" },
  "Eastside AA (Seattle)": { type: "AA", format: "TSML", state: "WA" },
  "Indianapolis AA": { type: "AA", format: "TSML", state: "IN" },
  "Houston AA": { type: "AA", format: "TSML", state: "TX" },
  "Austin AA": { type: "AA", format: "TSML", state: "TX" },
  "Atlanta AA": { type: "AA", format: "TSML", state: "GA" },
  "Boulder AA": { type: "AA", format: "TSML", state: "CO" },
  "Alabama NA": { type: "NA", format: "BMLT", state: "AL" },
  "Missouri NA": { type: "NA", format: "BMLT", state: "MO" },
};

function MeetingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getObject, isReady, connectionStatus } = useParse();

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourceDetailOpen, setSourceDetailOpen] = useState(false);
  const [mapImageLoaded, setMapImageLoaded] = useState(false);

  useEffect(() => {
    async function fetchMeeting() {
      if (!isReady || connectionStatus !== 'connected') {
        // Wait for Parse to be ready
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await getObject('Meetings', id);
        if (result) {
          setMeeting(result.toJSON());
        } else {
          setError('Meeting not found');
        }
      } catch (err) {
        console.error('Error fetching meeting:', err);
        setError(err.message || 'Failed to load meeting');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchMeeting();
    }
  }, [id, getObject, isReady, connectionStatus]);

  // Reset image loaded state when meeting changes
  useEffect(() => {
    setMapImageLoaded(false);
  }, [meeting?.latitude, meeting?.longitude]);

  const formatTime = (time) => {
    if (!time) return 'Time not specified';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getTypeLabel = (type) => {
    return typeDescriptions[type] || type;
  };

  const hasFullStreetAddress = (meeting) => {
    const address = meeting?.address;
    if (!address) return false;
    return /\d/.test(address);
  };

  const openInMaps = () => {
    if (!meeting) return;
    const address = meeting.formattedAddress ||
      `${meeting.address}, ${meeting.city}, ${meeting.state} ${meeting.postalCode}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  const navigateToMeeting = () => {
    if (!meeting) return;
    const address = meeting.formattedAddress ||
      `${meeting.address || ''}${meeting.city ? ', ' + meeting.city : ''}${meeting.state ? ', ' + meeting.state : ''}${meeting.postalCode ? ' ' + meeting.postalCode : ''}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
    window.open(url, '_blank');
  };

  const joinMeeting = () => {
    if (meeting?.onlineUrl) {
      window.open(meeting.onlineUrl, '_blank');
    }
  };

  const hasNavigableAddress = (meeting) => {
    return meeting?.address || (meeting?.city && meeting?.state);
  };

  const hasOnlineUrl = (meeting) => {
    return meeting?.isOnline && meeting?.onlineUrl;
  };

  // Loading state
  if (loading || connectionStatus === 'testing') {
    return (
      <div className="meeting-detail-page">
        <div className="meeting-detail-page-header">
          <Link to="/" className="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Meetings
          </Link>
        </div>
        <div className="meeting-detail-page-loading">
          <div className="loading-spinner"></div>
          <p>Loading meeting details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="meeting-detail-page">
        <div className="meeting-detail-page-header">
          <Link to="/" className="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Meetings
          </Link>
        </div>
        <div className="meeting-detail-page-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <h2>Meeting Not Found</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Browse Meetings
          </button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!meeting) {
    return (
      <div className="meeting-detail-page">
        <div className="meeting-detail-page-header">
          <Link to="/" className="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Meetings
          </Link>
        </div>
        <div className="meeting-detail-page-error">
          <h2>Meeting Not Found</h2>
          <p>The meeting you're looking for doesn't exist or has been removed.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Browse Meetings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-detail-page">
      {/* Header with back button */}
      <div className="meeting-detail-page-header">
        <Link to="/" className="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Meetings
        </Link>
      </div>

      {/* Map Preview */}
      {meeting.latitude && meeting.longitude && (
        <div className="meeting-detail-page-map">
          <img
            src={getMapTileUrl(meeting.latitude, meeting.longitude)}
            alt={`Map of ${meeting.name || 'meeting location'}`}
            className={`meeting-detail-page-map-image ${mapImageLoaded ? 'loaded' : ''}`}
            onLoad={() => setMapImageLoaded(true)}
          />
          <div className="meeting-detail-page-map-marker">
            <div className="meeting-detail-page-map-marker-inner" />
          </div>
          <div className="meeting-detail-page-map-overlay" />
        </div>
      )}

      {/* Main Content */}
      <div className="meeting-detail-page-content">
        <div className="meeting-detail-page-title">
          <h1>{meeting.name}</h1>
        </div>

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

        {/* Action Buttons */}
        {(hasNavigableAddress(meeting) || hasOnlineUrl(meeting)) && (
          <div className="meeting-action-buttons">
            {hasOnlineUrl(meeting) && (
              <button className="btn btn-success btn-action" onClick={joinMeeting}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15.6 11.6L22 7v10l-6.4-4.5v-1z"/>
                  <rect x="2" y="5" width="14" height="14" rx="2"/>
                </svg>
                Join Meeting
              </button>
            )}
            {hasNavigableAddress(meeting) && (
              <button className="btn btn-primary btn-action" onClick={navigateToMeeting}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                Navigate
              </button>
            )}
          </div>
        )}

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
            <div className="detail-content">
              <span>{dayNames[meeting.day] || 'Day not specified'}</span>
              <span className="field-description">Weekly meeting day</span>
            </div>
          </div>
          <div className="detail-row">
            <span className="detail-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </span>
            <div className="detail-content">
              <span>
                {formatTime(meeting.time)}
                {meeting.endTime && ` - ${formatTime(meeting.endTime)}`}
              </span>
              <span className="field-description">{meeting.endTime ? 'Start and end time' : 'Meeting start time'}</span>
            </div>
          </div>
          {meeting.timezone && (
            <div className="detail-row">
              <span className="detail-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </span>
              <div className="detail-content">
                <span>{meeting.timezone}</span>
                <span className="field-description">Local timezone for this meeting</span>
              </div>
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
              <div className="detail-content">
                <span>{meeting.locationName}</span>
                <span className="field-description">Venue or building name</span>
              </div>
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
              <div className="detail-content">
                <span>
                  {meeting.address}
                  {meeting.city && `, ${meeting.city}`}
                  {meeting.state && `, ${meeting.state}`}
                  {meeting.postalCode && ` ${meeting.postalCode}`}
                </span>
                <span className="field-description">Street address</span>
              </div>
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
              <div className="detail-content">
                <span>
                  {meeting.region}
                  {meeting.subRegion && ` / ${meeting.subRegion}`}
                </span>
                <span className="field-description">Geographic district or area</span>
              </div>
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
              <div className="detail-content">
                <span>{meeting.locationNotes}</span>
                <span className="field-description">Directions to find the meeting room</span>
              </div>
            </div>
          )}
          {meeting.latitude && meeting.longitude && !hasFullStreetAddress(meeting) && (
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
                <div className="detail-content">
                  <a href={meeting.onlineUrl} target="_blank" rel="noopener noreferrer">
                    Join Online Meeting
                  </a>
                  <span className="field-description">Video conference link (Zoom, etc.)</span>
                </div>
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
                <div className="detail-content">
                  <span>{meeting.onlineUrlNotes}</span>
                  <span className="field-description">Password or meeting ID if needed</span>
                </div>
              </div>
            )}
            {meeting.conferencePhone && (
              <div className="detail-row">
                <span className="detail-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </span>
                <div className="detail-content">
                  <a href={`tel:${meeting.conferencePhone}`}>{meeting.conferencePhone}</a>
                  <span className="field-description">Phone dial-in number</span>
                </div>
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
                <div className="detail-content">
                  <span>{meeting.conferencePhoneNotes}</span>
                  <span className="field-description">Phone access code or instructions</span>
                </div>
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
                <div className="detail-content">
                  <span>{meeting.group}</span>
                  <span className="field-description">Home group that hosts this meeting</span>
                </div>
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
                <div className="detail-content">
                  <span>{meeting.groupNotes}</span>
                  <span className="field-description">Additional info about the group</span>
                </div>
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
                <div className="detail-content">
                  <span>{meeting.contactName}</span>
                  <span className="field-description">Meeting contact person</span>
                </div>
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
                <div className="detail-content">
                  <a href={`mailto:${meeting.contactEmail}`}>{meeting.contactEmail}</a>
                  <span className="field-description">Email for questions about this meeting</span>
                </div>
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
                <div className="detail-content">
                  <a href={`tel:${meeting.contactPhone}`}>{meeting.contactPhone}</a>
                  <span className="field-description">Phone for questions about this meeting</span>
                </div>
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

        {/* Source Preview Card */}
        <div className="detail-section">
          <h4>Data Source</h4>
          <div
            className="source-preview-card"
            onClick={() => setSourceDetailOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setSourceDetailOpen(true)}
          >
            <div className="source-preview-main">
              <div className="source-preview-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <div className="source-preview-info">
                <span className="source-preview-name">{meeting.sourceFeed || 'Unknown Source'}</span>
                <div className="source-preview-badges">
                  {(() => {
                    const sourceInfo = feedMetadata[meeting.sourceFeed] || { type: meeting.meetingType, format: 'TSML' };
                    return (
                      <>
                        <span className={`source-mini-badge ${(sourceInfo.type || 'aa').toLowerCase()}`}>
                          {sourceInfo.type || meeting.meetingType || 'AA'}
                        </span>
                        <span className="source-mini-badge format">
                          {sourceInfo.format || 'TSML'}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="source-preview-meta">
              {meeting.updatedAt && (
                <span className="source-preview-date">
                  Updated {new Date(meeting.updatedAt).toLocaleDateString()}
                </span>
              )}
              <span className="source-preview-expand">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Source Detail Panel */}
      <SourceDetailPanel
        meeting={meeting}
        isOpen={sourceDetailOpen}
        onClose={() => setSourceDetailOpen(false)}
      />
    </div>
  );
}

export default MeetingDetailPage;
