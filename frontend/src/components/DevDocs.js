import React, { useState } from 'react';
import MeetingSchema from './MeetingSchema';

function DevDocs({ onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
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
            <h1>Developer Documentation</h1>
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
          </nav>

          <main className="dev-docs-content">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'schema' && <MeetingSchema />}
            {activeTab === 'api' && <ApiReferenceTab />}
            {activeTab === 'deployment' && <DeploymentTab />}
          </main>
        </div>
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

export default DevDocs;
