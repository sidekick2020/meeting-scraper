# Changelog

All notable changes to this project will be documented in this file.

## [1.6.1] - 2026-01-21

### UI/UX Improvements
- **Meetings List Placeholder**: Added visually friendly empty state when no scrape is in progress
  - Calendar icon with gradient background
  - Clear messaging: "Once you start a new scrape, recently added meetings will populate here"
  - Hint pill directing users to click "Start Scraping"
  - Soft purple/indigo color scheme matching the app theme

## [1.6.0] - 2026-01-21

### New Features
- **API Versioning with Changelog**: Users can now view and switch between API versions in Settings
  - Enhanced API version selector with feature details and endpoint information
  - Each version shows its stability status (Stable/Beta)
  - Feature lists for each API version
  - Endpoint previews showing available API paths
- **Integrated Changelog Viewer**: Release Notes tab now displays full changelog from the server
  - Structured display with sections for features, bug fixes, and improvements
  - Version dates and release information
  - Expandable details for each changelog item
  - Visual icons for different change categories
- **New API Endpoints**: Added backend support for versioning
  - `/api/api-versions` - Get available API versions with their features
  - `/api/changelog` - Get parsed changelog from CHANGELOG.md

### UI/UX Improvements
- Enhanced API version cards with feature lists and endpoint previews
- Status badges showing Stable/Beta for each version
- Improved changelog display with collapsible sections
- Better visual hierarchy for release notes

## [1.5.4] - 2026-01-21

### New Features
- **Script Generation for Tasks**: Research tasks now have a "Generate Script" button
  - Generates Python scraping scripts based on TSML, BMLT, or JSON feed patterns
  - Auto-detects feed type from URL structure
  - Scripts include all transformation logic for consistent data format
- **Source Testing**: Test feed URLs before adding them to sources
  - Validates JSON response format
  - Shows total meeting count and state breakdown
  - Displays sample meetings for verification
- **Add to Sources**: One-click button to add tested sources to the scraper
  - Adds to AA_FEEDS (TSML) or NA_FEEDS (BMLT) based on type
  - Auto-marks associated task as completed
- **Feed Listing API**: New `/api/feeds` endpoint to list all configured meeting sources

### UI/UX Improvements
- Step-by-step workflow modal for adding new sources
- Python script syntax display with copy-to-clipboard
- Success/error indicators for source testing
- Form validation with helpful hints

## [1.5.3] - 2026-01-21

### New Features
- **State Bubble Click**: Clicking a state bubble on the map filters meetings to that state
  - Scrolls to the meeting list automatically
  - Server-side filtering with pagination (50 at a time)
  - "Load More" button works with state filter active
- **Improved Map Interaction**: Map bubbles now support click-to-filter workflow
  - State bubbles zoom in AND filter the meeting list
  - Meetings load progressively as you scroll through the list

### Performance
- Server-side state filtering reduces data transfer
- Pagination works consistently with filters applied

## [1.5.2] - 2026-01-21

### New Features
- **Admin Directory Filters**: Added comprehensive filtering options to meeting directory
  - Day of week filter (Sunday-Saturday)
  - Meeting type filter (AA, NA, Al-Anon)
  - Format filter (In-Person, Online, Hybrid)
  - Dynamic state dropdown populated from actual meeting data
  - "Clear Filters" button to reset all filters at once
  - Filters automatically trigger new search when changed

### UI/UX Improvements
- Reorganized directory toolbar layout with multiple filter dropdowns
- Added border separator between filters and results count

## [1.5.1] - 2026-01-21

### UI/UX Improvements
- **Meeting Sidebar Light Mode**: Improved text legibility in meeting detail sidebar
  - Added section backgrounds with subtle borders for visual separation
  - Section headers now have bottom borders and bolder font weight
  - Icon stroke width increased for better visibility
  - Text colors darkened for improved contrast
  - Notes blocks and metadata sections have clearer styling
- **Scrape History Light Mode**: Enhanced row visibility in scrape history list
  - Added subtle row backgrounds with clear borders
  - Status badges now have better color contrast (green/red/yellow/blue)
  - Row hover states with accent color highlight
  - Expanded row details have clearer section dividers
  - State tags use accent color scheme for consistency

## [1.5.0] - 2026-01-21

### New Features
- **Efficient Heatmap View**: Replaced slow map loading with progressive heatmap approach
  - Shows clustered heatmap data at lower zoom levels instead of loading thousands of markers
  - Cluster markers display meeting counts and zoom in on click
  - Individual meetings only load when zoomed in (level 13+)
  - New `/api/meetings/heatmap` endpoint with server-side aggregation
  - Grid-based clustering with adaptive cell sizes (5km-500km based on zoom)
- **Build Logs Link**: Added link to Render dashboard in deployment indicator
  - Opens Render dashboard in new tab when deployment is in progress
  - Configurable via `REACT_APP_RENDER_DASHBOARD_URL` environment variable

### Bug Fixes
- **API Version Selection**: Fixed version switching failing due to non-existent versioned endpoints
  - Changed validation to use base `/api/meetings` endpoint
  - Version preference now saves correctly to localStorage

### Performance Improvements
- **Map Load Time**: Dramatically reduced initial map load
  - Initial load now fetches ~20-50 cluster points instead of 1000+ meetings
  - Reduced data transfer by only fetching lat/lng for clustering
  - 300ms debounce on viewport changes to avoid excessive API calls

## [1.4.0] - 2026-01-20

### New Features
- **Dedicated Docs Endpoint**: Documentation now has its own URL at `/docs`
  - Direct link: https://meeting-scraper-frontend.onrender.com/docs
  - Standalone page mode with "Back to App" navigation
  - Can be accessed without signing in to admin panel
- **React Router Integration**: Added URL-based routing to the frontend
  - Enables direct linking to specific pages
  - Better browser history support

### Documentation
- **README Enhancements**:
  - Added prominent Render Dashboard links table for frontend and backend
  - All external links now open in new tab for better UX
  - Fixed broken screenshot references
  - Added direct link to /docs endpoint

## [1.3.2] - 2026-01-20

### New Features
- **Alabama Meeting Feeds**: Added meeting data sources for Alabama
  - Birmingham AA feed (TSML format)
  - West Alabama AA feed covering Tuscaloosa, Jasper, Fayette areas
  - Alabama NA feed with BMLT support covering all 11 NA service areas
- **BMLT Feed Support**: Added support for BMLT (Basic Meeting List Toolkit) API format
  - Automatic transformation from BMLT to standard format
  - Enables scraping NA meetings from BMLT-powered sites

## [1.3.1] - 2026-01-20

### Documentation
- **Mobile Quick Start Guide**: Added step-by-step guide for showing meetings in iOS and Android apps
  - iOS integration with Swift/SwiftUI using ParseSwift SDK
  - Android integration with Kotlin/Jetpack Compose using Parse Android SDK
  - Complete Meeting model definitions for both platforms
  - Common query examples (filter by state, day, type, search, etc.)
  - Reference tables for day values, meeting types, and type codes

## [1.3.0] - 2026-01-20

### New Features
- **Admin Directory Load More**: Replaced Previous/Next pagination with "Load More" button
  - Meetings accumulate as you click Load More instead of replacing
  - Shows progress counter (e.g., "25 of 3450")
  - Increased page size from 10 to 25 for better initial load
- **Search Highlighting**: Added search term highlighting in admin directory
  - Matching text highlighted in yellow in Name and Location columns
  - Case-insensitive matching with 2+ character minimum

### Bug Fixes
- **Deployment Indicator**: Fixed indicator not disappearing when deployment finishes
  - Added recovery logic for frontend status to reset to 'stable'
  - Added frontendStatus to useEffect dependency array

### Performance Improvements
- **Faster Initial Page Load**: Fixed duplicate API calls on home page
  - Used refs instead of state for skip calculation to avoid useCallback recreation
  - Added guard to prevent initial useEffect from running multiple times
  - Skip first map bounds change to avoid extra fetch on map initialization
  - Reduced initial API calls from 3 to 1

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
