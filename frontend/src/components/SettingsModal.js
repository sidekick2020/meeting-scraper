import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Default API versions (will be enhanced with server data when available)
const DEFAULT_API_VERSIONS = [
  {
    version: 'v1',
    label: 'v1 (Stable)',
    description: 'Current stable API with full meeting data support',
    status: 'stable',
    features: [
      'Full meeting list with pagination',
      'Search and filtering',
      'Heatmap clustering',
      'State-based grouping'
    ],
    endpoints: ['/api/meetings', '/api/meetings/heatmap', '/api/meetings/by-state']
  },
  {
    version: 'v2-beta',
    label: 'v2 Beta',
    description: 'Next generation API with enhanced features',
    status: 'beta',
    features: [
      'All v1 features',
      'Enhanced filtering options',
      'Improved response format',
      'Batch operations support',
      'Webhooks (coming soon)'
    ],
    endpoints: ['/api/v2/meetings', '/api/v2/meetings/heatmap', '/api/v2/meetings/by-state']
  }
];

function SettingsModal({ config, onSave, onClose, isSaving, currentUser }) {
  const [activeTab, setActiveTab] = useState('config');
  const [appId, setAppId] = useState(config.appId);
  const [restKey, setRestKey] = useState(config.restKey);

  // API Version state
  const [apiVersion, setApiVersion] = useState(localStorage.getItem('api_version') || 'v1');
  const [isVersionSwitching, setIsVersionSwitching] = useState(false);
  const [versionSwitchProgress, setVersionSwitchProgress] = useState('');
  const [versionHistory, setVersionHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('api_version_history') || '[]');
    } catch {
      return [];
    }
  });
  const [versionError, setVersionError] = useState('');
  const [versionSuccess, setVersionSuccess] = useState('');

  // Git version tags state
  const [gitVersions, setGitVersions] = useState([]);
  const [recentCommits, setRecentCommits] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [hasGitTags, setHasGitTags] = useState(false);
  const [buildVersion, setBuildVersion] = useState('');

  // API versions with features
  const [apiVersions, setApiVersions] = useState(DEFAULT_API_VERSIONS);
  const [loadingApiVersions, setLoadingApiVersions] = useState(false);

  // Changelog state
  const [changelog, setChangelog] = useState([]);
  const [loadingChangelog, setLoadingChangelog] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [selectedVersionChangelog, setSelectedVersionChangelog] = useState(null);

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

  // Handle API version change with progress indicator
  const handleApiVersionChange = async (newVersion, isRollback = false) => {
    if (newVersion === apiVersion || isVersionSwitching) return;

    const previousVersion = apiVersion;
    setIsVersionSwitching(true);
    setVersionError('');
    setVersionSuccess('');
    setVersionSwitchProgress(isRollback ? 'Rolling back...' : 'Switching version...');

    try {
      // Step 1: Validate the API is reachable
      setVersionSwitchProgress('Validating endpoint...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const testResponse = await fetch(`${BACKEND_URL}/api/meetings?limit=1`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!testResponse.ok) {
        throw new Error(`API returned status ${testResponse.status}`);
      }

      // Step 2: Save current version to history (for rollback)
      setVersionSwitchProgress('Saving configuration...');
      const historyEntry = {
        version: previousVersion,
        switchedAt: new Date().toISOString(),
        switchedTo: newVersion
      };

      const updatedHistory = [historyEntry, ...versionHistory].slice(0, 10); // Keep last 10 entries
      setVersionHistory(updatedHistory);
      localStorage.setItem('api_version_history', JSON.stringify(updatedHistory));

      // Step 3: Apply the new version
      setVersionSwitchProgress('Applying changes...');
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause for UX

      setApiVersion(newVersion);
      localStorage.setItem('api_version', newVersion);

      setVersionSuccess(isRollback
        ? `Rolled back to ${newVersion}`
        : `Switched to ${newVersion}`);

      // Clear success message after 3 seconds
      setTimeout(() => setVersionSuccess(''), 3000);

    } catch (error) {
      if (error.name === 'AbortError') {
        setVersionError('Request timed out. The API endpoint may be unavailable.');
      } else {
        setVersionError(`Failed to switch version: ${error.message}`);
      }
    } finally {
      setIsVersionSwitching(false);
      setVersionSwitchProgress('');
    }
  };

  // Handle rollback to previous version
  const handleRollback = (historyEntry) => {
    handleApiVersionChange(historyEntry.version, true);
  };

  // Format relative time for history
  const formatRelativeTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
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

  // Fetch git version tags when API tab is active
  const fetchGitVersions = useCallback(async () => {
    setLoadingVersions(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/versions`);
      if (response.ok) {
        const data = await response.json();
        setGitVersions(data.versions || []);
        setRecentCommits(data.recent_commits || []);
        setHasGitTags(data.has_tags || false);
        setBuildVersion(data.build_version || '');
      }
    } catch (error) {
      console.error('Failed to fetch git versions:', error);
    } finally {
      setLoadingVersions(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'api') {
      fetchGitVersions();
      fetchApiVersions();
    }
    if (activeTab === 'releases') {
      fetchChangelog();
    }
  }, [activeTab, fetchGitVersions]);

  // Fetch API versions with features from server
  const fetchApiVersions = async () => {
    setLoadingApiVersions(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/api-versions`);
      if (response.ok) {
        const data = await response.json();
        if (data.versions && data.versions.length > 0) {
          setApiVersions(data.versions);
        }
      }
    } catch (error) {
      console.error('Failed to fetch API versions:', error);
    } finally {
      setLoadingApiVersions(false);
    }
  };

  // Fetch changelog from server
  const fetchChangelog = async () => {
    setLoadingChangelog(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/changelog`);
      if (response.ok) {
        const data = await response.json();
        setChangelog(data.changelog || []);
      }
    } catch (error) {
      console.error('Failed to fetch changelog:', error);
    } finally {
      setLoadingChangelog(false);
    }
  };

  // Show changelog for a specific version
  const handleShowVersionChangelog = (version) => {
    setSelectedVersionChangelog(version);
    setShowChangelogModal(true);
  };

  // Get section icon based on section name
  const getSectionIcon = (sectionName) => {
    const name = sectionName.toLowerCase();
    if (name.includes('feature')) return '✨';
    if (name.includes('bug') || name.includes('fix')) return '🐛';
    if (name.includes('performance')) return '⚡';
    if (name.includes('ui') || name.includes('ux')) return '🎨';
    if (name.includes('documentation') || name.includes('doc')) return '📚';
    if (name.includes('backend')) return '⚙️';
    return '📝';
  };

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

              {versionError && (
                <div className="alert alert-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {versionError}
                </div>
              )}

              {versionSuccess && (
                <div className="alert alert-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  {versionSuccess}
                </div>
              )}

              {isVersionSwitching && (
                <div className="version-switch-progress">
                  <div className="version-switch-spinner"></div>
                  <span>{versionSwitchProgress}</span>
                </div>
              )}

              <div className={`api-version-options ${isVersionSwitching ? 'disabled' : ''}`}>
                {apiVersions.map((v) => (
                  <div
                    key={v.version}
                    className={`api-version-card ${apiVersion === v.version ? 'selected' : ''} ${isVersionSwitching ? 'disabled' : ''}`}
                  >
                    <label className="api-version-card-header">
                      <input
                        type="radio"
                        name="apiVersion"
                        value={v.version}
                        checked={apiVersion === v.version}
                        onChange={() => handleApiVersionChange(v.version)}
                        disabled={isVersionSwitching}
                      />
                      <div className="version-radio">
                        {isVersionSwitching && apiVersion !== v.version && (
                          <div className="version-radio-loading"></div>
                        )}
                      </div>
                      <div className="version-info">
                        <div className="version-title-row">
                          <span className="version-label">{v.label}</span>
                          <span className={`version-status-badge ${v.status || 'stable'}`}>
                            {v.status === 'beta' ? 'Beta' : 'Stable'}
                          </span>
                        </div>
                        <span className="version-description">{v.description}</span>
                      </div>
                      {apiVersion === v.version && (
                        <span className="version-active-badge">Active</span>
                      )}
                    </label>

                    {/* Version Features */}
                    {v.features && v.features.length > 0 && (
                      <div className="version-features">
                        <div className="version-features-header">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9,11 12,14 22,4"/>
                            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                          </svg>
                          Features
                        </div>
                        <ul className="version-features-list">
                          {v.features.slice(0, 4).map((feature, idx) => (
                            <li key={idx}>{feature}</li>
                          ))}
                          {v.features.length > 4 && (
                            <li className="more-features">+{v.features.length - 4} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Version Endpoints */}
                    {v.endpoints && v.endpoints.length > 0 && (
                      <div className="version-endpoints">
                        <div className="version-endpoints-header">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
                          </svg>
                          Endpoints
                        </div>
                        <div className="version-endpoints-list">
                          {v.endpoints.slice(0, 2).map((endpoint, idx) => (
                            <code key={idx} className="endpoint-badge">{endpoint}</code>
                          ))}
                          {v.endpoints.length > 2 && (
                            <span className="more-endpoints">+{v.endpoints.length - 2} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="api-endpoint-info">
                <h4>Current Endpoint</h4>
                <code className="endpoint-url">
                  {BACKEND_URL}/api/{apiVersion}/meetings
                </code>
                {buildVersion && (
                  <div className="build-version-info">
                    <span className="build-label">Build:</span>
                    <code className="build-version">{buildVersion}</code>
                  </div>
                )}
              </div>

              {/* Git Version Tags Section */}
              <div className="git-versions-section">
                <h4>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  Release History
                </h4>
                <p className="section-description">
                  All tagged releases with commit details.
                </p>

                {loadingVersions ? (
                  <div className="versions-loading">
                    <div className="version-switch-spinner"></div>
                    <span>Loading version history...</span>
                  </div>
                ) : hasGitTags && gitVersions.length > 0 ? (
                  <div className="git-versions-list">
                    {gitVersions.map((v, index) => (
                      <div key={v.tag} className={`git-version-entry ${v.is_current ? 'current' : ''}`}>
                        <div className="git-version-header">
                          <span className="git-version-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                              <line x1="7" y1="7" x2="7.01" y2="7"/>
                            </svg>
                            {v.tag}
                          </span>
                          {v.is_current && (
                            <span className="git-version-current-badge">Current</span>
                          )}
                          <span className="git-version-date">
                            {v.commit_date ? new Date(v.commit_date).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <div className="git-version-details">
                          <div className="git-version-commit">
                            <code className="commit-hash">{v.commit_hash}</code>
                            <span className="commit-message">{v.commit_message}</span>
                          </div>
                          {v.annotation && v.annotation !== v.commit_message && (
                            <div className="git-version-annotation">{v.annotation}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-versions-message">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <p>No version tags found in repository.</p>
                    <p className="hint">Create tags using: <code>git tag -a v1.0.0 -m "Release notes"</code></p>
                  </div>
                )}

                {/* Recent Commits (unreleased) */}
                {recentCommits.length > 0 && (
                  <div className="recent-commits-section">
                    <h5>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="4"/>
                        <line x1="1.05" y1="12" x2="7" y2="12"/>
                        <line x1="17.01" y1="12" x2="22.96" y2="12"/>
                      </svg>
                      Unreleased Changes ({recentCommits.length} commits)
                    </h5>
                    <div className="recent-commits-list">
                      {recentCommits.slice(0, 5).map((c, index) => (
                        <div key={index} className="recent-commit-entry">
                          <code className="commit-hash">{c.hash}</code>
                          <span className="commit-message">{c.message}</span>
                        </div>
                      ))}
                      {recentCommits.length > 5 && (
                        <div className="more-commits">
                          +{recentCommits.length - 5} more commits
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* API Version Switch History */}
              {versionHistory.length > 0 && (
                <div className="api-rollback-section">
                  <h4>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1,4 1,10 7,10"/>
                      <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                    </svg>
                    API Version Switch History
                  </h4>
                  <p className="rollback-description">
                    Rollback to a previous API version if needed.
                  </p>
                  <div className="rollback-history">
                    {versionHistory.slice(0, 5).map((entry, index) => (
                      <div key={index} className="rollback-entry">
                        <div className="rollback-entry-info">
                          <span className="rollback-version">{entry.version}</span>
                          <span className="rollback-meta">
                            Used before switching to {entry.switchedTo} • {formatRelativeTime(entry.switchedAt)}
                          </span>
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRollback(entry)}
                          disabled={isVersionSwitching || entry.version === apiVersion}
                          title={entry.version === apiVersion ? 'Already using this version' : `Rollback to ${entry.version}`}
                        >
                          {entry.version === apiVersion ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20,6 9,17 4,12"/>
                              </svg>
                              Current
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="1,4 1,10 7,10"/>
                                <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                              </svg>
                              Rollback
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'releases' && (
            <div className="release-notes-section">
              <div className="changelog-header">
                <h3>Changelog</h3>
                <p className="section-description">
                  View all changes, features, and bug fixes across all versions.
                </p>
              </div>

              {loadingChangelog ? (
                <div className="versions-loading">
                  <div className="version-switch-spinner"></div>
                  <span>Loading changelog...</span>
                </div>
              ) : changelog.length > 0 ? (
                <div className="changelog-list">
                  {changelog.map((version, vIndex) => (
                    <div key={vIndex} className="changelog-version">
                      <div className="changelog-version-header">
                        <div className="changelog-version-info">
                          <span className="changelog-version-number">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                              <line x1="7" y1="7" x2="7.01" y2="7"/>
                            </svg>
                            {version.version}
                          </span>
                          {version.date && (
                            <span className="changelog-version-date">{version.date}</span>
                          )}
                        </div>
                      </div>

                      <div className="changelog-sections">
                        {Object.entries(version.sections).map(([sectionName, items], sIndex) => (
                          items.length > 0 && (
                            <div key={sIndex} className="changelog-section">
                              <div className="changelog-section-header">
                                <span className="changelog-section-icon">{getSectionIcon(sectionName)}</span>
                                <span className="changelog-section-name">{sectionName}</span>
                                <span className="changelog-section-count">{items.length}</span>
                              </div>

                              <div className="changelog-items">
                                {items.map((item, iIndex) => (
                                  <div key={iIndex} className="changelog-item">
                                    <div className="changelog-item-title">
                                      <strong>{item.title}</strong>
                                      {item.description && (
                                        <span className="changelog-item-description">: {item.description}</span>
                                      )}
                                    </div>
                                    {item.details && item.details.length > 0 && (
                                      <ul className="changelog-item-details">
                                        {item.details.map((detail, dIndex) => (
                                          <li key={dIndex}>{detail}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-versions-message">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <p>No changelog available</p>
                  <p className="hint">Check back later for release notes.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default SettingsModal;
