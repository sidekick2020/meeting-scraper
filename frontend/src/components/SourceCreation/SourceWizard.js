import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Meeting Preview Component - shows sample meetings with expandable details
function MeetingPreview({ meeting, isExpanded, onToggle }) {
  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className={`meeting-preview-item ${isExpanded ? 'expanded' : ''}`}>
      <div className="meeting-preview-header" onClick={onToggle}>
        <div className="meeting-basic-info">
          <span className="meeting-name">{meeting.name || 'Unnamed Meeting'}</span>
          <span className="meeting-schedule">
            {dayNames[meeting.day] || ''} {formatTime(meeting.time)}
          </span>
        </div>
        <svg
          className={`expand-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {isExpanded && (
        <div className="meeting-details">
          {meeting.location && (
            <div className="meeting-detail-row">
              <span className="detail-label">Location:</span>
              <span className="detail-value">{meeting.location}</span>
            </div>
          )}
          {(meeting.formatted_address || meeting.address) && (
            <div className="meeting-detail-row">
              <span className="detail-label">Address:</span>
              <span className="detail-value">{meeting.formatted_address || meeting.address}</span>
            </div>
          )}
          {meeting.types && meeting.types.length > 0 && (
            <div className="meeting-detail-row">
              <span className="detail-label">Types:</span>
              <span className="detail-value meeting-types">
                {meeting.types.map((type, idx) => (
                  <span key={idx} className="meeting-type-badge">{type}</span>
                ))}
              </span>
            </div>
          )}
          {meeting.notes && (
            <div className="meeting-detail-row">
              <span className="detail-label">Notes:</span>
              <span className="detail-value meeting-notes">{meeting.notes}</span>
            </div>
          )}
          {meeting.conference_url && (
            <div className="meeting-detail-row">
              <span className="detail-label">Online:</span>
              <a href={meeting.conference_url} target="_blank" rel="noopener noreferrer" className="detail-value meeting-link">
                Join Online
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Source Card with meeting preview
function SourceCard({ source, onUse }) {
  const [showMeetings, setShowMeetings] = useState(false);
  const [expandedMeeting, setExpandedMeeting] = useState(null);

  return (
    <div className={`source-card ${source.discovered ? 'discovered' : ''}`}>
      <div className="source-card-header">
        <div className="source-info">
          <span className="source-name">{source.name}</span>
          <span className="source-url">{source.url}</span>
          <div className="source-stats">
            <span className="source-meeting-count">{source.meetingCount} meetings</span>
            {source.discovered && <span className="source-badge discovered">NEW</span>}
          </div>
        </div>
        <div className="source-actions">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onUse(source)}
          >
            Use This Source
          </button>
        </div>
      </div>

      {source.sampleMeetings && source.sampleMeetings.length > 0 && (
        <div className="source-meetings-section">
          <button
            className="meetings-toggle"
            onClick={() => setShowMeetings(!showMeetings)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Preview Meetings ({source.sampleMeetings.length})</span>
            <svg
              className={`expand-icon ${showMeetings ? 'expanded' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showMeetings && (
            <div className="meetings-preview-list">
              {source.sampleMeetings.map((meeting, idx) => (
                <MeetingPreview
                  key={idx}
                  meeting={meeting}
                  isExpanded={expandedMeeting === idx}
                  onToggle={() => setExpandedMeeting(expandedMeeting === idx ? null : idx)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Expandable script preview component
function ScriptDraftPreview({ draft, onDelete, onUse }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(draft.scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`draft-card ${isExpanded ? 'expanded' : ''}`}>
      <div
        className="draft-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="draft-info">
          <span className={`draft-status ${draft.meetingCount > 0 ? 'valid' : 'needs-work'}`}>
            {draft.meetingCount > 0 ? '✓' : '⚠'}
          </span>
          <div className="draft-details">
            <span className="draft-name">{draft.name}</span>
            <span className="draft-meta">
              {draft.feedType?.toUpperCase()} • {draft.meetingCount} meetings • {draft.state}
            </span>
          </div>
        </div>
        <div className="draft-actions-header">
          <span className={`feed-type-badge ${draft.feedType}`}>{draft.feedType}</span>
          <svg
            className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="draft-content">
          <div className="draft-url">
            <strong>URL:</strong> {draft.url}
          </div>

          <div className="script-preview-container">
            <div className="script-preview-header">
              <span>Python Script</span>
              <button
                className="btn btn-ghost btn-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard();
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="script-code-preview">
              <code>{draft.scriptContent}</code>
            </pre>
          </div>

          <div className="draft-actions">
            <button
              className="btn btn-sm btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(draft.id);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              Delete
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                onUse(draft);
              }}
            >
              Use This Script
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [validateUrls, setValidateUrls] = useState(true);
  const [useDeepDiscovery, setUseDeepDiscovery] = useState(true);
  const [discoveredSources, setDiscoveredSources] = useState([]);
  const [allDiscoveredMeetings, setAllDiscoveredMeetings] = useState([]);

  // Testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [attemptHistory, setAttemptHistory] = useState([]);
  const [isTryingScrape, setIsTryingScrape] = useState(null); // Track which intergroup is being scraped

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load drafts for the selected state
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

  // Initialize from props
  useEffect(() => {
    if (isOpen) {
      if (initialState) {
        setSelectedState(initialState);
        loadDrafts(initialState);
      }
      if (existingSession) {
        setSelectedState(existingSession.state);
        setSourceName(existingSession.sourceName || '');
        setSourceUrl(existingSession.sourceUrl || '');
        setCurrentStep(existingSession.status === 'testing' ? 'test' : 'discover');
        loadDrafts(existingSession.state);
      }
    }
  }, [isOpen, initialState, existingSession, loadDrafts]);

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
    setValidateUrls(true);
    setUseDeepDiscovery(true);
    setDiscoveredSources([]);
    setAllDiscoveredMeetings([]);
    setIsTesting(false);
    setTestResults(null);
    setAttemptHistory([]);
    setIsTryingScrape(null);
    setDrafts([]);
    setIsLoadingDrafts(false);
    setShowDrafts(false);
    setIsSaving(false);
    setSaveSuccess(false);
    onClose();
  };

  // Try to scrape a URL and generate a draft script
  const tryScrape = async (ig) => {
    const domain = ig.domain;
    const url = ig.url || `https://${domain}/wp-admin/admin-ajax.php?action=meetings`;

    setIsTryingScrape(domain);

    try {
      const response = await fetch(`${BACKEND_URL}/api/sources/try-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          name: ig.name,
          state: selectedState,
          saveAsDraft: true
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add or update draft in local state
        if (data.draft) {
          setDrafts(prev => {
            const exists = prev.find(d => d.id === data.draft.id);
            if (exists) {
              return prev.map(d => d.id === data.draft.id ? data.draft : d);
            }
            return [data.draft, ...prev];
          });
          setShowDrafts(true);
        }

        // Update the intergroup with validation result
        setIntergroups(prev => ({
          ...prev,
          generated: prev.generated.map(g =>
            g.domain === domain
              ? { ...g, validated: true, meetingCount: data.totalMeetings, triedAt: new Date().toISOString() }
              : g
          )
        }));

        // If successful, update discovery notes
        setDiscoveryNotes(prev => [
          ...prev,
          `✓ Scraped ${ig.name}: Found ${data.totalMeetings} meetings, script saved as draft`
        ]);
      } else {
        // Mark as failed validation
        setIntergroups(prev => ({
          ...prev,
          generated: prev.generated.map(g =>
            g.domain === domain
              ? { ...g, validated: false, validationError: data.error, triedAt: new Date().toISOString() }
              : g
          )
        }));

        setDiscoveryNotes(prev => [
          ...prev,
          `✗ ${ig.name}: ${data.error || 'Could not scrape meeting data'}`
        ]);
      }
    } catch (error) {
      console.error('Error trying scrape:', error);
      setDiscoveryNotes(prev => [...prev, `✗ ${ig.name}: Network error`]);
    } finally {
      setIsTryingScrape(null);
    }
  };

  // Delete a draft
  const deleteDraft = async (draftId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sources/drafts/${draftId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  // Use a draft to populate the form
  const useDraft = (draft) => {
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

  // Run discovery - calls real API endpoint with optional URL validation
  const runDiscovery = async () => {
    if (!selectedState) return;

    setIsDiscovering(true);
    setDiscoveryNotes([]);
    setIntergroups({ known: [], generated: [] });
    setDiscoveredSources([]);
    setAllDiscoveredMeetings([]);

    // Also load any existing drafts for this state
    loadDrafts(selectedState);

    // Use deep discovery streaming endpoint if enabled
    if (useDeepDiscovery) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/intergroup-research/discover-deep-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: selectedState
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'note') {
                  setDiscoveryNotes(data.notes || []);
                } else if (data.type === 'source_found') {
                  setDiscoveredSources(prev => [...prev, data.source]);
                  setDiscoveryNotes(data.notes || []);
                } else if (data.type === 'complete') {
                  setDiscoveryNotes(data.notes || []);
                  setDiscoveredSources(data.sources || []);
                  setAllDiscoveredMeetings(data.allMeetings || []);

                  // Also update intergroups for backward compatibility
                  setIntergroups({
                    known: [],
                    generated: data.sources?.map(s => ({
                      name: s.name,
                      domain: s.domain || new URL(s.url).hostname,
                      type: s.type,
                      validated: true,
                      meetingCount: s.meetingCount,
                      url: s.url,
                      sampleMeetings: s.sampleMeetings
                    })) || []
                  });
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('Deep discovery error:', error);
        setDiscoveryNotes(prev => [...prev, `Error: ${error.message}`]);
      } finally {
        setIsDiscovering(false);
      }
      return;
    }

    // Original non-streaming discovery
    const initialNote = validateUrls
      ? `Searching and validating AA intergroups in ${stateNames[selectedState]}...`
      : `Searching for AA intergroups in ${stateNames[selectedState]}...`;
    setDiscoveryNotes([initialNote]);

    try {
      // Use validated endpoint if validation is enabled
      const endpoint = validateUrls
        ? `${BACKEND_URL}/api/intergroup-research/discover-validated`
        : `${BACKEND_URL}/api/intergroup-research/discover`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: selectedState,
          validateUrls: validateUrls
        })
      });

      const data = await response.json();

      if (data.success) {
        const notes = [initialNote];

        // Add notes about what was found
        if (data.known && data.known.length > 0) {
          notes.push(`Found ${data.known.length} known intergroup(s) for ${data.stateName}`);
          for (const ig of data.known) {
            notes.push(`→ ${ig.name} (${ig.domain})`);
          }
        }

        if (data.generated && data.generated.length > 0) {
          if (validateUrls) {
            notes.push(`Found ${data.generated.length} validated source(s) with live meeting data`);
            for (const ig of data.generated) {
              notes.push(`✓ ${ig.name}: ${ig.meetingCount} meetings`);
            }
          } else {
            notes.push(`Generated ${data.generated.length} potential domain pattern(s)`);
            for (const ig of data.generated) {
              notes.push(`→ ${ig.domain} (unverified)`);
            }
          }
        } else if (validateUrls && data.generated?.length === 0) {
          notes.push(`No automatically validated sources found. Try clicking "Try" on unvalidated patterns.`);
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

  // Test source URL by calling the real API
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
          feedType: feedType,
          state: selectedState || 'XX',
          name: sourceName || ''
        })
      });

      const data = await response.json();
      setTestResults(data);

      // Add this attempt to history
      setAttemptHistory(prev => [...prev, {
        id: Date.now(),
        url: sourceUrl,
        success: data.success,
        totalMeetings: data.totalMeetings || 0,
        error: data.error || null,
        timestamp: new Date().toISOString()
      }]);

      // Update feed type if auto-detected
      if (data.feedType && feedType === 'auto') {
        setFeedType(data.feedType);
      }

      if (data.success) {
        setCurrentStep('review');
      }
    } catch (error) {
      console.error('Error testing source:', error);
      const errorResult = {
        success: false,
        error: 'Failed to test source. Please check the URL and try again.'
      };
      setTestResults(errorResult);

      setAttemptHistory(prev => [...prev, {
        id: Date.now(),
        url: sourceUrl,
        success: false,
        totalMeetings: 0,
        error: 'Network error - could not reach server',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTesting(false);
    }
  };

  // Save source by calling the real API
  const saveSource = async (submitForReview = false) => {
    if (!sourceUrl.trim() || !sourceName.trim() || !selectedState.trim()) {
      return;
    }

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
          testResults: testResults
        })
      });

      const data = await response.json();

      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onComplete({
            state: selectedState,
            name: sourceName,
            url: sourceUrl,
            feedType,
            submitted: submitForReview
          });
        }, 1000);
      } else {
        setTestResults(prev => ({
          ...prev,
          saveError: data.error || 'Failed to save source'
        }));
      }
    } catch (error) {
      console.error('Error saving source:', error);
      setTestResults(prev => ({
        ...prev,
        saveError: 'Failed to save source. Please try again.'
      }));
    } finally {
      setIsSaving(false);
    }
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
          onChange={(e) => {
            setSelectedState(e.target.value);
            if (e.target.value) loadDrafts(e.target.value);
          }}
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

      {/* Discovery Mode Toggle */}
      <div className="discovery-options">
        <div className="validation-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={useDeepDiscovery}
              onChange={(e) => setUseDeepDiscovery(e.target.checked)}
              disabled={isDiscovering}
            />
            <span className="toggle-text">
              Deep Discovery Mode
              <span className="toggle-hint">
                {useDeepDiscovery ? '(Real-time scraping with meeting previews)' : '(Quick pattern-based search)'}
              </span>
            </span>
          </label>
        </div>

        {!useDeepDiscovery && (
          <div className="validation-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={validateUrls}
                onChange={(e) => setValidateUrls(e.target.checked)}
                disabled={isDiscovering}
              />
              <span className="toggle-text">
                Only show validated URLs
                <span className="toggle-hint">
                  {validateUrls ? '(Tests each URL - slower but more accurate)' : '(Shows all patterns - faster but includes dead links)'}
                </span>
              </span>
            </label>
          </div>
        )}
      </div>

      <button
        className="btn btn-primary discover-btn"
        onClick={runDiscovery}
        disabled={!selectedState || isDiscovering}
      >
        {isDiscovering ? (
          <>
            <span className="btn-spinner"></span>
            {validateUrls ? 'Validating URLs...' : 'Discovering...'}
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
            {isDiscovering && <span className="discovery-spinner"></span>}
          </div>
          <div className="discovery-notes-list">
            {discoveryNotes.map((note, index) => (
              <div
                key={index}
                className={`discovery-note ${note.startsWith('✓') ? 'success' : note.startsWith('✗') ? 'error' : note.includes('Error') ? 'error' : note.includes('DISCOVERED') ? 'discovered' : ''}`}
              >
                <span className="note-bullet">
                  {note.startsWith('✓') ? '' : note.startsWith('✗') ? '' : note.includes('SUCCESS') ? '✓' : note.includes('Checking') || note.includes('Testing') || note.includes('Trying') ? '→' : '•'}
                </span>
                <span className="note-text">{note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovered Sources with Meeting Preview (Deep Discovery Mode) */}
      {useDeepDiscovery && discoveredSources.length > 0 && (
        <div className="discovered-sources-section">
          <div className="discovered-sources-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Found {discoveredSources.length} source(s) with {discoveredSources.reduce((acc, s) => acc + (s.meetingCount || 0), 0)} total meetings</span>
          </div>
          <div className="discovered-sources-list">
            {discoveredSources.map((source, index) => (
              <SourceCard
                key={index}
                source={source}
                onUse={(s) => {
                  setSourceName(s.name);
                  setSourceUrl(s.url);
                  setFeedType('tsml');
                  setTestResults({
                    success: true,
                    totalMeetings: s.meetingCount,
                    feedType: 'tsml',
                    sampleMeetings: s.sampleMeetings
                  });
                  setCurrentStep('review');
                }}
              />
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
              <h4>{validateUrls ? 'Validated Sources' : 'Suggested Patterns'}</h4>
              <div className="intergroups-list">
                {intergroups.generated.map((ig, index) => (
                  <div key={index} className={`intergroup-item generated ${ig.validated ? 'validated' : ig.validationError ? 'failed' : ''}`}>
                    <div className="intergroup-info">
                      <span className="intergroup-name">{ig.name}</span>
                      <span className="intergroup-domain">{ig.domain}</span>
                      {ig.meetingCount > 0 && (
                        <span className="intergroup-meeting-count">{ig.meetingCount} meetings</span>
                      )}
                      {ig.validationError && (
                        <span className="intergroup-error">{ig.validationError}</span>
                      )}
                    </div>
                    <div className="intergroup-actions">
                      {ig.validated ? (
                        <span className="intergroup-type type-validated">✓ Validated</span>
                      ) : ig.validationError ? (
                        <span className="intergroup-type type-failed">✗ Failed</span>
                      ) : (
                        <span className="intergroup-type type-unknown">Unverified</span>
                      )}
                      {!ig.validated && !ig.validationError && (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => tryScrape(ig)}
                          disabled={isTryingScrape === ig.domain}
                        >
                          {isTryingScrape === ig.domain ? (
                            <>
                              <span className="btn-spinner-sm"></span>
                              Scraping...
                            </>
                          ) : (
                            'Try'
                          )}
                        </button>
                      )}
                      {ig.validated && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => selectIntergroup(ig)}
                        >
                          Use This
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved Drafts Section */}
      {(drafts.length > 0 || isLoadingDrafts) && (
        <div className="drafts-section">
          <button
            className="drafts-toggle"
            onClick={() => setShowDrafts(!showDrafts)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span>Saved Drafts ({drafts.length})</span>
            <svg
              className={`expand-icon ${showDrafts ? 'expanded' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showDrafts && (
            <div className="drafts-list">
              {isLoadingDrafts ? (
                <div className="drafts-loading">
                  <span className="btn-spinner"></span>
                  Loading drafts...
                </div>
              ) : (
                drafts.map(draft => (
                  <ScriptDraftPreview
                    key={draft.id}
                    draft={draft}
                    onDelete={deleteDraft}
                    onUse={useDraft}
                  />
                ))
              )}
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
          </div>

          {/* Editable Source Name */}
          <div className="review-name-edit">
            <label>Source Name</label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Enter a name for this source"
              className="source-name-input"
            />
            <span className="form-hint">This name will appear in the sources list</span>
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
