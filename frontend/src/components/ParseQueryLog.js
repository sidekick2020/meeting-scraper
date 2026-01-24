import React, { useState, useMemo } from 'react';
import { useParseQueryLogger } from '../contexts/ParseQueryLoggerContext';

// Icons for different log statuses
const SuccessIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 8l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const PendingIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" className="spinning">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="12 8"/>
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ChevronIcon = ({ expanded }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="12"
    height="12"
    style={{
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease'
    }}
  >
    <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const formatDuration = (ms) => {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusIcon = () => {
    switch (log.status) {
      case 'success': return <SuccessIcon />;
      case 'error': return <ErrorIcon />;
      case 'pending': return <PendingIcon />;
      default: return <InfoIcon />;
    }
  };

  const getStatusClass = () => {
    switch (log.status) {
      case 'success': return 'parse-log-success';
      case 'error': return 'parse-log-error';
      case 'pending': return 'parse-log-pending';
      default: return 'parse-log-info';
    }
  };

  const hasDetails = log.params || log.resultSample || log.error || log.errorDetails || log.codeSnippet;

  return (
    <div className={`parse-log-entry ${getStatusClass()} ${expanded ? 'expanded' : ''}`}>
      <div className="parse-log-header" onClick={() => hasDetails && setExpanded(!expanded)}>
        <div className="parse-log-status-icon">{getStatusIcon()}</div>
        <span className="parse-log-time">{formatTime(log.timestamp)}</span>
        <span className="parse-log-operation">{log.operation}</span>
        {log.className && <span className="parse-log-class">{log.className}</span>}
        <span className="parse-log-step">{log.step}</span>
        <span className="parse-log-duration">{formatDuration(log.duration)}</span>
        {log.resultCount !== null && (
          <span className="parse-log-count">{log.resultCount} results</span>
        )}
        {hasDetails && (
          <span className="parse-log-expand">
            <ChevronIcon expanded={expanded} />
          </span>
        )}
      </div>

      {expanded && (
        <div className="parse-log-details">
          {/* Caller / Code Snippet */}
          {log.codeSnippet && (
            <div className="parse-log-section">
              <h4>Code Location</h4>
              <div className="parse-log-code">
                <div className="parse-log-caller">{log.caller}</div>
                <code>{log.codeSnippet}</code>
              </div>
            </div>
          )}

          {/* Request Parameters */}
          {log.params && Object.keys(log.params).length > 0 && (
            <div className="parse-log-section">
              <h4>Request Parameters</h4>
              <pre className="parse-log-json">{JSON.stringify(log.params, null, 2)}</pre>
            </div>
          )}

          {/* Results */}
          {log.status === 'success' && log.resultSample && (
            <div className="parse-log-section">
              <h4>Results (Sample: first {log.resultSample.length} of {log.resultCount})</h4>
              <pre className="parse-log-json">{JSON.stringify(log.resultSample, null, 2)}</pre>
            </div>
          )}

          {/* Error Details */}
          {log.status === 'error' && (
            <div className="parse-log-section parse-log-error-section">
              <h4>Error</h4>
              <div className="parse-log-error-message">{log.error}</div>
              {log.errorDetails && (
                <>
                  {log.errorDetails.code && (
                    <div className="parse-log-error-code">Error Code: {log.errorDetails.code}</div>
                  )}
                  {log.errorDetails.stack && (
                    <details className="parse-log-stack-details">
                      <summary>Stack Trace</summary>
                      <pre className="parse-log-stack">{log.errorDetails.stack}</pre>
                    </details>
                  )}
                  {Object.keys(log.errorDetails).filter(k => !['code', 'stack'].includes(k)).length > 0 && (
                    <details className="parse-log-extra-details">
                      <summary>Additional Details</summary>
                      <pre className="parse-log-json">
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(log.errorDetails).filter(([k]) => !['code', 'stack'].includes(k))
                          ),
                          null, 2
                        )}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParseQueryLog() {
  const { logs, clearLogs, errorCount, pendingCount } = useParseQueryLogger();
  const [filter, setFilter] = useState('all'); // 'all', 'errors', 'success', 'pending'
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filter by status
    if (filter === 'errors') {
      result = result.filter(log => log.status === 'error');
    } else if (filter === 'success') {
      result = result.filter(log => log.status === 'success');
    } else if (filter === 'pending') {
      result = result.filter(log => log.status === 'pending');
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log =>
        log.operation?.toLowerCase().includes(term) ||
        log.className?.toLowerCase().includes(term) ||
        log.step?.toLowerCase().includes(term) ||
        log.caller?.toLowerCase().includes(term) ||
        log.error?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [logs, filter, searchTerm]);

  const successCount = logs.filter(l => l.status === 'success').length;

  return (
    <div className="parse-query-log">
      <div className="parse-query-log-header">
        <h3>Parse Query Log</h3>
        <div className="parse-query-log-stats">
          <span className="stat-badge stat-total">{logs.length} total</span>
          <span className="stat-badge stat-success">{successCount} success</span>
          {errorCount > 0 && (
            <span className="stat-badge stat-error">{errorCount} errors</span>
          )}
          {pendingCount > 0 && (
            <span className="stat-badge stat-pending">{pendingCount} pending</span>
          )}
        </div>
      </div>

      <div className="parse-query-log-controls">
        <div className="parse-query-log-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'errors' ? 'active' : ''}`}
            onClick={() => setFilter('errors')}
          >
            Errors {errorCount > 0 && `(${errorCount})`}
          </button>
          <button
            className={`filter-btn ${filter === 'success' ? 'active' : ''}`}
            onClick={() => setFilter('success')}
          >
            Success
          </button>
          <button
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
        </div>

        <div className="parse-query-log-search">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="clear-logs-btn" onClick={clearLogs}>
          Clear Logs
        </button>
      </div>

      <div className="parse-query-log-container">
        {filteredLogs.length === 0 ? (
          <div className="parse-query-log-empty">
            {logs.length === 0 ? (
              <>
                <p>No Parse queries logged yet.</p>
                <p className="parse-query-log-hint">
                  Query logs will appear here when the app makes requests to Back4App.
                </p>
              </>
            ) : (
              <p>No logs match the current filter.</p>
            )}
          </div>
        ) : (
          filteredLogs.map(log => (
            <LogEntry key={log.id} log={log} />
          ))
        )}
      </div>
    </div>
  );
}

export default ParseQueryLog;
