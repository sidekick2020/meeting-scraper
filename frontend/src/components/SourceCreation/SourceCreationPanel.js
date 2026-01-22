import React, { useState } from 'react';
import SourceWizard from './SourceWizard';

// State abbreviation to full name mapping
const stateNames = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia"
};

// Placeholder data for coverage gaps
const MOCK_COVERAGE_GAPS = [
  { state: 'WY', stateName: 'Wyoming', meetingCount: 45, population: 580000, hasSource: false },
  { state: 'MT', stateName: 'Montana', meetingCount: 120, population: 1085000, hasSource: false },
  { state: 'SD', stateName: 'South Dakota', meetingCount: 85, population: 895000, hasSource: false },
  { state: 'ND', stateName: 'North Dakota', meetingCount: 65, population: 775000, hasSource: false },
  { state: 'VT', stateName: 'Vermont', meetingCount: 95, population: 645000, hasSource: false },
  { state: 'ME', stateName: 'Maine', meetingCount: 180, population: 1360000, hasSource: true },
  { state: 'WV', stateName: 'West Virginia', meetingCount: 150, population: 1780000, hasSource: true },
  { state: 'ID', stateName: 'Idaho', meetingCount: 110, population: 1900000, hasSource: false },
];

// Placeholder data for sessions
const MOCK_SESSIONS = [
  {
    id: 1,
    state: 'CO',
    stateName: 'Colorado',
    status: 'testing',
    sourceName: 'Colorado AA Intergroup',
    sourceUrl: 'https://coloradoaa.org/meetings',
    createdAt: '2024-01-20T10:30:00Z',
    testedUrls: 3,
    workingUrls: 1
  },
  {
    id: 2,
    state: 'NM',
    stateName: 'New Mexico',
    status: 'discovering',
    sourceName: '',
    sourceUrl: '',
    createdAt: '2024-01-19T14:00:00Z',
    testedUrls: 0,
    workingUrls: 0
  },
];

// Placeholder data for history
const MOCK_HISTORY = [
  {
    id: 1,
    state: 'AZ',
    stateName: 'Arizona',
    sourceName: 'Phoenix AA Intergroup',
    status: 'completed',
    completedAt: '2024-01-18T16:45:00Z',
    meetingsFound: 847
  },
  {
    id: 2,
    state: 'TX',
    stateName: 'Texas',
    sourceName: 'Houston Intergroup',
    status: 'completed',
    completedAt: '2024-01-15T09:20:00Z',
    meetingsFound: 1203
  },
  {
    id: 3,
    state: 'FL',
    stateName: 'Florida',
    sourceName: 'Miami Area Intergroup',
    status: 'submitted',
    completedAt: '2024-01-14T11:30:00Z',
    meetingsFound: 956
  },
];

function SourceCreationPanel() {
  const [activeTab, setActiveTab] = useState('gaps'); // gaps | sessions | history
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  // Placeholder state - will be replaced with real data later
  const [coverageGaps] = useState(MOCK_COVERAGE_GAPS);
  const [sessions] = useState(MOCK_SESSIONS);
  const [history] = useState(MOCK_HISTORY);

  // Start new session from a coverage gap
  const handleStartFromGap = (gap) => {
    setSelectedState(gap.state);
    setSelectedSession(null);
    setWizardOpen(true);
  };

  // Resume an existing session
  const handleResumeSession = (session) => {
    setSelectedSession(session);
    setSelectedState(session.state);
    setWizardOpen(true);
  };

  // Start fresh (manual state selection)
  const handleStartFresh = () => {
    setSelectedState(null);
    setSelectedSession(null);
    setWizardOpen(true);
  };

  // Close wizard
  const handleCloseWizard = () => {
    setWizardOpen(false);
    setSelectedState(null);
    setSelectedSession(null);
  };

  // Handle wizard completion
  const handleWizardComplete = (result) => {
    console.log('Source creation completed:', result);
    handleCloseWizard();
    // TODO: Refresh data, show success message
  };

  const renderGapsTab = () => (
    <div className="source-creation-gaps">
      <div className="gaps-header">
        <div className="gaps-header-left">
          <h3>Coverage Gaps</h3>
          <p className="gaps-subtitle">
            States with low meeting coverage or missing data sources
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleStartFresh}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Source Manually
        </button>
      </div>

      {coverageGaps.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22,4 12,14.01 9,11.01"/>
          </svg>
          <p>Great coverage! No major gaps detected.</p>
        </div>
      ) : (
        <div className="coverage-gaps-grid">
          {coverageGaps.map((gap) => (
            <div
              key={gap.state}
              className={`coverage-gap-card ${gap.hasSource ? 'has-source' : 'no-source'}`}
            >
              <div className="gap-card-header">
                <span className="gap-state-badge">{gap.state}</span>
                <span className="gap-state-name">{gap.stateName}</span>
              </div>
              <div className="gap-card-stats">
                <div className="gap-stat">
                  <span className="gap-stat-value">{gap.meetingCount}</span>
                  <span className="gap-stat-label">meetings</span>
                </div>
                <div className="gap-stat">
                  <span className="gap-stat-value">{(gap.population / 1000000).toFixed(1)}M</span>
                  <span className="gap-stat-label">population</span>
                </div>
              </div>
              <div className="gap-card-footer">
                {gap.hasSource ? (
                  <span className="gap-status has-source">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8v4M12 16h.01"/>
                    </svg>
                    Partial coverage
                  </span>
                ) : (
                  <span className="gap-status no-source">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    No source
                  </span>
                )}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleStartFromGap(gap)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                  Find Source
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSessionsTab = () => (
    <div className="source-creation-sessions">
      <div className="sessions-header">
        <h3>Active Sessions</h3>
        <p className="sessions-subtitle">
          Continue where you left off
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>No active sessions. Start from a coverage gap to begin.</p>
        </div>
      ) : (
        <div className="sessions-list">
          {sessions.map((session) => (
            <div key={session.id} className="session-card">
              <div className="session-card-header">
                <div className="session-state">
                  <span className="session-state-badge">{session.state}</span>
                  <span className="session-state-name">{session.stateName}</span>
                </div>
                <span className={`session-status-badge status-${session.status}`}>
                  {session.status === 'discovering' && 'Discovering'}
                  {session.status === 'testing' && 'Testing'}
                  {session.status === 'ready' && 'Ready to Save'}
                </span>
              </div>

              {session.sourceName && (
                <div className="session-source-info">
                  <span className="session-source-name">{session.sourceName}</span>
                  {session.sourceUrl && (
                    <span className="session-source-url">{session.sourceUrl}</span>
                  )}
                </div>
              )}

              <div className="session-card-stats">
                <span className="session-stat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 21l-4.35-4.35"/>
                    <circle cx="11" cy="11" r="8"/>
                  </svg>
                  {session.testedUrls} tested
                </span>
                <span className="session-stat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  {session.workingUrls} working
                </span>
                <span className="session-stat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {new Date(session.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="session-card-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleResumeSession(session)}
                >
                  Continue
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                <button className="btn btn-ghost btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="source-creation-history">
      <div className="history-header">
        <h3>Completed</h3>
        <p className="history-subtitle">
          Sources you've added or submitted for review
        </p>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <p>No completed sources yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <div key={item.id} className="history-card">
              <div className="history-card-header">
                <div className="history-state">
                  <span className="history-state-badge">{item.state}</span>
                  <span className="history-source-name">{item.sourceName}</span>
                </div>
                <span className={`history-status-badge status-${item.status}`}>
                  {item.status === 'completed' && (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                        <polyline points="22,4 12,14.01 9,11.01"/>
                      </svg>
                      Added
                    </>
                  )}
                  {item.status === 'submitted' && (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      Pending Review
                    </>
                  )}
                </span>
              </div>
              <div className="history-card-stats">
                <span className="history-stat">
                  <strong>{item.meetingsFound.toLocaleString()}</strong> meetings
                </span>
                <span className="history-stat">
                  {new Date(item.completedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="source-creation-panel">
      <div className="source-creation-header">
        <div className="header-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <path d="M11 8v6M8 11h6"/>
          </svg>
          <h2>Add Meeting Sources</h2>
        </div>
      </div>

      <div className="source-creation-tabs">
        <button
          className={`tab-btn ${activeTab === 'gaps' ? 'active' : ''}`}
          onClick={() => setActiveTab('gaps')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18"/>
            <path d="M18 17V9"/>
            <path d="M13 17V5"/>
            <path d="M8 17v-3"/>
          </svg>
          Coverage Gaps
          {coverageGaps.length > 0 && (
            <span className="tab-badge">{coverageGaps.length}</span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Active Sessions
          {sessions.length > 0 && (
            <span className="tab-badge">{sessions.length}</span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22,4 12,14.01 9,11.01"/>
          </svg>
          Completed
          {history.length > 0 && (
            <span className="tab-badge">{history.length}</span>
          )}
        </button>
      </div>

      <div className="source-creation-content">
        {activeTab === 'gaps' && renderGapsTab()}
        {activeTab === 'sessions' && renderSessionsTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>

      {/* Source Creation Wizard Sidebar */}
      <SourceWizard
        isOpen={wizardOpen}
        onClose={handleCloseWizard}
        onComplete={handleWizardComplete}
        initialState={selectedState}
        existingSession={selectedSession}
      />
    </div>
  );
}

export default SourceCreationPanel;
