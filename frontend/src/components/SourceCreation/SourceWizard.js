import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

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

const allStates = Object.keys(stateNames).sort();

// Wizard steps
const STEPS = [
  { id: 'discover', label: 'Discover', icon: 'search' },
  { id: 'test', label: 'Test', icon: 'play' },
  { id: 'review', label: 'Review', icon: 'check' },
  { id: 'save', label: 'Save', icon: 'save' }
];

// Mock intergroups for discovery
const MOCK_INTERGROUPS = {
  known: [
    { name: 'Denver Area Intergroup', domain: 'daccaa.org', type: 'tsml' },
    { name: 'Colorado Springs Intergroup', domain: 'coloradospringsaa.org', type: 'tsml' },
  ],
  generated: [
    { name: 'Boulder County AA', domain: 'bouldercountyaa.org', type: 'unknown' },
    { name: 'Fort Collins AA', domain: 'fortcollinsaa.org', type: 'unknown' },
  ]
};

function SourceWizard({ isOpen, onClose, onComplete, initialState, existingSession }) {
  // Current step
  const [currentStep, setCurrentStep] = useState('discover');

  // Form state
  const [selectedState, setSelectedState] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [feedType, setFeedType] = useState('auto');

  // Discovery state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryNotes, setDiscoveryNotes] = useState([]);
  const [intergroups, setIntergroups] = useState({ known: [], generated: [] });

  // Testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [attemptHistory, setAttemptHistory] = useState([]);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize from props
  useEffect(() => {
    if (isOpen) {
      if (initialState) {
        setSelectedState(initialState);
      }
      if (existingSession) {
        setSelectedState(existingSession.state);
        setSourceName(existingSession.sourceName || '');
        setSourceUrl(existingSession.sourceUrl || '');
        setCurrentStep(existingSession.status === 'testing' ? 'test' : 'discover');
      }
    }
  }, [isOpen, initialState, existingSession]);

  // Reset state when closing
  const handleClose = () => {
    setCurrentStep('discover');
    setSelectedState('');
    setSourceName('');
    setSourceUrl('');
    setFeedType('auto');
    setIsDiscovering(false);
    setDiscoveryNotes([]);
    setIntergroups({ known: [], generated: [] });
    setIsTesting(false);
    setTestResults(null);
    setAttemptHistory([]);
    setIsSaving(false);
    setSaveSuccess(false);
    onClose();
  };

  // Run discovery - calls real API endpoint
  const runDiscovery = async () => {
    if (!selectedState) return;

    setIsDiscovering(true);
    setDiscoveryNotes([]);
    setIntergroups({ known: [], generated: [] });

    // Add initial discovery note
    setDiscoveryNotes([`Searching for AA intergroups in ${stateNames[selectedState]}...`]);

    try {
      // Call the discover API
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: selectedState })
      });

      const data = await response.json();

      if (data.success) {
        const notes = [`Searching for AA intergroups in ${stateNames[selectedState]}...`];

        // Add notes about what was found
        if (data.known && data.known.length > 0) {
          notes.push(`Found ${data.known.length} known intergroup(s) for ${data.stateName}`);
          for (const ig of data.known) {
            notes.push(`→ ${ig.name} (${ig.domain})`);
          }
        }

        if (data.generated && data.generated.length > 0) {
          notes.push(`Generated ${data.generated.length} potential domain pattern(s)`);
          for (const ig of data.generated) {
            notes.push(`→ Checking ${ig.domain}...`);
          }
        }

        notes.push(`Discovery complete! Found ${data.total} potential source(s)`);
        setDiscoveryNotes(notes);

        // Set real results
        setIntergroups({
          known: data.known || [],
          generated: data.generated || []
        });
      } else {
        setDiscoveryNotes(prev => [...prev, `Error: ${data.error || 'Discovery failed'}`]);
      }
    } catch (error) {
      console.error('Discovery error:', error);
      setDiscoveryNotes(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Placeholder: Select an intergroup
  const selectIntergroup = (ig) => {
    setSourceName(ig.name);
    setSourceUrl(`https://${ig.domain}/wp-admin/admin-ajax.php?action=meetings`);
    setFeedType(ig.type === 'tsml' ? 'tsml' : 'auto');
    setCurrentStep('test');
  };

  // Skip to manual entry
  const skipToManualEntry = () => {
    setSourceName('');
    setSourceUrl('');
    setFeedType('auto');
    setCurrentStep('test');
  };

  // Placeholder: Test source
  const testSource = async () => {
    if (!sourceUrl) return;

    setIsTesting(true);
    setTestResults(null);

    // Simulate testing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockResults = {
      success: true,
      totalMeetings: 847,
      feedType: 'tsml',
      stateBreakdown: { CO: 820, WY: 15, NM: 12 },
      sampleMeetings: [
        { name: 'Happy Hour Group', city: 'Denver', state: 'CO', day: 1, time: '17:30' },
        { name: 'Sunrise Serenity', city: 'Boulder', state: 'CO', day: 0, time: '07:00' },
        { name: 'Downtown Noon Meeting', city: 'Denver', state: 'CO', day: 3, time: '12:00' },
      ],
      generatedScript: `# Auto-generated scraper for ${sourceName}\nimport requests\n\nurl = "${sourceUrl}"\nresponse = requests.get(url)\nmeetings = response.json()\nprint(f"Found {len(meetings)} meetings")`
    };

    setTestResults(mockResults);
    setAttemptHistory(prev => [...prev, {
      id: Date.now(),
      url: sourceUrl,
      success: true,
      totalMeetings: 847,
      timestamp: new Date().toISOString()
    }]);
    setIsTesting(false);

    if (mockResults.success) {
      setCurrentStep('review');
    }
  };

  // Placeholder: Save source
  const saveSource = async (submitForReview = false) => {
    setIsSaving(true);

    // Simulate saving
    await new Promise(resolve => setTimeout(resolve, 1500));

    setSaveSuccess(true);
    setIsSaving(false);

    setTimeout(() => {
      onComplete({
        state: selectedState,
        name: sourceName,
        url: sourceUrl,
        feedType,
        submitted: submitForReview
      });
    }, 1000);
  };

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 'discover':
        return selectedState && (intergroups.known.length > 0 || intergroups.generated.length > 0);
      case 'test':
        return testResults?.success;
      case 'review':
        return testResults?.success && sourceName && sourceUrl;
      default:
        return false;
    }
  };

  const goToStep = (stepId) => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    const targetIndex = STEPS.findIndex(s => s.id === stepId);
    // Only allow going back, or going forward if current step is complete
    if (targetIndex < currentIndex || canGoNext()) {
      setCurrentStep(stepId);
    }
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="wizard-steps">
      {STEPS.map((step, index) => {
        const currentIndex = STEPS.findIndex(s => s.id === currentStep);
        const isActive = step.id === currentStep;
        const isComplete = index < currentIndex;
        const isClickable = index <= currentIndex || canGoNext();

        return (
          <button
            key={step.id}
            className={`wizard-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
            onClick={() => isClickable && goToStep(step.id)}
            disabled={!isClickable}
          >
            <span className="step-number">
              {isComplete ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className="step-label">{step.label}</span>
          </button>
        );
      })}
    </div>
  );

  // Render Discover step
  const renderDiscoverStep = () => (
    <div className="wizard-step-content discover-step">
      <div className="step-header">
        <h3>Discover Meeting Sources</h3>
        <p>Search for AA intergroup websites in your target state</p>
      </div>

      <div className="state-selector">
        <label>Select State</label>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          disabled={isDiscovering}
        >
          <option value="">Choose a state...</option>
          {allStates.map(code => (
            <option key={code} value={code}>
              {code} - {stateNames[code]}
            </option>
          ))}
        </select>
      </div>

      <button
        className="btn btn-primary discover-btn"
        onClick={runDiscovery}
        disabled={!selectedState || isDiscovering}
      >
        {isDiscovering ? (
          <>
            <span className="btn-spinner"></span>
            Discovering...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            Discover Sources
          </>
        )}
      </button>

      {/* Discovery Notes */}
      {discoveryNotes.length > 0 && (
        <div className="discovery-notes">
          <div className="discovery-notes-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            <span>Discovery Log</span>
          </div>
          <div className="discovery-notes-list">
            {discoveryNotes.map((note, index) => (
              <div
                key={index}
                className={`discovery-note ${note.includes('SUCCESS') ? 'success' : note.includes('Error') ? 'error' : ''}`}
              >
                <span className="note-bullet">
                  {note.includes('SUCCESS') ? '✓' : note.includes('Checking') || note.includes('Testing') ? '→' : '•'}
                </span>
                <span className="note-text">{note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovered Intergroups */}
      {(intergroups.known.length > 0 || intergroups.generated.length > 0) && (
        <div className="discovered-intergroups">
          {intergroups.known.length > 0 && (
            <div className="intergroups-section">
              <h4>Known Intergroups</h4>
              <div className="intergroups-list">
                {intergroups.known.map((ig, index) => (
                  <div key={index} className="intergroup-item">
                    <div className="intergroup-info">
                      <span className="intergroup-name">{ig.name}</span>
                      <span className="intergroup-domain">{ig.domain}</span>
                    </div>
                    <div className="intergroup-actions">
                      <span className={`intergroup-type type-${ig.type}`}>{ig.type.toUpperCase()}</span>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => selectIntergroup(ig)}
                      >
                        Use This
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {intergroups.generated.length > 0 && (
            <div className="intergroups-section">
              <h4>Suggested Patterns</h4>
              <div className="intergroups-list">
                {intergroups.generated.map((ig, index) => (
                  <div key={index} className="intergroup-item generated">
                    <div className="intergroup-info">
                      <span className="intergroup-name">{ig.name}</span>
                      <span className="intergroup-domain">{ig.domain}</span>
                    </div>
                    <div className="intergroup-actions">
                      <span className="intergroup-type type-unknown">Unverified</span>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => selectIntergroup(ig)}
                      >
                        Try
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Option */}
      <div className="manual-entry-section">
        <div className="manual-entry-divider">
          <span>or</span>
        </div>
        <button
          className="btn btn-ghost manual-entry-btn"
          onClick={skipToManualEntry}
          disabled={!selectedState || isDiscovering}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Enter Source Details Manually
        </button>
        <p className="manual-entry-hint">
          Already have a feed URL? Skip discovery and enter the details directly.
        </p>
      </div>
    </div>
  );

  // Render Test step
  const renderTestStep = () => (
    <div className="wizard-step-content test-step">
      <div className="step-header">
        <h3>Test Meeting Source</h3>
        <p>Verify the feed URL returns valid meeting data</p>
      </div>

      <div className="source-form">
        <div className="form-group">
          <label>Source Name</label>
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="e.g., Denver Area Intergroup"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>State</label>
            <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
              {allStates.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Feed Type</label>
            <select value={feedType} onChange={(e) => setFeedType(e.target.value)}>
              <option value="auto">Auto-detect</option>
              <option value="tsml">TSML (AA)</option>
              <option value="bmlt">BMLT (NA)</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Feed URL</label>
          <input
            type="text"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.org/wp-admin/admin-ajax.php?action=meetings"
          />
          <span className="form-hint">
            TSML: /wp-admin/admin-ajax.php?action=meetings | BMLT: /main_server/client_interface/json/
          </span>
        </div>
      </div>

      <div className="test-actions">
        <button
          className="btn btn-primary"
          onClick={testSource}
          disabled={!sourceUrl || isTesting}
        >
          {isTesting ? (
            <>
              <span className="btn-spinner"></span>
              Testing...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Test Source
            </>
          )}
        </button>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className={`test-results-card ${testResults.success ? 'success' : 'error'}`}>
          {testResults.success ? (
            <>
              <div className="test-results-header success">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
                <span>Found {testResults.totalMeetings} meetings</span>
              </div>

              <div className="test-details">
                <div className="test-detail-row">
                  <span className="test-detail-label">Feed Type</span>
                  <span className="test-detail-value">{testResults.feedType?.toUpperCase()}</span>
                </div>

                {testResults.stateBreakdown && (
                  <div className="test-detail-row">
                    <span className="test-detail-label">States</span>
                    <div className="test-state-tags">
                      {Object.entries(testResults.stateBreakdown).map(([st, count]) => (
                        <span key={st} className="test-state-tag">{st}: {count}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {testResults.sampleMeetings && (
                <div className="test-sample-meetings">
                  <div className="test-detail-label">Sample Meetings</div>
                  <div className="sample-meetings-list">
                    {testResults.sampleMeetings.map((m, i) => (
                      <div key={i} className="sample-meeting">
                        <span className="sample-meeting-name">{m.name}</span>
                        <span className="sample-meeting-location">{m.city}, {m.state}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="test-results-header error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>Test Failed</span>
              </div>
              <div className="test-error-message">
                {testResults.error || 'Could not fetch meeting data from this URL'}
              </div>
            </>
          )}
        </div>
      )}

      {/* Attempt History */}
      {attemptHistory.length > 1 && (
        <div className="attempt-history">
          <details>
            <summary>Previous Attempts ({attemptHistory.length - 1})</summary>
            <div className="attempt-list">
              {attemptHistory.slice(0, -1).map((attempt) => (
                <div key={attempt.id} className={`attempt-item ${attempt.success ? 'success' : 'failed'}`}>
                  <span className="attempt-url">{attempt.url}</span>
                  <span className="attempt-result">
                    {attempt.success ? `${attempt.totalMeetings} meetings` : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );

  // Render Review step
  const renderReviewStep = () => (
    <div className="wizard-step-content review-step">
      <div className="step-header">
        <h3>Review Source</h3>
        <p>Confirm the details before saving</p>
      </div>

      <div className="review-summary">
        <div className="review-card">
          <div className="review-card-header">
            <span className="review-state-badge">{selectedState}</span>
            <span className="review-source-name">{sourceName}</span>
          </div>

          <div className="review-details">
            <div className="review-row">
              <span className="review-label">Feed URL</span>
              <span className="review-value url">{sourceUrl}</span>
            </div>
            <div className="review-row">
              <span className="review-label">Feed Type</span>
              <span className="review-value">{(testResults?.feedType || feedType).toUpperCase()}</span>
            </div>
            <div className="review-row">
              <span className="review-label">Meetings Found</span>
              <span className="review-value highlight">{testResults?.totalMeetings?.toLocaleString()}</span>
            </div>
            {testResults?.stateBreakdown && (
              <div className="review-row">
                <span className="review-label">Coverage</span>
                <span className="review-value">
                  {Object.keys(testResults.stateBreakdown).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Generated Script Preview */}
        {testResults?.generatedScript && (
          <div className="script-preview">
            <div className="script-preview-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              <span>Generated Script</span>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => navigator.clipboard.writeText(testResults.generatedScript)}
              >
                Copy
              </button>
            </div>
            <pre className="script-code">
              <code>{testResults.generatedScript}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );

  // Render Save step
  const renderSaveStep = () => (
    <div className="wizard-step-content save-step">
      {saveSuccess ? (
        <div className="save-success">
          <div className="success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22,4 12,14.01 9,11.01"/>
            </svg>
          </div>
          <h3>Source Added Successfully!</h3>
          <p>The meeting source has been saved and will be included in the next scrape.</p>
        </div>
      ) : (
        <>
          <div className="step-header">
            <h3>Save Source</h3>
            <p>Choose how to add this source</p>
          </div>

          <div className="save-options">
            <button
              className="save-option-card"
              onClick={() => saveSource(false)}
              disabled={isSaving}
            >
              <div className="save-option-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                  <polyline points="17,21 17,13 7,13 7,21"/>
                  <polyline points="7,3 7,8 15,8"/>
                </svg>
              </div>
              <div className="save-option-content">
                <h4>Save to Sources</h4>
                <p>Add directly to the active sources list (admin only)</p>
              </div>
            </button>

            <button
              className="save-option-card secondary"
              onClick={() => saveSource(true)}
              disabled={isSaving}
            >
              <div className="save-option-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13"/>
                  <path d="M22 2L15 22l-4-9-9-4 20-7z"/>
                </svg>
              </div>
              <div className="save-option-content">
                <h4>Submit for Review</h4>
                <p>Send to admins for approval before adding</p>
              </div>
            </button>
          </div>

          {isSaving && (
            <div className="saving-indicator">
              <span className="btn-spinner"></span>
              <span>Saving source...</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="wizard-overlay" onClick={handleClose} />

      {/* Sidebar */}
      <div className="source-wizard">
        <div className="wizard-header">
          <div className="wizard-title">
            <h3>Add Meeting Source</h3>
            {selectedState && (
              <span className="wizard-state-badge">{selectedState}</span>
            )}
          </div>
          <button className="wizard-close" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {renderStepIndicator()}

        <div className="wizard-body">
          {currentStep === 'discover' && renderDiscoverStep()}
          {currentStep === 'test' && renderTestStep()}
          {currentStep === 'review' && renderReviewStep()}
          {currentStep === 'save' && renderSaveStep()}
        </div>

        {/* Footer with navigation */}
        {!saveSuccess && (
          <div className="wizard-footer">
            <button
              className="btn btn-ghost"
              onClick={() => {
                const currentIndex = STEPS.findIndex(s => s.id === currentStep);
                if (currentIndex > 0) {
                  setCurrentStep(STEPS[currentIndex - 1].id);
                } else {
                  handleClose();
                }
              }}
            >
              {currentStep === 'discover' ? 'Cancel' : 'Back'}
            </button>

            {currentStep !== 'save' && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  const currentIndex = STEPS.findIndex(s => s.id === currentStep);
                  if (currentIndex < STEPS.length - 1) {
                    setCurrentStep(STEPS[currentIndex + 1].id);
                  }
                }}
                disabled={!canGoNext()}
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default SourceWizard;
