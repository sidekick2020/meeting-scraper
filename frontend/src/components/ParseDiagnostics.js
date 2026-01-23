import React, { useState, useEffect } from 'react';
import { getFrontendInitLog } from '../contexts/ParseContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * ParseDiagnostics - A popup that shows Parse/Back4App initialization diagnostics
 * Useful for debugging connection issues
 */
function ParseDiagnostics({ isOpen, onClose }) {
  const [backendDiagnostics, setBackendDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBackendDiagnostics();
    }
  }, [isOpen]);

  const fetchBackendDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/parse-diagnostics`);
      if (response.ok) {
        const data = await response.json();
        setBackendDiagnostics(data);
      } else {
        setError(`Backend returned ${response.status}: ${response.statusText}`);
      }
    } catch (e) {
      setError(`Failed to fetch backend diagnostics: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const frontendData = getFrontendInitLog();

  const generateDiagnosticReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      frontend: frontendData,
      backend: backendDiagnostics,
      backendError: error
    };
    return JSON.stringify(report, null, 2);
  };

  const handleCopy = () => {
    const report = generateDiagnosticReport();
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  const renderLogEntry = (entry, index) => {
    const levelColors = {
      info: '#666',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545'
    };
    return (
      <div key={index} style={{
        padding: '4px 8px',
        borderLeft: `3px solid ${levelColors[entry.level] || '#666'}`,
        marginBottom: '4px',
        backgroundColor: 'rgba(0,0,0,0.02)',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        <span style={{ color: '#999', marginRight: '8px' }}>
          {entry.timestamp.split('T')[1]?.substring(0, 12) || entry.timestamp}
        </span>
        <span style={{ color: levelColors[entry.level], fontWeight: 'bold', marginRight: '8px' }}>
          [{entry.level.toUpperCase()}]
        </span>
        <span>{entry.message}</span>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="sign-in-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="modal-header">
          <h2>Parse/Back4App Diagnostics</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Frontend Section */}
          <h3 style={{ marginTop: 0 }}>Frontend (Parse SDK)</h3>
          <div style={{
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Status:</strong>{' '}
              <span style={{
                color: frontendData.state.isInitialized ? '#28a745' : '#dc3545',
                fontWeight: 'bold'
              }}>
                {frontendData.state.isInitialized ? 'INITIALIZED' : 'NOT INITIALIZED'}
              </span>
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Connection Status:</strong> {frontendData.state.connectionStatus}
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>App ID:</strong> {frontendData.state.config.appIdPrefix || 'NOT SET'}
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>JS Key:</strong> {frontendData.state.config.jsKeyPrefix || 'NOT SET'}
            </p>
            {frontendData.state.error && (
              <p style={{ margin: '0', color: '#dc3545' }}>
                <strong>Error:</strong> {frontendData.state.error}
              </p>
            )}
          </div>

          <h4>Frontend Init Log:</h4>
          <div style={{
            maxHeight: '150px',
            overflow: 'auto',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            {frontendData.log.map(renderLogEntry)}
          </div>

          {/* Backend Section */}
          <h3>Backend (REST API)</h3>
          {loading && <p>Loading backend diagnostics...</p>}
          {error && (
            <div style={{
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              color: '#721c24',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '16px'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}
          {backendDiagnostics && (
            <>
              <div style={{
                backgroundColor: '#f5f5f5',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>Initial Connection:</strong>{' '}
                  <span style={{
                    color: backendDiagnostics.current_state.initial_connection_ok ? '#28a745' : '#dc3545',
                    fontWeight: 'bold'
                  }}>
                    {backendDiagnostics.current_state.initial_connection_ok ? 'OK' : 'FAILED'}
                  </span>
                </p>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>App ID:</strong> {backendDiagnostics.current_state.BACK4APP_APP_ID || 'NOT SET'}
                </p>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>REST Key:</strong> {backendDiagnostics.current_state.BACK4APP_REST_KEY || 'NOT SET'}
                </p>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>Session App ID Header:</strong> {backendDiagnostics.current_state.session_headers['X-Parse-Application-Id']}
                </p>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>Session REST Key Header:</strong> {backendDiagnostics.current_state.session_headers['X-Parse-REST-API-Key']}
                </p>
              </div>

              <h4>Live Connection Test:</h4>
              <div style={{
                backgroundColor: backendDiagnostics.live_test?.success ? '#d4edda' : '#f8d7da',
                border: `1px solid ${backendDiagnostics.live_test?.success ? '#c3e6cb' : '#f5c6cb'}`,
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>Result:</strong>{' '}
                  <span style={{ fontWeight: 'bold' }}>
                    {backendDiagnostics.live_test?.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </p>
                <p style={{ margin: '0' }}>
                  <strong>Message:</strong> {backendDiagnostics.live_test?.message}
                </p>
                {backendDiagnostics.live_test?.response_text && (
                  <pre style={{
                    margin: '8px 0 0 0',
                    fontSize: '11px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {backendDiagnostics.live_test.response_text}
                  </pre>
                )}
              </div>

              <h4>Backend Init Log:</h4>
              <div style={{
                maxHeight: '150px',
                overflow: 'auto',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                {backendDiagnostics.initialization_log.map(renderLogEntry)}
              </div>
            </>
          )}

          {/* Copy Button */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            borderTop: '1px solid #ddd',
            paddingTop: '16px',
            marginTop: '16px'
          }}>
            <button
              className="btn"
              onClick={fetchBackendDiagnostics}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy Full Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParseDiagnostics;
