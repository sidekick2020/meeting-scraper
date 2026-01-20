import React from 'react';

// Source feed metadata - maps feed names to their details
const feedMetadata = {
  // AA Feeds (TSML format)
  "Palo Alto (Bay Area)": { type: "AA", format: "TSML", state: "CA", region: "Bay Area", url: "https://sheets.code4recovery.org/storage/12Ga8uwMG4WJ8pZ_SEU7vNETp_aQZ-2yNVsYDFqIwHyE.json" },
  "San Diego": { type: "AA", format: "TSML", state: "CA", region: "San Diego County", url: "https://aasandiego.org" },
  "Phoenix": { type: "AA", format: "TSML", state: "AZ", region: "Maricopa County", url: "https://aaphoenix.org" },
  "Birmingham AA": { type: "AA", format: "TSML", state: "AL", region: "Birmingham", url: "https://birminghamaa.org" },
  "West Alabama AA": { type: "AA", format: "TSML", state: "AL", region: "West Alabama", url: "https://westalaa.org" },
  "Richmond AA": { type: "AA", format: "TSML", state: "VA", region: "Richmond", url: "https://www.aarichmond.org" },
  "Blue Ridge AA": { type: "AA", format: "TSML", state: "VA", region: "Blue Ridge", url: "https://aablueridge.org" },
  "Eastside AA (Seattle)": { type: "AA", format: "TSML", state: "WA", region: "Seattle Eastside", url: "https://www.eastsideaa.org" },
  "Indianapolis AA": { type: "AA", format: "TSML", state: "IN", region: "Indianapolis", url: "https://indyaa.org" },
  "Houston AA": { type: "AA", format: "TSML", state: "TX", region: "Houston", url: "https://aahouston.org" },
  "Austin AA": { type: "AA", format: "TSML", state: "TX", region: "Austin", url: "https://www.austinaa.org" },
  "Atlanta AA": { type: "AA", format: "TSML", state: "GA", region: "Atlanta", url: "https://atlantaaa.org" },
  "Boulder AA": { type: "AA", format: "TSML", state: "CO", region: "Boulder County", url: "https://www.bouldercountyaa.com" },
  // NA Feeds (BMLT format)
  "Alabama NA": { type: "NA", format: "BMLT", state: "AL", region: "Alabama", url: "https://bmlt.sezf.org" },
  "Missouri NA": { type: "NA", format: "BMLT", state: "MO", region: "Missouri", url: "https://missourina.org" },
};

// State full names
const stateNames = {
  CA: "California", AZ: "Arizona", AL: "Alabama", VA: "Virginia",
  WA: "Washington", IN: "Indiana", TX: "Texas", GA: "Georgia",
  CO: "Colorado", MO: "Missouri"
};

function SourceDetailPanel({ meeting, isOpen, onClose }) {
  if (!meeting) return null;

  const sourceFeed = meeting.sourceFeed || 'Unknown Source';
  const sourceInfo = feedMetadata[sourceFeed] || {
    type: meeting.meetingType || 'Unknown',
    format: 'Unknown',
    state: meeting.state || 'Unknown',
    region: meeting.region || 'Unknown',
    url: null
  };

  const formatDate = (date) => {
    if (!date) return 'Not available';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`source-panel-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`source-detail-panel ${isOpen ? 'open' : ''}`}>
        <div className="source-panel-header">
          <div className="source-panel-title">
            <h3>Source Details</h3>
            <span className="source-badge-type">{sourceInfo.type}</span>
          </div>
          <button className="source-panel-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="source-panel-body">
          {/* Source Feed Section */}
          <div className="source-section">
            <h4>Feed Information</h4>
            <div className="source-info-card">
              <div className="source-feed-name">{sourceFeed}</div>
              <div className="source-feed-badges">
                <span className={`source-type-badge ${sourceInfo.type.toLowerCase()}`}>
                  {sourceInfo.type}
                </span>
                <span className="source-format-badge">
                  {sourceInfo.format}
                </span>
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="source-section">
            <h4>Coverage Area</h4>
            <div className="source-detail-row">
              <span className="source-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <div className="source-detail-content">
                <span className="source-detail-label">Region</span>
                <span className="source-detail-value">{sourceInfo.region}</span>
              </div>
            </div>
            <div className="source-detail-row">
              <span className="source-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                  <line x1="8" y1="2" x2="8" y2="18"/>
                  <line x1="16" y1="6" x2="16" y2="22"/>
                </svg>
              </span>
              <div className="source-detail-content">
                <span className="source-detail-label">State</span>
                <span className="source-detail-value">
                  {stateNames[sourceInfo.state] || sourceInfo.state} ({sourceInfo.state})
                </span>
              </div>
            </div>
          </div>

          {/* Technical Details Section */}
          <div className="source-section">
            <h4>Technical Details</h4>
            <div className="source-detail-row">
              <span className="source-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </span>
              <div className="source-detail-content">
                <span className="source-detail-label">API Format</span>
                <span className="source-detail-value">
                  {sourceInfo.format === 'TSML' ? 'TSML (12 Step Meeting List)' :
                   sourceInfo.format === 'BMLT' ? 'BMLT (Basic Meeting List Toolkit)' :
                   sourceInfo.format}
                </span>
              </div>
            </div>
            <div className="source-detail-row">
              <span className="source-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8M12 17v4"/>
                </svg>
              </span>
              <div className="source-detail-content">
                <span className="source-detail-label">Source Type</span>
                <span className="source-detail-value">{meeting.sourceType || 'web_scraper'}</span>
              </div>
            </div>
            {sourceInfo.url && (
              <div className="source-detail-row">
                <span className="source-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </span>
                <div className="source-detail-content">
                  <span className="source-detail-label">Website</span>
                  <a
                    href={sourceInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-detail-link"
                  >
                    {sourceInfo.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Timestamps Section */}
          <div className="source-section">
            <h4>Data Timestamps</h4>
            {meeting.scrapedAt && (
              <div className="source-detail-row">
                <span className="source-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </span>
                <div className="source-detail-content">
                  <span className="source-detail-label">Scraped At</span>
                  <span className="source-detail-value">{formatDate(meeting.scrapedAt?.iso || meeting.scrapedAt)}</span>
                </div>
              </div>
            )}
            {meeting.updatedAt && (
              <div className="source-detail-row">
                <span className="source-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                </span>
                <div className="source-detail-content">
                  <span className="source-detail-label">Last Updated (at source)</span>
                  <span className="source-detail-value">{formatDate(meeting.updatedAt?.iso || meeting.updatedAt)}</span>
                </div>
              </div>
            )}
            {meeting.foundedDate && (
              <div className="source-detail-row">
                <span className="source-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                </span>
                <div className="source-detail-content">
                  <span className="source-detail-label">Meeting Founded</span>
                  <span className="source-detail-value">{formatDate(meeting.foundedDate?.iso || meeting.foundedDate)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Source URLs Section */}
          {(meeting.meetingUrl || meeting.locationUrl || meeting.editUrl) && (
            <div className="source-section">
              <h4>Source Links</h4>
              {meeting.meetingUrl && (
                <div className="source-detail-row">
                  <span className="source-detail-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15,3 21,3 21,9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </span>
                  <div className="source-detail-content">
                    <span className="source-detail-label">Meeting Page</span>
                    <a
                      href={meeting.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-detail-link"
                    >
                      View on source website
                    </a>
                  </div>
                </div>
              )}
              {meeting.locationUrl && (
                <div className="source-detail-row">
                  <span className="source-detail-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </span>
                  <div className="source-detail-content">
                    <span className="source-detail-label">Location Info</span>
                    <a
                      href={meeting.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-detail-link"
                    >
                      View location details
                    </a>
                  </div>
                </div>
              )}
              {meeting.editUrl && (
                <div className="source-detail-row">
                  <span className="source-detail-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </span>
                  <div className="source-detail-content">
                    <span className="source-detail-label">Edit Meeting</span>
                    <a
                      href={meeting.editUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-detail-link"
                    >
                      Suggest corrections
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Additional Info Section */}
          {(meeting.approximate || (meeting.feedbackEmails && meeting.feedbackEmails.length > 0)) && (
            <div className="source-section">
              <h4>Additional Information</h4>
              {meeting.approximate && (
                <div className="source-detail-row source-warning">
                  <span className="source-detail-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </span>
                  <div className="source-detail-content">
                    <span className="source-detail-label">Address Accuracy</span>
                    <span className="source-detail-value source-approximate">
                      Approximate location (not exact address)
                    </span>
                  </div>
                </div>
              )}
              {meeting.feedbackEmails && meeting.feedbackEmails.length > 0 && (
                <div className="source-detail-row">
                  <span className="source-detail-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <div className="source-detail-content">
                    <span className="source-detail-label">Report Issues To</span>
                    <div className="source-feedback-emails">
                      {meeting.feedbackEmails.map((email, idx) => (
                        <a
                          key={idx}
                          href={`mailto:${email}`}
                          className="source-detail-link"
                        >
                          {email}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Quality Indicators */}
          <div className="source-section source-quality">
            <h4>Data Quality</h4>
            <div className="source-quality-grid">
              <div className="source-quality-item">
                <span className={`quality-indicator ${meeting.latitude && meeting.longitude ? 'good' : 'missing'}`}></span>
                <span className="quality-label">Coordinates</span>
              </div>
              <div className="source-quality-item">
                <span className={`quality-indicator ${meeting.address ? 'good' : 'missing'}`}></span>
                <span className="quality-label">Address</span>
              </div>
              <div className="source-quality-item">
                <span className={`quality-indicator ${meeting.time ? 'good' : 'missing'}`}></span>
                <span className="quality-label">Time</span>
              </div>
              <div className="source-quality-item">
                <span className={`quality-indicator ${meeting.types && meeting.types.length > 0 ? 'good' : 'missing'}`}></span>
                <span className="quality-label">Meeting Types</span>
              </div>
              <div className="source-quality-item">
                <span className={`quality-indicator ${meeting.locationName ? 'good' : 'missing'}`}></span>
                <span className="quality-label">Venue Name</span>
              </div>
              <div className="source-quality-item">
                <span className={`quality-indicator ${meeting.notes || meeting.locationNotes ? 'good' : 'missing'}`}></span>
                <span className="quality-label">Notes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SourceDetailPanel;
