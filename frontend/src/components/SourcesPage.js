import React, { useState, useEffect, useCallback } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';

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

// Cache keys
const SOURCES_CACHE_KEY = 'sources:feeds';
const COVERAGE_GAPS_CACHE_KEY = 'sources:coverageGaps';
const DRAFTS_CACHE_KEY = 'sources:drafts';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Expandable Coverage Gap Row Component
function CoverageGapRow({ gap, isExpanded, onToggle, onAddSource }) {
  return (
    <>
      <tr
        className={`coverage-gap-row ${isExpanded ? 'expanded' : ''} ${gap.hasFeed ? 'has-feed' : 'no-feed'}`}
        onClick={onToggle}
      >
        <td className="gap-state-cell">
          <span className="gap-state-badge">{gap.state}</span>
          <span className="gap-state-name">{gap.stateName}</span>
        </td>
        <td className="gap-population-cell">
          {(gap.population / 1000000).toFixed(1)}M
        </td>
        <td className="gap-meetings-cell">
          {gap.meetingCount.toLocaleString()}
        </td>
        <td className="gap-coverage-cell">
          <span className={`coverage-ratio ${gap.coverageRatio < 1 ? 'low' : gap.coverageRatio < 5 ? 'medium' : 'good'}`}>
            {gap.coverageRatio.toFixed(2)}/100k
          </span>
        </td>
        <td className="gap-status-cell">
          {gap.hasFeed ? (
            <span className="status-badge status-partial">Partial</span>
          ) : (
            <span className="status-badge status-none">No Source</span>
          )}
        </td>
        <td className="gap-actions-cell">
          <button
            className="btn btn-sm btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              onAddSource(gap);
            }}
          >
            Add Source
          </button>
          <svg
            className={`expand-chevron ${isExpanded ? 'rotated' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </td>
      </tr>
      {isExpanded && (
        <tr className="coverage-gap-details-row">
          <td colSpan={6}>
            <div className="gap-details-content">
              <div className="gap-detail-section">
                <h4>Coverage Analysis</h4>
                <div className="gap-detail-stats">
                  <div className="gap-detail-stat">
                    <span className="stat-label">Population</span>
                    <span className="stat-value">{gap.population.toLocaleString()}</span>
                  </div>
                  <div className="gap-detail-stat">
                    <span className="stat-label">Current Meetings</span>
                    <span className="stat-value">{gap.meetingCount.toLocaleString()}</span>
                  </div>
                  <div className="gap-detail-stat">
                    <span className="stat-label">Coverage Ratio</span>
                    <span className="stat-value">{gap.coverageRatio.toFixed(2)} per 100k</span>
                  </div>
                  <div className="gap-detail-stat">
                    <span className="stat-label">Has Feed</span>
                    <span className="stat-value">{gap.hasFeed ? 'Yes (partial)' : 'No'}</span>
                  </div>
                </div>
              </div>
              <div className="gap-detail-section">
                <h4>Recommendations</h4>
                <ul className="gap-recommendations">
                  {!gap.hasFeed && (
                    <li>Search for {gap.stateName} AA/NA intergroup websites</li>
                  )}
                  {gap.coverageRatio < 1 && (
                    <li>Priority: Very low coverage - needs immediate attention</li>
                  )}
                  {gap.population > 2000000 && (
                    <li>Large population state - consider multiple regional sources</li>
                  )}
                  <li>Check TSML and BMLT directories for existing feeds</li>
                </ul>
              </div>
              <div className="gap-detail-actions">
                <button
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSource(gap);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                    <path d="M11 8v6M8 11h6"/>
                  </svg>
                  Find & Add Source
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Draft Selection Panel
function DraftSelectionPanel({ isOpen, onClose, onSelectDraft, drafts, searchQuery, onSearchChange, isLoading }) {
  if (!isOpen) return null;

  const filteredDrafts = drafts.filter(draft => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      draft.name?.toLowerCase().includes(query) ||
      draft.state?.toLowerCase().includes(query) ||
      stateNames[draft.state]?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="draft-selection-overlay" onClick={onClose}>
      <div className="draft-selection-panel" onClick={(e) => e.stopPropagation()}>
        <div className="draft-panel-header">
          <h3>Select a Draft</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="draft-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search drafts by name or state..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => onSearchChange('')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        <div className="draft-list">
          {isLoading ? (
            <div className="draft-loading">
              <span className="spinner"></span>
              Loading drafts...
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="draft-empty">
              {searchQuery ? (
                <p>No drafts match "{searchQuery}"</p>
              ) : (
                <p>No drafts saved yet</p>
              )}
            </div>
          ) : (
            filteredDrafts.map(draft => (
              <div
                key={draft.id}
                className="draft-item"
                onClick={() => onSelectDraft(draft)}
              >
                <div className="draft-item-header">
                  <span className="draft-state-badge">{draft.state}</span>
                  <span className="draft-name">{draft.name}</span>
                </div>
                <div className="draft-item-meta">
                  <span className={`draft-type-badge ${draft.feedType}`}>
                    {draft.feedType?.toUpperCase()}
                  </span>
                  <span className="draft-meeting-count">
                    {draft.meetingCount || 0} meetings
                  </span>
                  <span className="draft-date">
                    {draft.createdAt ? new Date(draft.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Add Source Side Panel
function AddSourcePanel({ isOpen, onClose, initialState, prefillData, onComplete }) {
  const [currentStep, setCurrentStep] = useState('discover');
  const [selectedState, setSelectedState] = useState(initialState || '');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [feedType, setFeedType] = useState('auto');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryNotes, setDiscoveryNotes] = useState([]);
  const [intergroups, setIntergroups] = useState({ known: [], generated: [] });
  const [validateUrls, setValidateUrls] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [isTryingScrape, setIsTryingScrape] = useState(null);

  // Load drafts for selected state
  const loadDrafts = useCallback(async (state) => {
    if (!state) return;
    setIsLoadingDrafts(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/sources/drafts?state=${state}`);
      const data = await response.json();
      if (data.success) {
        setDrafts(data.drafts || []);
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
    } finally {
      setIsLoadingDrafts(false);
    }
  }, []);

  // Initialize with prefill data
  useEffect(() => {
    if (isOpen && prefillData) {
      setSelectedState(prefillData.state || '');
      setSourceName(prefillData.name || '');
      setSourceUrl(prefillData.url || '');
      setFeedType(prefillData.feedType || 'auto');
      if (prefillData.testResults) {
        setTestResults(prefillData.testResults);
        setCurrentStep('review');
      }
      if (prefillData.state) {
        loadDrafts(prefillData.state);
      }
    } else if (isOpen && initialState) {
      setSelectedState(initialState);
      loadDrafts(initialState);
    }
  }, [isOpen, prefillData, initialState, loadDrafts]);

  // Reset when closing
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
    setIsSaving(false);
    setSaveSuccess(false);
    setDrafts([]);
    setShowDrafts(false);
    onClose();
  };

  // Run discovery
  const runDiscovery = async () => {
    if (!selectedState) return;
    setIsDiscovering(true);
    setDiscoveryNotes([]);
    setIntergroups({ known: [], generated: [] });

    const initialNote = validateUrls
      ? `Searching and validating AA intergroups in ${stateNames[selectedState]}...`
      : `Searching for AA intergroups in ${stateNames[selectedState]}...`;
    setDiscoveryNotes([initialNote]);
    loadDrafts(selectedState);

    try {
      const endpoint = validateUrls
        ? `${BACKEND_URL}/api/intergroup-research/discover-validated`
        : `${BACKEND_URL}/api/intergroup-research/discover`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: selectedState, validateUrls })
      });

      const data = await response.json();

      if (data.success) {
        const notes = [initialNote];
        if (data.known?.length > 0) {
          notes.push(`Found ${data.known.length} known intergroup(s)`);
        }
        if (data.generated?.length > 0) {
          notes.push(validateUrls
            ? `Found ${data.generated.length} validated source(s)`
            : `Generated ${data.generated.length} patterns`
          );
        }
        notes.push(`Discovery complete! Found ${data.total} potential source(s)`);
        setDiscoveryNotes(notes);
        setIntergroups({ known: data.known || [], generated: data.generated || [] });
      } else {
        setDiscoveryNotes(prev => [...prev, `Error: ${data.error || 'Discovery failed'}`]);
      }
    } catch (error) {
      setDiscoveryNotes(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Try scraping an intergroup
  const tryScrape = async (ig) => {
    const domain = ig.domain;
    const url = ig.url || `https://${domain}/wp-admin/admin-ajax.php?action=meetings`;
    setIsTryingScrape(domain);

    try {
      const response = await fetch(`${BACKEND_URL}/api/sources/try-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name: ig.name, state: selectedState, saveAsDraft: true })
      });

      const data = await response.json();
      if (data.success) {
        if (data.draft) {
          setDrafts(prev => {
            const exists = prev.find(d => d.id === data.draft.id);
            if (exists) return prev.map(d => d.id === data.draft.id ? data.draft : d);
            return [data.draft, ...prev];
          });
          setShowDrafts(true);
        }
        setIntergroups(prev => ({
          ...prev,
          generated: prev.generated.map(g =>
            g.domain === domain ? { ...g, validated: true, meetingCount: data.totalMeetings } : g
          )
        }));
        setDiscoveryNotes(prev => [...prev, `✓ Scraped ${ig.name}: Found ${data.totalMeetings} meetings`]);
      } else {
        setIntergroups(prev => ({
          ...prev,
          generated: prev.generated.map(g =>
            g.domain === domain ? { ...g, validated: false, validationError: data.error } : g
          )
        }));
        setDiscoveryNotes(prev => [...prev, `✗ ${ig.name}: ${data.error || 'Could not scrape'}`]);
      }
    } catch (error) {
      setDiscoveryNotes(prev => [...prev, `✗ ${ig.name}: Network error`]);
    } finally {
      setIsTryingScrape(null);
    }
  };

  // Select an intergroup
  const selectIntergroup = (ig) => {
    setSourceName(ig.name);
    setSourceUrl(`https://${ig.domain}/wp-admin/admin-ajax.php?action=meetings`);
    setFeedType(ig.type === 'tsml' ? 'tsml' : 'auto');
    setCurrentStep('test');
  };

  // Apply a draft
  const applyDraft = (draft) => {
    setSourceName(draft.name);
    setSourceUrl(draft.url);
    setFeedType(draft.feedType || 'auto');
    setTestResults({
      success: draft.meetingCount > 0,
      totalMeetings: draft.meetingCount,
      feedType: draft.feedType,
      generatedScript: draft.scriptContent,
      ...draft.testResults
    });
    setCurrentStep('review');
  };

  // Test source
  const testSource = async () => {
    if (!sourceUrl) return;
    setIsTesting(true);
    setTestResults(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/test-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          feedType,
          state: selectedState || 'XX',
          name: sourceName || ''
        })
      });

      const data = await response.json();
      setTestResults(data);
      if (data.feedType && feedType === 'auto') {
        setFeedType(data.feedType);
      }
      if (data.success) {
        setCurrentStep('review');
      }
    } catch (error) {
      setTestResults({ success: false, error: 'Failed to test source.' });
    } finally {
      setIsTesting(false);
    }
  };

  // Save source
  const saveSource = async (submitForReview = false) => {
    if (!sourceUrl.trim() || !sourceName.trim() || !selectedState.trim()) return;
    setIsSaving(true);

    try {
      const endpoint = submitForReview
        ? `${BACKEND_URL}/api/submissions`
        : `${BACKEND_URL}/api/tasks/add-source`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          name: sourceName,
          state: selectedState,
          feedType: feedType === 'auto' ? 'tsml' : feedType,
          testResults
        })
      });

      const data = await response.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onComplete?.({ state: selectedState, name: sourceName, url: sourceUrl, feedType });
          handleClose();
        }, 1000);
      } else {
        setTestResults(prev => ({ ...prev, saveError: data.error || 'Failed to save' }));
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, saveError: 'Failed to save source.' }));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const STEPS = [
    { id: 'discover', label: 'Discover' },
    { id: 'test', label: 'Test' },
    { id: 'review', label: 'Review' },
    { id: 'save', label: 'Save' }
  ];

  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <>
      <div className="add-source-overlay" onClick={handleClose} />
      <div className="add-source-panel">
        <div className="add-source-header">
          <div className="add-source-title">
            <h3>Add Meeting Source</h3>
            {selectedState && <span className="state-badge">{selectedState}</span>}
          </div>
          <button className="btn-close" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="add-source-steps">
          {STEPS.map((step, index) => (
            <button
              key={step.id}
              className={`step-indicator ${step.id === currentStep ? 'active' : ''} ${index < currentIndex ? 'complete' : ''}`}
              onClick={() => index <= currentIndex && setCurrentStep(step.id)}
              disabled={index > currentIndex}
            >
              <span className="step-number">
                {index < currentIndex ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span className="step-label">{step.label}</span>
            </button>
          ))}
        </div>

        <div className="add-source-body">
          {/* Discover Step */}
          {currentStep === 'discover' && (
            <div className="step-content discover-step">
              <div className="step-header">
                <h4>Discover Meeting Sources</h4>
                <p>Search for AA intergroup websites in your target state</p>
              </div>

              <div className="form-group">
                <label>Select State</label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    if (e.target.value) loadDrafts(e.target.value);
                  }}
                  disabled={isDiscovering}
                >
                  <option value="">Choose a state...</option>
                  {allStates.map(code => (
                    <option key={code} value={code}>{code} - {stateNames[code]}</option>
                  ))}
                </select>
              </div>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={validateUrls}
                  onChange={(e) => setValidateUrls(e.target.checked)}
                  disabled={isDiscovering}
                />
                <span>Only show validated URLs (slower but more accurate)</span>
              </label>

              <button
                className="btn btn-primary"
                onClick={runDiscovery}
                disabled={!selectedState || isDiscovering}
              >
                {isDiscovering ? (
                  <><span className="spinner"></span>Discovering...</>
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
                  {discoveryNotes.map((note, i) => (
                    <div key={i} className={`note ${note.startsWith('✓') ? 'success' : note.startsWith('✗') ? 'error' : ''}`}>
                      {note}
                    </div>
                  ))}
                </div>
              )}

              {/* Discovered Intergroups */}
              {(intergroups.known.length > 0 || intergroups.generated.length > 0) && (
                <div className="discovered-list">
                  {intergroups.known.length > 0 && (
                    <div className="intergroups-section">
                      <h5>Known Intergroups</h5>
                      {intergroups.known.map((ig, i) => (
                        <div key={i} className="intergroup-item">
                          <div className="ig-info">
                            <span className="ig-name">{ig.name}</span>
                            <span className="ig-domain">{ig.domain}</span>
                          </div>
                          <button className="btn btn-sm btn-primary" onClick={() => selectIntergroup(ig)}>
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {intergroups.generated.length > 0 && (
                    <div className="intergroups-section">
                      <h5>{validateUrls ? 'Validated Sources' : 'Suggested Patterns'}</h5>
                      {intergroups.generated.map((ig, i) => (
                        <div key={i} className={`intergroup-item ${ig.validated ? 'validated' : ig.validationError ? 'failed' : ''}`}>
                          <div className="ig-info">
                            <span className="ig-name">{ig.name}</span>
                            <span className="ig-domain">{ig.domain}</span>
                            {ig.meetingCount > 0 && (
                              <span className="ig-count">{ig.meetingCount} meetings</span>
                            )}
                          </div>
                          {ig.validated ? (
                            <button className="btn btn-sm btn-primary" onClick={() => selectIntergroup(ig)}>Use</button>
                          ) : ig.validationError ? (
                            <span className="ig-failed">Failed</span>
                          ) : (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => tryScrape(ig)}
                              disabled={isTryingScrape === ig.domain}
                            >
                              {isTryingScrape === ig.domain ? 'Trying...' : 'Try'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Drafts Section */}
              {(drafts.length > 0 || isLoadingDrafts) && (
                <div className="drafts-section">
                  <button className="drafts-toggle" onClick={() => setShowDrafts(!showDrafts)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                    </svg>
                    Saved Drafts ({drafts.length})
                    <svg className={`chevron ${showDrafts ? 'rotated' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {showDrafts && (
                    <div className="drafts-list">
                      {isLoadingDrafts ? (
                        <div className="draft-loading"><span className="spinner"></span>Loading...</div>
                      ) : (
                        drafts.map(draft => (
                          <div key={draft.id} className="draft-item" onClick={() => applyDraft(draft)}>
                            <div className="draft-header">
                              <span className="draft-name">{draft.name}</span>
                              <span className={`draft-type ${draft.feedType}`}>{draft.feedType}</span>
                            </div>
                            <div className="draft-meta">
                              {draft.meetingCount} meetings
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Manual Entry */}
              <div className="manual-entry">
                <span className="divider">or</span>
                <button
                  className="btn btn-ghost"
                  onClick={() => setCurrentStep('test')}
                  disabled={!selectedState}
                >
                  Enter Source Details Manually
                </button>
              </div>
            </div>
          )}

          {/* Test Step */}
          {currentStep === 'test' && (
            <div className="step-content test-step">
              <div className="step-header">
                <h4>Test Meeting Source</h4>
                <p>Verify the feed URL returns valid meeting data</p>
              </div>

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
              </div>

              <button
                className="btn btn-primary"
                onClick={testSource}
                disabled={!sourceUrl || isTesting}
              >
                {isTesting ? (
                  <><span className="spinner"></span>Testing...</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Test Source
                  </>
                )}
              </button>

              {testResults && (
                <div className={`test-results ${testResults.success ? 'success' : 'error'}`}>
                  {testResults.success ? (
                    <>
                      <div className="result-header success">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <polyline points="22,4 12,14.01 9,11.01"/>
                        </svg>
                        Found {testResults.totalMeetings} meetings
                      </div>
                      <div className="result-details">
                        <span>Feed Type: {testResults.feedType?.toUpperCase()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="result-header error">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                      {testResults.error || 'Test failed'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="step-content review-step">
              <div className="step-header">
                <h4>Review Source</h4>
                <p>Confirm the details before saving</p>
              </div>

              <div className="review-card">
                <div className="review-row">
                  <span className="review-label">State</span>
                  <span className="review-value">{selectedState} - {stateNames[selectedState]}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">Source Name</span>
                  <span className="review-value">{sourceName}</span>
                </div>
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
              </div>
            </div>
          )}

          {/* Save Step */}
          {currentStep === 'save' && (
            <div className="step-content save-step">
              {saveSuccess ? (
                <div className="save-success">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  <h4>Source Added Successfully!</h4>
                  <p>The meeting source has been saved.</p>
                </div>
              ) : (
                <>
                  <div className="step-header">
                    <h4>Save Source</h4>
                    <p>Choose how to add this source</p>
                  </div>

                  <div className="save-options">
                    <button
                      className="save-option"
                      onClick={() => saveSource(false)}
                      disabled={isSaving}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                        <polyline points="17,21 17,13 7,13 7,21"/>
                        <polyline points="7,3 7,8 15,8"/>
                      </svg>
                      <div>
                        <h5>Save to Sources</h5>
                        <p>Add directly to the active sources list</p>
                      </div>
                    </button>

                    <button
                      className="save-option secondary"
                      onClick={() => saveSource(true)}
                      disabled={isSaving}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13"/>
                        <path d="M22 2L15 22l-4-9-9-4 20-7z"/>
                      </svg>
                      <div>
                        <h5>Submit for Review</h5>
                        <p>Send to admins for approval</p>
                      </div>
                    </button>
                  </div>

                  {isSaving && (
                    <div className="saving-indicator">
                      <span className="spinner"></span>
                      Saving source...
                    </div>
                  )}

                  {testResults?.saveError && (
                    <div className="save-error">{testResults.saveError}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {!saveSuccess && (
          <div className="add-source-footer">
            <button
              className="btn btn-ghost"
              onClick={() => {
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
                onClick={() => setCurrentStep(STEPS[currentIndex + 1].id)}
                disabled={
                  (currentStep === 'discover' && !selectedState) ||
                  (currentStep === 'test' && !testResults?.success) ||
                  (currentStep === 'review' && (!sourceName || !sourceUrl))
                }
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

// Main SourcesPage Component
function SourcesPage({ feeds, feedsLoading, onSelectSource, onRefreshFeeds }) {
  const { getCache, setCache } = useDataCache();

  // State
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [selectedStateForAdd, setSelectedStateForAdd] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [coverageGaps, setCoverageGaps] = useState([]);
  const [isLoadingGaps, setIsLoadingGaps] = useState(true);
  const [expandedGapState, setExpandedGapState] = useState(null);
  const [activeTab, setActiveTab] = useState('sources'); // sources | gaps | drafts
  const [drafts, setDrafts] = useState([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [showDraftSelector, setShowDraftSelector] = useState(false);

  // Source filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [lastScrapeFilter, setLastScrapeFilter] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Fetch coverage gaps with cache-first, Back4app fallback
  const fetchCoverageGaps = useCallback(async (forceRefresh = false) => {
    const cached = getCache(COVERAGE_GAPS_CACHE_KEY);
    if (!forceRefresh && cached?.data) {
      setCoverageGaps(cached.data);
      setIsLoadingGaps(false);
      return;
    }

    setIsLoadingGaps(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/coverage/gaps`);
      if (response.ok) {
        const data = await response.json();
        setCoverageGaps(data.gaps || []);
        setCache(COVERAGE_GAPS_CACHE_KEY, data.gaps || [], CACHE_TTL);
      }
    } catch (error) {
      console.error('Error fetching coverage gaps:', error);
    } finally {
      setIsLoadingGaps(false);
    }
  }, [getCache, setCache]);

  // Fetch all drafts
  const fetchDrafts = useCallback(async (forceRefresh = false) => {
    const cached = getCache(DRAFTS_CACHE_KEY);
    if (!forceRefresh && cached?.data) {
      setDrafts(cached.data);
      return;
    }

    setIsLoadingDrafts(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/sources/drafts`);
      if (response.ok) {
        const data = await response.json();
        setDrafts(data.drafts || []);
        setCache(DRAFTS_CACHE_KEY, data.drafts || [], CACHE_TTL);
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
    } finally {
      setIsLoadingDrafts(false);
    }
  }, [getCache, setCache]);

  useEffect(() => {
    fetchCoverageGaps();
    fetchDrafts();
  }, [fetchCoverageGaps, fetchDrafts]);

  // Handle opening add panel from coverage gap
  const handleAddFromGap = (gap) => {
    setSelectedStateForAdd(gap.state);
    setPrefillData(null);
    setIsAddPanelOpen(true);
  };

  // Handle selecting a draft to prefill
  const handleSelectDraft = (draft) => {
    setPrefillData({
      state: draft.state,
      name: draft.name,
      url: draft.url,
      feedType: draft.feedType,
      testResults: {
        success: draft.meetingCount > 0,
        totalMeetings: draft.meetingCount,
        feedType: draft.feedType,
        generatedScript: draft.scriptContent
      }
    });
    setSelectedStateForAdd(draft.state);
    setShowDraftSelector(false);
    setIsAddPanelOpen(true);
  };

  // Handle add panel completion
  const handleAddComplete = () => {
    onRefreshFeeds?.();
    fetchCoverageGaps(true);
    fetchDrafts(true);
  };

  // Format last scraped
  const formatLastScraped = (lastScraped) => {
    if (!lastScraped) return 'Never';
    const date = new Date(lastScraped);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get unique states from feeds
  const sourceStates = [...new Set(feeds.map(f => f.state).filter(Boolean))].sort();

  // Filter sources
  const filteredSources = feeds.filter(feed => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!feed.name.toLowerCase().includes(query) && !feed.state?.toLowerCase().includes(query)) {
        return false;
      }
    }
    if (stateFilter && feed.state !== stateFilter) return false;
    if (lastScrapeFilter) {
      if (lastScrapeFilter === 'never' && feed.lastScraped) return false;
      if (lastScrapeFilter === 'today') {
        if (!feed.lastScraped) return false;
        if (new Date(feed.lastScraped).toDateString() !== new Date().toDateString()) return false;
      }
      if (lastScrapeFilter === 'week') {
        if (!feed.lastScraped) return false;
        if ((new Date() - new Date(feed.lastScraped)) / (1000 * 60 * 60 * 24) > 7) return false;
      }
      if (lastScrapeFilter === 'stale') {
        if (!feed.lastScraped) return true;
        if ((new Date() - new Date(feed.lastScraped)) / (1000 * 60 * 60 * 24) <= 7) return false;
      }
    }
    return true;
  });

  // Sort sources
  const sortedSources = [...filteredSources].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'state':
        comparison = (a.state || '').localeCompare(b.state || '');
        break;
      case 'lastScraped':
        comparison = (a.lastScraped ? new Date(a.lastScraped).getTime() : 0) -
                     (b.lastScraped ? new Date(b.lastScraped).getTime() : 0);
        break;
      case 'meetingCount':
        comparison = (a.meetingCount || 0) - (b.meetingCount || 0);
        break;
      default:
        comparison = 0;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const hasFilters = searchQuery || stateFilter || lastScrapeFilter;

  const clearFilters = () => {
    setSearchQuery('');
    setStateFilter('');
    setLastScrapeFilter('');
  };

  return (
    <div className="sources-page">
      <div className="sources-page-header">
        <div className="header-left">
          <h2>Sources</h2>
          <p>Manage meeting data sources and discover new ones</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-ghost"
            onClick={() => setShowDraftSelector(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            Drafts ({drafts.length})
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSelectedStateForAdd(null);
              setPrefillData(null);
              setIsAddPanelOpen(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add New Source
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sources-tabs">
        <button
          className={`tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          Active Sources
          <span className="tab-count">{feeds.length}</span>
        </button>
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
          {coverageGaps.length > 0 && <span className="tab-count alert">{coverageGaps.length}</span>}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'sources' && (
        <div className="sources-content">
          <div className="sources-toolbar">
            <div className="sources-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All States</option>
              {sourceStates.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            <select
              value={lastScrapeFilter}
              onChange={(e) => setLastScrapeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="today">Scraped Today</option>
              <option value="week">Scraped This Week</option>
              <option value="stale">Needs Refresh</option>
              <option value="never">Never Scraped</option>
            </select>
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          {!feedsLoading && (
            <div className="sources-count">
              {sortedSources.length} of {feeds.length} sources
            </div>
          )}

          {feedsLoading ? (
            <div className="sources-table-wrapper">
              <table className="sources-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>State</th>
                    <th>Last Run</th>
                    <th>Meetings</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(8)].map((_, i) => (
                    <tr key={i} className="source-row skeleton-row">
                      <td className="source-name-cell">
                        <div className="skeleton-icon"></div>
                        <div className="skeleton-text" style={{ width: `${120 + (i % 4) * 30}px` }}></div>
                      </td>
                      <td><div className="skeleton-badge"></div></td>
                      <td><div className="skeleton-text" style={{ width: '60px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '40px' }}></div></td>
                      <td><div className="skeleton-badge" style={{ width: '80px' }}></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : feeds.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
              <p>No sources configured</p>
              <span className="empty-hint">Add meeting data sources to get started</span>
            </div>
          ) : (
            <div className="sources-table-wrapper">
              <table className="sources-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('name')}>
                      Name
                      {sortColumn === 'name' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortDirection === 'asc' ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'}/>
                        </svg>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('state')}>
                      State
                      {sortColumn === 'state' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortDirection === 'asc' ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'}/>
                        </svg>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('lastScraped')}>
                      Last Run
                      {sortColumn === 'lastScraped' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortDirection === 'asc' ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'}/>
                        </svg>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('meetingCount')}>
                      Meetings
                      {sortColumn === 'meetingCount' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortDirection === 'asc' ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'}/>
                        </svg>
                      )}
                    </th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSources.map((feed, index) => {
                    const isStale = !feed.lastScraped ||
                      (new Date() - new Date(feed.lastScraped)) > (7 * 24 * 60 * 60 * 1000);
                    return (
                      <tr
                        key={index}
                        className="source-row"
                        onClick={() => onSelectSource?.(feed)}
                      >
                        <td className="source-name-cell">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M2 12h20"/>
                            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                          </svg>
                          <span>{feed.name}</span>
                        </td>
                        <td><span className="state-badge">{feed.state}</span></td>
                        <td className={isStale ? 'stale' : ''}>{formatLastScraped(feed.lastScraped)}</td>
                        <td>{feed.meetingCount > 0 ? feed.meetingCount.toLocaleString() : '—'}</td>
                        <td>
                          <span className={`status-badge ${isStale ? 'stale' : 'active'}`}>
                            {isStale ? 'Needs Refresh' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'gaps' && (
        <div className="gaps-content">
          <div className="gaps-header">
            <p>States with low meeting coverage or missing data sources. Click a row for more details.</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fetchCoverageGaps(true)}
              disabled={isLoadingGaps}
            >
              {isLoadingGaps ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {isLoadingGaps ? (
            <div className="loading-state">
              <span className="spinner"></span>
              Loading coverage gaps...
            </div>
          ) : coverageGaps.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
              <p>Great coverage! No major gaps detected.</p>
            </div>
          ) : (
            <div className="gaps-table-wrapper">
              <table className="gaps-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Population</th>
                    <th>Meetings</th>
                    <th>Coverage</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageGaps.map(gap => (
                    <CoverageGapRow
                      key={gap.state}
                      gap={gap}
                      isExpanded={expandedGapState === gap.state}
                      onToggle={() => setExpandedGapState(
                        expandedGapState === gap.state ? null : gap.state
                      )}
                      onAddSource={handleAddFromGap}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Draft Selection Modal */}
      <DraftSelectionPanel
        isOpen={showDraftSelector}
        onClose={() => setShowDraftSelector(false)}
        onSelectDraft={handleSelectDraft}
        drafts={drafts}
        searchQuery={draftSearchQuery}
        onSearchChange={setDraftSearchQuery}
        isLoading={isLoadingDrafts}
      />

      {/* Add Source Side Panel */}
      <AddSourcePanel
        isOpen={isAddPanelOpen}
        onClose={() => setIsAddPanelOpen(false)}
        initialState={selectedStateForAdd}
        prefillData={prefillData}
        onComplete={handleAddComplete}
      />
    </div>
  );
}

export default SourcesPage;
