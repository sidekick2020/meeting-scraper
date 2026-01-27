import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme, useAuth } from '../contexts';

const Header = () => {
  const { theme, toggleTheme, isDark } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <Link to="/" className="header-logo">
            {/* Replace with your logo */}
            <span>🔷</span>
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
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* User menu */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                  style={{ width: 32, height: 32, borderRadius: '50%' }}
                />
                <button className="btn btn-ghost btn-sm" onClick={signOut}>
                  Sign Out
                </button>
              </div>
            ) : (
              <div id="google-signin-button" />
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
