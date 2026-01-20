import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Release notes content
const RELEASE_NOTES = `
## Version 1.3.2

### New Features
- **Alabama Meeting Feeds**: Added meeting data sources for Alabama
  - Birmingham AA feed (TSML format)
  - West Alabama AA feed covering Tuscaloosa, Jasper, Fayette areas
  - Alabama NA feed with BMLT support covering all 11 NA service areas
- **BMLT Feed Support**: Added support for BMLT (Basic Meeting List Toolkit) API format
  - Automatic transformation from BMLT to standard format
  - Enables scraping NA meetings from BMLT-powered sites

## Version 1.3.1

### Documentation
- **Mobile Quick Start Guide**: Step-by-step guide for showing meetings in iOS and Android apps
  - iOS integration with Swift/SwiftUI using ParseSwift SDK
  - Android integration with Kotlin/Jetpack Compose using Parse Android SDK
  - Complete Meeting model definitions for both platforms

## Version 1.3.0

### New Features
- **Admin Directory Load More**: Replaced Previous/Next pagination with "Load More" button
- **Search Highlighting**: Added search term highlighting in admin directory

### Bug Fixes
- **Deployment Indicator**: Fixed indicator not disappearing when deployment finishes

## Earlier Updates

### Performance Improvements
- **Faster Initial Load**: Reduced initial meeting request from 1000 to 100
- **Coverage Analysis Optimization**: Fixed timeout with single batched fetch

### UI/UX Improvements
- **Dark/Light Mode Toggle**: Added theme toggle in profile dropdown
- **Light Mode Improvements**: Comprehensive styling overhaul
- **Skeleton Loading**: Added shimmer animation for users table

### New Features
- **Downloadable Model Files**: Added Meeting.swift and Meeting.kt files
- **CC Email for Invites**: Added ability to CC someone when sending invitations
- **Comprehensive Query Docs**: Added extensive query examples for iOS and Android
`;

const API_VERSIONS = [
  { version: 'v1', label: 'v1 (Stable)', description: 'Current stable API version' },
  { version: 'v2-beta', label: 'v2 Beta', description: 'New features, may have breaking changes' }
];

function SettingsModal({ config, onSave, onClose, isSaving, currentUser }) {
  const [activeTab, setActiveTab] = useState('config');
  const [appId, setAppId] = useState(config.appId);
  const [restKey, setRestKey] = useState(config.restKey);

  // API Version state
  const [apiVersion, setApiVersion] = useState(localStorage.getItem('api_version') || 'v1');

  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('standard');
  const [ccEmail, setCcEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Handle API version change
  const handleApiVersionChange = (version) => {
    setApiVersion(version);
    localStorage.setItem('api_version', version);
  };

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isOwner || currentUser?.email === 'chris.thompson@sobersidekick.com';

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUserError('');

    // Create abort controller with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(`${BACKEND_URL}/api/users`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        const data = await response.json();
        setUserError(data.error || 'Failed to load users');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        setUserError('Request timed out. Please try again.');
      } else {
        setUserError('Failed to connect to server');
      }
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      fetchUsers();
    }
  }, [activeTab, isAdmin, fetchUsers]);

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    onSave({ appId, restKey });
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setInviting(true);
    setUserError('');
    setUserSuccess('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          inviterEmail: currentUser?.email,
          inviterName: currentUser?.name || 'Admin',
          ccEmail: ccEmail.trim() || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        setUserSuccess(data.emailSent
          ? `Invitation sent to ${inviteEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''}`
          : `User created (email not sent - SMTP not configured)`);
        setInviteEmail('');
        setInviteRole('standard');
        setCcEmail('');
        setShowInviteForm(false);
        fetchUsers();
      } else {
        setUserError(data.error || 'Failed to invite user');
      }
    } catch (error) {
      setUserError('Failed to connect to server');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    setUserError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole,
          requesterEmail: currentUser?.email
        })
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const data = await response.json();
        setUserError(data.error || 'Failed to update user');
      }
    } catch (error) {
      setUserError('Failed to connect to server');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to remove ${userEmail} from the dashboard?`)) {
      return;
    }

    setUserError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}?requesterEmail=${currentUser?.email}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setUserSuccess(`${userEmail} has been removed`);
        fetchUsers();
      } else {
        const data = await response.json();
        setUserError(data.error || 'Failed to delete user');
      }
    } catch (error) {
      setUserError('Failed to connect to server');
    }
  };

  const handleResendInvite = async (userId, userEmail) => {
    setUserError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviterName: currentUser?.name || 'Admin'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setUserSuccess(data.emailSent
          ? `Invitation resent to ${userEmail}`
          : `Invite refreshed (email not sent - SMTP not configured)`);
      } else {
        const data = await response.json();
        setUserError(data.error || 'Failed to resend invite');
      }
    } catch (error) {
      setUserError('Failed to connect to server');
    }
  };

  const formatDate = (dateObj) => {
    if (!dateObj) return '—';
    const date = dateObj.iso ? new Date(dateObj.iso) : new Date(dateObj);
    return date.toLocaleDateString();
  };

  return (
    <>
      <div className="settings-panel-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose} disabled={isSaving}>&times;</button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Configuration
          </button>
          {isAdmin && (
            <button
              className={`settings-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              Users
            </button>
          )}
          <button
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16,18 22,12 16,6"/>
              <polyline points="8,6 2,12 8,18"/>
            </svg>
            API
          </button>
          <button
            className={`settings-tab ${activeTab === 'releases' ? 'active' : ''}`}
            onClick={() => setActiveTab('releases')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            Release Notes
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'config' && (
            <form onSubmit={handleConfigSubmit} className="settings-form">
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
              </div>

              <div className="settings-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'users' && isAdmin && (
            <div className="users-section">
              {userError && (
                <div className="alert alert-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {userError}
                </div>
              )}

              {userSuccess && (
                <div className="alert alert-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  {userSuccess}
                </div>
              )}

              <div className="users-header">
                <h3>Team Members</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowInviteForm(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  Invite User
                </button>
              </div>

              {showInviteForm && (
                <form onSubmit={handleInviteUser} className="invite-form">
                  <div className="invite-form-row">
                    <div className="form-group">
                      <label htmlFor="inviteEmail">Email Address</label>
                      <input
                        type="email"
                        id="inviteEmail"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@example.com"
                        required
                        disabled={inviting}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="inviteRole">Role</label>
                      <select
                        id="inviteRole"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        disabled={inviting}
                      >
                        <option value="standard">Standard</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="ccEmail">CC Email (optional)</label>
                    <input
                      type="email"
                      id="ccEmail"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      placeholder="manager@example.com"
                      disabled={inviting}
                    />
                  </div>
                  <div className="invite-form-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowInviteForm(false)}
                      disabled={inviting}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={inviting}>
                      {inviting ? (
                        <>
                          <span className="btn-spinner"></span>
                          Sending...
                        </>
                      ) : 'Send Invite'}
                    </button>
                  </div>
                  <p className="invite-help">
                    <strong>Standard:</strong> Can view and use the scraper.
                    <strong>Admin:</strong> Can also manage users.
                  </p>
                </form>
              )}

              <div className="users-list-container">
                {loadingUsers ? (
                  <div className="users-list">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="skeleton-row">
                        <div className="skeleton-avatar"></div>
                        <div className="skeleton-content">
                          <div className="skeleton-line medium"></div>
                          <div className="skeleton-line short"></div>
                        </div>
                        <div className="skeleton-actions"></div>
                      </div>
                    ))}
                  </div>
                ) : users.length === 0 ? (
                <div className="users-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  <p>No users yet</p>
                  <span>Invite team members to get started</span>
                </div>
              ) : (
                <div className="users-list">
                  {users.map((user) => (
                    <div key={user.objectId} className="user-card">
                      <div className="user-avatar">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="user-info">
                        <div className="user-email">{user.email}</div>
                        <div className="user-meta">
                          <span className={`user-status status-${user.status}`}>
                            {user.status === 'pending' ? 'Pending' : user.status === 'active' ? 'Active' : 'Suspended'}
                          </span>
                          {user.isOwner && <span className="user-badge owner">Owner</span>}
                          <span className="user-invited">
                            Invited {formatDate(user.invitedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="user-role">
                        {user.isOwner ? (
                          <span className="role-badge admin">Admin</span>
                        ) : (
                          <select
                            value={user.role || 'standard'}
                            onChange={(e) => handleUpdateRole(user.objectId, e.target.value)}
                            className="role-select"
                          >
                            <option value="standard">Standard</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </div>
                      <div className="user-actions">
                        {user.status === 'pending' && (
                          <button
                            className="btn btn-ghost btn-icon"
                            onClick={() => handleResendInvite(user.objectId, user.email)}
                            title="Resend invite"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="1,4 1,10 7,10"/>
                              <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                            </svg>
                          </button>
                        )}
                        {!user.isOwner && (
                          <button
                            className="btn btn-ghost btn-icon btn-danger-hover"
                            onClick={() => handleDeleteUser(user.objectId, user.email)}
                            title="Remove user"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3,6 5,6 21,6"/>
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="api-version-section">
              <h3>API Version</h3>
              <p className="section-description">
                Select which API version to use for data requests. Changes take effect immediately.
              </p>

              <div className="api-version-options">
                {API_VERSIONS.map((v) => (
                  <label
                    key={v.version}
                    className={`api-version-option ${apiVersion === v.version ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="apiVersion"
                      value={v.version}
                      checked={apiVersion === v.version}
                      onChange={() => handleApiVersionChange(v.version)}
                    />
                    <div className="version-radio"></div>
                    <div className="version-info">
                      <span className="version-label">{v.label}</span>
                      <span className="version-description">{v.description}</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="api-endpoint-info">
                <h4>Current Endpoint</h4>
                <code className="endpoint-url">
                  {BACKEND_URL}/api/{apiVersion}/meetings
                </code>
              </div>
            </div>
          )}

          {activeTab === 'releases' && (
            <div className="release-notes-section">
              <div className="release-notes-content">
                {RELEASE_NOTES.split('\n').map((line, index) => {
                  if (line.startsWith('## ')) {
                    return <h2 key={index}>{line.replace('## ', '')}</h2>;
                  } else if (line.startsWith('### ')) {
                    return <h3 key={index}>{line.replace('### ', '')}</h3>;
                  } else if (line.startsWith('- **')) {
                    const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
                    if (match) {
                      return (
                        <div key={index} className="release-item">
                          <strong>{match[1]}:</strong> {match[2]}
                        </div>
                      );
                    }
                    return <p key={index}>{line}</p>;
                  } else if (line.startsWith('  - ')) {
                    return <div key={index} className="release-subitem">{line.replace('  - ', '')}</div>;
                  } else if (line.trim()) {
                    return <p key={index}>{line}</p>;
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default SettingsModal;
