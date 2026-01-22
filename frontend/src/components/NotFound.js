import React from 'react';

const NotFound = () => {
  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    },
    container: {
      textAlign: 'center',
      maxWidth: '500px'
    },
    icon: {
      fontSize: '6rem',
      marginBottom: '24px',
      display: 'block'
    },
    title: {
      color: '#fff',
      fontSize: '2.5rem',
      marginBottom: '16px',
      fontWeight: '700'
    },
    subtitle: {
      color: '#94a3b8',
      fontSize: '1.2rem',
      marginBottom: '32px',
      lineHeight: '1.6'
    },
    btnContainer: {
      display: 'flex',
      gap: '16px',
      justifyContent: 'center',
      flexWrap: 'wrap'
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
      transition: 'background 0.2s'
    },
    secondaryBtn: {
      display: 'inline-block',
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#fff',
      padding: '14px 28px',
      borderRadius: '8px',
      textDecoration: 'none',
      fontWeight: '600',
      fontSize: '1rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      transition: 'background 0.2s'
    },
    errorCode: {
      color: 'rgba(255, 255, 255, 0.1)',
      fontSize: '10rem',
      fontWeight: '800',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 0,
      pointerEvents: 'none',
      userSelect: 'none'
    },
    content: {
      position: 'relative',
      zIndex: 1
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.errorCode}>404</div>
      <div style={styles.container}>
        <div style={styles.content}>
          <span style={styles.icon}>🔍</span>
          <h1 style={styles.title}>Page Not Found</h1>
          <p style={styles.subtitle}>
            Oops! The page you're looking for doesn't exist or has been moved.
          </p>
          <div style={styles.btnContainer}>
            <a href="/" style={styles.primaryBtn}>
              Go Home
            </a>
            <a href="/docs" style={styles.secondaryBtn}>
              View Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
