import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// Hamburger toggle button component - can be used in headers
export function SidebarToggleButton({ isOpen, onClick, className = '' }) {
  return (
    <button
      className={`public-sidebar-toggle ${className}`}
      onClick={onClick}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        // X icon when open
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        // Menu/hamburger icon when closed
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      )}
    </button>
  );
}

function PublicSidebar({ onAdminClick, isOpen: externalIsOpen, onToggle }) {
  // Use external state if provided, otherwise manage internally
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? onToggle : setInternalIsOpen;

  const { toggleTheme, isDark } = useTheme();
  const sidebarRef = useRef(null);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking the toggle button
      if (event.target.closest('.public-sidebar-toggle')) {
        return;
      }
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setIsOpen]);

  const handleSoberSidekickLogin = () => {
    // TODO: Implement Sober Sidekick member login
    // Study implementation from https://github.com/never-alone-sidekick/EmpathyHealth
    console.log('Sober Sidekick login - TODO');
    alert('Sober Sidekick member login coming soon!');
  };

  return (
    <>
      {/* Only render fixed toggle button if not externally controlled */}
      {!isControlled && (
        <SidebarToggleButton
          isOpen={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        />
      )}

      {/* Overlay when sidebar is open */}
      {isOpen && <div className="public-sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        className={`public-sidebar ${isOpen ? 'open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="public-sidebar-header">
          <h3>Menu</h3>
          <button
            className="public-sidebar-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="public-sidebar-content">
          {/* Theme Toggle */}
          <div className="public-sidebar-section">
            <div className="public-sidebar-section-title">Appearance</div>
            <button
              className="public-sidebar-item"
              onClick={toggleTheme}
            >
              <span className="public-sidebar-item-icon">
                {isDark ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </span>
              <span className="public-sidebar-item-label">
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </span>
              <span className="public-sidebar-item-badge">
                {isDark ? 'Dark' : 'Light'}
              </span>
            </button>
          </div>

          {/* Account Section */}
          <div className="public-sidebar-section">
            <div className="public-sidebar-section-title">Account</div>
            <button
              className="public-sidebar-item"
              onClick={handleSoberSidekickLogin}
            >
              <span className="public-sidebar-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <span className="public-sidebar-item-label">
                Member Login
              </span>
              <span className="public-sidebar-item-badge todo">
                Soon
              </span>
            </button>
          </div>
        </div>

        {/* Footer with Admin Login */}
        <div className="public-sidebar-footer">
          <button
            className="public-sidebar-item admin-login"
            onClick={onAdminClick}
          >
            <span className="public-sidebar-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <span className="public-sidebar-item-label">
              Admin Console
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

export default PublicSidebar;
