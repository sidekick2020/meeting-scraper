import React from 'react';

function Stats({ byState, byType }) {
  const stateEntries = Object.entries(byState).sort((a, b) => b[1] - a[1]);
  const typeEntries = Object.entries(byType).filter(([_, count]) => count > 0);

  return (
    <div className="stats-panel">
      <h3>Statistics</h3>

      <div className="stats-section">
        <h4>By Meeting Type</h4>
        <div className="type-stats">
          {typeEntries.length > 0 ? (
            typeEntries.map(([type, count]) => (
              <div key={type} className="stat-item">
                <span className={`stat-badge type-${type.toLowerCase().replace('-', '')}`}>
                  {type}
                </span>
                <span className="stat-count">{count}</span>
              </div>
            ))
          ) : (
            <p className="no-data">No meetings collected yet</p>
          )}
        </div>
      </div>

      <div className="stats-section">
        <h4>By State</h4>
        <div className="state-stats">
          {stateEntries.length > 0 ? (
            stateEntries.slice(0, 10).map(([state, count]) => (
              <div key={state} className="stat-item">
                <span className="stat-label">{state}</span>
                <div className="stat-bar-container">
                  <div
                    className="stat-bar"
                    style={{
                      width: `${(count / Math.max(...Object.values(byState))) * 100}%`
                    }}
                  ></div>
                </div>
                <span className="stat-count">{count}</span>
              </div>
            ))
          ) : (
            <p className="no-data">No meetings collected yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Stats;
