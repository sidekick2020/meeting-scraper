import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const dayAbbrev = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Meeting type definitions with icons
const MEETING_TYPES = {
  'AA': { name: 'Alcoholics Anonymous', shortName: 'Alcohol' },
  'NA': { name: 'Narcotics Anonymous', shortName: 'Narcotics' },
  'CA': { name: 'Cocaine Anonymous', shortName: 'Cocaine' },
  'MA': { name: 'Marijuana Anonymous', shortName: 'Marijuana' },
  'OA': { name: 'Overeaters Anonymous', shortName: 'Overeating' },
  'GA': { name: 'Gamblers Anonymous', shortName: 'Gambling' },
  'Al-Anon': { name: 'Al-Anon Family Groups', shortName: 'Family Support' },
  'SLAA': { name: 'Sex & Love Addicts Anonymous', shortName: 'Sex & Love' },
  'HA': { name: 'Heroin Anonymous', shortName: 'Heroin' },
  'SA': { name: 'Sexaholics Anonymous', shortName: 'Sex Addiction' },
  'CMA': { name: 'Crystal Meth Anonymous', shortName: 'Meth' },
  'ACA': { name: 'Adult Children of Alcoholics', shortName: 'Adult Children' },
  'Other': { name: 'Other Programs', shortName: 'Other' },
};

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

function PublicSidebar({
  onAdminClick,
  isOpen: externalIsOpen,
  onToggle,
  // Mobile navigation props
  mobileNav = null
}) {
  // Use external state if provided, otherwise manage internally
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? onToggle : setInternalIsOpen;

  const { toggleTheme, isDark } = useTheme();
  const sidebarRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Expand/collapse state for mobile nav sections
  const [expandedSection, setExpandedSection] = useState(null);

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
          {/* Mobile Navigation - Search & Filters (only shown when mobileNav is provided) */}
          {mobileNav && (
            <>
              {/* Search Section */}
              <div className="public-sidebar-section mobile-nav-section">
                <div className="public-sidebar-section-title">Search</div>
                <div className="mobile-search-input">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search locations..."
                    value={mobileNav.searchQuery || ''}
                    onChange={(e) => mobileNav.onSearchChange?.(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && mobileNav.onSearchSubmit?.()}
                  />
                  {mobileNav.searchQuery && (
                    <button
                      className="mobile-search-clear"
                      onClick={() => mobileNav.onSearchChange?.('')}
                      aria-label="Clear search"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Filters */}
              <div className="public-sidebar-section mobile-nav-section">
                <div className="public-sidebar-section-title">Quick Filters</div>
                <div className="mobile-quick-filters">
                  <button
                    className={`mobile-filter-chip ${mobileNav.showTodayOnly ? 'active' : ''}`}
                    onClick={() => mobileNav.onTodayToggle?.()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                      <circle cx="12" cy="15" r="2" fill="currentColor"/>
                    </svg>
                    <span>Today</span>
                  </button>
                  <button
                    className={`mobile-filter-chip ${mobileNav.showOnlineOnly ? 'active' : ''}`}
                    onClick={() => mobileNav.onOnlineToggle?.()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <path d="M8 21h8"/>
                      <path d="M12 17v4"/>
                    </svg>
                    <span>Online</span>
                  </button>
                  <button
                    className={`mobile-filter-chip ${mobileNav.showHybridOnly ? 'active' : ''}`}
                    onClick={() => mobileNav.onHybridToggle?.()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <rect x="16" y="11" width="6" height="8" rx="1"/>
                    </svg>
                    <span>Hybrid</span>
                  </button>
                </div>
              </div>

              {/* Days Filter */}
              <div className="public-sidebar-section mobile-nav-section">
                <button
                  className="public-sidebar-expand-header"
                  onClick={() => setExpandedSection(expandedSection === 'days' ? null : 'days')}
                >
                  <div className="expand-header-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>Days</span>
                    {mobileNav.selectedDays?.length > 0 && (
                      <span className="filter-count">{mobileNav.selectedDays.length}</span>
                    )}
                  </div>
                  <svg className={`expand-chevron ${expandedSection === 'days' ? 'expanded' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {expandedSection === 'days' && (
                  <div className="mobile-filter-content">
                    <div className="mobile-days-grid">
                      {dayAbbrev.map((day, index) => (
                        <button
                          key={day}
                          className={`mobile-day-chip ${mobileNav.selectedDays?.includes(index) ? 'selected' : ''}`}
                          onClick={() => mobileNav.onDayToggle?.(index)}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <div className="mobile-day-presets">
                      <button onClick={() => mobileNav.onDaysPreset?.([1, 2, 3, 4, 5])}>Weekdays</button>
                      <button onClick={() => mobileNav.onDaysPreset?.([0, 6])}>Weekends</button>
                      <button onClick={() => mobileNav.onDaysPreset?.([0, 1, 2, 3, 4, 5, 6])}>All</button>
                      {mobileNav.selectedDays?.length > 0 && (
                        <button className="clear-btn" onClick={() => mobileNav.onDaysPreset?.([])}>Clear</button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Meeting Types Filter */}
              <div className="public-sidebar-section mobile-nav-section">
                <button
                  className="public-sidebar-expand-header"
                  onClick={() => setExpandedSection(expandedSection === 'types' ? null : 'types')}
                >
                  <div className="expand-header-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span>Meeting Type</span>
                    {mobileNav.selectedTypes?.length > 0 && (
                      <span className="filter-count">{mobileNav.selectedTypes.length}</span>
                    )}
                  </div>
                  <svg className={`expand-chevron ${expandedSection === 'types' ? 'expanded' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {expandedSection === 'types' && (
                  <div className="mobile-filter-content">
                    <div className="mobile-types-list">
                      {(mobileNav.availableTypes || Object.keys(MEETING_TYPES)).map(type => (
                        <button
                          key={type}
                          className={`mobile-type-item ${mobileNav.selectedTypes?.includes(type) ? 'selected' : ''}`}
                          onClick={() => mobileNav.onTypeToggle?.(type)}
                        >
                          <span className="type-name">{type}</span>
                          <span className="type-full-name">{MEETING_TYPES[type]?.name || type}</span>
                          {mobileNav.selectedTypes?.includes(type) && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                    {mobileNav.selectedTypes?.length > 0 && (
                      <button className="mobile-clear-filter" onClick={() => mobileNav.onClearTypes?.()}>
                        Clear Types
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* States Filter */}
              {mobileNav.availableStates?.length > 0 && (
                <div className="public-sidebar-section mobile-nav-section">
                  <button
                    className="public-sidebar-expand-header"
                    onClick={() => setExpandedSection(expandedSection === 'states' ? null : 'states')}
                  >
                    <div className="expand-header-left">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span>State</span>
                      {mobileNav.selectedStates?.length > 0 && (
                        <span className="filter-count">{mobileNav.selectedStates.length}</span>
                      )}
                    </div>
                    <svg className={`expand-chevron ${expandedSection === 'states' ? 'expanded' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {expandedSection === 'states' && (
                    <div className="mobile-filter-content">
                      <div className="mobile-states-list">
                        {mobileNav.availableStates.map(state => (
                          <button
                            key={state}
                            className={`mobile-state-item ${mobileNav.selectedStates?.includes(state) ? 'selected' : ''}`}
                            onClick={() => mobileNav.onStateToggle?.(state)}
                          >
                            <span>{state}</span>
                            {mobileNav.selectedStates?.includes(state) && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                      {mobileNav.selectedStates?.length > 0 && (
                        <button className="mobile-clear-filter" onClick={() => mobileNav.onClearStates?.()}>
                          Clear States
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Clear All Filters */}
              {mobileNav.hasActiveFilters && (
                <div className="public-sidebar-section mobile-nav-section">
                  <button
                    className="mobile-clear-all-filters"
                    onClick={() => mobileNav.onClearAllFilters?.()}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    <span>Clear All Filters</span>
                  </button>
                </div>
              )}

              <div className="mobile-nav-divider" />
            </>
          )}

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

          {/* Browse Section */}
          <div className="public-sidebar-section">
            <div className="public-sidebar-section-title">Browse</div>
            <button
              className={`public-sidebar-item ${location.pathname === '/online-meetings' ? 'active' : ''}`}
              onClick={() => {
                navigate('/online-meetings');
                setIsOpen(false);
              }}
            >
              <span className="public-sidebar-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8"/>
                  <path d="M12 17v4"/>
                </svg>
              </span>
              <span className="public-sidebar-item-label">
                Online Meetings
              </span>
            </button>
            <button
              className={`public-sidebar-item ${location.pathname === '/' ? 'active' : ''}`}
              onClick={() => {
                navigate('/');
                setIsOpen(false);
              }}
            >
              <span className="public-sidebar-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <span className="public-sidebar-item-label">
                All Meetings
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
