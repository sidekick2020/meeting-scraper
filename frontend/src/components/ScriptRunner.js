import React, { useState, useRef, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ScriptRunner({ script, onScriptUpdated, onClose }) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('logs'); // logs, meetings, history
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (script?.id) {
      fetchExecutionHistory();
    }
  }, [script?.id]);

  useEffect(() => {
    if (logsEndRef.current && logs.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const fetchExecutionHistory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/scripts/${script.id}/executions`);
      const data = await response.json();
      if (data.success) {
        setExecutionHistory(data.executions);
      }
    } catch (error) {
      console.error('Error fetching execution history:', error);
    }
  };

  const executeScript = async () => {
    setIsExecuting(true);
    setLogs([]);
    setMeetings([]);
    setExecutionResult(null);
    setSelectedMeeting(null);
    setActiveTab('logs');

    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/scripts/${script.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (data.success) {
        setExecutionResult(data.execution);
        setLogs(data.execution.logs || []);
        setMeetings(data.meetings || []);
        fetchExecutionHistory();
      } else {
        setExecutionResult({ success: false, error: data.error });
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error executing script:', error);
      setExecutionResult({ success: false, error: error.message });
      setLogs([{ level: 'error', message: error.message, timestamp: new Date().toISOString() }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const regenerateScript = async () => {
    setIsRegenerating(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/intergroup-research/scripts/${script.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (data.success) {
        if (onScriptUpdated) {
          onScriptUpdated(data.script);
        }
        // Show regeneration info
        setLogs(prev => [
          ...prev,
          { level: 'info', message: '--- Script Regenerated ---', timestamp: new Date().toISOString() },
          { level: 'info', message: `Issues addressed: ${data.issues.join(', ') || 'None specific'}`, timestamp: new Date().toISOString() },
          { level: 'info', message: `Suggestions applied: ${data.suggestions.join(', ') || 'Standard improvements'}`, timestamp: new Date().toISOString() }
        ]);
      } else {
        setLogs(prev => [
          ...prev,
          { level: 'error', message: `Regeneration failed: ${data.error}`, timestamp: new Date().toISOString() }
        ]);
      }
    } catch (error) {
      console.error('Error regenerating script:', error);
      setLogs(prev => [
        ...prev,
        { level: 'error', message: `Regeneration error: ${error.message}`, timestamp: new Date().toISOString() }
      ]);
    } finally {
      setIsRegenerating(false);
    }
  };

  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLogIcon = (level) => {
    switch (level) {
      case 'success':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22,4 12,14.01 9,11.01"/>
          </svg>
        );
      case 'error':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        );
      case 'warning':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        );
    }
  };

  const renderLogsTab = () => (
    <div className="script-runner-logs">
      {logs.length === 0 ? (
        <div className="logs-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p>No logs yet. Click "Run Script" to execute.</p>
        </div>
      ) : (
        <div className="logs-list">
          {logs.map((log, idx) => (
            <div key={idx} className={`log-entry log-${log.level}`}>
              <span className="log-icon">{getLogIcon(log.level)}</span>
              <span className="log-time">{formatTimestamp(log.timestamp)}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );

  const renderMeetingsTab = () => (
    <div className="script-runner-meetings">
      {meetings.length === 0 ? (
        <div className="meetings-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <p>No meetings data. Run the script first.</p>
        </div>
      ) : (
        <div className="meetings-grid">
          <div className="meetings-header">
            <span className="meetings-count">{meetings.length} meetings found</span>
            {executionResult?.qualityScore && (
              <span className={`quality-badge quality-${executionResult.qualityScore >= 80 ? 'high' : executionResult.qualityScore >= 50 ? 'medium' : 'low'}`}>
                {executionResult.qualityScore}% quality
              </span>
            )}
          </div>
          <div className="meetings-table-wrapper">
            <table className="meetings-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>City</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting, idx) => (
                  <tr key={idx} className={selectedMeeting === idx ? 'selected' : ''}>
                    <td className="meeting-name-cell">{meeting.name || '-'}</td>
                    <td>{meeting.day !== undefined && meeting.day !== null ? DAY_NAMES[meeting.day]?.slice(0, 3) : '-'}</td>
                    <td>{meeting.time || '-'}</td>
                    <td>{meeting.city || '-'}</td>
                    <td>
                      <button
                        className="btn btn-xs btn-ghost"
                        onClick={() => setSelectedMeeting(idx === selectedMeeting ? null : idx)}
                      >
                        {selectedMeeting === idx ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="script-runner-history">
      {executionHistory.length === 0 ? (
        <div className="history-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>No execution history yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {executionHistory.slice().reverse().map((exec, idx) => (
            <div key={idx} className={`history-item ${exec.success ? 'success' : 'error'}`}>
              <div className="history-header">
                <span className={`history-status ${exec.success ? 'success' : 'error'}`}>
                  {exec.success ? '✓ Success' : '✗ Failed'}
                </span>
                <span className="history-date">
                  {new Date(exec.executedAt).toLocaleString()}
                </span>
              </div>
              {exec.success ? (
                <div className="history-stats">
                  <span>{exec.totalNormalized} meetings</span>
                  <span>{exec.qualityScore}% quality</span>
                  <span>{exec.duration_ms}ms</span>
                </div>
              ) : (
                <div className="history-error">{exec.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMeetingDetails = () => {
    if (selectedMeeting === null || !meetings[selectedMeeting]) return null;
    const meeting = meetings[selectedMeeting];

    return (
      <div className="meeting-details-sidebar">
        <div className="meeting-details-header">
          <h4>Meeting Details</h4>
          <button
            className="btn-icon"
            onClick={() => setSelectedMeeting(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="meeting-details-content">
          <div className="detail-group">
            <label>Name</label>
            <span className="detail-value">{meeting.name || 'Not specified'}</span>
          </div>
          <div className="detail-row">
            <div className="detail-group">
              <label>Day</label>
              <span className="detail-value">
                {meeting.day !== undefined && meeting.day !== null ? DAY_NAMES[meeting.day] : 'Not specified'}
              </span>
            </div>
            <div className="detail-group">
              <label>Time</label>
              <span className="detail-value">{meeting.time || 'Not specified'}</span>
            </div>
          </div>
          <div className="detail-group">
            <label>Location</label>
            <span className="detail-value">{meeting.location || 'Not specified'}</span>
          </div>
          <div className="detail-group">
            <label>Address</label>
            <span className="detail-value">{meeting.address || 'Not specified'}</span>
          </div>
          <div className="detail-row">
            <div className="detail-group">
              <label>City</label>
              <span className="detail-value">{meeting.city || 'Not specified'}</span>
            </div>
            <div className="detail-group">
              <label>State</label>
              <span className="detail-value">{meeting.state || 'Not specified'}</span>
            </div>
          </div>
          {meeting.latitude && meeting.longitude && (
            <div className="detail-group">
              <label>Coordinates</label>
              <span className="detail-value">{meeting.latitude}, {meeting.longitude}</span>
            </div>
          )}
          {meeting.types && meeting.types.length > 0 && (
            <div className="detail-group">
              <label>Types</label>
              <div className="detail-tags">
                {meeting.types.map((type, i) => (
                  <span key={i} className="type-tag">{type}</span>
                ))}
              </div>
            </div>
          )}
          {meeting.notes && (
            <div className="detail-group">
              <label>Notes</label>
              <span className="detail-value notes">{meeting.notes}</span>
            </div>
          )}
          <div className="detail-group">
            <label>Meeting Type</label>
            <span className={`meeting-type-badge ${meeting.meeting_type?.toLowerCase()}`}>
              {meeting.meeting_type || 'Unknown'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="script-runner">
      <div className="script-runner-header">
        <div className="header-left">
          <h3>{script?.intergroupName || 'Script Runner'}</h3>
          <span className="script-url">{script?.url}</span>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={executeScript}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <>
                <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run Script
              </>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={regenerateScript}
            disabled={isRegenerating || executionHistory.length === 0}
            title={executionHistory.length === 0 ? 'Run the script first to enable regeneration' : 'Regenerate script based on execution logs'}
          >
            {isRegenerating ? (
              <>
                <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Regenerating...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                Regenerate
              </>
            )}
          </button>
          {onClose && (
            <button className="btn btn-ghost" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {executionResult && (
        <div className={`execution-summary ${executionResult.success ? 'success' : 'error'}`}>
          {executionResult.success ? (
            <>
              <span className="summary-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
              </span>
              <span className="summary-text">
                Found {executionResult.totalNormalized} meetings ({executionResult.qualityScore}% quality) in {executionResult.duration_ms}ms
              </span>
            </>
          ) : (
            <>
              <span className="summary-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </span>
              <span className="summary-text">{executionResult.error}</span>
            </>
          )}
        </div>
      )}

      <div className="script-runner-tabs">
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          Logs
          {logs.length > 0 && <span className="tab-badge">{logs.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'meetings' ? 'active' : ''}`}
          onClick={() => setActiveTab('meetings')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          Meetings
          {meetings.length > 0 && <span className="tab-badge">{meetings.length}</span>}
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
          {executionHistory.length > 0 && <span className="tab-badge">{executionHistory.length}</span>}
        </button>
      </div>

      <div className="script-runner-content">
        <div className={`content-main ${selectedMeeting !== null ? 'with-sidebar' : ''}`}>
          {activeTab === 'logs' && renderLogsTab()}
          {activeTab === 'meetings' && renderMeetingsTab()}
          {activeTab === 'history' && renderHistoryTab()}
        </div>
        {selectedMeeting !== null && renderMeetingDetails()}
      </div>
    </div>
  );
}

export default ScriptRunner;
