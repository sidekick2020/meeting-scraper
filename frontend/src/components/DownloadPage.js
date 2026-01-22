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
        release.assets && release.assets.some(asset => asset.name && asset.name.endsWith('.dmg'))
      );

      setReleases(releasesWithMac);
      if (releasesWithMac.length > 0) {
        setSelectedVersion(releasesWithMac[0].tag_name);
      }
    } catch (err) {
      console.error('Error fetching releases:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    },
    container: {
      maxWidth: '700px',
      margin: '0 auto'
    },
    header: {
      textAlign: 'center',
      marginBottom: '40px'
    },
    title: {
      color: '#fff',
      fontSize: '2.5rem',
      marginBottom: '10px',
      fontWeight: '700'
    },
    subtitle: {
      color: '#94a3b8',
      fontSize: '1.1rem',
      margin: 0
    },
    card: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '40px',
      textAlign: 'center',
      color: '#fff',
      marginBottom: '24px'
    },
    emptyIcon: {
      fontSize: '5rem',
      marginBottom: '24px',
      display: 'block'
    },
    emptyTitle: {
      fontSize: '1.5rem',
      marginBottom: '12px',
      fontWeight: '600'
    },
    emptyText: {
      color: '#94a3b8',
      marginBottom: '24px',
      lineHeight: '1.6'
    },
    primaryBtn: {
      display: 'inline-block',
      background: '#3b82f6',
      color: '#fff',
      padding: '14px 28px',
      borderRadius: '8px',
      textDecoration: 'none',
      fontWeight: '600',
      fontSize: '1rem',
      transition: 'all 0.2s',
      border: 'none',
      cursor: 'pointer'
    },
    spinner: {
      width: '48px',
      height: '48px',
      border: '4px solid rgba(255, 255, 255, 0.1)',
      borderTopColor: '#3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto 24px'
    },
    errorCard: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '16px',
      padding: '40px',
      textAlign: 'center',
      color: '#fff',
      marginBottom: '24px'
    },
    link: {
      color: '#60a5fa',
      textDecoration: 'none'
    },
    footer: {
      display: 'flex',
      justifyContent: 'space-between',
      paddingTop: '24px',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    },
    footerLink: {
      color: '#60a5fa',
      textDecoration: 'none',
      fontSize: '0.95rem'
    },
    versionSelect: {
      width: '100%',
      padding: '14px 18px',
      fontSize: '1rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.05)',
      color: '#fff',
      cursor: 'pointer',
      marginBottom: '24px'
    },
    downloadBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      background: '#3b82f6',
      color: '#fff',
      padding: '18px 24px',
      borderRadius: '10px',
      textDecoration: 'none',
      marginBottom: '12px',
      transition: 'background 0.2s'
    },
    downloadIcon: {
      fontSize: '1.8rem'
    },
    downloadText: {
      textAlign: 'left'
    },
    downloadFilename: {
      fontWeight: '600',
      fontSize: '1rem',
      display: 'block'
    },
    downloadSize: {
      fontSize: '0.85rem',
      opacity: '0.8'
    },
    badge: {
      background: '#22c55e',
      color: '#fff',
      padding: '6px 14px',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: '600'
    },
    sectionCard: {
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '20px',
      color: '#fff',
      textAlign: 'left'
    },
    sectionTitle: {
      fontSize: '1.1rem',
      marginBottom: '16px',
      fontWeight: '600'
    },
    list: {
      color: '#94a3b8',
      paddingLeft: '20px',
      margin: 0,
      lineHeight: '1.8'
    }
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Download Meeting Scraper</h1>
          <p style={styles.subtitle}>Native Mac app for browsing public meeting data</p>
        </div>

        {loading && (
          <div style={styles.card}>
            <div style={styles.spinner}></div>
            <p>Loading available versions...</p>
          </div>
        )}

        {error && (
          <div style={styles.errorCard}>
            <div style={styles.emptyIcon}>⚠️</div>
            <h2 style={styles.emptyTitle}>Unable to Load Releases</h2>
            <p style={styles.emptyText}>{error}</p>
            <p style={styles.emptyText}>
              Please check back later or visit our{' '}
              <a href="https://github.com/sidekick2020/meeting-scraper/releases" target="_blank" rel="noopener noreferrer" style={styles.link}>
                GitHub releases page
              </a>.
            </p>
          </div>
        )}

        {!loading && !error && releases.length === 0 && (
          <div style={styles.card}>
            <span style={styles.emptyIcon}>🖥️</span>
            <h2 style={styles.emptyTitle}>Mac App Coming Soon!</h2>
            <p style={styles.emptyText}>
              We're working on bringing Meeting Scraper to your desktop.<br />
              In the meantime, enjoy the full experience on the web.
            </p>
            <a href="/" style={styles.primaryBtn}>
              Open Web App
            </a>
          </div>
        )}

        {!loading && !error && releases.length > 0 && (
          <>
            <div style={{ marginBottom: '8px', color: '#94a3b8', fontSize: '0.9rem' }}>
              Select Version:
            </div>
            <select
              value={selectedVersion || ''}
              onChange={(e) => setSelectedVersion(e.target.value)}
              style={styles.versionSelect}
            >
              {releases.map(release => (
                <option key={release.tag_name} value={release.tag_name}>
                  {release.tag_name} {release.tag_name === releases[0].tag_name ? '(Latest)' : ''}
                </option>
              ))}
            </select>

            {selectedRelease && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem' }}>{selectedRelease.tag_name}</h2>
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                      Released {formatDate(selectedRelease.published_at)}
                    </span>
                  </div>
                  {selectedRelease.tag_name === releases[0].tag_name && (
                    <span style={styles.badge}>Latest</span>
                  )}
                </div>

                {selectedRelease.assets
                  .filter(asset => asset.name.endsWith('.dmg'))
                  .map(asset => (
                    <a
                      key={asset.id}
                      href={asset.browser_download_url}
                      style={styles.downloadBtn}
                    >
                      <span style={styles.downloadIcon}>⬇️</span>
                      <div style={styles.downloadText}>
                        <span style={styles.downloadFilename}>{asset.name}</span>
                        <span style={styles.downloadSize}>{formatSize(asset.size)}</span>
                      </div>
                    </a>
                  ))}
              </div>
            )}

            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>Installation Instructions</h3>
              <ol style={styles.list}>
                <li>Download the DMG file above</li>
                <li>Open the downloaded .dmg file</li>
                <li>Drag Meeting Scraper to your Applications folder</li>
                <li><strong>Important:</strong> Right-click the app and select "Open" (don't double-click)</li>
                <li>Click "Open" in the security dialog that appears</li>
              </ol>
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                <strong style={{ color: '#f59e0b' }}>Note:</strong>
                <span style={{ color: '#94a3b8' }}> Since this app isn't from the App Store, macOS requires you to right-click and select "Open" the first time. After that, it opens normally.</span>
              </div>
            </div>

            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>System Requirements</h3>
              <ul style={styles.list}>
                <li>macOS 10.13 (High Sierra) or later</li>
                <li>Apple Silicon (M1/M2/M3) or Intel processor</li>
                <li>Internet connection required</li>
              </ul>
            </div>
          </>
        )}

        <div style={styles.footer}>
          <a href="/" style={styles.footerLink}>← Back to Web App</a>
          <a
            href="https://github.com/sidekick2020/meeting-scraper/releases"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
