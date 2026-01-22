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

const allStates = Object.keys(stateNames).sort();

function IntergroupResearchPanel({ isExpanded, onToggleExpand }) {
  // Session state
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Research state
  const [selectedState, setSelectedState] = useState('');
  const [intergroups, setIntergroups] = useState({ known: [], generated: [] });
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Probe state
  const [probingDomain, setProbingDomain] = useState(null);
  const [probeNotes, setProbeNotes] = useState([]);
  const [probeResults, setProbeResults] = useState([]);
  const [workingEndpoints, setWorkingEndpoints] = useState([]);
  const probeNotesEndRef = useRef(null);

  // Notes state
  const [sessionNotes, setSessionNotes] = useState([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState('general');

  // Scripts state
  const [savedScripts, setSavedScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Findings state
  const [findings, setFindings] = useState([]);

  // View state
  const [activeTab, setActiveTab] = useState('discover'); // discover, notes, scripts, history

  // Scroll probe notes to bottom
  useEffect(() => {
    if (probeNotesEndRef.current && probeNotes.length > 0) {
      probeNotesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [probeNotes]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load session data when active session changes
  useEffect(() => {
    if (activeSession) {
      loadSessionData(activeSession.id);
    }
  }, [activeSession?.id]);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/sessions`);
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSessionData = async (sessionId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/sessions/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setSessionNotes(data.notes || []);
        setSavedScripts(data.scripts || []);
        setFindings(data.findings || []);
      }
    } catch (error) {
      console.error('Error loading session data:', error);
    }
  };

  const createSession = async () => {
    if (!selectedState) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: selectedState,
          notes: `Research session for ${stateNames[selectedState]}`
        })
      });
      const data = await response.json();
      if (data.success) {
        setSessions(prev => [data.session, ...prev]);
        setActiveSession(data.session);
        discoverIntergroups(data.session.id);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm('Delete this research session and all its data?')) return;

    try {
      await fetch(`${BACKEND_URL}/api/intergroup-research/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setSessionNotes([]);
        setSavedScripts([]);
        setFindings([]);
        setIntergroups({ known: [], generated: [] });
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const discoverIntergroups = async (sessionId = activeSession?.id) => {
    const state = activeSession?.state || selectedState;
    if (!state) return;

    setIsDiscovering(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          sessionId
        })
      });
      const data = await response.json();
      if (data.success) {
        setIntergroups({
          known: data.known || [],
          generated: data.generated || []
        });
      }
    } catch (error) {
      console.error('Error discovering intergroups:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const probeIntergroup = useCallback(async (intergroup) => {
    setProbingDomain(intergroup.domain);
    setProbeNotes([]);
    setProbeResults([]);
    setWorkingEndpoints([]);

    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/probe-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: intergroup.domain,
          name: intergroup.name,
          sessionId: activeSession?.id
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'note') {
                setProbeNotes(data.notes || []);
              } else if (data.type === 'complete') {
                setProbeResults(data.results || []);
                setWorkingEndpoints(data.working || []);

                // Add findings for working endpoints
                if (data.working && data.working.length > 0) {
                  for (const endpoint of data.working) {
                    await addFinding({
                      state: activeSession?.state,
                      intergroupName: intergroup.name,
                      domain: intergroup.domain,
                      url: endpoint.url,
                      type: endpoint.type,
                      status: 'verified',
                      meetingCount: endpoint.meetingCount
                    });
                  }
                }

                // Refresh session to get updated stats
                if (activeSession) {
                  const sessionRes = await fetch(`${BACKEND_URL}/api/intergroup-research/sessions/${activeSession.id}`);
                  const sessionData = await sessionRes.json();
                  if (sessionData.success) {
                    setActiveSession(sessionData.session);
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing probe data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error probing intergroup:', error);
      setProbeNotes(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setProbingDomain(null);
    }
  }, [activeSession]);

  const addFinding = async (finding) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession?.id,
          ...finding
        })
      });
      const data = await response.json();
      if (data.success) {
        setFindings(prev => [...prev, data.finding]);
      }
    } catch (error) {
      console.error('Error adding finding:', error);
    }
  };

  const addNote = async () => {
    if (!newNoteContent.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession?.id,
          type: newNoteType,
          title: newNoteTitle,
          content: newNoteContent
        })
      });
      const data = await response.json();
      if (data.success) {
        setSessionNotes(prev => [...prev, data.note]);
        setNewNoteTitle('');
        setNewNoteContent('');
        setNewNoteType('general');
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await fetch(`${BACKEND_URL}/api/intergroup-research/notes/${noteId}`, {
        method: 'DELETE'
      });
      setSessionNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const generateScript = async (endpoint) => {
    setIsGeneratingScript(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/generate-scraper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: endpoint.url,
          name: endpoint.name || 'Unknown Intergroup',
          state: activeSession?.state || '',
          pageType: endpoint.type || 'html'
        })
      });
      const data = await response.json();
      if (data.success) {
        // Save the script
        const saveResponse = await fetch(`${BACKEND_URL}/api/intergroup-research/scripts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSession?.id,
            state: activeSession?.state,
            intergroupName: endpoint.name,
            domain: new URL(endpoint.url).hostname,
            url: endpoint.url,
            scriptType: 'python',
            feedType: endpoint.type,
            content: data.script,
            description: `Auto-generated script for ${endpoint.name}`
          })
        });
        const saveData = await saveResponse.json();
        if (saveData.success) {
          setSavedScripts(prev => [...prev, saveData.script]);
          setSelectedScript(saveData.script);
          setActiveTab('scripts');
        }
      }
    } catch (error) {
      console.error('Error generating script:', error);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const deleteScript = async (scriptId) => {
    try {
      await fetch(`${BACKEND_URL}/api/intergroup-research/scripts/${scriptId}`, {
        method: 'DELETE'
      });
      setSavedScripts(prev => prev.filter(s => s.id !== scriptId));
      if (selectedScript?.id === scriptId) {
        setSelectedScript(null);
      }
    } catch (error) {
      console.error('Error deleting script:', error);
    }
  };

  const renderSessionSelector = () => (
    <div className="research-session-selector">
      <div className="session-header">
        <h4>Research Sessions</h4>
        <div className="session-new">
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="state-select"
          >
            <option value="">Select state...</option>
            {allStates.map(code => (
              <option key={code} value={code}>
                {code} - {stateNames[code]}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary btn-sm"
            onClick={createSession}
            disabled={!selectedState}
          >
            + New Session
          </button>
        </div>
      </div>

      {isLoadingSessions ? (
        <div className="loading-text">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <p>No research sessions yet.</p>
          <p className="hint">Select a state and click "New Session" to begin.</p>
        </div>
      ) : (
        <div className="sessions-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`}
              onClick={() => {
                setActiveSession(session);
                setSelectedState(session.state);
                discoverIntergroups(session.id);
              }}
            >
              <div className="session-item-header">
                <span className="session-state-badge">{session.state}</span>
                <span className="session-name">{session.stateName}</span>
                <button
                  className="btn-icon btn-danger-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  title="Delete session"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
              <div className="session-stats">
                <span title="Working sources">{session.working_sources || 0} working</span>
                <span title="Endpoints tested">{session.endpoints_tested || 0} tested</span>
                <span title="Failed attempts">{session.failed_attempts || 0} failed</span>
              </div>
              <div className="session-date">
                {new Date(session.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDiscoverTab = () => (
    <div className="research-discover-tab">
      {!activeSession ? (
        <div className="empty-state">
          <p>Select or create a research session to begin.</p>
        </div>
      ) : (
        <>
          <div className="intergroups-section">
            <div className="section-header">
              <h4>Intergroups in {activeSession.stateName}</h4>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => discoverIntergroups()}
                disabled={isDiscovering}
              >
                {isDiscovering ? 'Discovering...' : 'Refresh'}
              </button>
            </div>

            {intergroups.known.length === 0 && intergroups.generated.length === 0 ? (
              <div className="loading-text">
                {isDiscovering ? 'Discovering intergroups...' : 'No intergroups found'}
              </div>
            ) : (
              <div className="intergroups-list">
                {intergroups.known.length > 0 && (
                  <>
                    <div className="intergroups-subheader">Known Intergroups</div>
                    {intergroups.known.map((ig, idx) => (
                      <div key={`known-${idx}`} className="intergroup-item">
                        <div className="intergroup-info">
                          <span className="intergroup-name">{ig.name}</span>
                          <span className="intergroup-domain">{ig.domain}</span>
                          <span className={`intergroup-type type-${ig.type}`}>{ig.type}</span>
                        </div>
                        <div className="intergroup-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => probeIntergroup(ig)}
                            disabled={probingDomain === ig.domain}
                          >
                            {probingDomain === ig.domain ? 'Probing...' : 'Probe'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {intergroups.generated.length > 0 && (
                  <>
                    <div className="intergroups-subheader">Generated Patterns</div>
                    {intergroups.generated.map((ig, idx) => (
                      <div key={`gen-${idx}`} className="intergroup-item generated">
                        <div className="intergroup-info">
                          <span className="intergroup-name">{ig.name}</span>
                          <span className="intergroup-domain">{ig.domain}</span>
                          <span className="intergroup-type type-unknown">unverified</span>
                        </div>
                        <div className="intergroup-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => probeIntergroup(ig)}
                            disabled={probingDomain === ig.domain}
                          >
                            {probingDomain === ig.domain ? 'Probing...' : 'Try'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Probe Results Section */}
          {(probeNotes.length > 0 || probeResults.length > 0) && (
            <div className="probe-results-section">
              <h4>Probe Results</h4>

              {probeNotes.length > 0 && (
                <div className="probe-notes">
                  {probeNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className={`probe-note ${
                        note.includes('✓') ? 'success' :
                        note.includes('✗') ? 'error' :
                        note.includes('~') ? 'partial' : ''
                      }`}
                    >
                      {note}
                    </div>
                  ))}
                  <div ref={probeNotesEndRef} />
                </div>
              )}

              {workingEndpoints.length > 0 && (
                <div className="working-endpoints">
                  <div className="endpoints-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                      <polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                    Working Endpoints ({workingEndpoints.length})
                  </div>
                  {workingEndpoints.map((endpoint, idx) => (
                    <div key={idx} className="endpoint-item">
                      <div className="endpoint-info">
                        <span className="endpoint-url">{endpoint.url}</span>
                        <span className="endpoint-count">{endpoint.meetingCount} meetings</span>
                      </div>
                      <div className="endpoint-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => generateScript(endpoint)}
                          disabled={isGeneratingScript}
                        >
                          {isGeneratingScript ? 'Generating...' : 'Generate Script'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Findings Section */}
          {findings.length > 0 && (
            <div className="findings-section">
              <h4>Verified Sources ({findings.length})</h4>
              <div className="findings-list">
                {findings.map((finding, idx) => (
                  <div key={idx} className="finding-item">
                    <div className="finding-name">{finding.intergroupName}</div>
                    <div className="finding-url">{finding.url}</div>
                    <div className="finding-meta">
                      <span className={`finding-type type-${finding.type}`}>{finding.type}</span>
                      <span className="finding-count">{finding.meetingCount} meetings</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderNotesTab = () => (
    <div className="research-notes-tab">
      {!activeSession ? (
        <div className="empty-state">
          <p>Select a session to view notes.</p>
        </div>
      ) : (
        <>
          <div className="add-note-form">
            <h4>Add Research Note</h4>
            <div className="note-form-row">
              <select
                value={newNoteType}
                onChange={(e) => setNewNoteType(e.target.value)}
                className="note-type-select"
              >
                <option value="general">General</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="learning">Learning</option>
                <option value="reminder">Reminder</option>
              </select>
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Note title (optional)"
                className="note-title-input"
              />
            </div>
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write your research note here... Document what worked, what failed, and what to try next time."
              className="note-content-input"
              rows={4}
            />
            <button
              className="btn btn-primary"
              onClick={addNote}
              disabled={!newNoteContent.trim()}
            >
              Add Note
            </button>
          </div>

          <div className="notes-list">
            <h4>Session Notes ({sessionNotes.length})</h4>
            {sessionNotes.length === 0 ? (
              <div className="empty-state">
                <p>No notes yet. Add notes to track your research progress and learnings.</p>
              </div>
            ) : (
              sessionNotes.map(note => (
                <div key={note.id} className={`note-card note-${note.type}`}>
                  <div className="note-header">
                    <span className={`note-type-badge ${note.type}`}>{note.type}</span>
                    {note.title && <span className="note-title">{note.title}</span>}
                    <button
                      className="btn-icon btn-danger-icon"
                      onClick={() => deleteNote(note.id)}
                      title="Delete note"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                  <div className="note-content">{note.content}</div>
                  <div className="note-meta">
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderScriptsTab = () => (
    <div className="research-scripts-tab">
      {!activeSession ? (
        <div className="empty-state">
          <p>Select a session to view scripts.</p>
        </div>
      ) : (
        <div className="scripts-layout">
          <div className="scripts-list-panel">
            <h4>Saved Scripts ({savedScripts.length})</h4>
            {savedScripts.length === 0 ? (
              <div className="empty-state">
                <p>No scripts saved yet.</p>
                <p className="hint">Probe intergroups and generate scripts from working endpoints.</p>
              </div>
            ) : (
              <div className="scripts-list">
                {savedScripts.map(script => (
                  <div
                    key={script.id}
                    className={`script-item ${selectedScript?.id === script.id ? 'active' : ''}`}
                    onClick={() => setSelectedScript(script)}
                  >
                    <div className="script-item-header">
                      <span className="script-name">{script.intergroupName}</span>
                      <button
                        className="btn-icon btn-danger-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScript(script.id);
                        }}
                        title="Delete script"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                    <div className="script-item-meta">
                      <span className={`script-type-badge ${script.feedType}`}>{script.feedType}</span>
                      <span className="script-domain">{script.domain}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="script-viewer-panel">
            {selectedScript ? (
              <>
                <div className="script-viewer-header">
                  <h4>{selectedScript.intergroupName}</h4>
                  <div className="script-viewer-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedScript.content);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                      Copy
                    </button>
                  </div>
                </div>
                <div className="script-viewer-meta">
                  <span>URL: {selectedScript.url}</span>
                  <span>Type: {selectedScript.feedType}</span>
                </div>
                <pre className="script-code">
                  <code>{selectedScript.content}</code>
                </pre>
              </>
            ) : (
              <div className="empty-state">
                <p>Select a script to view its contents.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="research-history-tab">
      <h4>Research History</h4>
      <div className="history-summary">
        <div className="history-stat">
          <span className="stat-value">{sessions.length}</span>
          <span className="stat-label">Sessions</span>
        </div>
        <div className="history-stat">
          <span className="stat-value">{new Set(sessions.map(s => s.state)).size}</span>
          <span className="stat-label">States Researched</span>
        </div>
        <div className="history-stat">
          <span className="stat-value">
            {sessions.reduce((acc, s) => acc + (s.working_sources || 0), 0)}
          </span>
          <span className="stat-label">Sources Found</span>
        </div>
      </div>

      <div className="history-by-state">
        <h5>By State</h5>
        {Object.entries(
          sessions.reduce((acc, session) => {
            if (!acc[session.state]) {
              acc[session.state] = {
                stateName: session.stateName,
                sessions: 0,
                working: 0,
                tested: 0
              };
            }
            acc[session.state].sessions++;
            acc[session.state].working += session.working_sources || 0;
            acc[session.state].tested += session.endpoints_tested || 0;
            return acc;
          }, {})
        ).map(([state, data]) => (
          <div key={state} className="history-state-row">
            <span className="state-badge">{state}</span>
            <span className="state-name">{data.stateName}</span>
            <span className="state-stats">
              {data.sessions} session{data.sessions !== 1 ? 's' : ''} |
              {data.working} working |
              {data.tested} tested
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`intergroup-research-panel ${isExpanded ? 'expanded' : ''}`}>
      <div className="research-panel-header">
        <div className="header-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <path d="M11 8v6M8 11h6"/>
          </svg>
          <h3>Intergroup Research</h3>
          {activeSession && (
            <span className="active-session-badge">{activeSession.state}</span>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onToggleExpand}
            title={isExpanded ? 'Collapse panel' : 'Expand to 50%'}
          >
            {isExpanded ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 14 10 14 10 20"/>
                <polyline points="20 10 14 10 14 4"/>
                <line x1="14" y1="10" x2="21" y2="3"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9"/>
                <polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="research-panel-body">
        <div className="research-sidebar">
          {renderSessionSelector()}
        </div>

        <div className="research-main">
          <div className="research-tabs">
            <button
              className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
              onClick={() => setActiveTab('discover')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              Discover
            </button>
            <button
              className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              Notes
              {sessionNotes.length > 0 && (
                <span className="tab-badge">{sessionNotes.length}</span>
              )}
            </button>
            <button
              className={`tab-btn ${activeTab === 'scripts' ? 'active' : ''}`}
              onClick={() => setActiveTab('scripts')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Scripts
              {savedScripts.length > 0 && (
                <span className="tab-badge">{savedScripts.length}</span>
              )}
            </button>
            <button
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              History
            </button>
          </div>

          <div className="research-tab-content">
            {activeTab === 'discover' && renderDiscoverTab()}
            {activeTab === 'notes' && renderNotesTab()}
            {activeTab === 'scripts' && renderScriptsTab()}
            {activeTab === 'history' && renderHistoryTab()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntergroupResearchPanel;
