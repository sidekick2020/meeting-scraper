import React, { useState, useEffect, useCallback, useRef } from 'react';

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

  // Streaming research state
  const [researchProgress, setResearchProgress] = useState({ step: 0, total: 5, message: '' });
  const [researchNotes, setResearchNotes] = useState([]);
  const [testedUrls, setTestedUrls] = useState([]);
  const [generatedScript, setGeneratedScript] = useState(null);
  const notesEndRef = useRef(null);

  // Test scrape state
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [testAttempts, setTestAttempts] = useState(0);
  const [suggestions, setSuggestions] = useState([]);

  // Attempt history - tracks all previous tries with their results and scripts
  const [attemptHistory, setAttemptHistory] = useState([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Submit for review state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Script expansion state
  const [isScriptExpanded, setIsScriptExpanded] = useState(false);

  // Scroll research notes to bottom when new notes arrive
  useEffect(() => {
    if (notesEndRef.current && researchNotes.length > 0) {
      notesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [researchNotes]);

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
      setSubmitSuccess(false);
      setIsScriptExpanded(false);

      // Reset streaming research state
      setResearchProgress({ step: 0, total: 5, message: '' });
      setResearchNotes([]);
      setTestedUrls([]);
      setGeneratedScript(null);

      // Reset attempt history
      setAttemptHistory([]);
      setIsHistoryExpanded(false);

      // Auto-research on open if we have state info
      if (task.state && !task.url) {
        streamResearch();
      }
    }
  }, [task, isOpen]);

  // Auto-research function to find potential URLs (legacy, non-streaming)
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

  // Streaming research function with real-time progress updates
  // excludedUrls parameter allows retrying while avoiding previously tried URLs
  const streamResearch = useCallback(async (excludedUrls = []) => {
    if (!task) return;

    setIsResearching(true);
    setResearchError(null);
    setResearchResults(null);
    setResearchProgress({ step: 0, total: 5, message: 'Initializing...' });
    setResearchNotes([]);
    setTestedUrls([]);
    setGeneratedScript(null);

    // Gather all previously tried URLs to exclude
    const allExcludedUrls = [
      ...excludedUrls,
      ...attemptHistory.map(a => a.url)
    ];

    try {
      // Use fetch with ReadableStream for SSE
      const response = await fetch(`${BACKEND_URL}/api/tasks/research-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: task.state || sourceState,
          title: task.title,
          description: task.description,
          type: task.type,
          // Pass excluded URLs and previous failure info to help research
          excludedUrls: allExcludedUrls,
          previousFailures: attemptHistory.filter(a => !a.success).map(a => ({
            url: a.url,
            error: a.error,
            feedType: a.feedType
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Research stream failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setResearchProgress({
                  step: data.step,
                  total: data.total,
                  message: data.message
                });
              } else if (data.type === 'note') {
                setResearchNotes(data.notes || []);
                if (data.tested) {
                  setTestedUrls(data.tested);
                }
              } else if (data.type === 'complete') {
                // Research complete - populate fields
                setResearchResults(data);

                if (data.suggestions && data.suggestions.length > 0) {
                  // Find the best verified suggestion
                  const bestSuggestion = data.suggestions.find(s => s.verified) || data.suggestions[0];
                  if (bestSuggestion) {
                    setSourceUrl(bestSuggestion.url);
                    setSourceName(bestSuggestion.name);
                    setFeedType(bestSuggestion.feedType || 'auto');
                  }
                }

                if (data.bestResult) {
                  // Set test results from the best result
                  setTestResults({
                    success: true,
                    totalMeetings: data.bestResult.totalMeetings,
                    feedType: data.bestResult.feedType,
                    stateBreakdown: data.bestResult.stateBreakdown,
                    sampleMeetings: data.bestResult.sampleMeetings,
                    generatedScript: data.generatedScript
                  });
                }

                if (data.generatedScript) {
                  setGeneratedScript(data.generatedScript);
                }

                setResearchProgress({ step: 5, total: 5, message: 'Research complete!' });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during streaming research:', error);
      setResearchError('Failed to research. Please enter details manually.');
      // Fall back to non-streaming research
      autoResearch();
    } finally {
      setIsResearching(false);
    }
  }, [task, sourceState, autoResearch, attemptHistory]);

  // Retry research with new sources, excluding all previously tried URLs
  const retryWithNewResearch = useCallback(() => {
    // Clear current results and do fresh research excluding all tried URLs
    setTestResults(null);
    setSuggestions([]);
    setSourceUrl('');
    setSourceName('');
    // Start fresh research that avoids all previously tried URLs
    streamResearch(attemptHistory.map(a => a.url));
  }, [attemptHistory, streamResearch]);

  // Test the source URL
  const testSource = async (retryWithAlternate = false) => {
    if (!sourceUrl.trim()) return;

    const currentAttemptNumber = testAttempts + 1;
    const urlBeingTested = sourceUrl;

    setIsTesting(true);
    setTestResults(null);
    setSuggestions([]);
    setTestAttempts(currentAttemptNumber);
    setIsScriptExpanded(false);

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/test-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          feedType: feedType,
          state: sourceState || 'XX',
          name: sourceName || '',  // Include source name for script generation
          attempt: currentAttemptNumber,
          retryWithAlternate,
          // Pass previous attempts to backend so it can learn from failures
          previousAttempts: attemptHistory.map(a => ({
            url: a.url,
            error: a.error,
            feedType: a.feedType
          }))
        })
      });

      const data = await response.json();
      setTestResults(data);

      // Add this attempt to history
      const attemptRecord = {
        id: Date.now(),
        attemptNumber: currentAttemptNumber,
        url: urlBeingTested,
        feedType: data.feedType || feedType,
        success: data.success,
        error: data.error || null,
        hint: data.hint || null,
        totalMeetings: data.totalMeetings || 0,
        generatedScript: data.generatedScript || null,
        timestamp: new Date().toISOString()
      };
      setAttemptHistory(prev => [...prev, attemptRecord]);

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
      const errorResult = {
        success: false,
        error: 'Failed to test source. Please check the URL and try again.'
      };
      setTestResults(errorResult);

      // Add failed attempt to history
      const attemptRecord = {
        id: Date.now(),
        attemptNumber: currentAttemptNumber,
        url: urlBeingTested,
        feedType: feedType,
        success: false,
        error: 'Network error - could not reach server',
        hint: null,
        totalMeetings: 0,
        generatedScript: null,
        timestamp: new Date().toISOString()
      };
      setAttemptHistory(prev => [...prev, attemptRecord]);

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

  // Submit source for review (non-admin workflow)
  const submitForReview = async () => {
    if (!sourceUrl.trim() || !sourceName.trim() || !sourceState.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          name: sourceName,
          state: sourceState,
          feedType: feedType === 'auto' ? 'tsml' : feedType,
          taskId: task?.id,
          testResults: testResults,
          notes: ''
        })
      });

      const data = await response.json();

      if (data.success) {
        setSubmitSuccess(true);

        // Mark task as completed
        if (task?.id && onTaskUpdate) {
          onTaskUpdate(task.id, 'completed');
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
      console.error('Error submitting for review:', error);
      setTestResults({
        ...testResults,
        saveError: 'Failed to submit. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
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
    setSubmitSuccess(false);
    // Reset streaming research state
    setResearchProgress({ step: 0, total: 5, message: '' });
    setResearchNotes([]);
    setTestedUrls([]);
    setGeneratedScript(null);
    // Reset attempt history
    setAttemptHistory([]);
    setIsHistoryExpanded(false);
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
          {/* Task Info with Research Button */}
          <div className="task-sidebar-task-info">
            <div className="task-info-row">
              <div className="task-info-content">
                <div className="task-info-title">{task.title}</div>
                {task.description && (
                  <div className="task-info-description">{task.description}</div>
                )}
              </div>
              {!isResearching && task.state && (
                <button
                  className="btn btn-sm btn-secondary research-btn"
                  onClick={streamResearch}
                  title="Research meeting sources"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                  Research
                </button>
              )}
            </div>
          </div>

          {/* Research Progress Section */}
          {isResearching && (
            <div className="research-progress-section">
              <div className="research-progress-header">
                <div className="research-spinner"></div>
                <span className="research-progress-message">{researchProgress.message || 'Researching...'}</span>
              </div>

              {/* Progress bar */}
              <div className="research-progress-bar-container">
                <div
                  className="research-progress-bar"
                  style={{ width: `${(researchProgress.step / researchProgress.total) * 100}%` }}
                />
                <span className="research-progress-steps">
                  Step {researchProgress.step} of {researchProgress.total}
                </span>
              </div>

              {/* Research notes */}
              {researchNotes.length > 0 && (
                <div className="research-notes-section">
                  <div className="research-notes-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span>Research Notes</span>
                  </div>
                  <div className="research-notes-list">
                    {researchNotes.map((note, index) => (
                      <div key={index} className={`research-note ${note.includes('SUCCESS') ? 'success' : note.includes('Timeout') || note.includes('failed') || note.includes('HTTP') ? 'error' : ''}`}>
                        <span className="note-bullet">
                          {note.includes('SUCCESS') ? '✓' : note.includes('Testing:') ? '→' : '•'}
                        </span>
                        <span className="note-text">{note}</span>
                      </div>
                    ))}
                    <div ref={notesEndRef} />
                  </div>
                </div>
              )}

              {/* Tested URLs summary */}
              {testedUrls.length > 0 && (
                <div className="tested-urls-section">
                  <div className="tested-urls-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                      <polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                    <span>Working Sources Found ({testedUrls.length})</span>
                  </div>
                  <div className="tested-urls-list">
                    {testedUrls.map((result, index) => (
                      <div key={index} className="tested-url-item">
                        <span className="tested-url-name">{result.name}</span>
                        <span className="tested-url-count">{result.totalMeetings} meetings</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Research Complete - Show notes history (collapsed) */}
          {!isResearching && researchNotes.length > 0 && (
            <div className="research-complete-section">
              <details className="research-notes-details">
                <summary className="research-notes-summary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                  </svg>
                  <span>Research Notes ({researchNotes.length})</span>
                  <svg className="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6,9 12,15 18,9"/>
                  </svg>
                </summary>
                <div className="research-notes-list collapsed">
                  {researchNotes.map((note, index) => (
                    <div key={index} className={`research-note ${note.includes('SUCCESS') ? 'success' : note.includes('Timeout') || note.includes('failed') || note.includes('HTTP') ? 'error' : ''}`}>
                      <span className="note-bullet">
                        {note.includes('SUCCESS') ? '✓' : note.includes('Testing:') ? '→' : '•'}
                      </span>
                      <span className="note-text">{note}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {researchResults && researchResults.suggestions && researchResults.suggestions.length > 0 && (
            <div className="task-sidebar-section">
              <h4>Suggested Sources</h4>
              <div className="research-suggestions">
                {researchResults.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`research-suggestion ${sourceUrl === suggestion.url ? 'selected' : ''} ${suggestion.verified ? 'verified' : ''}`}
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <div className="suggestion-header">
                      <div className="suggestion-name">{suggestion.name}</div>
                      {suggestion.verified && (
                        <span className="suggestion-verified">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                            <polyline points="22,4 12,14.01 9,11.01"/>
                          </svg>
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="suggestion-url">{suggestion.url?.substring(0, 50)}...</div>
                    <div className="suggestion-meta">
                      <span className={`suggestion-type ${suggestion.feedType}`}>
                        {suggestion.feedType?.toUpperCase()}
                      </span>
                      {suggestion.meetingCount && (
                        <span className="suggestion-meetings">
                          {suggestion.meetingCount} meetings
                        </span>
                      )}
                      {suggestion.confidence && !suggestion.meetingCount && (
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

              {testResults && !testResults.success && (
                <div className="retry-actions">
                  <button
                    className="btn btn-ghost btn-retry"
                    onClick={() => testSource(true)}
                    disabled={isTesting}
                    title="Retry with URL fixes"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6"/>
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                    </svg>
                    Retry URL
                  </button>
                  <button
                    className="btn btn-secondary btn-retry-research"
                    onClick={retryWithNewResearch}
                    disabled={isTesting || isResearching}
                    title="Research new sources (won't try the same URLs)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="M21 21l-4.35-4.35"/>
                    </svg>
                    Try New Source
                  </button>
                </div>
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

            {/* Generated Script - Expandable with prominent styling */}
            {testResults?.success && testResults?.generatedScript && (
              <div className="generated-script-section prominent">
                <button
                  className="script-toggle-btn"
                  onClick={() => setIsScriptExpanded(!isScriptExpanded)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`script-chevron ${isScriptExpanded ? 'expanded' : ''}`}
                  >
                    <polyline points="9,18 15,12 9,6"/>
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16 18 22 12 16 6"/>
                    <polyline points="8 6 2 12 8 18"/>
                  </svg>
                  <span>View Python Script</span>
                  <span className="script-badge">{testResults.feedType?.toUpperCase()}</span>
                </button>
                {isScriptExpanded && (
                  <div className="script-content">
                    <div className="script-header">
                      <span className="script-filename">
                        scrape_{(sourceName || 'source').toLowerCase().replace(/\s+/g, '_')}.py
                      </span>
                      <button
                        className="script-copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(testResults.generatedScript);
                        }}
                        title="Copy to clipboard"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Copy
                      </button>
                    </div>
                    <pre className="script-code"><code>{testResults.generatedScript}</code></pre>
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

            {/* Previous Attempts History */}
            {attemptHistory.length > 0 && (
              <div className="attempt-history-section">
                <button
                  className="history-toggle-btn"
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`history-chevron ${isHistoryExpanded ? 'expanded' : ''}`}
                  >
                    <polyline points="9,18 15,12 9,6"/>
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>Previous Attempts ({attemptHistory.length})</span>
                  <span className="history-summary">
                    {attemptHistory.filter(a => a.success).length} succeeded, {attemptHistory.filter(a => !a.success).length} failed
                  </span>
                </button>
                {isHistoryExpanded && (
                  <div className="attempt-history-list">
                    {attemptHistory.map((attempt, index) => (
                      <AttemptHistoryItem
                        key={attempt.id}
                        attempt={attempt}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="task-sidebar-footer">
          {(saveSuccess || submitSuccess) ? (
            <div className="save-success-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
              {saveSuccess ? 'Source added successfully!' : 'Submitted for review!'}
            </div>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={handleClose}>
                Cancel
              </button>
              <div className="footer-actions">
                {/* Submit for Review - for non-admin users */}
                <button
                  className="btn btn-secondary"
                  onClick={submitForReview}
                  disabled={!canSave || isSubmitting || isSaving}
                  title="Submit for admin review before adding to sources"
                >
                  {isSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13"/>
                        <path d="M22 2L15 22l-4-9-9-4 20-7z"/>
                      </svg>
                      Submit for Review
                    </>
                  )}
                </button>
                {/* Save to Sources - for admin users */}
                <button
                  className="btn btn-primary"
                  onClick={saveSource}
                  disabled={!canSave || isSaving || isSubmitting}
                  title="Add directly to sources (admin)"
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
              </div>
            </>
          )}
          {!canSave && !saveSuccess && !submitSuccess && testResults?.success && (
            <span className="footer-hint">Fill in all fields to continue</span>
          )}
          {!canSave && !saveSuccess && !submitSuccess && !testResults?.success && (
            <span className="footer-hint">Test the source first</span>
          )}
        </div>
      </div>
    </>
  );
}

// Sub-component for displaying attempt history items
function AttemptHistoryItem({ attempt, index }) {
  const [isScriptExpanded, setIsScriptExpanded] = useState(false);

  return (
    <div className={`attempt-item ${attempt.success ? 'success' : 'failed'}`}>
      <div className="attempt-header">
        <div className="attempt-number">
          <span className={`attempt-status-icon ${attempt.success ? 'success' : 'failed'}`}>
            {attempt.success ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
          </span>
          Attempt #{attempt.attemptNumber}
        </div>
        <span className={`attempt-badge ${attempt.feedType}`}>
          {attempt.feedType?.toUpperCase()}
        </span>
      </div>

      <div className="attempt-url" title={attempt.url}>
        {attempt.url?.length > 60 ? attempt.url.substring(0, 60) + '...' : attempt.url}
      </div>

      {attempt.success ? (
        <div className="attempt-success-info">
          Found {attempt.totalMeetings} meetings
        </div>
      ) : (
        <div className="attempt-error-info">
          <span className="attempt-error">{attempt.error}</span>
          {attempt.hint && <span className="attempt-hint">{attempt.hint}</span>}
        </div>
      )}

      {attempt.generatedScript && (
        <div className="attempt-script-section">
          <button
            className="attempt-script-toggle"
            onClick={() => setIsScriptExpanded(!isScriptExpanded)}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`chevron ${isScriptExpanded ? 'expanded' : ''}`}
            >
              <polyline points="9,18 15,12 9,6"/>
            </svg>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            <span>View Script</span>
          </button>
          {isScriptExpanded && (
            <div className="attempt-script-content">
              <div className="attempt-script-header">
                <button
                  className="script-copy-btn small"
                  onClick={() => navigator.clipboard.writeText(attempt.generatedScript)}
                  title="Copy to clipboard"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                  Copy
                </button>
              </div>
              <pre className="attempt-script-code"><code>{attempt.generatedScript}</code></pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskSidebar;
