# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-01-20

### New Features
- **Deployment Indicator**: Added bottom-right indicator showing frontend and backend deployment status
  - Detects backend deployment via /api/version endpoint failures
  - Detects frontend deployment via version.json build timestamp changes
  - Auto-refreshes page when new version is available
  - Expandable UI shows detailed status of each service
- **Pagination**: Added "Load More" button for meetings directory
  - Initial load of 50 meetings for faster page load
  - Load more meetings on demand
  - Shows count of loaded vs total meetings
- **Enhanced Filtering**: Added new filter options in meetings directory
  - Meeting format filter (big_book, step_study, discussion, speaker, etc.)
  - Accessibility filters (wheelchair accessible, childcare, sign language, parking)
  - Hybrid meeting filter
- **Backend Config Check**: Frontend now checks and displays backend configuration status
  - Shows specific error when Back4App credentials are not configured
  - Shows error when backend is unreachable

### UI/UX Improvements
- **Light Mode Card Visibility**: Improved card visibility with subtle gray background (#f8fafc)
  - Enhanced card shadows for better definition
  - Increased border opacity for clearer card edges
  - Updated light theme gradient background
- **Logo Visibility**: Fixed Sober Sidekick logo in light mode
  - Updated logo-light.svg with blue gradient for better contrast
  - Changed circle stroke from white to dark gray
  - Improved tagline text weight and color

### Backend Improvements
- **Pagination Support**: Added total count query for accurate pagination
  - Returns actual total count from Back4App for "Load More" functionality
  - Only performs count query when results hit the limit

## [Unreleased]

### Performance Improvements
- **Faster Initial Load**: Reduced initial meeting request from 1000 to 100 for quicker first-load performance
- **Coverage Analysis Optimization**: Fixed timeout by replacing 52 sequential API calls with single batched fetch
- **Map Bounds Loading**: Fixed JSON encoding for bounds queries to properly load meetings when panning map

### UI/UX Improvements
- **Map Visibility**: Added explicit opacity settings to ensure map tiles are fully visible
- **Card Visibility**: Improved meeting card visibility in light mode with stronger borders and accent colors
- **Side Panel**: Fixed legibility issues in light mode with proper theme variable usage
- **Logo Display**: Fixed SVG logo cutoff by expanding viewBox with padding
- **Skeleton Loading**: Added shimmer animation for users table loading state
- **Dark/Light Mode Toggle**: Added theme toggle in profile dropdown to switch between dark and light modes
- **Light Mode Improvements**: Comprehensive light mode styling overhaul
  - Darker blue accent color (#1a4fd8) for better visibility
  - Sidebar with lighter background, darker/bolder text, and visible vertical divider
  - Search inputs with clear rounded borders and visible placeholder text
  - Documentation with improved text contrast and indentation
  - Better form input styling with visible borders and focus states
- **Map Style**: Changed to CartoDB Voyager tiles for better contrast while remaining subtle

### New Features
- **Downloadable Model Files**: Added Meeting.swift and Meeting.kt files for iOS/Android integration
- **CC Email for Invites**: Added ability to CC someone when sending user invitations
- **API Version Setting**: Added API version selector in Settings to switch between v1 (stable) and v2-beta
- **In-App Release Notes**: Added Release Notes tab in Settings to view latest updates
- **Comprehensive Query Docs**: Added extensive query examples for iOS (Swift) and Android (Kotlin)
  - Filter by meeting type (AA, NA, etc.)
  - Filter online/hybrid meetings
  - Filter by city and state
  - Filter by type codes (Women, Beginners, etc.)
  - Search by name
  - Pagination
  - Compound queries (OR conditions)

### Bug Fixes
- **Start New Scrape**: Fixed app hang when clicking "Start New Scrape" by showing feed selector first
- **Team Members Timeout**: Increased API timeout from 8s to 30s for loading team members
- **Invite Email Timeout**: Added 15s timeout to SMTP connection to prevent indefinite hang
- **Loading Indicators**: Added spinner to invite button for better feedback during submission
