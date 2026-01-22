import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function SubmissionsPanel() {
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [expandedScriptId, setExpandedScriptId] = useState(null);

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/submissions`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions || []);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Review submission (approve/reject)
  const reviewSubmission = async (submissionId, action) => {
    setProcessingId(submissionId);

    try {
      const response = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewer: 'admin',
          notes: ''
        })
      });

      if (response.ok) {
        // Refresh submissions
        fetchSubmissions();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error reviewing submission:', error);
      alert('Failed to process submission');
    } finally {
      setProcessingId(null);
    }
  };

  // Delete submission
  const deleteSubmission = async (submissionId) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchSubmissions();
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
    }
  };

  const filteredSubmissions = submissions.filter(s => {
    if (filterStatus === 'all') return true;
    return s.status === filterStatus;
  });

  const counts = {
    all: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="submissions-panel">
        <div className="submissions-loading">Loading submissions...</div>
      </div>
    );
  }

  return (
    <div className="submissions-panel">
      {/* Header */}
      <div className="submissions-header">
        <div className="submissions-header-left">
          <h2>Source Submissions</h2>
          <p className="submissions-subtitle">
            Review and approve user-submitted meeting sources
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchSubmissions}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="submissions-filters">
        {['pending', 'approved', 'rejected', 'all'].map(status => (
          <button
            key={status}
            className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
            onClick={() => setFilterStatus(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="filter-count">{counts[status]}</span>
          </button>
        ))}
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="submissions-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 2L11 13"/>
            <path d="M22 2L15 22l-4-9-9-4 20-7z"/>
          </svg>
          <p>
            {filterStatus === 'pending'
              ? 'No pending submissions to review'
              : `No ${filterStatus} submissions`}
          </p>
        </div>
      ) : (
        <div className="submissions-list">
          {filteredSubmissions.map(submission => (
            <div key={submission.id} className={`submission-card status-${submission.status}`}>
              <div className="submission-header">
                <div className="submission-name">{submission.name}</div>
                <span className={`submission-status-badge ${submission.status}`}>
                  {submission.status}
                </span>
              </div>

              <div className="submission-details">
                <div className="submission-url">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                  <span>{submission.url}</span>
                </div>

                <div className="submission-meta">
                  <span className="submission-state">{submission.state}</span>
                  <span className={`submission-type ${submission.feedType}`}>
                    {submission.feedType?.toUpperCase()}
                  </span>
                  {submission.testResults?.totalMeetings && (
                    <span className="submission-meetings">
                      {submission.testResults.totalMeetings} meetings
                    </span>
                  )}
                </div>

                {submission.testResults?.sampleMeetings?.length > 0 && (
                  <div className="submission-samples">
                    <span className="samples-label">Sample:</span>
                    {submission.testResults.sampleMeetings.map((m, i) => (
                      <span key={i} className="sample-meeting-tag">
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Generated Script - Expandable */}
                {submission.testResults?.generatedScript && (
                  <div className="submission-script-section">
                    <button
                      className="script-toggle-btn"
                      onClick={() => setExpandedScriptId(
                        expandedScriptId === submission.id ? null : submission.id
                      )}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`script-chevron ${expandedScriptId === submission.id ? 'expanded' : ''}`}
                      >
                        <polyline points="9,18 15,12 9,6"/>
                      </svg>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                      </svg>
                      <span>Python Script</span>
                    </button>
                    {expandedScriptId === submission.id && (
                      <div className="script-content">
                        <div className="script-header">
                          <span className="script-filename">
                            scrape_{submission.name.toLowerCase().replace(/\s+/g, '_')}.py
                          </span>
                          <button
                            className="script-copy-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(submission.testResults.generatedScript);
                            }}
                            title="Copy to clipboard"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                            Copy
                          </button>
                        </div>
                        <pre className="script-code"><code>{submission.testResults.generatedScript}</code></pre>
                      </div>
                    )}
                  </div>
                )}

                <div className="submission-footer">
                  <span className="submission-date">
                    Submitted {formatDate(submission.submittedAt)}
                  </span>
                  {submission.reviewedAt && (
                    <span className="submission-reviewed">
                      Reviewed {formatDate(submission.reviewedAt)}
                    </span>
                  )}
                </div>
              </div>

              {submission.status === 'pending' && (
                <div className="submission-actions">
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => reviewSubmission(submission.id, 'approve')}
                    disabled={processingId === submission.id}
                  >
                    {processingId === submission.id ? (
                      <span className="btn-spinner"></span>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20,6 9,17 4,12"/>
                        </svg>
                        Approve
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => reviewSubmission(submission.id, 'reject')}
                    disabled={processingId === submission.id}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Reject
                  </button>
                </div>
              )}

              {submission.status !== 'pending' && (
                <div className="submission-actions">
                  <button
                    className="btn btn-xs btn-ghost btn-danger"
                    onClick={() => deleteSubmission(submission.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SubmissionsPanel;
