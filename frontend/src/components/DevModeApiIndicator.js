import React, { useState, useRef, useEffect } from 'react';
import { useDevMode } from '../contexts/DevModeContext';

// Expandable section component with copy button
function ExpandableSection({ title, content, isError, onCopy, copyFeedback, copyId }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const formattedContent = typeof content === 'string'
    ? content
    : JSON.stringify(content, null, 2);

  return (
    <div className="api-log-section">
      <div
        className={`api-log-section-header ${isError ? 'error' : ''}`}
        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
      >
        <span className="api-log-section-toggle">{isExpanded ? '▼' : '▶'}</span>
        <span className={`api-log-section-title ${isError ? 'error' : ''}`}>{title}</span>
        <button
          className={`api-log-section-copy ${copyFeedback === copyId ? 'copied' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onCopy(formattedContent, copyId);
          }}
          title={`Copy ${title}`}
        >
          {copyFeedback === copyId ? '✓' : '📋'}
        </button>
      </div>
      {isExpanded && (
        <pre className="api-log-pre">{formattedContent}</pre>
      )}
    </div>
  );
}

function DevModeApiIndicator() {
  const { development, logs, clearLogs } = useDevMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const panelRef = useRef(null);
  const containerRef = useRef(null);

  // Drag state
  const [position, setPosition] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  // Filter state - status filters are all false by default (meaning show all/ignore filter)
  const [statusFilters, setStatusFilters] = useState({
    pending: false,
    success: false,
    error: false
  });
  const [methodFilter, setMethodFilter] = useState(''); // empty = show all
  const [searchQuery, setSearchQuery] = useState('');

  // Handle drag start
  const handleDragStart = (e) => {
    // Only start drag if clicking on the drag handle area
    if (e.target.closest('.dev-mode-drag-handle')) {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      // Get current position
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        positionStartRef.current = { x: rect.left, y: rect.top };
        // Initialize position if not set
        if (position.x === null) {
          setPosition({ x: rect.left, y: rect.top });
        }
      }
    }
  };

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      let newX = positionStartRef.current.x + deltaX;
      let newY = positionStartRef.current.y + deltaY;

      // Constrain to viewport
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
      }

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Reset position function
  const resetPosition = () => {
    setPosition({ x: null, y: null });
  };

  // Don't render if not in development mode
  if (!development) {
    return null;
  }

  const pendingCount = logs.filter(log => log.status === 'pending').length;
  const errorCount = logs.filter(log => log.status === 'error').length;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <span className="api-log-spinner"></span>;
      case 'success':
        return <span className="api-log-icon success">✓</span>;
      case 'error':
        return <span className="api-log-icon error">✕</span>;
      default:
        return null;
    }
  };

  const getMethodClass = (method) => {
    return `api-method api-method-${method.toLowerCase()}`;
  };

  const formatDuration = (ms) => {
    if (ms === null) return '...';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  const formatTimestamp = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyLogAsJson = (log) => {
    const logData = {
      timestamp: log.timestamp.toISOString(),
      method: log.method,
      url: log.url,
      status: log.statusCode,
      duration: log.duration,
      requestHeaders: log.requestHeaders,
      requestBody: log.requestBody,
      responseHeaders: log.responseHeaders,
      response: log.response,
      error: log.error
    };
    copyToClipboard(JSON.stringify(logData, null, 2), 'json');
  };

  const copyLogAsCurl = (log) => {
    let curl = `curl -X ${log.method} '${log.url}'`;

    if (log.requestHeaders && Object.keys(log.requestHeaders).length > 0) {
      Object.entries(log.requestHeaders).forEach(([key, value]) => {
        curl += ` \\\n  -H '${key}: ${value}'`;
      });
    }

    if (log.requestBody) {
      const body = typeof log.requestBody === 'string'
        ? log.requestBody
        : JSON.stringify(log.requestBody);
      curl += ` \\\n  -d '${body}'`;
    }

    copyToClipboard(curl, 'curl');
  };

  const copyRequest = (log) => {
    let request = `${log.method} ${log.url}\n`;

    if (log.requestHeaders && Object.keys(log.requestHeaders).length > 0) {
      request += '\n--- Headers ---\n';
      Object.entries(log.requestHeaders).forEach(([key, value]) => {
        request += `${key}: ${value}\n`;
      });
    }

    if (log.requestBody) {
      request += '\n--- Body ---\n';
      request += typeof log.requestBody === 'string'
        ? log.requestBody
        : JSON.stringify(log.requestBody, null, 2);
    }

    copyToClipboard(request, 'request');
  };

  const copyResponse = (log) => {
    let response = '';

    if (log.statusCode) {
      response += `Status: ${log.statusCode} ${log.statusText || ''}\n`;
    }

    if (log.responseHeaders && Object.keys(log.responseHeaders).length > 0) {
      response += '\n--- Headers ---\n';
      Object.entries(log.responseHeaders).forEach(([key, value]) => {
        response += `${key}: ${value}\n`;
      });
    }

    if (log.response) {
      response += '\n--- Body ---\n';
      response += typeof log.response === 'string'
        ? log.response
        : JSON.stringify(log.response, null, 2);
    }

    if (log.error) {
      response += '\n--- Error ---\n';
      response += log.error;
    }

    copyToClipboard(response, 'response');
  };

  const copyAllLogs = () => {
    const allLogsData = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      method: log.method,
      url: log.url,
      status: log.statusCode,
      duration: log.duration,
      requestHeaders: log.requestHeaders,
      requestBody: log.requestBody,
      responseHeaders: log.responseHeaders,
      response: log.response,
      error: log.error
    }));
    copyToClipboard(JSON.stringify(allLogsData, null, 2), 'all');
  };

  const handleLogClick = (log) => {
    setSelectedLog(selectedLog?.id === log.id ? null : log);
  };

  // Toggle status filter
  const toggleStatusFilter = (status) => {
    setStatusFilters(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  // Check if any status filter is active
  const hasActiveStatusFilter = statusFilters.pending || statusFilters.success || statusFilters.error;

  // Get unique methods from logs
  const uniqueMethods = [...new Set(logs.map(log => log.method))].sort();

  // Filter logs based on current filters
  const filteredLogs = logs.filter(log => {
    // Status filter - if no status filters active, show all; otherwise show only selected statuses
    if (hasActiveStatusFilter && !statusFilters[log.status]) {
      return false;
    }

    // Method filter
    if (methodFilter && log.method !== methodFilter) {
      return false;
    }

    // Search filter (URL)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const urlMatch = log.url.toLowerCase().includes(searchLower);
      if (!urlMatch) {
        return false;
      }
    }

    return true;
  });

  // Clear all filters
  const clearFilters = () => {
    setStatusFilters({ pending: false, success: false, error: false });
    setMethodFilter('');
    setSearchQuery('');
  };

  // Check if any filter is active
  const hasActiveFilters = hasActiveStatusFilter || methodFilter || searchQuery;

  // Custom positioning style when dragged
  const positionStyle = position.x !== null ? {
    left: `${position.x}px`,
    top: `${position.y}px`,
    right: 'auto',
    bottom: 'auto'
  } : {};

  return (
    <div
      ref={containerRef}
      className={`dev-mode-indicator ${isExpanded ? 'expanded' : ''} ${isDragging ? 'dragging' : ''} ${position.x !== null ? 'custom-position' : ''}`}
      style={positionStyle}
    >
      {/* Header - always visible */}
      <div
        className="dev-mode-header"
        onMouseDown={handleDragStart}
        onClick={(e) => {
          // Don't toggle if we were dragging
          if (!e.target.closest('.dev-mode-drag-handle')) {
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <span className="dev-mode-drag-handle" title="Drag to move">⋮⋮</span>
        <span className="dev-mode-badge">DEV</span>
        <span className="dev-mode-title">API Logs</span>
        <span className="dev-mode-count">
          {logs.length > 0 && (
            <>
              {pendingCount > 0 && (
                <span className="count-pending">{pendingCount} pending</span>
              )}
              {errorCount > 0 && (
                <span className="count-error">{errorCount} errors</span>
              )}
              <span className="count-total">{logs.length}</span>
            </>
          )}
        </span>
        <span className="dev-mode-expand">{isExpanded ? '▼' : '▲'}</span>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="dev-mode-panel" ref={panelRef}>
          <div className="dev-mode-toolbar">
            <button
              className={`dev-mode-btn ${copyFeedback === 'all' ? 'copied' : ''}`}
              onClick={copyAllLogs}
              disabled={logs.length === 0}
            >
              {copyFeedback === 'all' ? 'Copied!' : 'Copy All Logs'}
            </button>
            <button
              className="dev-mode-btn"
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              Clear
            </button>
            {position.x !== null && (
              <button
                className="dev-mode-btn"
                onClick={resetPosition}
                title="Reset to default position"
              >
                Reset Position
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="dev-mode-filters">
            <div className="filter-group">
              <span className="filter-label">Status:</span>
              <div className="filter-pills">
                <button
                  className={`filter-pill status-pending ${statusFilters.pending ? 'active' : ''}`}
                  onClick={() => toggleStatusFilter('pending')}
                >
                  Pending
                </button>
                <button
                  className={`filter-pill status-success ${statusFilters.success ? 'active' : ''}`}
                  onClick={() => toggleStatusFilter('success')}
                >
                  Success
                </button>
                <button
                  className={`filter-pill status-error ${statusFilters.error ? 'active' : ''}`}
                  onClick={() => toggleStatusFilter('error')}
                >
                  Error
                </button>
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Method:</span>
              <select
                className="filter-select"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
              >
                <option value="">All</option>
                {uniqueMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div className="filter-group filter-search">
              <input
                type="text"
                className="filter-input"
                placeholder="Search URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <button className="filter-clear" onClick={clearFilters}>
                Clear Filters
              </button>
            )}

            {hasActiveFilters && (
              <span className="filter-count">
                {filteredLogs.length} / {logs.length}
              </span>
            )}
          </div>

          <div className="dev-mode-logs">
            {logs.length === 0 ? (
              <div className="dev-mode-empty">No API requests yet</div>
            ) : filteredLogs.length === 0 ? (
              <div className="dev-mode-empty">No logs match the current filters</div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className={`api-log-entry ${log.status}`}>
                  <div
                    className="api-log-summary"
                    onClick={() => handleLogClick(log)}
                  >
                    {getStatusIcon(log.status)}
                    <span className={getMethodClass(log.method)}>{log.method}</span>
                    <span className="api-log-url" title={log.url}>
                      {formatUrl(log.url)}
                    </span>
                    <span className="api-log-status">
                      {log.statusCode && (
                        <span className={`status-code ${log.status}`}>
                          {log.statusCode}
                        </span>
                      )}
                    </span>
                    <span className="api-log-duration">
                      {formatDuration(log.duration)}
                    </span>
                    <span className="api-log-time">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>

                  {selectedLog?.id === log.id && (
                    <div className="api-log-details">
                      <div className="api-log-actions">
                        <button
                          className={`dev-mode-btn small ${copyFeedback === 'request' ? 'copied' : ''}`}
                          onClick={(e) => { e.stopPropagation(); copyRequest(log); }}
                        >
                          {copyFeedback === 'request' ? 'Copied!' : 'Copy Request'}
                        </button>
                        <button
                          className={`dev-mode-btn small ${copyFeedback === 'response' ? 'copied' : ''}`}
                          onClick={(e) => { e.stopPropagation(); copyResponse(log); }}
                        >
                          {copyFeedback === 'response' ? 'Copied!' : 'Copy Response'}
                        </button>
                        <button
                          className={`dev-mode-btn small ${copyFeedback === 'curl' ? 'copied' : ''}`}
                          onClick={(e) => { e.stopPropagation(); copyLogAsCurl(log); }}
                        >
                          {copyFeedback === 'curl' ? 'Copied!' : 'Copy cURL'}
                        </button>
                        <button
                          className={`dev-mode-btn small ${copyFeedback === 'json' ? 'copied' : ''}`}
                          onClick={(e) => { e.stopPropagation(); copyLogAsJson(log); }}
                        >
                          {copyFeedback === 'json' ? 'Copied!' : 'Copy JSON'}
                        </button>
                      </div>

                      {log.error && (
                        <ExpandableSection
                          title="Error"
                          content={log.error}
                          isError={true}
                          onCopy={copyToClipboard}
                          copyFeedback={copyFeedback}
                          copyId={`error-${log.id}`}
                        />
                      )}

                      {log.requestBody && (
                        <ExpandableSection
                          title="Request Body"
                          content={log.requestBody}
                          onCopy={copyToClipboard}
                          copyFeedback={copyFeedback}
                          copyId={`reqbody-${log.id}`}
                        />
                      )}

                      {log.response && (
                        <ExpandableSection
                          title="Response"
                          content={log.response}
                          onCopy={copyToClipboard}
                          copyFeedback={copyFeedback}
                          copyId={`response-${log.id}`}
                        />
                      )}

                      {log.requestHeaders && Object.keys(log.requestHeaders).length > 0 && (
                        <ExpandableSection
                          title="Request Headers"
                          content={log.requestHeaders}
                          onCopy={copyToClipboard}
                          copyFeedback={copyFeedback}
                          copyId={`reqheaders-${log.id}`}
                        />
                      )}

                      {log.responseHeaders && Object.keys(log.responseHeaders).length > 0 && (
                        <ExpandableSection
                          title="Response Headers"
                          content={log.responseHeaders}
                          onCopy={copyToClipboard}
                          copyFeedback={copyFeedback}
                          copyId={`resheaders-${log.id}`}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DevModeApiIndicator;
