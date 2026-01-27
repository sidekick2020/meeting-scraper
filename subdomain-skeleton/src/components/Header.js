import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme, useAuth } from '../contexts';

const Header = () => {
  const { toggleTheme, isDark } = useTheme();
  const { user, isAuthenticated, signOut, renderSignInButton } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Render Google Sign-In button when not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      renderSignInButton('google-signin-btn', {
        theme: isDark ? 'filled_black' : 'outline',
        size: 'medium',
      });
    }
  }, [isAuthenticated, isDark, renderSignInButton]);

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <Link to="/" className="header-logo">
            {/* TODO: Replace with your logo */}
            <span style={{ fontSize: '1.5rem' }}>🔷</span>
            <span>My App</span>
          </Link>

          <nav className="header-nav hide-mobile">
            <Link
              to="/"
              className={`header-nav-item ${isActive('/') ? 'active' : ''}`}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`header-nav-item ${isActive('/about') ? 'active' : ''}`}
            >
              About
            </Link>
          </nav>
        </div>

        <div className="header-right">
          <div className="header-actions">
            {/* Theme toggle */}
            <button
              className="btn btn-ghost btn-icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
              style={{ fontSize: '1.25rem' }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* User menu */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <img
                  src={user.picture}
                  alt={user.name}
                  style={{ width: 32, height: 32, borderRadius: '50%' }}
                />
                <button className="btn btn-ghost btn-sm" onClick={signOut}>
                  Sign Out
                </button>
              </div>
            ) : (
              <div id="google-signin-btn" />
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="header-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
        <Link
          to="/"
          className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          Home
        </Link>
        <Link
          to="/about"
          className={`mobile-nav-item ${isActive('/about') ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          About
        </Link>
      </nav>
    </header>
  );
};

export default Header;
