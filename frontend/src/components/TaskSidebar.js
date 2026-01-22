import React, { useState, useEffect, useCallback } from 'react';

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

// All US state codes for dropdown
const allStates = Object.keys(stateNames).sort();

function TaskSidebar({ task, isOpen, onClose, onTaskUpdate, onSourceAdded }) {
  // Form state
  const [sourceName, setSourceName] = useState('');
  const [sourceState, setSourceState] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [feedType, setFeedType] = useState('auto');

  // Autofill/research state
  const [isResearching, setIsResearching] = useState(false);
  const [researchResults, setResearchResults] = useState(null);
  const [researchError, setResearchError] = useState(null);

  // Test scrape state
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [testAttempts, setTestAttempts] = useState(0);
  const [suggestions, setSuggestions] = useState([]);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form from task data when task changes
  useEffect(() => {
    if (task && isOpen) {
      // Pre-fill from task data
      const name = task.title?.replace(/^(Add |Research |Check |Find )/, '') || '';
      setSourceName(name);
      setSourceState(task.state || '');
      setSourceUrl(task.url || '');
      setFeedType('auto');

      // Reset states
      setTestResults(null);
      setResearchResults(null);
      setResearchError(null);
      setTestAttempts(0);
      setSuggestions([]);
      setSaveSuccess(false);

      // Auto-research on open if we have state info
      if (task.state && !task.url) {
        autoResearch();
      }
    }
  }, [task, isOpen]);

  // Auto-research function to find potential URLs
  const autoResearch = useCallback(async () => {
    if (!task) return;

    setIsResearching(true);
    setResearchError(null);
    setResearchResults(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/autofill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: task.state || sourceState,
          title: task.title,
          description: task.description,
          type: task.type
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResearchResults(data);

        // Auto-fill with first suggestion if available
        if (data.suggestions && data.suggestions.length > 0) {
          const firstSuggestion = data.suggestions[0];
          if (firstSuggestion.url && !sourceUrl) {
            setSourceUrl(firstSuggestion.url);
          }
          if (firstSuggestion.name && !sourceName) {
            setSourceName(firstSuggestion.name);
          }
          if (firstSuggestion.feedType) {
            setFeedType(firstSuggestion.feedType);
          }
        }
      } else {
        const error = await response.json();
        setResearchError(error.error || 'Research failed');
      }
    } catch (error) {
      console.error('Error during research:', error);
      setResearchError('Failed to research. Please enter details manually.');
    } finally {
      setIsResearching(false);
    }
  }, [task, sourceState, sourceUrl, sourceName]);

  // Test the source URL
  const testSource = async (retryWithAlternate = false) => {
    if (!sourceUrl.trim()) return;

    setIsTesting(true);
    setTestResults(null);
    setSuggestions([]);
    setTestAttempts(prev => prev + 1);

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/test-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          feedType: feedType,
          state: sourceState || 'XX',
          attempt: testAttempts + 1,
          retryWithAlternate
        })
      });

      const data = await response.json();
      setTestResults(data);

      // Update feed type if auto-detected
      if (data.feedType && feedType === 'auto') {
        setFeedType(data.feedType);
      }

      // Generate suggestions based on results
      if (data.success) {
        generateImprovementSuggestions(data);
      } else {
        generateFailureSuggestions(data);
      }
    } catch (error) {
      console.error('Error testing source:', error);
      setTestResults({
        success: false,
        error: 'Failed to test source. Please check the URL and try again.'
      });
      generateFailureSuggestions({ error: 'Network error' });
    } finally {
      setIsTesting(false);
    }
  };

  // Generate improvement suggestions for successful tests
  const generateImprovementSuggestions = (results) => {
    const newSuggestions = [];

    if (results.totalMeetings < 10) {
      newSuggestions.push({
        type: 'warning',
        message: 'Low meeting count. This might be a limited regional feed.',
        action: 'Consider searching for a statewide or larger regional feed.'
      });
    }

    if (results.stateBreakdown) {
      const states = Object.keys(results.stateBreakdown);
      if (states.length > 3) {
        newSuggestions.push({
          type: 'info',
          message: `This feed covers ${states.length} states: ${states.join(', ')}`,
          action: 'Consider if this is the right scope for your needs.'
        });
      }

      // Check if target state is included
      if (sourceState && !states.includes(sourceState)) {
        newSuggestions.push({
          type: 'warning',
          message: `Target state ${sourceState} not found in feed data.`,
          action: 'The meetings may be tagged with different state codes.'
        });
      }
    }

    if (results.fieldsFound) {
      const importantFields = ['name', 'address', 'city', 'day', 'time'];
      const missingFields = importantFields.filter(f => !results.fieldsFound.includes(f));
      if (missingFields.length > 0) {
        newSuggestions.push({
          type: 'warning',
          message: `Some expected fields are missing: ${missingFields.join(', ')}`,
          action: 'The feed may have non-standard field names.'
        });
      }
    }

    if (results.totalMeetings > 100) {
      newSuggestions.push({
        type: 'success',
        message: `Great! Found ${results.totalMeetings} meetings.`,
        action: 'This looks like a comprehensive source.'
      });
    }

    setSuggestions(newSuggestions);
  };

  // Generate suggestions for failed tests
  const generateFailureSuggestions = (results) => {
    const newSuggestions = [];

    if (results.error?.includes('timeout') || results.error?.includes('Timeout')) {
      newSuggestions.push({
        type: 'error',
        message: 'The server took too long to respond.',
        action: 'Try again later or check if the website is down.'
      });
    } else if (results.error?.includes('404') || results.error?.includes('not found')) {
      newSuggestions.push({
        type: 'error',
        message: 'The URL was not found.',
        action: 'Double-check the URL. The endpoint may have changed.'
      });
    } else if (results.error?.includes('JSON')) {
      newSuggestions.push({
        type: 'error',
        message: 'The response is not valid JSON.',
        action: 'This might not be a meeting feed endpoint. Try adding /wp-admin/admin-ajax.php?action=meetings for TSML sites.'
      });
    } else if (results.error?.includes('array')) {
      newSuggestions.push({
        type: 'warning',
        message: 'The feed returned data but not in the expected format.',
        action: 'Try switching the feed type or check the API documentation.'
      });
    }

    // Always suggest retry
    if (testAttempts < 3) {
      newSuggestions.push({
        type: 'info',
        message: `Attempt ${testAttempts} of 3.`,
        action: 'Click "Retry" to try again with different settings.'
      });
    }

    setSuggestions(newSuggestions);
  };

  // Apply a research suggestion
  const applySuggestion = (suggestion) => {
    if (suggestion.url) setSourceUrl(suggestion.url);
    if (suggestion.name) setSourceName(suggestion.name);
    if (suggestion.feedType) setFeedType(suggestion.feedType);
    if (suggestion.state) setSourceState(suggestion.state);

    // Clear previous test results when applying new suggestion
    setTestResults(null);
    setSuggestions([]);
    setTestAttempts(0);
  };

  // Save the source
  const saveSource = async () => {
    if (!sourceUrl.trim() || !sourceName.trim() || !sourceState.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/add-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          name: sourceName,
          state: sourceState,
          feedType: feedType === 'auto' ? 'tsml' : feedType
        })
      });

      const data = await response.json();

      if (data.success) {
        setSaveSuccess(true);

        // Mark task as completed
        if (task?.id && onTaskUpdate) {
          onTaskUpdate(task.id, 'completed');
        }

        // Notify parent of new source
        if (onSourceAdded) {
          onSourceAdded(data.feedConfig);
        }

        // Close sidebar after a moment
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setTestResults({
          ...testResults,
          saveError: data.error
        });
      }
    } catch (error) {
      console.error('Error saving source:', error);
      setTestResults({
        ...testResults,
        saveError: 'Failed to save source. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setSourceName('');
    setSourceState('');
    setSourceUrl('');
    setFeedType('auto');
    setTestResults(null);
    setResearchResults(null);
    setResearchError(null);
    setSuggestions([]);
    setTestAttempts(0);
    setSaveSuccess(false);
    onClose();
  };

  if (!task) return null;

  const canSave = testResults?.success && sourceName.trim() && sourceState.trim() && sourceUrl.trim();

  return (
    <>
      {/* Overlay */}
      <div
        className={`task-sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={handleClose}
      />

      {/* Sidebar */}
      <div className={`task-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="task-sidebar-header">
          <div className="task-sidebar-title">
            <h3>Add Source</h3>
            {task.state && (
              <span className="task-state-badge">{task.state}</span>
            )}
          </div>
          <button className="task-sidebar-close" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="task-sidebar-body">
          {/* Task Info */}
          <div className="task-sidebar-task-info">
            <div className="task-info-title">{task.title}</div>
            {task.description && (
              <div className="task-info-description">{task.description}</div>
            )}
          </div>

          {/* Research Section */}
          {isResearching && (
            <div className="task-sidebar-research-loading">
              <div className="research-spinner"></div>
              <span>Researching meeting sources...</span>
            </div>
          )}

          {researchResults && researchResults.suggestions && researchResults.suggestions.length > 0 && (
            <div className="task-sidebar-section">
              <h4>Suggested Sources</h4>
              <div className="research-suggestions">
                {researchResults.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`research-suggestion ${sourceUrl === suggestion.url ? 'selected' : ''}`}
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <div className="suggestion-name">{suggestion.name}</div>
                    <div className="suggestion-url">{suggestion.url?.substring(0, 50)}...</div>
                    <div className="suggestion-meta">
                      <span className={`suggestion-type ${suggestion.feedType}`}>
                        {suggestion.feedType?.toUpperCase()}
                      </span>
                      {suggestion.confidence && (
                        <span className="suggestion-confidence">
                          {Math.round(suggestion.confidence * 100)}% match
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {researchError && (
            <div className="task-sidebar-error">
              {researchError}
            </div>
          )}

          {/* Form Section */}
          <div className="task-sidebar-section">
            <h4>Source Details</h4>
            <div className="task-sidebar-form">
              <div className="form-group">
                <label>Source Name</label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g., Phoenix AA Intergroup"
                />
              </div>

              <div className="form-row">
                <div className="form-group form-group-state">
                  <label>State</label>
                  <select
                    value={sourceState}
                    onChange={(e) => setSourceState(e.target.value)}
                  >
                    <option value="">Select...</option>
                    {allStates.map(code => (
                      <option key={code} value={code}>
                        {code} - {stateNames[code]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group form-group-type">
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
          </div>

          {/* Test Section */}
          <div className="task-sidebar-section">
            <h4>Test Scrape</h4>
            <div className="test-actions">
              <button
                className="btn btn-secondary btn-test"
                onClick={() => testSource(false)}
                disabled={!sourceUrl.trim() || isTesting}
              >
                {isTesting ? (
                  <>
                    <span className="btn-spinner"></span>
                    Testing...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                    Test Source
                  </>
                )}
              </button>

              {testResults && !testResults.success && testAttempts < 3 && (
                <button
                  className="btn btn-ghost btn-retry"
                  onClick={() => testSource(true)}
                  disabled={isTesting}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Retry
                </button>
              )}
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
                            {Object.entries(testResults.stateBreakdown).slice(0, 5).map(([st, count]) => (
                              <span key={st} className="test-state-tag">{st}: {count}</span>
                            ))}
                            {Object.keys(testResults.stateBreakdown).length > 5 && (
                              <span className="test-state-tag more">+{Object.keys(testResults.stateBreakdown).length - 5} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {testResults.sampleMeetings && testResults.sampleMeetings.length > 0 && (
                      <div className="test-sample-meetings">
                        <div className="test-detail-label">Sample Meetings</div>
                        <div className="sample-meetings-list">
                          {testResults.sampleMeetings.slice(0, 3).map((m, i) => (
                            <div key={i} className="sample-meeting">
                              <span className="sample-meeting-name">{m.name}</span>
                              <span className="sample-meeting-location">{m.city}{m.state ? `, ${m.state}` : ''}</span>
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
                      {testResults.error}
                    </div>
                    {testResults.hint && (
                      <div className="test-hint">
                        {testResults.hint}
                      </div>
                    )}
                  </>
                )}

                {testResults.saveError && (
                  <div className="test-save-error">
                    {testResults.saveError}
                  </div>
                )}
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="test-suggestions">
                {suggestions.map((s, i) => (
                  <div key={i} className={`test-suggestion ${s.type}`}>
                    <div className="suggestion-icon">
                      {s.type === 'success' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <polyline points="22,4 12,14.01 9,11.01"/>
                        </svg>
                      )}
                      {s.type === 'warning' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                      )}
                      {s.type === 'error' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                      )}
                      {s.type === 'info' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="16" x2="12" y2="12"/>
                          <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                      )}
                    </div>
                    <div className="suggestion-content">
                      <div className="suggestion-message">{s.message}</div>
                      {s.action && <div className="suggestion-action">{s.action}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="task-sidebar-footer">
          {saveSuccess ? (
            <div className="save-success-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
              Source added successfully!
            </div>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={handleClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveSource}
                disabled={!canSave || isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="btn-spinner"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                      <polyline points="17,21 17,13 7,13 7,21"/>
                      <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    Save to Sources
                  </>
                )}
              </button>
            </>
          )}
          {!canSave && !saveSuccess && testResults?.success && (
            <span className="footer-hint">Fill in all fields to save</span>
          )}
          {!canSave && !saveSuccess && !testResults?.success && (
            <span className="footer-hint">Test the source first</span>
          )}
        </div>
      </div>
    </>
  );
}

export default TaskSidebar;
