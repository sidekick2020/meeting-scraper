import React from 'react';

// Source feed metadata - maps feed names to their details
const feedMetadata = {
  // AA Feeds (TSML format)
  "Palo Alto (Bay Area)": { type: "AA", format: "TSML", state: "CA", region: "Bay Area", url: "https://sheets.code4recovery.org/storage/12Ga8uwMG4WJ8pZ_SEU7vNETp_aQZ-2yNVsYDFqIwHyE.json", description: "Covers AA meetings in the Palo Alto and greater Bay Area region of California." },
  "San Diego": { type: "AA", format: "TSML", state: "CA", region: "San Diego County", url: "https://aasandiego.org", description: "San Diego County AA meetings and groups." },
  "Phoenix": { type: "AA", format: "TSML", state: "AZ", region: "Maricopa County", url: "https://aaphoenix.org", description: "Phoenix metro area AA meetings in Maricopa County." },
  "Birmingham AA": { type: "AA", format: "TSML", state: "AL", region: "Birmingham", url: "https://birminghamaa.org", description: "Birmingham and surrounding area AA meetings in Alabama." },
  "West Alabama AA": { type: "AA", format: "TSML", state: "AL", region: "West Alabama", url: "https://westalaa.org", description: "Western Alabama AA meetings and groups." },
  "Richmond AA": { type: "AA", format: "TSML", state: "VA", region: "Richmond", url: "https://www.aarichmond.org", description: "Richmond and central Virginia AA meetings." },
  "Blue Ridge AA": { type: "AA", format: "TSML", state: "VA", region: "Blue Ridge", url: "https://aablueridge.org", description: "Blue Ridge mountain region AA meetings in Virginia." },
  "Eastside AA (Seattle)": { type: "AA", format: "TSML", state: "WA", region: "Seattle Eastside", url: "https://www.eastsideaa.org", description: "Seattle Eastside AA meetings in Washington state." },
  "Indianapolis AA": { type: "AA", format: "TSML", state: "IN", region: "Indianapolis", url: "https://indyaa.org", description: "Indianapolis area AA meetings in Indiana." },
  "Houston AA": { type: "AA", format: "TSML", state: "TX", region: "Houston", url: "https://aahouston.org", description: "Houston metro area AA meetings in Texas." },
  "Austin AA": { type: "AA", format: "TSML", state: "TX", region: "Austin", url: "https://www.austinaa.org", description: "Austin area AA meetings in Texas." },
  "Atlanta AA": { type: "AA", format: "TSML", state: "GA", region: "Atlanta", url: "https://atlantaaa.org", description: "Atlanta metro area AA meetings in Georgia." },
  "Boulder AA": { type: "AA", format: "TSML", state: "CO", region: "Boulder County", url: "https://www.bouldercountyaa.com", description: "Boulder County AA meetings in Colorado." },
  // NA Feeds (BMLT format)
  "Alabama NA": { type: "NA", format: "BMLT", state: "AL", region: "Alabama", url: "https://bmlt.sezf.org", description: "Narcotics Anonymous meetings across Alabama." },
  "Missouri NA": { type: "NA", format: "BMLT", state: "MO", region: "Missouri", url: "https://missourina.org", description: "Narcotics Anonymous meetings across Missouri." },
};

// State full names
const stateNames = {
  CA: "California", AZ: "Arizona", AL: "Alabama", VA: "Virginia",
  WA: "Washington", IN: "Indiana", TX: "Texas", GA: "Georgia",
  CO: "Colorado", MO: "Missouri"
};

function FeedDetailPanel({ feed, isOpen, onClose }) {
  if (!feed) return null;

  const feedName = feed.name;
  const metadata = feedMetadata[feedName] || {
    type: feed.type || 'Unknown',
    format: feed.format || 'Unknown',
    state: feed.state || 'Unknown',
    region: feed.region || 'Unknown',
    url: feed.url || null,
    description: null
  };

  // Merge feed data with metadata
  const sourceInfo = {
    ...metadata,
    type: metadata.type || feed.type || 'Unknown',
    state: metadata.state || feed.state || 'Unknown',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`feed-panel-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`feed-detail-panel ${isOpen ? 'open' : ''}`}>
        <div className="feed-panel-header">
          <div className="feed-panel-title">
            <h3>{feedName}</h3>
            <span className={`feed-badge-type ${sourceInfo.type.toLowerCase()}`}>{sourceInfo.type}</span>
          </div>
          <button className="feed-panel-close" onClick={onClose} aria-label="Close panel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="feed-panel-body">
          {/* Status Section */}
          <div className="feed-section">
            <div className="feed-status-card">
              <span className="feed-status-indicator active"></span>
              <span className="feed-status-text">Active</span>
              <span className="feed-status-description">This source is enabled and will be scraped</span>
            </div>
          </div>

          {/* Description Section */}
          {sourceInfo.description && (
            <div className="feed-section">
              <h4>About This Source</h4>
              <p className="feed-description">{sourceInfo.description}</p>
            </div>
          )}

          {/* Coverage Area Section */}
          <div className="feed-section">
            <h4>Coverage Area</h4>
            <div className="feed-detail-row">
              <span className="feed-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <div className="feed-detail-content">
                <span className="feed-detail-label">Region</span>
                <span className="feed-detail-value">{sourceInfo.region}</span>
              </div>
            </div>
            <div className="feed-detail-row">
              <span className="feed-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                  <line x1="8" y1="2" x2="8" y2="18"/>
                  <line x1="16" y1="6" x2="16" y2="22"/>
                </svg>
              </span>
              <div className="feed-detail-content">
                <span className="feed-detail-label">State</span>
                <span className="feed-detail-value">
                  {stateNames[sourceInfo.state] || sourceInfo.state} ({sourceInfo.state})
                </span>
              </div>
            </div>
          </div>

          {/* Technical Details Section */}
          <div className="feed-section">
            <h4>Technical Details</h4>
            <div className="feed-detail-row">
              <span className="feed-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </span>
              <div className="feed-detail-content">
                <span className="feed-detail-label">Data Format</span>
                <span className="feed-detail-value">
                  {sourceInfo.format === 'TSML' ? 'TSML (12 Step Meeting List)' :
                   sourceInfo.format === 'BMLT' ? 'BMLT (Basic Meeting List Toolkit)' :
                   sourceInfo.format}
                </span>
              </div>
            </div>
            <div className="feed-detail-row">
              <span className="feed-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </span>
              <div className="feed-detail-content">
                <span className="feed-detail-label">Meeting Type</span>
                <span className="feed-detail-value">
                  {sourceInfo.type === 'AA' ? 'Alcoholics Anonymous' :
                   sourceInfo.type === 'NA' ? 'Narcotics Anonymous' :
                   sourceInfo.type}
                </span>
              </div>
            </div>
            {sourceInfo.url && (
              <div className="feed-detail-row">
                <span className="feed-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </span>
                <div className="feed-detail-content">
                  <span className="feed-detail-label">Source Website</span>
                  <a
                    href={sourceInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="feed-detail-link"
                  >
                    {sourceInfo.url.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 40)}
                    {sourceInfo.url.length > 50 ? '...' : ''}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15,3 21,3 21,9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Format Information Section */}
          <div className="feed-section">
            <h4>About {sourceInfo.format} Format</h4>
            <div className="feed-format-info">
              {sourceInfo.format === 'TSML' ? (
                <>
                  <p>
                    <strong>TSML (12 Step Meeting List)</strong> is a standardized JSON format
                    used by many AA intergroups and central offices to share meeting data.
                  </p>
                  <ul className="feed-format-features">
                    <li>Standardized meeting data structure</li>
                    <li>Includes meeting types and formats</li>
                    <li>Geographic coordinates when available</li>
                    <li>Online/hybrid meeting support</li>
                  </ul>
                </>
              ) : sourceInfo.format === 'BMLT' ? (
                <>
                  <p>
                    <strong>BMLT (Basic Meeting List Toolkit)</strong> is an open-source
                    meeting list server used primarily by NA service bodies.
                  </p>
                  <ul className="feed-format-features">
                    <li>REST API for meeting queries</li>
                    <li>Supports geographic searches</li>
                    <li>Real-time data updates</li>
                    <li>Multi-language support</li>
                  </ul>
                </>
              ) : (
                <p>Custom data format specific to this source.</p>
              )}
            </div>
          </div>

          {/* Actions Section */}
          <div className="feed-section feed-actions-section">
            <h4>Actions</h4>
            <div className="feed-actions">
              {sourceInfo.url && (
                <a
                  href={sourceInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feed-action-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  Visit Source Website
                </a>
              )}
              <button className="feed-action-btn feed-action-secondary" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18"/>
                  <path d="M9 21V9"/>
                </svg>
                View Scrape History
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default FeedDetailPanel;
