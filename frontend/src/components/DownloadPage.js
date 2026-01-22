import React, { useState, useEffect } from 'react';

const DownloadPage = () => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    try {
      const response = await fetch(
        'https://api.github.com/repos/sidekick2020/meeting-scraper/releases'
      );
      if (!response.ok) throw new Error('Failed to fetch releases');
      const data = await response.json();

      // Filter releases that have Mac DMG assets
      const releasesWithMac = data.filter(release =>
        release.assets.some(asset => asset.name.endsWith('.dmg'))
      );

      setReleases(releasesWithMac);
      if (releasesWithMac.length > 0) {
        setSelectedVersion(releasesWithMac[0].tag_name);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDownloadUrl = (release, arch = 'universal') => {
    const asset = release.assets.find(a => {
      if (arch === 'arm64') return a.name.includes('arm64') && a.name.endsWith('.dmg');
      if (arch === 'x64') return a.name.includes('x64') && a.name.endsWith('.dmg');
      // Universal or first DMG found
      return a.name.endsWith('.dmg');
    });
    return asset?.browser_download_url;
  };

  const selectedRelease = releases.find(r => r.tag_name === selectedVersion);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatSize = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="download-page">
      <div className="download-container">
        <div className="download-header">
          <h1>Download Meeting Scraper</h1>
          <p className="download-subtitle">
            Native Mac app for browsing public meeting data
          </p>
        </div>

        {loading && (
          <div className="download-loading">
            <div className="spinner"></div>
            <p>Loading available versions...</p>
          </div>
        )}

        {error && (
          <div className="download-error">
            <p>Unable to load releases: {error}</p>
            <p>Please check back later or visit our <a href="https://github.com/sidekick2020/meeting-scraper/releases" target="_blank" rel="noopener noreferrer">GitHub releases page</a>.</p>
          </div>
        )}

        {!loading && !error && releases.length === 0 && (
          <div className="download-empty">
            <div className="empty-icon">📦</div>
            <h2>No Downloads Available Yet</h2>
            <p>The Mac app is coming soon! In the meantime, you can use the web version.</p>
            <a href="/" className="btn btn-primary">Use Web Version</a>
          </div>
        )}

        {!loading && !error && releases.length > 0 && (
          <>
            <div className="version-selector">
              <label htmlFor="version-select">Select Version:</label>
              <select
                id="version-select"
                value={selectedVersion || ''}
                onChange={(e) => setSelectedVersion(e.target.value)}
              >
                {releases.map(release => (
                  <option key={release.tag_name} value={release.tag_name}>
                    {release.tag_name} {release.tag_name === releases[0].tag_name ? '(Latest)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedRelease && (
              <div className="download-card">
                <div className="download-card-header">
                  <div className="version-info">
                    <h2>{selectedRelease.tag_name}</h2>
                    <span className="release-date">
                      Released {formatDate(selectedRelease.published_at)}
                    </span>
                  </div>
                  {selectedRelease.tag_name === releases[0].tag_name && (
                    <span className="badge badge-latest">Latest</span>
                  )}
                </div>

                <div className="download-buttons">
                  {selectedRelease.assets
                    .filter(asset => asset.name.endsWith('.dmg'))
                    .map(asset => (
                      <a
                        key={asset.id}
                        href={asset.browser_download_url}
                        className="download-btn"
                      >
                        <span className="download-icon">⬇</span>
                        <div className="download-btn-text">
                          <span className="download-filename">{asset.name}</span>
                          <span className="download-size">{formatSize(asset.size)}</span>
                        </div>
                      </a>
                    ))}
                </div>

                {selectedRelease.body && (
                  <div className="release-notes">
                    <h3>Release Notes</h3>
                    <div className="release-notes-content">
                      {selectedRelease.body.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="install-instructions">
              <h3>Installation Instructions</h3>
              <ol>
                <li>Download the DMG file above</li>
                <li>Open the downloaded <code>.dmg</code> file</li>
                <li>Drag <strong>Meeting Scraper</strong> to your <strong>Applications</strong> folder</li>
                <li>Open Meeting Scraper from Applications</li>
                <li>If prompted about an unidentified developer, go to <strong>System Preferences → Security & Privacy</strong> and click "Open Anyway"</li>
              </ol>
            </div>

            <div className="system-requirements">
              <h3>System Requirements</h3>
              <ul>
                <li>macOS 10.13 (High Sierra) or later</li>
                <li>Apple Silicon (M1/M2/M3) or Intel processor</li>
                <li>Internet connection required</li>
              </ul>
            </div>
          </>
        )}

        <div className="download-footer">
          <a href="/" className="link-back">← Back to Web App</a>
          <a
            href="https://github.com/sidekick2020/meeting-scraper/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="link-github"
          >
            View on GitHub
          </a>
        </div>
      </div>

      <style>{`
        .download-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 40px 20px;
        }

        .download-container {
          max-width: 700px;
          margin: 0 auto;
        }

        .download-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .download-header h1 {
          color: #fff;
          font-size: 2.5rem;
          margin-bottom: 10px;
        }

        .download-subtitle {
          color: #94a3b8;
          font-size: 1.1rem;
        }

        .download-loading,
        .download-error,
        .download-empty {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 40px;
          text-align: center;
          color: #fff;
        }

        .download-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .download-error a {
          color: #60a5fa;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 20px;
        }

        .download-empty h2 {
          margin-bottom: 10px;
        }

        .download-empty p {
          color: #94a3b8;
          margin-bottom: 20px;
        }

        .btn-primary {
          display: inline-block;
          background: #3b82f6;
          color: #fff;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: background 0.2s;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .version-selector {
          margin-bottom: 20px;
        }

        .version-selector label {
          display: block;
          color: #94a3b8;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }

        .version-selector select {
          width: 100%;
          padding: 12px 16px;
          font-size: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          cursor: pointer;
        }

        .version-selector select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .download-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 30px;
        }

        .download-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .version-info h2 {
          color: #fff;
          margin: 0 0 4px 0;
          font-size: 1.5rem;
        }

        .release-date {
          color: #64748b;
          font-size: 0.9rem;
        }

        .badge-latest {
          background: #22c55e;
          color: #fff;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .download-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .download-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #3b82f6;
          color: #fff;
          padding: 16px 20px;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.2s;
        }

        .download-btn:hover {
          background: #2563eb;
        }

        .download-icon {
          font-size: 1.5rem;
        }

        .download-btn-text {
          display: flex;
          flex-direction: column;
        }

        .download-filename {
          font-weight: 500;
        }

        .download-size {
          font-size: 0.85rem;
          opacity: 0.8;
        }

        .release-notes {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 20px;
        }

        .release-notes h3 {
          color: #fff;
          font-size: 1rem;
          margin-bottom: 12px;
        }

        .release-notes-content {
          color: #94a3b8;
          font-size: 0.9rem;
        }

        .release-notes-content p {
          margin: 4px 0;
        }

        .install-instructions,
        .system-requirements {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .install-instructions h3,
        .system-requirements h3 {
          color: #fff;
          font-size: 1.1rem;
          margin-bottom: 16px;
        }

        .install-instructions ol,
        .system-requirements ul {
          color: #94a3b8;
          padding-left: 20px;
          margin: 0;
        }

        .install-instructions li,
        .system-requirements li {
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .install-instructions code {
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }

        .download-footer {
          display: flex;
          justify-content: space-between;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .link-back,
        .link-github {
          color: #60a5fa;
          text-decoration: none;
          font-size: 0.9rem;
        }

        .link-back:hover,
        .link-github:hover {
          text-decoration: underline;
        }

        @media (max-width: 600px) {
          .download-header h1 {
            font-size: 1.8rem;
          }

          .download-card-header {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default DownloadPage;
