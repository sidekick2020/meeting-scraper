# Changelog

All notable changes to this project will be documented in this file.

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

### New Features
- **Downloadable Model Files**: Added Meeting.swift and Meeting.kt files for iOS/Android integration
- **CC Email for Invites**: Added ability to CC someone when sending user invitations
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
