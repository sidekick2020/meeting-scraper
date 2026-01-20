import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MeetingSchema from './MeetingSchema';

// Swift Meeting model file content
const swiftModelContent = `import ParseSwift

struct Meeting: ParseObject {
    // Required by ParseObject
    var objectId: String?
    var createdAt: Date?
    var updatedAt: Date?
    var ACL: ParseACL?
    var originalData: Data?

    // Meeting fields
    var name: String?
    var meetingType: String?
    var day: Int?
    var time: String?
    var endTime: String?
    var timezone: String?
    var address: String?
    var city: String?
    var state: String?
    var postalCode: String?
    var latitude: Double?
    var longitude: Double?
    var isOnline: Bool?
    var isHybrid: Bool?
    var onlineUrl: String?
    var locationName: String?
    var types: [String]?
    var notes: String?
    var region: String?
    var subRegion: String?
    var locationNotes: String?
    var group: String?
    var groupNotes: String?
    var contactName: String?
    var contactEmail: String?
    var contactPhone: String?
    var sourceFeed: String?
}
`;

// Kotlin Meeting model file content
const kotlinModelContent = `package com.yourapp.models

import com.parse.ParseClassName
import com.parse.ParseObject

@ParseClassName("Meetings")
class Meeting : ParseObject() {
    var name: String?
        get() = getString("name")
        set(value) = put("name", value ?: "")

    var meetingType: String?
        get() = getString("meetingType")
        set(value) = put("meetingType", value ?: "")

    var day: Int
        get() = getInt("day")
        set(value) = put("day", value)

    var time: String?
        get() = getString("time")
        set(value) = put("time", value ?: "")

    var endTime: String?
        get() = getString("endTime")
        set(value) = put("endTime", value ?: "")

    var timezone: String?
        get() = getString("timezone")
        set(value) = put("timezone", value ?: "")

    var city: String?
        get() = getString("city")
        set(value) = put("city", value ?: "")

    var state: String?
        get() = getString("state")
        set(value) = put("state", value ?: "")

    var address: String?
        get() = getString("address")
        set(value) = put("address", value ?: "")

    var postalCode: String?
        get() = getString("postalCode")
        set(value) = put("postalCode", value ?: "")

    var latitude: Double
        get() = getDouble("latitude")
        set(value) = put("latitude", value)

    var longitude: Double
        get() = getDouble("longitude")
        set(value) = put("longitude", value)

    var isOnline: Boolean
        get() = getBoolean("isOnline")
        set(value) = put("isOnline", value)

    var isHybrid: Boolean
        get() = getBoolean("isHybrid")
        set(value) = put("isHybrid", value)

    var onlineUrl: String?
        get() = getString("onlineUrl")
        set(value) = put("onlineUrl", value ?: "")

    var locationName: String?
        get() = getString("locationName")
        set(value) = put("locationName", value ?: "")

    var region: String?
        get() = getString("region")
        set(value) = put("region", value ?: "")

    var subRegion: String?
        get() = getString("subRegion")
        set(value) = put("subRegion", value ?: "")

    var locationNotes: String?
        get() = getString("locationNotes")
        set(value) = put("locationNotes", value ?: "")

    var notes: String?
        get() = getString("notes")
        set(value) = put("notes", value ?: "")

    var group: String?
        get() = getString("group")
        set(value) = put("group", value ?: "")

    var groupNotes: String?
        get() = getString("groupNotes")
        set(value) = put("groupNotes", value ?: "")

    var contactName: String?
        get() = getString("contactName")
        set(value) = put("contactName", value ?: "")

    var contactEmail: String?
        get() = getString("contactEmail")
        set(value) = put("contactEmail", value ?: "")

    var contactPhone: String?
        get() = getString("contactPhone")
        set(value) = put("contactPhone", value ?: "")

    var sourceFeed: String?
        get() = getString("sourceFeed")
        set(value) = put("sourceFeed", value ?: "")

    var types: List<String>?
        get() = getList("types")
        set(value) = put("types", value ?: emptyList<String>())
}
`;

// Helper function to download file
const downloadFile = (content, filename) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function DevDocs({ onClose, standalone = false }) {
  const [activeTab, setActiveTab] = useState('user-guide');
  const navigate = useNavigate();

  const handleClose = () => {
    if (standalone) {
      navigate('/');
    } else if (onClose) {
      onClose();
    }
  };

  const content = (
    <div className={`dev-docs-container ${standalone ? 'dev-docs-standalone' : ''}`}>
      <header className="dev-docs-header">
        <div className="dev-docs-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <h1>Documentation</h1>
        </div>
        {standalone ? (
          <button onClick={handleClose} className="dev-docs-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to App
          </button>
        ) : (
          <button onClick={handleClose} className="dev-docs-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </header>

          <div className="dev-docs-layout">
            <nav className="dev-docs-sidebar">
              <div className="sidebar-section">
                <h3>Getting Started</h3>
                <button
                  className={`sidebar-item ${activeTab === 'user-guide' ? 'active' : ''}`}
                  onClick={() => setActiveTab('user-guide')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  User Guide
                </button>
                <button
                  className={`sidebar-item ${activeTab === 'admin-guide' ? 'active' : ''}`}
                  onClick={() => setActiveTab('admin-guide')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                  Admin Guide
                </button>
              </div>
              <div className="sidebar-section">
                <h3>Documentation</h3>
                <button
                  className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                  Overview
                </button>
                <button
                  className={`sidebar-item ${activeTab === 'schema' ? 'active' : ''}`}
                  onClick={() => setActiveTab('schema')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                  Meeting Schema
                </button>
                <button
                  className={`sidebar-item ${activeTab === 'api' ? 'active' : ''}`}
                  onClick={() => setActiveTab('api')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10"/>
                    <path d="M12 20V4"/>
                    <path d="M6 20v-6"/>
                  </svg>
                  API Reference
                </button>
                <button
                  className={`sidebar-item ${activeTab === 'deployment' ? 'active' : ''}`}
                  onClick={() => setActiveTab('deployment')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  Deployment
                </button>
              </div>
              <div className="sidebar-section">
                <h3>Mobile SDKs</h3>
                <button
                  className={`sidebar-item ${activeTab === 'ios' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ios')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                  iOS Guide
                </button>
                <button
                  className={`sidebar-item ${activeTab === 'android' ? 'active' : ''}`}
                  onClick={() => setActiveTab('android')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                  Android Guide
                </button>
              </div>
              <div className="sidebar-section">
                <h3>Resources</h3>
                <a
                  href="https://github.com/sidekick2020/meeting-scraper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sidebar-item external-link"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/>
                  </svg>
                  GitHub Repository
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="external-icon">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
                <a
                  href="https://www.back4app.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sidebar-item external-link"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                  Back4app Dashboard
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="external-icon">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              </div>
            </nav>

            <main className="dev-docs-content">
              {activeTab === 'user-guide' && <UserGuideTab />}
              {activeTab === 'admin-guide' && <AdminGuideTab />}
              {activeTab === 'overview' && <OverviewTab />}
              {activeTab === 'schema' && <MeetingSchema />}
              {activeTab === 'api' && <ApiReferenceTab />}
              {activeTab === 'deployment' && <DeploymentTab />}
              {activeTab === 'ios' && <IOSGuideTab />}
              {activeTab === 'android' && <AndroidGuideTab />}
            </main>
          </div>
        </div>
  );

  if (standalone) {
    return content;
  }

  return (
    <>
      <div className="dev-docs-backdrop" onClick={handleClose} />
      <div className="dev-docs-overlay">
        {content}
      </div>
    </>
  );
}

function AdminGuideTab() {
  return (
    <div className="docs-page">
      <h1>Using the Meeting Scraper</h1>
      <p className="lead">
        Learn how to use the admin dashboard to collect and manage meeting data from
        recovery organizations across the United States.
      </p>

      <h2>Getting Started</h2>

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>Sign In to Admin</h4>
            <p>Click the <strong>"Admin"</strong> button in the top-right corner. Sign in with your authorized Google account.</p>
          </div>
        </div>
        <div className="step-card">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>Configure Database (First Time)</h4>
            <p>Go to <strong>Settings → Configuration</strong> and enter your Back4app Application ID and REST API Key.</p>
          </div>
        </div>
        <div className="step-card">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>Start Scraping</h4>
            <p>Click <strong>"Start Scraping"</strong> on the dashboard to begin collecting meeting data automatically.</p>
          </div>
        </div>
      </div>

      <div className="info-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <p><strong>Need credentials?</strong> Contact your administrator or create a free Back4app account at back4app.com</p>
      </div>

      <h2>Running the Scraper</h2>

      <div className="guide-section">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          What Happens During Scraping
        </h3>
        <div className="feature-grid">
          <div className="feature-item">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/>
              </svg>
              Connects to Feeds
            </h4>
            <p>Reaches official AA, NA, and Al-Anon websites to gather data</p>
          </div>
          <div className="feature-item">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <path d="M14 2v6h6M16 13H8M16 17H8"/>
              </svg>
              Collects Information
            </h4>
            <p>Gathers meeting names, times, locations, and all details</p>
          </div>
          <div className="feature-item">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="18" y1="8" x2="23" y2="13"/>
                <line x1="23" y1="8" x2="18" y2="13"/>
              </svg>
              Removes Duplicates
            </h4>
            <p>Prevents the same meeting from being saved twice</p>
          </div>
          <div className="feature-item">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Geocodes Addresses
            </h4>
            <p>Adds map coordinates for accurate location display</p>
          </div>
        </div>
      </div>

      <h3>Monitoring Progress</h3>
      <table className="quick-ref">
        <thead>
          <tr>
            <th>Indicator</th>
            <th>What It Shows</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Progress Bar</strong></td>
            <td>How many feeds have been processed out of the total</td>
          </tr>
          <tr>
            <td><strong>Meetings Found</strong></td>
            <td>Total number of meetings discovered so far</td>
          </tr>
          <tr>
            <td><strong>Meetings Saved</strong></td>
            <td>How many were successfully saved to your database</td>
          </tr>
          <tr>
            <td><strong>Current Source</strong></td>
            <td>Which feed is currently being scraped</td>
          </tr>
          <tr>
            <td><strong>Activity Log</strong></td>
            <td>Real-time updates on scraping activity</td>
          </tr>
        </tbody>
      </table>

      <div className="tip-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <p><strong>Tip:</strong> You can stop the scraper anytime by clicking "Stop Scraping". Any meetings already saved will remain in the database.</p>
      </div>

      <h2>Understanding the Dashboard</h2>

      <div className="feature-grid">
        <div className="feature-item">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            Total Meetings
          </h4>
          <p>All meetings currently stored in your database</p>
        </div>
        <div className="feature-item">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 10-16 0c0 3 2.7 7 8 11.7z"/>
            </svg>
            States Covered
          </h4>
          <p>Number of states with meeting data available</p>
        </div>
        <div className="feature-item">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Coverage Analysis
          </h4>
          <p>Meetings per capita and priority states needing data</p>
        </div>
        <div className="feature-item">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Activity Log
          </h4>
          <p>Real-time feed of scraping events and status updates</p>
        </div>
      </div>

      <h2>Managing Team Members</h2>

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>Open User Settings</h4>
            <p>Go to <strong>Settings → Users</strong> tab (Admin access required)</p>
          </div>
        </div>
        <div className="step-card">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>Invite New User</h4>
            <p>Click <strong>"Invite User"</strong>, enter their email, and select a role</p>
          </div>
        </div>
        <div className="step-card">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>Send Invitation</h4>
            <p>Click <strong>"Send Invite"</strong> - they'll receive an email with instructions</p>
          </div>
        </div>
      </div>

      <table className="quick-ref">
        <thead>
          <tr>
            <th>Role</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Standard</strong></td>
            <td>View dashboard, run scraper, browse meetings</td>
          </tr>
          <tr>
            <td><strong>Admin</strong></td>
            <td>All standard permissions + manage users and settings</td>
          </tr>
        </tbody>
      </table>

      <h2>Troubleshooting</h2>

      <div className="warning-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p><strong>Scraper won't start?</strong> Check that Back4app is configured in Settings and verify your internet connection.</p>
      </div>

      <table className="quick-ref">
        <thead>
          <tr>
            <th>Problem</th>
            <th>Solution</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>No meetings being saved</td>
            <td>Check activity log for errors; verify Back4app credentials</td>
          </tr>
          <tr>
            <td>Slow performance</td>
            <td>Normal - large feeds take several minutes; delays prevent server overload</td>
          </tr>
          <tr>
            <td>Feed errors</td>
            <td>Source may be temporarily unavailable; try again later</td>
          </tr>
          <tr>
            <td>Can't access admin</td>
            <td>Contact your administrator to verify your account is authorized</td>
          </tr>
        </tbody>
      </table>

      <div className="user-guide-cta">
        <h3>Need More Help?</h3>
        <p>If you're still having trouble:</p>
        <ul>
          <li>Check the <strong>Activity Log</strong> for detailed error messages</li>
          <li>Review <strong>Settings → Configuration</strong> to verify your setup</li>
          <li>Contact your system administrator for access or technical issues</li>
        </ul>
      </div>
    </div>
  );
}

function UserGuideTab() {
  return (
    <div className="docs-page">
      <h1>Finding Meetings</h1>
      <p className="lead">
        Welcome to the 12-Step Meeting Finder. This guide will help you find AA, NA, and other
        recovery meetings in your area.
      </p>

      <h2>How to Search for Meetings</h2>

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>Use the Search Bar</h4>
            <p>Type a city name, state, ZIP code, or meeting name to find meetings near you.</p>
          </div>
        </div>
        <div className="step-card">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>Filter Your Results</h4>
            <p>Narrow down by day of week, meeting type (AA, NA), or format (in-person, online).</p>
          </div>
        </div>
        <div className="step-card">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>View Meeting Details</h4>
            <p>Click any meeting card to see the full address, time, and how to join.</p>
          </div>
        </div>
      </div>

      <div className="tip-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p><strong>Tip:</strong> Search by ZIP code to find the meetings closest to your location.</p>
      </div>

      <h2>Understanding Meeting Types</h2>

      <div className="guide-section">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
          Fellowship Types
        </h3>
        <table className="quick-ref">
          <thead>
            <tr>
              <th>Type</th>
              <th>Who It's For</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>AA</strong> (Alcoholics Anonymous)</td>
              <td>People who want to stop drinking alcohol</td>
            </tr>
            <tr>
              <td><strong>NA</strong> (Narcotics Anonymous)</td>
              <td>People recovering from drug addiction</td>
            </tr>
            <tr>
              <td><strong>Al-Anon</strong></td>
              <td>Friends and family members of alcoholics</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="guide-section">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Meeting Formats
        </h3>
        <div className="feature-grid">
          <div className="feature-item">
            <h4>Open</h4>
            <p>Anyone can attend, including family and friends</p>
          </div>
          <div className="feature-item">
            <h4>Closed</h4>
            <p>Only for those with a desire to stop drinking/using</p>
          </div>
          <div className="feature-item">
            <h4>Speaker</h4>
            <p>Members share their personal recovery stories</p>
          </div>
          <div className="feature-item">
            <h4>Discussion</h4>
            <p>Group discusses a topic or reading together</p>
          </div>
          <div className="feature-item">
            <h4>Big Book</h4>
            <p>Study of the AA Big Book text</p>
          </div>
          <div className="feature-item">
            <h4>Beginners</h4>
            <p>Especially welcoming to newcomers</p>
          </div>
        </div>
      </div>

      <h2>Using the Map</h2>

      <div className="feature-grid">
        <div className="feature-item">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            Zoom In/Out
          </h4>
          <p>Use + and - buttons or scroll to zoom</p>
        </div>
        <div className="feature-item">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Click Markers
          </h4>
          <p>Tap any pin to see meeting details</p>
        </div>
        <div className="feature-item">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="5 9 2 12 5 15"/>
              <polyline points="9 5 12 2 15 5"/>
              <polyline points="15 19 12 22 9 19"/>
              <polyline points="19 9 22 12 19 15"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <line x1="12" y1="2" x2="12" y2="22"/>
            </svg>
            Drag to Move
          </h4>
          <p>Click and drag to explore different areas</p>
        </div>
        <div className="feature-item">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Click Clusters
          </h4>
          <p>Grouped markers expand when clicked</p>
        </div>
      </div>

      <h2>Online & Hybrid Meetings</h2>

      <div className="info-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <p><strong>Online meetings</strong> are held via video call (Zoom, etc.). <strong>Hybrid meetings</strong> let you attend in-person OR join online. Look for the video icon on meeting cards.</p>
      </div>

      <h2>Tips for Newcomers</h2>

      <div className="guide-section">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Making the Most of Meetings
        </h3>
        <div className="feature-grid">
          <div className="feature-item">
            <h4>Try Different Meetings</h4>
            <p>Each meeting has its own personality - find what works for you</p>
          </div>
          <div className="feature-item">
            <h4>Arrive Early</h4>
            <p>A few minutes early gives you time to settle in</p>
          </div>
          <div className="feature-item">
            <h4>Just Listen</h4>
            <p>You don't have to speak - it's okay to just listen</p>
          </div>
          <div className="feature-item">
            <h4>Ask for Help</h4>
            <p>People at meetings are happy to answer questions</p>
          </div>
        </div>
      </div>

      <div className="tip-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p><strong>Look for "Beginners" meetings</strong> - these are especially welcoming to newcomers and often explain how meetings work.</p>
      </div>

      <div className="user-guide-cta">
        <h3>Need Immediate Support?</h3>
        <p>If you're struggling and need help right now, these resources are available 24/7:</p>
        <table className="quick-ref">
          <tbody>
            <tr>
              <td><strong>AA Hotline</strong></td>
              <td>1-800-839-1686</td>
            </tr>
            <tr>
              <td><strong>NA Helpline</strong></td>
              <td>1-818-773-9999</td>
            </tr>
            <tr>
              <td><strong>SAMHSA National Helpline</strong></td>
              <td>1-800-662-4357 (free, 24/7)</td>
            </tr>
          </tbody>
        </table>
        <p><em>You're never alone. Help is always available.</em></p>
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="docs-page">
      <h1>12-Step Meeting Scraper</h1>
      <p className="lead">
        A comprehensive web scraping system that automatically collects AA, NA, Al-Anon,
        and other 12-step support group meetings from across the United States and stores
        them directly in Back4app.
      </p>

      <h2>Features</h2>
      <ul>
        <li><strong>Automated Web Scraping</strong>: Collects thousands of meetings from official AA, NA, and Al-Anon websites</li>
        <li><strong>Real-time Dashboard</strong>: Beautiful React frontend with live progress updates</li>
        <li><strong>Direct Back4app Integration</strong>: Automatically stores meetings in your Back4app database</li>
        <li><strong>Multi-source Support</strong>: Scrapes from regional AA/NA websites across all 50 states</li>
        <li><strong>Deduplication</strong>: Prevents duplicate meetings using unique key matching</li>
        <li><strong>Geocoding</strong>: Automatically generates coordinates for addresses</li>
        <li><strong>Coverage Analysis</strong>: Track meeting density by state population</li>
      </ul>

      <h2>Architecture</h2>

      <h3>Backend (Python/Flask)</h3>
      <ul>
        <li><strong>Flask API</strong> with RESTful endpoints</li>
        <li><strong>Requests</strong> for HTTP requests to feeds</li>
        <li><strong>Back4app REST API</strong> integration</li>
        <li><strong>Nominatim</strong> for geocoding addresses</li>
      </ul>

      <h3>Frontend (React)</h3>
      <ul>
        <li><strong>React 18</strong> with functional components and hooks</li>
        <li><strong>Google Sign-In</strong> for admin authentication</li>
        <li><strong>Responsive Design</strong> with modern CSS</li>
        <li><strong>Dashboard</strong> with live statistics and progress bars</li>
      </ul>

      <h2>Prerequisites</h2>
      <ul>
        <li>Python 3.8+</li>
        <li>Node.js 16+</li>
        <li>Back4app account</li>
        <li>Google Cloud Console project (for auth)</li>
      </ul>

      <h2>Quick Start</h2>

      <h3>Backend Setup</h3>
      <pre><code>{`cd backend
pip install -r requirements.txt
python app.py`}</code></pre>
      <p>The backend will start on <code>http://localhost:5000</code></p>

      <h3>Frontend Setup</h3>
      <pre><code>{`cd frontend
npm install
npm start`}</code></pre>
      <p>The frontend will start on <code>http://localhost:3000</code></p>

      <h2>Configuration</h2>
      <p>When you first open the app:</p>
      <ol>
        <li>Click the <strong>"Configure"</strong> button</li>
        <li>Enter your Back4app credentials:
          <ul>
            <li>Application ID</li>
            <li>REST API Key</li>
          </ul>
        </li>
        <li>Click <strong>"Save Configuration"</strong></li>
      </ol>

      <h2>Usage</h2>
      <ol>
        <li><strong>Configure</strong> your Back4app credentials</li>
        <li>Click <strong>"Start Scraping"</strong></li>
        <li>Watch the real-time progress as meetings are discovered and saved</li>
        <li>View statistics by state and meeting type</li>
        <li>See recently added meetings in the live feed</li>
      </ol>

      <h2>Legal & Ethical Considerations</h2>
      <ul>
        <li>This scraper respects robots.txt</li>
        <li>Implements rate limiting to avoid overloading servers</li>
        <li>Only collects publicly available meeting information</li>
        <li>Intended for legitimate recovery support purposes</li>
      </ul>
    </div>
  );
}

function ApiReferenceTab() {
  return (
    <div className="docs-page">
      <h1>API Reference</h1>
      <p className="lead">
        The backend provides a RESTful API for controlling the scraper and accessing meeting data.
      </p>

      <h2>Endpoints</h2>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method get">GET</span>
          <code>/api/status</code>
        </div>
        <p>Get current scraping status and statistics.</p>
        <h4>Response</h4>
        <pre><code>{`{
  "is_running": false,
  "total_found": 1250,
  "total_saved": 1180,
  "current_source": "San Diego AA",
  "meetings_by_state": {"CA": 500, "TX": 300},
  "errors": [],
  "activity_log": [...]
}`}</code></pre>
      </div>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method post">POST</span>
          <code>/api/start</code>
        </div>
        <p>Start the scraping process.</p>
        <h4>Response</h4>
        <pre><code>{`{
  "success": true,
  "message": "Scraping started"
}`}</code></pre>
      </div>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method post">POST</span>
          <code>/api/stop</code>
        </div>
        <p>Stop the current scraping process.</p>
      </div>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method get">GET</span>
          <code>/api/config</code>
        </div>
        <p>Check if Back4app is configured.</p>
        <h4>Response</h4>
        <pre><code>{`{
  "configured": true,
  "hasAppId": true,
  "hasRestKey": true
}`}</code></pre>
      </div>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method post">POST</span>
          <code>/api/config</code>
        </div>
        <p>Save Back4app configuration.</p>
        <h4>Request Body</h4>
        <pre><code>{`{
  "appId": "your-app-id",
  "restKey": "your-rest-key"
}`}</code></pre>
      </div>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method get">GET</span>
          <code>/api/meetings</code>
        </div>
        <p>Get meetings from Back4app with optional filters.</p>
        <h4>Query Parameters</h4>
        <ul>
          <li><code>state</code> - Filter by state (e.g., "CA")</li>
          <li><code>day</code> - Filter by day of week (0-6)</li>
          <li><code>limit</code> - Number of results (default: 100)</li>
          <li><code>skip</code> - Offset for pagination</li>
        </ul>
      </div>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method get">GET</span>
          <code>/api/coverage</code>
        </div>
        <p>Get US coverage analysis - meetings per capita by state.</p>
        <h4>Response</h4>
        <pre><code>{`{
  "summary": {
    "totalMeetings": 5000,
    "statesWithMeetings": 15,
    "statesWithoutMeetings": 37,
    "averageCoveragePer100k": 2.5
  },
  "coverage": [...],
  "priorityStates": [...],
  "statesWithoutCoverage": [...]
}`}</code></pre>
      </div>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method get">GET</span>
          <code>/api/history</code>
        </div>
        <p>Get scrape history (stored in memory).</p>
      </div>

      <div className="api-endpoint">
        <div className="endpoint-header">
          <span className="method post">POST</span>
          <code>/api/test-save</code>
        </div>
        <p>Test saving a single meeting to Back4app (for debugging).</p>
      </div>
    </div>
  );
}

function DeploymentTab() {
  return (
    <div className="docs-page">
      <h1>Deployment</h1>
      <p className="lead">
        Deploy the meeting scraper to production using Render, Vercel, or other cloud platforms.
      </p>

      <h2>Current Production Setup</h2>
      <ul>
        <li><strong>Backend</strong>: Render (https://meeting-scraper.onrender.com)</li>
        <li><strong>Frontend</strong>: Render Static Site</li>
        <li><strong>Database</strong>: Back4app (Parse Server)</li>
      </ul>

      <h2>Environment Variables</h2>

      <h3>Backend (Render)</h3>
      <table className="env-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>BACK4APP_APP_ID</code></td>
            <td>Your Back4app Application ID</td>
          </tr>
          <tr>
            <td><code>BACK4APP_REST_KEY</code></td>
            <td>Your Back4app REST API Key</td>
          </tr>
          <tr>
            <td><code>PORT</code></td>
            <td>Server port (default: 5000)</td>
          </tr>
          <tr>
            <td><code>FLASK_ENV</code></td>
            <td>Set to "production" for prod</td>
          </tr>
        </tbody>
      </table>

      <h3>Frontend (Render/Vercel)</h3>
      <table className="env-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>REACT_APP_BACKEND_URL</code></td>
            <td>Backend API URL</td>
          </tr>
          <tr>
            <td><code>REACT_APP_GOOGLE_CLIENT_ID</code></td>
            <td>Google OAuth Client ID</td>
          </tr>
          <tr>
            <td><code>REACT_APP_ALLOWED_DOMAIN</code></td>
            <td>Allowed email domain for admin (optional)</td>
          </tr>
        </tbody>
      </table>

      <h2>Render Deployment</h2>

      <h3>Backend Service</h3>
      <ol>
        <li>Create a new Web Service in Render</li>
        <li>Connect your GitHub repository</li>
        <li>Set the root directory to <code>backend</code></li>
        <li>Build command: <code>pip install -r requirements.txt</code></li>
        <li>Start command: <code>gunicorn app:app</code></li>
        <li>Add environment variables</li>
      </ol>

      <h3>Frontend Static Site</h3>
      <ol>
        <li>Create a new Static Site in Render</li>
        <li>Connect your GitHub repository</li>
        <li>Set the root directory to <code>frontend</code></li>
        <li>Build command: <code>npm install && npm run build</code></li>
        <li>Publish directory: <code>build</code></li>
        <li>Add environment variables</li>
      </ol>

      <h2>Back4app Setup</h2>
      <ol>
        <li>Create a new app at <a href="https://www.back4app.com" target="_blank" rel="noopener noreferrer">back4app.com</a></li>
        <li>Go to <strong>App Settings → Security & Keys</strong></li>
        <li>Copy your Application ID and REST API Key</li>
        <li>The Meetings class will be auto-created on first save</li>
      </ol>

      <h2>Google OAuth Setup</h2>
      <ol>
        <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
        <li>Create or select a project</li>
        <li>Enable the Google+ API</li>
        <li>Go to <strong>Credentials → Create Credentials → OAuth Client ID</strong></li>
        <li>Select "Web application"</li>
        <li>Add authorized origins (your frontend URLs)</li>
        <li>Copy the Client ID to your frontend env vars</li>
      </ol>

      <h2>Troubleshooting</h2>

      <h3>Backend won't start</h3>
      <ul>
        <li>Ensure all dependencies are in requirements.txt</li>
        <li>Check Render logs for specific errors</li>
        <li>Verify environment variables are set</li>
      </ul>

      <h3>Frontend can't connect to backend</h3>
      <ul>
        <li>Verify REACT_APP_BACKEND_URL is set correctly</li>
        <li>Check CORS configuration in backend</li>
        <li>Ensure backend is running and accessible</li>
      </ul>

      <h3>Meetings not saving to Back4app</h3>
      <ul>
        <li>Check Back4app credentials</li>
        <li>Look at Render logs for API errors</li>
        <li>Verify the Meetings class exists in Back4app</li>
      </ul>
    </div>
  );
}

function IOSGuideTab() {
  return (
    <div className="docs-page">
      <h1>iOS Integration Guide</h1>
      <p className="lead">
        Integrate the meeting data into your iOS app using the Parse Swift SDK to fetch
        meetings directly from Back4app.
      </p>

      <div className="prereq-box">
        <h3>Prerequisites</h3>
        <p>
          Before proceeding, complete the Parse iOS SDK setup from the official documentation:
        </p>
        <a
          href="https://docs.parseplatform.org/ios/guide/"
          target="_blank"
          rel="noopener noreferrer"
          className="prereq-link"
        >
          Parse iOS SDK Setup Guide
        </a>
      </div>

      <h2>Installation</h2>
      <p>For new projects, we recommend using <strong>ParseSwift</strong> with Swift Package Manager.</p>

      <h3>Swift Package Manager (Recommended)</h3>
      <ol>
        <li>In Xcode, go to <strong>File → Add Package Dependencies</strong></li>
        <li>Enter the repository URL:
          <pre><code>https://github.com/parse-community/Parse-Swift.git</code></pre>
        </li>
        <li>Select the version and click <strong>Add Package</strong></li>
      </ol>

      <h3>CocoaPods (Alternative)</h3>
      <p>Add to your Podfile:</p>
      <pre><code>{`pod 'ParseSwift'`}</code></pre>
      <p>Then run:</p>
      <pre><code>pod install</code></pre>

      <h2>Initialize Parse</h2>
      <p>In your <code>AppDelegate.swift</code> or app entry point:</p>
      <pre><code>{`import ParseSwift

@main
struct MeetingFinderApp: App {
    init() {
        ParseSwift.initialize(
            applicationId: "YOUR_BACK4APP_APP_ID",
            clientKey: "YOUR_BACK4APP_CLIENT_KEY",
            serverURL: URL(string: "https://parseapi.back4app.com")!
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}`}</code></pre>

      <h2>Define the Meeting Model</h2>
      <p>Create a Swift struct that conforms to <code>ParseObject</code>:</p>
      <pre><code>{`import ParseSwift

struct Meeting: ParseObject {
    // Required by ParseObject
    var objectId: String?
    var createdAt: Date?
    var updatedAt: Date?
    var ACL: ParseACL?
    var originalData: Data?

    // Meeting fields
    var name: String?
    var meetingType: String?
    var day: Int?
    var time: String?
    var endTime: String?
    var timezone: String?
    var address: String?
    var city: String?
    var state: String?
    var postalCode: String?
    var latitude: Double?
    var longitude: Double?
    var isOnline: Bool?
    var isHybrid: Bool?
    var onlineUrl: String?
    var locationName: String?
    var types: [String]?
    var notes: String?
}`}</code></pre>
      <button
        className="btn btn-secondary btn-sm download-model-btn"
        onClick={() => downloadFile(swiftModelContent, 'Meeting.swift')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        Download Meeting.swift
      </button>

      <h2>Query Meetings</h2>
      <h3>Fetch All Meetings</h3>
      <pre><code>{`func fetchMeetings() async throws -> [Meeting] {
    let query = Meeting.query()
        .limit(100)
        .order([.ascending("day"), .ascending("time")])

    return try await query.find()
}`}</code></pre>

      <h3>Filter by State</h3>
      <pre><code>{`func fetchMeetingsByState(_ state: String) async throws -> [Meeting] {
    let query = Meeting.query("state" == state)
        .limit(100)

    return try await query.find()
}`}</code></pre>

      <h3>Filter by Day of Week</h3>
      <pre><code>{`func fetchMeetingsByDay(_ day: Int) async throws -> [Meeting] {
    // day: 0 = Sunday, 1 = Monday, etc.
    let query = Meeting.query("day" == day)
        .order([.ascending("time")])

    return try await query.find()
}`}</code></pre>

      <h3>Find Nearby Meetings</h3>
      <pre><code>{`import CoreLocation

func fetchNearbyMeetings(
    location: CLLocationCoordinate2D,
    radiusMiles: Double = 25
) async throws -> [Meeting] {
    let geoPoint = try ParseGeoPoint(
        latitude: location.latitude,
        longitude: location.longitude
    )

    let query = Meeting.query("location" <= geoPoint.within(miles: radiusMiles))
        .limit(50)

    return try await query.find()
}`}</code></pre>

      <h3>Filter by Meeting Type (AA, NA, etc.)</h3>
      <pre><code>{`func fetchAAMeetings() async throws -> [Meeting] {
    let query = Meeting.query("meetingType" == "AA")
        .order([.ascending("day"), .ascending("time")])
        .limit(100)
    return try await query.find()
}`}</code></pre>

      <h3>Filter Online or Hybrid Meetings</h3>
      <pre><code>{`func fetchOnlineMeetings() async throws -> [Meeting] {
    let query = Meeting.query("isOnline" == true)
        .limit(100)
    return try await query.find()
}

func fetchHybridMeetings() async throws -> [Meeting] {
    let query = Meeting.query("isHybrid" == true)
        .limit(100)
    return try await query.find()
}`}</code></pre>

      <h3>Filter by City and State</h3>
      <pre><code>{`func fetchMeetingsInCity(_ city: String, state: String) async throws -> [Meeting] {
    let query = Meeting.query("city" == city, "state" == state)
        .order([.ascending("day"), .ascending("time")])
        .limit(100)
    return try await query.find()
}`}</code></pre>

      <h3>Filter by Type Codes (Women, Beginners, etc.)</h3>
      <pre><code>{`func fetchWomensMeetings() async throws -> [Meeting] {
    // Types is an array field containing codes like "W", "B", "D"
    let query = Meeting.query("types" == "W")
        .limit(100)
    return try await query.find()
}

func fetchBeginnerMeetings() async throws -> [Meeting] {
    let query = Meeting.query("types" == "B")
        .limit(100)
    return try await query.find()
}`}</code></pre>

      <h3>Search by Name</h3>
      <pre><code>{`func searchMeetings(term: String) async throws -> [Meeting] {
    let query = Meeting.query("name" =~ term)  // regex match
        .limit(50)
    return try await query.find()
}`}</code></pre>

      <h3>Pagination</h3>
      <pre><code>{`func fetchMeetingsPage(page: Int, pageSize: Int = 20) async throws -> [Meeting] {
    let skip = page * pageSize
    let query = Meeting.query()
        .order([.ascending("name")])
        .skip(skip)
        .limit(pageSize)
    return try await query.find()
}`}</code></pre>

      <h3>Compound Queries (OR conditions)</h3>
      <pre><code>{`func fetchAAorNAMeetings() async throws -> [Meeting] {
    let aaQuery = Meeting.query("meetingType" == "AA")
    let naQuery = Meeting.query("meetingType" == "NA")

    let compoundQuery = try aaQuery.or(naQuery)
        .limit(100)

    return try await compoundQuery.find()
}`}</code></pre>

      <h2>SwiftUI Example</h2>
      <pre><code>{`import SwiftUI
import ParseSwift

struct MeetingsListView: View {
    @State private var meetings: [Meeting] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationView {
            Group {
                if isLoading {
                    ProgressView("Loading meetings...")
                } else if let error = errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                } else {
                    List(meetings, id: \\.objectId) { meeting in
                        MeetingRow(meeting: meeting)
                    }
                }
            }
            .navigationTitle("Meetings")
        }
        .task {
            await loadMeetings()
        }
    }

    func loadMeetings() async {
        do {
            meetings = try await Meeting.query()
                .limit(100)
                .find()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}

struct MeetingRow: View {
    let meeting: Meeting

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(meeting.name ?? "Unknown Meeting")
                .font(.headline)
            HStack {
                Text(meeting.meetingType ?? "")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(4)
                Text(meeting.city ?? "")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}`}</code></pre>

      <h2>Error Handling</h2>
      <pre><code>{`func fetchMeetingsWithErrorHandling() async {
    do {
        let meetings = try await Meeting.query().find()
        // Handle success
    } catch let error as ParseError {
        switch error.code {
        case .connectionFailed:
            print("No internet connection")
        case .invalidSessionToken:
            print("Session expired")
        default:
            print("Parse error: \\(error.message)")
        }
    } catch {
        print("Unexpected error: \\(error)")
    }
}`}</code></pre>

      <h2>Offline Caching</h2>
      <p>Enable local datastore for offline access:</p>
      <pre><code>{`ParseSwift.initialize(
    applicationId: "YOUR_APP_ID",
    clientKey: "YOUR_CLIENT_KEY",
    serverURL: URL(string: "https://parseapi.back4app.com")!,
    cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
    requestCachePolicy: .useProtocolCachePolicy
)`}</code></pre>
    </div>
  );
}

function AndroidGuideTab() {
  return (
    <div className="docs-page">
      <h1>Android Integration Guide</h1>
      <p className="lead">
        Integrate the meeting data into your Android app using the Parse Android SDK
        to fetch meetings directly from Back4app.
      </p>

      <div className="prereq-box">
        <h3>Prerequisites</h3>
        <p>
          Before proceeding, complete the Parse Android SDK setup from the official documentation:
        </p>
        <a
          href="https://docs.parseplatform.org/android/guide/"
          target="_blank"
          rel="noopener noreferrer"
          className="prereq-link"
        >
          Parse Android SDK Setup Guide
        </a>
      </div>

      <h2>Installation</h2>

      <h3>Step 1: Add JitPack Repository</h3>
      <p>In your <code>settings.gradle</code> (or root <code>build.gradle</code> for older projects):</p>
      <pre><code>{`dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://jitpack.io' }
    }
}`}</code></pre>

      <h3>Step 2: Add Dependencies</h3>
      <p>In your app-level <code>build.gradle</code>:</p>
      <pre><code>{`dependencies {
    implementation 'com.github.parse-community.Parse-SDK-Android:parse:1.26.0'

    // For logging API calls (optional, useful for debugging)
    implementation 'com.squareup.okhttp3:logging-interceptor:4.9.3'
}`}</code></pre>

      <h3>Step 3: Sync Project</h3>
      <p>Click <strong>Sync Now</strong> or go to <strong>File → Sync Project with Gradle Files</strong></p>

      <h2>Initialize Parse</h2>
      <p>Create an Application class:</p>
      <pre><code>{`// App.kt
import android.app.Application
import com.parse.Parse

class App : Application() {
    override fun onCreate() {
        super.onCreate()

        Parse.initialize(
            Parse.Configuration.Builder(this)
                .applicationId("YOUR_BACK4APP_APP_ID")
                .clientKey("YOUR_BACK4APP_CLIENT_KEY")
                .server("https://parseapi.back4app.com/")
                .build()
        )
    }
}`}</code></pre>
      <p>Register it in <code>AndroidManifest.xml</code>:</p>
      <pre><code>{`<application
    android:name=".App"
    ...>`}</code></pre>

      <h2>Define the Meeting Model</h2>
      <p>Create a data class for meetings:</p>
      <pre><code>{`// Meeting.kt
import com.parse.ParseClassName
import com.parse.ParseObject

@ParseClassName("Meetings")
class Meeting : ParseObject() {
    var name: String?
        get() = getString("name")
        set(value) = put("name", value ?: "")

    var meetingType: String?
        get() = getString("meetingType")
        set(value) = put("meetingType", value ?: "")

    var day: Int
        get() = getInt("day")
        set(value) = put("day", value)

    var time: String?
        get() = getString("time")
        set(value) = put("time", value ?: "")

    var city: String?
        get() = getString("city")
        set(value) = put("city", value ?: "")

    var state: String?
        get() = getString("state")
        set(value) = put("state", value ?: "")

    var address: String?
        get() = getString("address")
        set(value) = put("address", value ?: "")

    var latitude: Double
        get() = getDouble("latitude")
        set(value) = put("latitude", value)

    var longitude: Double
        get() = getDouble("longitude")
        set(value) = put("longitude", value)

    var isOnline: Boolean
        get() = getBoolean("isOnline")
        set(value) = put("isOnline", value)

    var onlineUrl: String?
        get() = getString("onlineUrl")
        set(value) = put("onlineUrl", value ?: "")

    var locationName: String?
        get() = getString("locationName")
        set(value) = put("locationName", value ?: "")
}`}</code></pre>
      <button
        className="btn btn-secondary btn-sm download-model-btn"
        onClick={() => downloadFile(kotlinModelContent, 'Meeting.kt')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        Download Meeting.kt
      </button>
      <p>Register the subclass before initializing Parse:</p>
      <pre><code>{`// In App.kt onCreate(), before Parse.initialize()
ParseObject.registerSubclass(Meeting::class.java)`}</code></pre>

      <h2>Query Meetings</h2>

      <h3>Fetch All Meetings (Kotlin Coroutines)</h3>
      <pre><code>{`import com.parse.ParseQuery
import com.parse.coroutines.suspendFind

suspend fun fetchMeetings(): List<Meeting> {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .setLimit(100)
        .orderByAscending("day")
        .addAscendingOrder("time")

    return query.suspendFind()
}`}</code></pre>

      <h3>Filter by State</h3>
      <pre><code>{`suspend fun fetchMeetingsByState(state: String): List<Meeting> {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("state", state)
        .setLimit(100)

    return query.suspendFind()
}`}</code></pre>

      <h3>Filter by Day of Week</h3>
      <pre><code>{`suspend fun fetchMeetingsByDay(day: Int): List<Meeting> {
    // day: 0 = Sunday, 1 = Monday, etc.
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("day", day)
        .orderByAscending("time")

    return query.suspendFind()
}`}</code></pre>

      <h3>Find Nearby Meetings</h3>
      <pre><code>{`import com.parse.ParseGeoPoint

suspend fun fetchNearbyMeetings(
    latitude: Double,
    longitude: Double,
    radiusMiles: Double = 25.0
): List<Meeting> {
    val userLocation = ParseGeoPoint(latitude, longitude)

    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereWithinMiles("location", userLocation, radiusMiles)
        .setLimit(50)

    return query.suspendFind()
}`}</code></pre>

      <h3>Filter by Meeting Type (AA, NA, etc.)</h3>
      <pre><code>{`suspend fun fetchAAMeetings(): List<Meeting> {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("meetingType", "AA")
        .orderByAscending("day")
        .addAscendingOrder("time")
        .setLimit(100)
    return query.suspendFind()
}`}</code></pre>

      <h3>Filter Online or Hybrid Meetings</h3>
      <pre><code>{`suspend fun fetchOnlineMeetings(): List<Meeting> {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("isOnline", true)
        .setLimit(100)
    return query.suspendFind()
}

suspend fun fetchHybridMeetings(): List<Meeting> {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("isHybrid", true)
        .setLimit(100)
    return query.suspendFind()
}`}</code></pre>

      <h3>Filter by City and State</h3>
      <pre><code>{`suspend fun fetchMeetingsInCity(city: String, state: String): List<Meeting> {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("city", city)
        .whereEqualTo("state", state)
        .orderByAscending("day")
        .addAscendingOrder("time")
        .setLimit(100)
    return query.suspendFind()
}`}</code></pre>

      <h3>Filter by Type Codes (Women, Beginners, etc.)</h3>
      <pre><code>{`suspend fun fetchWomensMeetings(): List<Meeting> {
    // Types is an array field containing codes like "W", "B", "D"
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("types", "W")
        .setLimit(100)
    return query.suspendFind()
}

suspend fun fetchBeginnerMeetings(): List<Meeting> {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("types", "B")
        .setLimit(100)
    return query.suspendFind()
}`}</code></pre>

      <h3>Search by Name</h3>
      <pre><code>{`suspend fun searchMeetings(term: String): List<Meeting> {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .whereMatches("name", term, "i")  // case-insensitive regex
        .setLimit(50)
    return query.suspendFind()
}`}</code></pre>

      <h3>Pagination</h3>
      <pre><code>{`suspend fun fetchMeetingsPage(page: Int, pageSize: Int = 20): List<Meeting> {
    val skip = page * pageSize
    val query = ParseQuery.getQuery(Meeting::class.java)
        .orderByAscending("name")
        .setSkip(skip)
        .setLimit(pageSize)
    return query.suspendFind()
}`}</code></pre>

      <h3>Compound Queries (OR conditions)</h3>
      <pre><code>{`suspend fun fetchAAorNAMeetings(): List<Meeting> {
    val aaQuery = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("meetingType", "AA")

    val naQuery = ParseQuery.getQuery(Meeting::class.java)
        .whereEqualTo("meetingType", "NA")

    val compoundQuery = ParseQuery.or(listOf(aaQuery, naQuery))
        .setLimit(100)

    return compoundQuery.suspendFind()
}`}</code></pre>

      <h2>Jetpack Compose Example</h2>
      <pre><code>{`import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class MeetingsViewModel : ViewModel() {
    var meetings by mutableStateOf<List<Meeting>>(emptyList())
        private set
    var isLoading by mutableStateOf(true)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    init {
        loadMeetings()
    }

    fun loadMeetings() {
        viewModelScope.launch {
            isLoading = true
            try {
                val query = ParseQuery.getQuery(Meeting::class.java)
                    .setLimit(100)
                    .orderByAscending("day")
                meetings = query.suspendFind()
                error = null
            } catch (e: Exception) {
                error = e.message
            } finally {
                isLoading = false
            }
        }
    }
}

@Composable
fun MeetingsScreen(viewModel: MeetingsViewModel = viewModel()) {
    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Meetings") })

        when {
            viewModel.isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            viewModel.error != null -> {
                Text(
                    text = viewModel.error ?: "Unknown error",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(16.dp)
                )
            }
            else -> {
                LazyColumn {
                    items(viewModel.meetings) { meeting ->
                        MeetingItem(meeting)
                    }
                }
            }
        }
    }
}

@Composable
fun MeetingItem(meeting: Meeting) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = meeting.name ?: "Unknown Meeting",
                style = MaterialTheme.typography.titleMedium
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                meeting.meetingType?.let {
                    AssistChip(
                        onClick = { },
                        label = { Text(it) }
                    )
                }
                Text(
                    text = meeting.city ?: "",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}`}</code></pre>

      <h2>Callback-based Alternative</h2>
      <p>If not using coroutines:</p>
      <pre><code>{`fun fetchMeetingsWithCallback() {
    val query = ParseQuery.getQuery(Meeting::class.java)
        .setLimit(100)

    query.findInBackground { meetings, e ->
        if (e == null) {
            // Success - update UI with meetings
            updateMeetingsList(meetings)
        } else {
            // Error handling
            Log.e("Meetings", "Error: " + e.message)
        }
    }
}`}</code></pre>

      <h2>Offline Caching</h2>
      <p>Enable local datastore for offline access:</p>
      <pre><code>{`// In App.kt
Parse.initialize(
    Parse.Configuration.Builder(this)
        .applicationId("YOUR_APP_ID")
        .clientKey("YOUR_CLIENT_KEY")
        .server("https://parseapi.back4app.com/")
        .enableLocalDataStore() // Enable offline caching
        .build()
)

// Pin results locally
suspend fun fetchAndCacheMeetings() {
    val query = ParseQuery.getQuery(Meeting::class.java)
    val meetings = query.suspendFind()
    Meeting.pinAllInBackground("allMeetings", meetings)
}

// Query from local cache first
fun fetchFromCache(): ParseQuery<Meeting> {
    return ParseQuery.getQuery(Meeting::class.java)
        .fromLocalDatastore()
}`}</code></pre>

      <h2>ProGuard Rules</h2>
      <p>If using ProGuard/R8, add these rules:</p>
      <pre><code>{`# Parse SDK
-keep class com.parse.** { *; }
-dontwarn com.parse.**

# Your Meeting model
-keep class com.yourpackage.Meeting { *; }`}</code></pre>
    </div>
  );
}

export default DevDocs;
