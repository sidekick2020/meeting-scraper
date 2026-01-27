import React, { useState, useEffect, useCallback } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Cache keys for SettingsModal
const SETTINGS_CACHE_KEYS = {
  USERS: 'settings:users',
  GIT_VERSIONS: 'settings:gitVersions',
  RECENT_COMMITS: 'settings:recentCommits',
  API_VERSIONS: 'settings:apiVersions',
  CHANGELOG: 'settings:changelog',
  PR_HISTORY: 'settings:prHistory'
};

// Cache TTL: 5 minutes for settings data
const SETTINGS_CACHE_TTL = 5 * 60 * 1000;

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

function SettingsModal({ onClose, currentUser }) {
  const { getCache, setCache } = useDataCache();

  // Initialize from cache
  const cachedUsers = getCache(SETTINGS_CACHE_KEYS.USERS);
  const cachedGitVersions = getCache(SETTINGS_CACHE_KEYS.GIT_VERSIONS);
  const cachedRecentCommits = getCache(SETTINGS_CACHE_KEYS.RECENT_COMMITS);
  const cachedApiVersions = getCache(SETTINGS_CACHE_KEYS.API_VERSIONS);
  const cachedChangelog = getCache(SETTINGS_CACHE_KEYS.CHANGELOG);
  const cachedPrHistory = getCache(SETTINGS_CACHE_KEYS.PR_HISTORY);

  const [activeTab, setActiveTab] = useState('users');

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

  // Git version tags state - initialize from cache
  const [gitVersions, setGitVersions] = useState(cachedGitVersions?.data || []);
  const [recentCommits, setRecentCommits] = useState(cachedRecentCommits?.data || []);
  const [loadingVersions, setLoadingVersions] = useState(!cachedGitVersions?.data);
  const [hasGitTags, setHasGitTags] = useState(cachedGitVersions?.data?.length > 0);
  const [buildVersion, setBuildVersion] = useState('');

  // API versions with features - initialize from cache
  const [apiVersions, setApiVersions] = useState(cachedApiVersions?.data || DEFAULT_API_VERSIONS);
  const [loadingApiVersions, setLoadingApiVersions] = useState(!cachedApiVersions?.data);

  // Changelog state - initialize from cache
  const [changelog, setChangelog] = useState(cachedChangelog?.data || []);
  const [loadingChangelog, setLoadingChangelog] = useState(!cachedChangelog?.data);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [selectedVersionChangelog, setSelectedVersionChangelog] = useState(null);

  // PR History state - initialize from cache
  const [prHistory, setPrHistory] = useState(cachedPrHistory?.data || []);
  const [loadingPrHistory, setLoadingPrHistory] = useState(!cachedPrHistory?.data);
  const [expandedPrId, setExpandedPrId] = useState(null);

  // Users state - initialize from cache
  const [users, setUsers] = useState(cachedUsers?.data || []);
  const [loadingUsers, setLoadingUsers] = useState(!cachedUsers?.data);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('standard');
  const [ccEmail, setCcEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Permissions state
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [permissionDefinitions, setPermissionDefinitions] = useState(null);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);

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

  const fetchUsers = useCallback(async (forceRefresh = false) => {
    // Skip if we have cached data and not forcing refresh
    if (!forceRefresh && cachedUsers?.data && cachedUsers.data.length > 0) {
      setLoadingUsers(false);
      return;
    }

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
        const usersList = data.users || [];
        setUsers(usersList);
        // Cache the users
        setCache(SETTINGS_CACHE_KEYS.USERS, usersList, SETTINGS_CACHE_TTL);
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
  }, [cachedUsers, setCache]);

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      fetchUsers();
      fetchPermissions();
    }
  }, [activeTab, isAdmin, fetchUsers]);

  // Fetch permission definitions
  const fetchPermissions = async () => {
    if (permissionDefinitions) return; // Already loaded
    try {
      const response = await fetch(`${BACKEND_URL}/api/permissions`);
      if (response.ok) {
        const data = await response.json();
        setPermissionDefinitions(data);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  // Toggle user expanded state
  const toggleUserExpanded = (userId) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  // Handle permission toggle for a user
  const handleTogglePermission = async (userId, permission, currentPermissions) => {
    setUpdatingPermissions(true);
    setUserError('');

    const hasPermission = currentPermissions?.includes(permission);
    const newPermissions = hasPermission
      ? currentPermissions.filter(p => p !== permission)
      : [...(currentPermissions || []), permission];

    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: newPermissions,
          requesterEmail: currentUser?.email
        })
      });

      if (response.ok) {
        fetchUsers(true); // Force refresh
        setUserSuccess('Permission updated successfully');
        setTimeout(() => setUserSuccess(''), 3000);
      } else {
        const data = await response.json();
        setUserError(data.error || 'Failed to update permissions');
      }
    } catch (error) {
      setUserError('Failed to connect to server');
    } finally {
      setUpdatingPermissions(false);
    }
  };

  // Get user's effective permissions (considering role)
  const getUserPermissions = (user) => {
    if (user.role === 'admin' || user.isOwner) {
      return permissionDefinitions?.allPermissions || [];
    }
    return user.permissions || permissionDefinitions?.defaultStandardPermissions || [];
  };

  // Fetch git version tags when API tab is active
  const fetchGitVersions = useCallback(async (forceRefresh = false) => {
    // Skip if we have cached data and not forcing refresh
    if (!forceRefresh && cachedGitVersions?.data && cachedGitVersions.data.length > 0) {
      setLoadingVersions(false);
      return;
    }

    setLoadingVersions(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/versions`);
      if (response.ok) {
        const data = await response.json();
        const versions = data.versions || [];
        const commits = data.recent_commits || [];
        setGitVersions(versions);
        setRecentCommits(commits);
        setHasGitTags(data.has_tags || false);
        setBuildVersion(data.build_version || '');
        // Cache the data
        setCache(SETTINGS_CACHE_KEYS.GIT_VERSIONS, versions, SETTINGS_CACHE_TTL);
        setCache(SETTINGS_CACHE_KEYS.RECENT_COMMITS, commits, SETTINGS_CACHE_TTL);
      }
    } catch (error) {
      console.error('Failed to fetch git versions:', error);
    } finally {
      setLoadingVersions(false);
    }
  }, [cachedGitVersions, setCache]);

  useEffect(() => {
    if (activeTab === 'api') {
      fetchGitVersions();
      fetchApiVersions();
    }
    if (activeTab === 'releases') {
      fetchChangelog();
    }
    if (activeTab === 'version-history') {
      fetchPrHistory();
    }
  }, [activeTab, fetchGitVersions]);

  // Fetch API versions with features from server
  const fetchApiVersions = async (forceRefresh = false) => {
    // Skip if we have cached data and not forcing refresh
    if (!forceRefresh && cachedApiVersions?.data && cachedApiVersions.data.length > 0) {
      setLoadingApiVersions(false);
      return;
    }

    setLoadingApiVersions(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/api-versions`);
      if (response.ok) {
        const data = await response.json();
        if (data.versions && data.versions.length > 0) {
          setApiVersions(data.versions);
          // Cache the data
          setCache(SETTINGS_CACHE_KEYS.API_VERSIONS, data.versions, SETTINGS_CACHE_TTL);
        }
      }
    } catch (error) {
      console.error('Failed to fetch API versions:', error);
    } finally {
      setLoadingApiVersions(false);
    }
  };

  // Fetch changelog from server
  const fetchChangelog = async (forceRefresh = false) => {
    // Skip if we have cached data and not forcing refresh
    if (!forceRefresh && cachedChangelog?.data && cachedChangelog.data.length > 0) {
      setLoadingChangelog(false);
      return;
    }

    setLoadingChangelog(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/changelog`);
      if (response.ok) {
        const data = await response.json();
        const changelogData = data.changelog || [];
        setChangelog(changelogData);
        // Cache the data
        setCache(SETTINGS_CACHE_KEYS.CHANGELOG, changelogData, SETTINGS_CACHE_TTL);
      }
    } catch (error) {
      console.error('Failed to fetch changelog:', error);
    } finally {
      setLoadingChangelog(false);
    }
  };

  // Fetch PR history from server
  const fetchPrHistory = async (forceRefresh = false) => {
    // Skip if we have cached data and not forcing refresh
    if (!forceRefresh && cachedPrHistory?.data && cachedPrHistory.data.length > 0) {
      setLoadingPrHistory(false);
      return;
    }

    setLoadingPrHistory(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/pr-history`);
      if (response.ok) {
        const data = await response.json();
        const prs = data.pull_requests || [];
        setPrHistory(prs);
        // Cache the data
        setCache(SETTINGS_CACHE_KEYS.PR_HISTORY, prs, SETTINGS_CACHE_TTL);
      }
    } catch (error) {
      console.error('Failed to fetch PR history:', error);
    } finally {
      setLoadingPrHistory(false);
    }
  };

  // Get PR type badge color
  const getPrTypeBadge = (type) => {
    const badges = {
      feature: { label: 'Feature', className: 'pr-type-feature' },
      fix: { label: 'Bug Fix', className: 'pr-type-fix' },
      improvement: { label: 'Improvement', className: 'pr-type-improvement' },
      docs: { label: 'Docs', className: 'pr-type-docs' },
      refactor: { label: 'Refactor', className: 'pr-type-refactor' },
      test: { label: 'Test', className: 'pr-type-test' }
    };
    return badges[type] || { label: 'Other', className: 'pr-type-other' };
  };

  // Format PR date
  const formatPrDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
        fetchUsers(true); // Force refresh
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
        fetchUsers(true); // Force refresh
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
        fetchUsers(true); // Force refresh
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
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-tabs">
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
          <button
            className={`settings-tab ${activeTab === 'version-history' ? 'active' : ''}`}
            onClick={() => setActiveTab('version-history')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            Version History
          </button>
        </div>

        <div className="settings-content">
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
                  {users.map((user) => {
                    const isExpanded = expandedUserId === user.objectId;
                    const userPermissions = getUserPermissions(user);
                    const isAdminUser = user.role === 'admin' || user.isOwner;

                    return (
                      <div key={user.objectId} className={`user-card ${isExpanded ? 'expanded' : ''}`}>
                        <div className="user-card-header" onClick={() => toggleUserExpanded(user.objectId)}>
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
                          <div className="user-role" onClick={(e) => e.stopPropagation()}>
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
                          <div className="user-actions" onClick={(e) => e.stopPropagation()}>
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
                          <button className={`user-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="6,9 12,15 18,9"/>
                            </svg>
                          </button>
                        </div>

                        {isExpanded && permissionDefinitions && (
                          <div className="user-permissions-panel">
                            <div className="permissions-header">
                              <h4>Permissions</h4>
                              {isAdminUser && (
                                <span className="permissions-note">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="16" x2="12" y2="12"/>
                                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                                  </svg>
                                  Admin users have all permissions
                                </span>
                              )}
                            </div>

                            <div className="permissions-grid">
                              {Object.entries(
                                Object.entries(permissionDefinitions.permissions).reduce((acc, [key, perm]) => {
                                  const category = perm.category || 'Other';
                                  if (!acc[category]) acc[category] = [];
                                  acc[category].push({ key, ...perm });
                                  return acc;
                                }, {})
                              ).map(([category, perms]) => (
                                <div key={category} className="permission-category">
                                  <div className="permission-category-header">{category}</div>
                                  {perms.map((perm) => {
                                    const hasPermission = userPermissions.includes(perm.key);
                                    return (
                                      <label
                                        key={perm.key}
                                        className={`permission-toggle ${isAdminUser ? 'disabled' : ''} ${hasPermission ? 'active' : ''}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={hasPermission}
                                          disabled={isAdminUser || updatingPermissions}
                                          onChange={() => handleTogglePermission(user.objectId, perm.key, user.permissions || [])}
                                        />
                                        <span className="permission-checkbox">
                                          {hasPermission && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                              <polyline points="20,6 9,17 4,12"/>
                                            </svg>
                                          )}
                                        </span>
                                        <span className="permission-info">
                                          <span className="permission-label">{perm.label}</span>
                                          <span className="permission-description">{perm.description}</span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

          {activeTab === 'version-history' && (
            <div className="version-history-section">
              <div className="version-history-header">
                <h3>Pull Request History</h3>
                <p className="section-description">
                  Track all merged pull requests and their contributions to the codebase.
                </p>
              </div>

              {loadingPrHistory ? (
                <div className="versions-loading">
                  <div className="version-switch-spinner"></div>
                  <span>Loading PR history...</span>
                </div>
              ) : prHistory.length > 0 ? (
                <div className="pr-history-list">
                  {prHistory.map((pr) => {
                    const typeBadge = getPrTypeBadge(pr.type);
                    const isExpanded = expandedPrId === pr.number;

                    return (
                      <div
                        key={pr.number}
                        className={`pr-history-card ${isExpanded ? 'expanded' : ''}`}
                      >
                        <div
                          className="pr-history-card-header"
                          onClick={() => setExpandedPrId(isExpanded ? null : pr.number)}
                        >
                          <div className="pr-info">
                            <div className="pr-title-row">
                              <span className="pr-number">#{pr.number}</span>
                              <span className="pr-title">{pr.title}</span>
                              <span className={`pr-type-badge ${typeBadge.className}`}>
                                {typeBadge.label}
                              </span>
                            </div>
                            <div className="pr-meta">
                              <span className="pr-date">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                  <line x1="16" y1="2" x2="16" y2="6"/>
                                  <line x1="8" y1="2" x2="8" y2="6"/>
                                  <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                {formatPrDate(pr.merged_at)}
                              </span>
                              <span className="pr-branch">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="6" y1="3" x2="6" y2="15"/>
                                  <circle cx="18" cy="6" r="3"/>
                                  <circle cx="6" cy="18" r="3"/>
                                  <path d="M18 9a9 9 0 01-9 9"/>
                                </svg>
                                {pr.branch}
                              </span>
                              {pr.commits_count > 0 && (
                                <span className="pr-commits-count">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="4"/>
                                    <line x1="1.05" y1="12" x2="7" y2="12"/>
                                    <line x1="17.01" y1="12" x2="22.96" y2="12"/>
                                  </svg>
                                  {pr.commits_count} commit{pr.commits_count !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="pr-actions">
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => e.stopPropagation()}
                              title="View on GitHub"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                                <polyline points="15,3 21,3 21,9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                              View PR
                            </a>
                            <button className={`pr-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6,9 12,15 18,9"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        {isExpanded && pr.commits && pr.commits.length > 0 && (
                          <div className="pr-commits-panel">
                            <div className="pr-commits-header">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="4"/>
                                <line x1="1.05" y1="12" x2="7" y2="12"/>
                                <line x1="17.01" y1="12" x2="22.96" y2="12"/>
                              </svg>
                              Commits in this PR
                            </div>
                            <div className="pr-commits-list">
                              {pr.commits.map((commit, idx) => (
                                <div key={idx} className="pr-commit-entry">
                                  <code className="commit-hash">{commit.hash}</code>
                                  <span className="commit-message">{commit.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-versions-message">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <p>No pull request history available</p>
                  <p className="hint">PR history will appear here once pull requests are merged.</p>
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
