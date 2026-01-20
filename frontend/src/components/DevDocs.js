import React, { useState } from 'react';
import MeetingSchema from './MeetingSchema';

function DevDocs({ onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <>
      <div className="dev-docs-backdrop" onClick={onClose} />
      <div className="dev-docs-overlay">
        <div className="dev-docs-container">
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
            <button onClick={onClose} className="dev-docs-close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>

          <div className="dev-docs-layout">
            <nav className="dev-docs-sidebar">
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
              {activeTab === 'overview' && <OverviewTab />}
              {activeTab === 'schema' && <MeetingSchema />}
              {activeTab === 'api' && <ApiReferenceTab />}
              {activeTab === 'deployment' && <DeploymentTab />}
              {activeTab === 'ios' && <IOSGuideTab />}
              {activeTab === 'android' && <AndroidGuideTab />}
            </main>
          </div>
        </div>
      </div>
    </>
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
        <li>The Meeting schema will be auto-created on first save</li>
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
        <li>Verify the Meeting class exists in Back4app</li>
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

@ParseClassName("Meeting")
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
