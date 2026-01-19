import React, { useState } from 'react';

function ConfigModal({ config, onSave, onClose, isSaving }) {
  const [appId, setAppId] = useState(config.appId);
  const [restKey, setRestKey] = useState(config.restKey);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ appId, restKey });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Back4app Configuration</h2>
          <button className="modal-close" onClick={onClose} disabled={isSaving}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="appId">Application ID</label>
            <input
              type="text"
              id="appId"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="Enter your Back4app Application ID"
              disabled={isSaving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="restKey">REST API Key</label>
            <input
              type="password"
              id="restKey"
              value={restKey}
              onChange={(e) => setRestKey(e.target.value)}
              placeholder="Enter your Back4app REST API Key"
              disabled={isSaving}
            />
          </div>

          <div className="form-help">
            <p>Find these credentials in your Back4app dashboard:</p>
            <ol>
              <li>Go to App Settings</li>
              <li>Click Security & Keys</li>
              <li>Copy Application ID and REST API Key</li>
            </ol>
            <p style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
              (Optional - you can test scraping without credentials)
            </p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConfigModal;
