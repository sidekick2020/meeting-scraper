import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function CoverageAnalysis() {
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllStates, setShowAllStates] = useState(false);

  const fetchCoverage = useCallback(async (isInitialLoad = false) => {
    try {
      // Only show loading spinner on initial load, not refreshes
      if (isInitialLoad) {
        setLoading(true);
      }
      const response = await fetch(`${BACKEND_URL}/api/coverage`);
      if (response.ok) {
        const data = await response.json();
        setCoverage(data);
        setError(null);
      } else {
        setError('Failed to load coverage data');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoverage(true); // Initial load shows spinner
  }, [fetchCoverage]);

  const getCoverageColor = (coveragePer100k, avgCoverage) => {
    if (coveragePer100k === 0) return '#ef4444'; // Red - no coverage
    if (coveragePer100k < avgCoverage * 0.5) return '#f97316'; // Orange - low
    if (coveragePer100k < avgCoverage) return '#eab308'; // Yellow - below avg
    return '#22c55e'; // Green - good
  };

  const getCoverageLevel = (coveragePer100k, avgCoverage) => {
    if (coveragePer100k === 0) return 'None';
    if (coveragePer100k < avgCoverage * 0.5) return 'Low';
    if (coveragePer100k < avgCoverage) return 'Below Avg';
    return 'Good';
  };

  if (loading) {
    return (
      <div className="coverage-analysis">
        <h3>Coverage Analysis</h3>
        <div className="loading">Loading coverage data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="coverage-analysis">
        <h3>Coverage Analysis</h3>
        <div className="error-message">{error}</div>
        <button onClick={fetchCoverage} className="btn btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  if (!coverage) return null;

  const { summary, coverage: coverageData, priorityStates, statesWithoutCoverage } = coverage;
  const displayedStates = showAllStates ? coverageData : coverageData.slice(0, 15);

  return (
    <div className="coverage-analysis">
      <div className="coverage-header">
        <h3>US Coverage Analysis</h3>
        <button onClick={() => fetchCoverage(false)} className="btn btn-ghost btn-small">
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="coverage-summary">
        <div className="summary-card">
          <div className="summary-value">{summary.totalMeetings.toLocaleString()}</div>
          <div className="summary-label">Total Meetings</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{summary.statesWithMeetings}</div>
          <div className="summary-label">States Covered</div>
        </div>
        <div className="summary-card">
          <div className="summary-value highlight-warning">{summary.statesWithoutMeetings}</div>
          <div className="summary-label">States Without Coverage</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{summary.averageCoveragePer100k}</div>
          <div className="summary-label">Avg Meetings/100k</div>
        </div>
      </div>

      {/* Priority States Alert */}
      {priorityStates.length > 0 && (
        <div className="priority-alert">
          <h4>Priority States (High Population, Low Coverage)</h4>
          <div className="priority-list">
            {priorityStates.slice(0, 5).map(state => (
              <div key={state.state} className="priority-item">
                <span className="state-name">{state.stateName}</span>
                <span className="state-pop">
                  {(state.population / 1000000).toFixed(1)}M pop
                </span>
                <span className="state-meetings">
                  {state.meetings} meetings
                </span>
                <span
                  className="coverage-badge"
                  style={{ backgroundColor: getCoverageColor(state.coveragePer100k, summary.averageCoveragePer100k) }}
                >
                  {state.coveragePer100k}/100k
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coverage Table */}
      <div className="coverage-table-container">
        <table className="coverage-table">
          <thead>
            <tr>
              <th>State</th>
              <th>Population</th>
              <th>Meetings</th>
              <th>Coverage/100k</th>
              <th>Status</th>
              <th>Feed</th>
            </tr>
          </thead>
          <tbody>
            {displayedStates.map(state => (
              <tr key={state.state} className={state.meetings === 0 ? 'no-coverage' : ''}>
                <td>
                  <strong>{state.state}</strong>
                  <span className="state-full-name">{state.stateName}</span>
                </td>
                <td>{(state.population / 1000000).toFixed(1)}M</td>
                <td>{state.meetings.toLocaleString()}</td>
                <td>
                  <span
                    className="coverage-badge"
                    style={{ backgroundColor: getCoverageColor(state.coveragePer100k, summary.averageCoveragePer100k) }}
                  >
                    {state.coveragePer100k}
                  </span>
                </td>
                <td className={`status-${getCoverageLevel(state.coveragePer100k, summary.averageCoveragePer100k).toLowerCase().replace(' ', '-')}`}>
                  {getCoverageLevel(state.coveragePer100k, summary.averageCoveragePer100k)}
                </td>
                <td>
                  {state.hasFeed ? (
                    <span className="feed-active">Active</span>
                  ) : (
                    <span className="feed-needed">Needed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {coverageData.length > 15 && (
          <button
            className="btn btn-ghost show-more"
            onClick={() => setShowAllStates(!showAllStates)}
          >
            {showAllStates ? 'Show Less' : `Show All ${coverageData.length} States`}
          </button>
        )}
      </div>

      {/* States Without Coverage */}
      {statesWithoutCoverage.length > 0 && (
        <div className="no-coverage-section">
          <h4>States Without Any Meetings ({statesWithoutCoverage.length})</h4>
          <div className="no-coverage-list">
            {statesWithoutCoverage.map(state => (
              <span key={state.state} className="no-coverage-tag">
                {state.state} ({(state.population / 1000000).toFixed(1)}M)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CoverageAnalysis;
