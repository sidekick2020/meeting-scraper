import React, { useEffect, useRef, useMemo } from 'react';

const PHASE_DEFINITIONS = {
  full: [
    { name: 'Fetching meetings', minProgress: 0, maxProgress: 15 },
    { name: 'Deleting existing indicators', minProgress: 15, maxProgress: 20 },
    { name: 'Generating clusters', minProgress: 20, maxProgress: 80 },
    { name: 'Saving indicators', minProgress: 80, maxProgress: 90 },
    { name: 'Updating meetings', minProgress: 90, maxProgress: 100 },
  ],
  incremental: [
    { name: 'Fetching new meetings', minProgress: 0, maxProgress: 50 },
    { name: 'Assigning cluster keys', minProgress: 50, maxProgress: 75 },
    { name: 'Updating meetings', minProgress: 75, maxProgress: 100 },
  ]
};

function ClusteringProgressSidebar({ isOpen, onClose, jobStatus }) {
  const logsEndRef = useRef(null);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, jobStatus?.logs?.length]);

  // Calculate ETA based on progress and elapsed time
  const etaInfo = useMemo(() => {
    if (!jobStatus?.is_running || !jobStatus?.started_at || !jobStatus?.progress) {
      return null;
    }

    const startTime = new Date(jobStatus.started_at).getTime();
    const now = Date.now();
    const elapsedMs = now - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const progress = jobStatus.progress;

    if (progress <= 0 || progress >= 100) {
      return { elapsed: elapsedSeconds, remaining: null, total: null };
    }

    // Calculate estimated total time based on current progress
    const estimatedTotalMs = (elapsedMs / progress) * 100;
    const remainingMs = estimatedTotalMs - elapsedMs;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const totalSeconds = Math.floor(estimatedTotalMs / 1000);

    return {
      elapsed: elapsedSeconds,
      remaining: remainingSeconds,
      total: totalSeconds
    };
  }, [jobStatus?.is_running, jobStatus?.started_at, jobStatus?.progress]);

  // Format seconds to human readable string
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  // Get phase definitions based on mode
  const phases = PHASE_DEFINITIONS[jobStatus?.mode] || PHASE_DEFINITIONS.full;

  // Calculate current phase index
  const currentPhaseIndex = useMemo(() => {
    if (!jobStatus?.progress) return 0;
    const progress = jobStatus.progress;
    return phases.findIndex((phase, idx) => {
      const nextPhase = phases[idx + 1];
      if (!nextPhase) return true; // Last phase
      return progress >= phase.minProgress && progress < nextPhase.minProgress;
    });
  }, [jobStatus?.progress, phases]);

  // Calculate progress within current phase
  const phaseProgress = useMemo(() => {
    if (!jobStatus?.progress || currentPhaseIndex < 0) return 0;
    const phase = phases[currentPhaseIndex];
    const progress = jobStatus.progress;
    const phaseRange = phase.maxProgress - phase.minProgress;
    const progressInPhase = progress - phase.minProgress;
    return Math.min(100, Math.max(0, (progressInPhase / phaseRange) * 100));
  }, [jobStatus?.progress, currentPhaseIndex, phases]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`clustering-sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={`clustering-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="clustering-sidebar-header">
          <div className="clustering-sidebar-title">
            <div className="clustering-sidebar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <circle cx="19" cy="6" r="2"/>
                <circle cx="5" cy="6" r="2"/>
                <circle cx="19" cy="18" r="2"/>
                <circle cx="5" cy="18" r="2"/>
                <path d="M12 9V6M12 15v3M9 12H6M15 12h3"/>
              </svg>
            </div>
            <div>
              <h3>Clustering Progress</h3>
              <span className={`clustering-mode-badge ${jobStatus?.mode}`}>
                {jobStatus?.mode === 'incremental' ? 'Incremental' : 'Full Rebuild'}
              </span>
            </div>
          </div>
          <button className="clustering-sidebar-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="clustering-sidebar-body">
          {/* Overall Progress Section */}
          <div className="clustering-section">
            <div className="clustering-section-header">
              <span className="clustering-section-title">Overall Progress</span>
              <span className="clustering-percent">{jobStatus?.progress || 0}%</span>
            </div>
            <div className="clustering-progress-bar">
              <div
                className="clustering-progress-fill"
                style={{ width: `${jobStatus?.progress || 0}%` }}
              />
            </div>
            <div className="clustering-progress-stats">
              <div className="clustering-stat">
                <span className="stat-label">Elapsed</span>
                <span className="stat-value">{formatTime(etaInfo?.elapsed)}</span>
              </div>
              <div className="clustering-stat">
                <span className="stat-label">Remaining</span>
                <span className="stat-value eta">{formatTime(etaInfo?.remaining)}</span>
              </div>
              <div className="clustering-stat">
                <span className="stat-label">Estimated Total</span>
                <span className="stat-value">{formatTime(etaInfo?.total)}</span>
              </div>
            </div>
          </div>

          {/* Phase Progress Section */}
          <div className="clustering-section">
            <div className="clustering-section-header">
              <span className="clustering-section-title">Phase Progress</span>
            </div>
            <div className="clustering-phases">
              {phases.map((phase, idx) => {
                const isCompleted = idx < currentPhaseIndex;
                const isCurrent = idx === currentPhaseIndex;
                const isPending = idx > currentPhaseIndex;

                return (
                  <div
                    key={phase.name}
                    className={`clustering-phase ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}
                  >
                    <div className="phase-indicator">
                      {isCompleted ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : isCurrent ? (
                        <div className="phase-spinner" />
                      ) : (
                        <div className="phase-dot" />
                      )}
                    </div>
                    <div className="phase-content">
                      <div className="phase-name">{phase.name}</div>
                      {isCurrent && (
                        <>
                          <div className="phase-progress-bar">
                            <div
                              className="phase-progress-fill"
                              style={{ width: `${phaseProgress}%` }}
                            />
                          </div>
                          {jobStatus?.phase_detail && (
                            <div className="phase-detail">{jobStatus.phase_detail}</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Section */}
          {(jobStatus?.total_meetings > 0 || jobStatus?.new_meetings > 0 || jobStatus?.indicators_created > 0) && (
            <div className="clustering-section">
              <div className="clustering-section-header">
                <span className="clustering-section-title">Statistics</span>
              </div>
              <div className="clustering-stats-grid">
                {jobStatus?.total_meetings > 0 && (
                  <div className="clustering-stat-card">
                    <span className="stat-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                        <path d="M16 3.13a4 4 0 010 7.75"/>
                      </svg>
                    </span>
                    <span className="stat-number">{jobStatus.total_meetings.toLocaleString()}</span>
                    <span className="stat-label">Total Meetings</span>
                  </div>
                )}
                {jobStatus?.new_meetings > 0 && (
                  <div className="clustering-stat-card">
                    <span className="stat-icon new">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                    </span>
                    <span className="stat-number">{jobStatus.new_meetings.toLocaleString()}</span>
                    <span className="stat-label">New Meetings</span>
                  </div>
                )}
                {jobStatus?.indicators_created > 0 && (
                  <div className="clustering-stat-card">
                    <span className="stat-icon indicators">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                        <polyline points="2 17 12 22 22 17"/>
                        <polyline points="2 12 12 17 22 12"/>
                      </svg>
                    </span>
                    <span className="stat-number">{jobStatus.indicators_created.toLocaleString()}</span>
                    <span className="stat-label">Indicators Created</span>
                  </div>
                )}
                {jobStatus?.meetings_updated > 0 && (
                  <div className="clustering-stat-card">
                    <span className="stat-icon updated">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                    </span>
                    <span className="stat-number">{jobStatus.meetings_updated.toLocaleString()}</span>
                    <span className="stat-label">Meetings Updated</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logs Section */}
          <div className="clustering-section logs-section">
            <div className="clustering-section-header">
              <span className="clustering-section-title">
                Real-time Logs
                {jobStatus?.logs?.length > 0 && (
                  <span className="logs-count">({jobStatus.logs.length})</span>
                )}
              </span>
            </div>
            <div className="clustering-logs-container">
              {jobStatus?.logs?.length > 0 ? (
                <>
                  {jobStatus.logs.map((log, idx) => (
                    <div key={idx} className={`clustering-log-entry log-${log.level}`}>
                      <span className="log-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`log-level level-${log.level}`}>
                        {log.level === 'success' ? '✓' : log.level === 'error' ? '✗' : log.level === 'warning' ? '!' : '•'}
                      </span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </>
              ) : (
                <div className="clustering-logs-empty">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span>Waiting for logs...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="clustering-sidebar-footer">
          {jobStatus?.is_running ? (
            <div className="clustering-footer-status running">
              <div className="status-indicator pulse" />
              <span>Job in progress</span>
            </div>
          ) : jobStatus?.last_completed_at ? (
            <div className="clustering-footer-status completed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>Completed {new Date(jobStatus.last_completed_at).toLocaleString()}</span>
            </div>
          ) : null}
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

export default ClusteringProgressSidebar;
