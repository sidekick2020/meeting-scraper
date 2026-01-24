import React, { useState, useRef, useEffect } from 'react';
import { useDevMode } from '../contexts/DevModeContext';

function DevModeApiIndicator() {
  const { development, logs, clearLogs } = useDevMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const panelRef = useRef(null);

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

  return (
    <div className={`dev-mode-indicator ${isExpanded ? 'expanded' : ''}`}>
      {/* Header - always visible */}
      <div
        className="dev-mode-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
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
          </div>

          <div className="dev-mode-logs">
            {logs.length === 0 ? (
              <div className="dev-mode-empty">No API requests yet</div>
            ) : (
              logs.map((log) => (
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
                        <div className="api-log-section">
                          <div className="api-log-section-title error">Error</div>
                          <pre className="api-log-pre">{log.error}</pre>
                        </div>
                      )}

                      {log.requestBody && (
                        <div className="api-log-section">
                          <div className="api-log-section-title">Request Body</div>
                          <pre className="api-log-pre">
                            {typeof log.requestBody === 'string'
                              ? log.requestBody
                              : JSON.stringify(log.requestBody, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.response && (
                        <div className="api-log-section">
                          <div className="api-log-section-title">Response</div>
                          <pre className="api-log-pre">
                            {typeof log.response === 'string'
                              ? log.response
                              : JSON.stringify(log.response, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.requestHeaders && Object.keys(log.requestHeaders).length > 0 && (
                        <div className="api-log-section">
                          <div className="api-log-section-title">Request Headers</div>
                          <pre className="api-log-pre">
                            {JSON.stringify(log.requestHeaders, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.responseHeaders && Object.keys(log.responseHeaders).length > 0 && (
                        <div className="api-log-section">
                          <div className="api-log-section-title">Response Headers</div>
                          <pre className="api-log-pre">
                            {JSON.stringify(log.responseHeaders, null, 2)}
                          </pre>
                        </div>
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
