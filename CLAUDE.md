# Claude Code Instructions

This document provides guidance for Claude Code sessions working on this repository.

## Project Overview

**Sober Sidekick - 12-Step Meeting Finder** is a full-stack web application that aggregates AA, NA, Al-Anon, and other 12-step support group meetings from across the United States.

### Key Features
- **Public Directory**: Airbnb-style browsable interface with map/list views
- **Admin Dashboard**: Real-time scraping progress, user management, coverage analysis
- **Data Scraper**: Automated collection from 50+ TSML and BMLT feeds
- **Mobile SDKs**: iOS and Android integration via Back4app Parse SDK
- **Desktop App**: Native Mac app built with Electron

### Live URLs
- **Frontend**: https://meeting-scraper-frontend.onrender.com
- **Backend API**: https://meeting-scraper.onrender.com
- **Documentation**: https://meeting-scraper-frontend.onrender.com/docs

---

## Codebase Structure

```
meeting-scraper/
├── backend/                    # Python Flask API
│   ├── app.py                  # Main Flask server (~4000 lines)
│   ├── heatmap_indicator_service.py  # Hierarchical clustering
│   ├── thumbnail_service.py    # Location thumbnails
│   ├── test_feeds.py           # Feed testing utilities
│   └── requirements.txt        # Python dependencies
├── frontend/                   # React 18 SPA
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── contexts/           # React Context providers
│   │   ├── utils/              # Utility functions
│   │   ├── App.js              # Main app with routing
│   │   └── App.css             # All styles (single file)
│   ├── public/
│   │   ├── _redirects          # SPA routing fallback
│   │   └── version.json        # App version info
│   └── package.json
├── desktop/                    # Electron Mac app
│   ├── main.js                 # Electron main process
│   └── package.json
├── docs/                       # Documentation
│   ├── SCHEMA.md               # Database schema reference
│   └── MOBILE_QUICKSTART.md    # iOS/Android SDK guides
├── changelog/                  # Changelog fragments
│   ├── compile.py              # Compilation script
│   └── unreleased/             # Pending changes
│       ├── features/
│       ├── fixes/
│       └── improvements/
├── .github/workflows/          # GitHub Actions
│   ├── build-desktop.yml       # Mac app builds
│   ├── compile-changelog.yml   # Auto changelog compilation
│   └── pr-summary.yml          # PR summaries
├── render.yaml                 # Render.com deployment config
├── docker-compose.yml          # Docker configuration
└── CLAUDE.md                   # This file
```

---

## Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11 | Runtime |
| Flask | 3.0.0 | Web framework |
| Gunicorn | 21.2 | WSGI server |
| Requests | 2.31 | HTTP client |
| BeautifulSoup4 | 4.12.2 | HTML parsing |
| Flask-Compress | 1.14 | Response compression |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI framework |
| React Router | 7.x | Client-side routing |
| Leaflet | 1.9.4 | Interactive maps |
| Parse SDK | 5.3 | Back4app database |
| Socket.io-client | - | Real-time updates |

### Database
- **Back4app (Parse Server)**: Cloud-hosted Parse database
- Key classes: `Meetings`, `Users`, `ScrapeHistory`, `CoverageAnalysis`, `HeatmapIndicator`

### Desktop
- **Electron 28**: Native Mac app wrapper
- Build targets: Apple Silicon (M1/M2/M3), Intel x64, Universal

---

## Key Files Reference

### Backend (`backend/`)
| File | Purpose |
|------|---------|
| `app.py` | Main Flask API - all endpoints, cache managers, scraping logic |
| `heatmap_indicator_service.py` | 5-tier zoom clustering for heatmap display |
| `requirements.txt` | Python dependencies |

### Frontend Components (`frontend/src/components/`)
| Component | Purpose |
|-----------|---------|
| `MeetingsExplorer.js` | Main public directory with map/list views |
| `AdminPanel.js` | Admin dashboard interface |
| `MeetingMap.js` | Interactive Leaflet map component |
| `MeetingDetail.js` | Single meeting view |
| `MeetingDetailPage.js` | Standalone meeting page (for sharing) |
| `DevDocs.js` | Developer documentation portal |
| `CoverageAnalysis.js` | State-by-state coverage metrics |
| `SourcesPage.js` | Feed management interface |
| `SettingsModal.js` | Configuration UI |
| `StateHeatmapModal.js` | Coverage heatmap display |
| `OnlineMeetings.js` | Online-only meeting directory |
| `DownloadPage.js` | Desktop app downloads |

### Frontend Contexts (`frontend/src/contexts/`)
| Context | Purpose |
|---------|---------|
| `AnalyticsContext.js` | Amplitude analytics tracking (see Analytics section) |
| `AuthContext.js` | Google Sign-In authentication |
| `ParseContext.js` | Back4app/Parse SDK initialization |
| `DataCacheContext.js` | Client-side API response caching |
| `ThemeContext.js` | Light/dark theme support |
| `DevModeContext.js` | Development utilities |

---

## API Endpoints

### Status & Control
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Scraper status and statistics |
| `/api/start` | POST | Start scraping process |
| `/api/stop` | POST | Stop scraping process |
| `/api/reset` | POST | Reset scraper state |

### Meetings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/meetings` | GET | List meetings with pagination |
| `/api/meetings/<id>` | GET | Get single meeting |
| `/api/meetings/<id>` | PUT | Update meeting |
| `/api/meetings/<id>` | DELETE | Delete meeting |

### Feeds & Sources
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feeds` | GET | List available data feeds |
| `/api/sources` | GET | List configured sources |

### Users (Admin)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | GET | List dashboard users |
| `/api/users` | POST | Invite new user |
| `/api/users/<id>` | PUT | Update user role |
| `/api/users/<id>` | DELETE | Remove user |

### System
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/versions` | GET | Release history from git tags |
| `/api/changelog` | GET | Compiled changelog |
| `/api/cache-stats` | GET | Cache statistics |
| `/api/parse-diagnostics` | GET | Backend diagnostics |

---

## Database Schema

### Meetings Class (Primary)
| Field | Type | Description |
|-------|------|-------------|
| `objectId` | String | Unique identifier |
| `uniqueKey` | String | Deduplication key |
| `name` | String | Meeting name |
| `fellowship` | String | AA, NA, Al-Anon, etc. |
| `day` | Number | Day of week (0=Sun, 6=Sat) |
| `time` | String | Start time (HH:MM) |
| `endTime` | String | End time |
| `timezone` | String | Timezone identifier |
| `address` | String | Street address |
| `city` | String | City |
| `state` | String | State abbreviation |
| `latitude` | Number | GPS latitude |
| `longitude` | Number | GPS longitude |
| `formattedAddress` | String | Full formatted address |
| `isOnline` | Boolean | Virtual meeting flag |
| `isHybrid` | Boolean | Hybrid meeting flag |
| `onlineUrl` | String | Zoom/video link |
| `conferencePhone` | String | Phone dial-in |
| `types` | Array | Meeting type codes |
| `notes` | String | Additional notes |
| `clusterKey` | String | Heatmap clustering key |

See `docs/SCHEMA.md` for complete field reference.

---

## Development Setup

### Prerequisites
- Python 3.8+ (3.11 recommended)
- Node.js 16+ (18 recommended)
- Back4app account (free tier available)

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
# Runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

### Environment Variables

**Backend** (required):
- `BACK4APP_APP_ID` - Parse server app ID
- `BACK4APP_REST_KEY` - Parse server REST key

**Frontend** (optional - defaults work for development):
- `REACT_APP_BACKEND_URL` - Backend API URL
- `REACT_APP_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `REACT_APP_AMPLITUDE_API_KEY` - Amplitude analytics API key (required for production)

---

## Common Patterns & Conventions

### Cache-First Strategy
The backend uses multiple `CacheManager` instances with TTL-based expiration:
- `meetings_data_cache` (3 min)
- `heatmap_cache` (5 min)
- `coverage_analysis_cache` (15 min)

### Error Response Format
All API errors follow a standardized format with detailed diagnostics.

### Data Pipeline
1. Scrape from TSML/BMLT feeds
2. Normalize to standard schema
3. Deduplicate via `uniqueKey`
4. Geocode missing coordinates (Nominatim)
5. Save to Back4app
6. Cache responses

### Component Architecture
- Feature-based component organization
- Context API for cross-cutting concerns
- Single CSS file (`App.css`) for all styles

---

## Changelog Fragments System

To avoid merge conflicts, this project uses **changelog fragments** instead of directly editing `CHANGELOG.md`.

### Adding a Changelog Entry

After making significant code changes, create a fragment file:

1. Create a `.md` file in the appropriate category:
   - `changelog/unreleased/features/` - New features
   - `changelog/unreleased/fixes/` - Bug fixes
   - `changelog/unreleased/improvements/` - UI/UX improvements

2. Name the file descriptively (e.g., `state-heatmap.md`)

3. Write the entry:
   ```markdown
   **Feature Name**: Brief description
   - Detail point 1
   - Detail point 2
   ```

### Compiling at Release Time

**Automatic (Recommended)**: When you create a GitHub Release, the changelog is compiled automatically via GitHub Actions. The workflow extracts the version from the release tag (e.g., `v1.8.0` → `1.8.0`), runs the compile script, and commits the updated `CHANGELOG.md`.

**Manual**: If needed, you can also run manually:
```bash
python changelog/compile.py 1.8.0
```

This compiles all fragments into `CHANGELOG.md` and deletes the fragment files.

### Important: Never Edit CHANGELOG.md Directly

Always use changelog fragments. Direct edits to `CHANGELOG.md` will cause merge conflicts when multiple PRs are open.

---

## Post-Change Checklist

After completing significant code changes, Claude should **always**:

1. **Create a PR** - Always create a pull request with summary and test plan after making significant changes. Do not ask - just create it.
2. **Add changelog fragment** - Create a fragment file for the changes
3. **Provide git tag commands** - Give copy-paste commands for version tagging (after PR is merged)

Provide all commands without comments for easy copy-paste.

---

## Commit and Push Policy

**When a PR already exists for the current branch**, Claude should automatically commit and push any new changes without asking. This keeps the PR up to date with the latest work.

- If changes are requested or additional work is done on an existing PR branch, commit and push immediately
- Do not ask for permission to push when a PR is already open
- Use clear, descriptive commit messages for each logical change

---

## Release Versioning Workflow

When making changes that warrant a new version release, follow this process:

### 1. Add Changelog Fragment

Create a fragment file instead of editing CHANGELOG.md directly:

```bash
echo '**Feature Name**: Description
- Detail 1
- Detail 2' > changelog/unreleased/features/my-feature.md
```

### 2. Create a Git Tag (Important Limitation)

**Claude cannot push git tags** due to authentication restrictions. Claude's git credentials only allow pushing to branches matching `claude/*`.

After the PR is merged, Claude should provide tag commands:

```bash
git tag -a vX.Y.Z <commit-hash> -m "Release vX.Y.Z - Summary"
git push origin vX.Y.Z
```

### 3. Why Tags Matter

The `/api/versions` endpoint reads git tags to populate the Release History in the Settings modal. Without a pushed tag, versions won't appear in the UI even if they're documented in the CHANGELOG.

---

## Version Number Guidelines

- **Major (X.0.0)**: Breaking changes or major new functionality
- **Minor (X.Y.0)**: New features, significant enhancements
- **Patch (X.Y.Z)**: Bug fixes, small improvements

---

## Periodic Tag Reminders

**Claude should periodically remind the user to push pending tags**, especially:
- At the end of a session where CHANGELOG was updated
- When a significant feature is completed
- When the user asks about releases or versions

### Reminder Format

When reminding the user, provide **copy-paste ready commands** with a changelog summary:

```
📦 **Pending Release Tag**

The following version is ready to be tagged and pushed:

**v1.6.0** - API Versioning with Changelog
- API Versioning with Changelog viewer in Settings
- New /api/api-versions and /api/changelog endpoints
- Enhanced version cards with feature lists and status badges

**Run these commands to publish the release:**

git tag -a v1.6.0 3c419bf -m "Release v1.6.0 - API Versioning with Changelog"
git push origin v1.6.0
```

### When to Suggest New Tags

Suggest a new version tag when:
- **Patch (X.Y.Z)**: Bug fixes, minor UI tweaks
- **Minor (X.Y.0)**: New features, significant enhancements
- **Major (X.0.0)**: Breaking changes, major rewrites

Always check CHANGELOG.md to see what the latest documented version is, and compare with `git tag -l` to identify unpushed versions.

---

## Commit Message Format

When updating the CHANGELOG for a new version, use a commit message like:

```
Release vX.Y.Z - Brief summary

- Feature 1
- Feature 2
- Bug fix
```

---

## API Versions vs Application Versions

This project has two distinct version concepts:

1. **API Versions** (`v1`, `v2-beta`): Defined in `backend/app.py` `API_VERSIONS` constant. These are endpoint versioning for the API.

2. **Application Versions** (`1.5.0`, `1.6.0`): Git tags representing releases. Shown in Release History UI.

Don't confuse these - adding a CHANGELOG entry for v1.6.0 doesn't create a new API version.

---

## Mac Build Tags

When providing mac build tag commands (tags matching `v*` or `mac-v*`), follow these requirements:

1. **Always check existing tags first** by running `git fetch --tags && git tag -l "v*" --sort=-v:refname | head -5` to find the latest version
2. **Generate a new unused version number** - increment from the highest existing tag (e.g., if v1.24.0 exists, use v1.25.0 or mac-v1.25.0)
3. **Always include a fetch command** before tagging to ensure the latest commits are available
4. **Always include the GitHub Actions link** to view the build progress

The "Build Desktop App" workflow runs on:
- Tags matching `v*` (e.g., `v1.25.0`)
- Tags matching `mac-v*` (e.g., `mac-v1.25.0`)
- Manual workflow dispatch

Example format when providing tag commands:

```
git fetch origin <branch-name>
git tag -a mac-v1.25.0 <commit-hash> -m "Release mac-v1.25.0 - Summary"
git push origin mac-v1.25.0

**View build progress:** https://github.com/sidekick2020/meeting-scraper/actions/workflows/build-desktop.yml
```

---

## Render.com SPA Routing

The frontend is deployed as a static site on Render.com. For SPA routing to work correctly (so direct URL access like `/meeting/abc123` doesn't return 404), we use multiple fallback mechanisms:

### How It Works

1. **`build/200.html`** - Render's native SPA fallback. When this file exists, Render serves it for any path that doesn't match an existing file, with a 200 status code. This is the most reliable method.

2. **`_redirects` file** - Netlify-style redirects (also supported by Render), located in `frontend/public/_redirects`.

3. **`render.yaml` routes** - Explicit rewrite rules in the render.yaml file.

4. **Directory fallbacks** - The postbuild script creates `index.html` copies in route directories (e.g., `build/meeting/index.html`).

### When Adding New Routes

**IMPORTANT**: When adding a new frontend route (in `App.js`), you must also update SPA routing:

1. **Update `frontend/package.json` postbuild script** - Add the new route directory:
   ```json
   "postbuild": "mkdir -p build/docs build/download build/meeting build/NEW_ROUTE && cp build/index.html build/docs/index.html ... && cp build/index.html build/NEW_ROUTE/index.html && cp build/index.html build/200.html"
   ```

2. **Update `frontend/public/_redirects`** - Add explicit rewrite rules:
   ```
   /new-route        /index.html   200
   /new-route/*      /index.html   200
   ```

3. **Update `render.yaml`** - Add route entries:
   ```yaml
   - type: rewrite
     source: /new-route
     destination: /index.html
   - type: rewrite
     source: /new-route/*
     destination: /index.html
   ```

### Why This Matters

Without these configurations, direct URL access to routes (e.g., refreshing the page or sharing a link) will return a 404 error because Render looks for a static file at that path. The `200.html` fallback is the most reliable solution, but we maintain all three methods for redundancy.

---

## Testing

### Backend
```bash
cd backend
python test_feeds.py  # Test feed connectivity
```

### Frontend
```bash
cd frontend
npm test  # React testing (react-scripts)
```

### Build Verification
```bash
# Frontend production build
cd frontend && npm run build

# Desktop app (Mac)
cd desktop && npm run build
```

---

## Docker Deployment

```bash
# Full stack with Docker Compose
docker-compose up --build

# Backend: port 5000
# Frontend: port 80
```

---

## Troubleshooting

### Common Issues

**Backend won't start**
- Check Python version (3.8+ required)
- Verify `BACK4APP_APP_ID` and `BACK4APP_REST_KEY` are set
- Run `pip install -r requirements.txt`

**Frontend shows connection errors**
- Verify backend is running on port 5000
- Check browser console for CORS errors
- Clear localStorage and refresh

**Scraping fails**
- Check feed URLs are accessible
- Review rate limiting on external sites
- Check activity log in admin dashboard

**SPA routes return 404 on Render**
- Ensure `build/200.html` exists after build
- Verify `_redirects` file is in `frontend/public/`
- Check `render.yaml` has correct rewrite rules

---

## Amplitude Analytics Data Collection

This project uses [Amplitude Analytics](https://amplitude.com/docs/analytics) for product analytics. The implementation is in `frontend/src/contexts/AnalyticsContext.js`.

### Current Implementation Status

| Category | Status | Coverage |
|----------|--------|----------|
| Core Context | ✅ Complete | `AnalyticsContext.js` with 120+ event constants |
| MeetingsExplorer | ✅ Complete | 21+ tracking calls |
| AdminPanel | ✅ Complete | 9+ tracking calls |
| MeetingDetailPage | ✅ Complete | Full tracking |
| OnlineMeetings | ✅ Complete | Full tracking |
| Other Components | ⚠️ Incomplete | 30+ components need tracking |

### Environment Configuration

```bash
# Required for production
REACT_APP_AMPLITUDE_API_KEY=your-amplitude-api-key

# Development (analytics disabled by default)
# Set the key in .env.development.local to enable local tracking
```

### Event Naming Conventions

Follow [Amplitude's taxonomy best practices](https://amplitude.com/docs/data/data-planning-playbook):

| Rule | Example | Rationale |
|------|---------|-----------|
| Use `snake_case` | `meeting_viewed` | Consistent, readable |
| Use past tense verbs | `search_completed` | Indicates action occurred |
| Noun + Verb pattern | `filter_applied` | Consistent structure |
| Be concise | `map_zoom_changed` vs `user_changed_zoom_on_map` | Easier to query |

**Property Naming:**
- Use `snake_case` for properties: `meeting_id`, `filter_type`
- Limit to 20 properties per event
- Use boolean prefixes: `is_online`, `has_results`

### Required Analytics When Adding Features

**CRITICAL**: When implementing new features, Claude MUST add analytics tracking. Follow this checklist:

#### 1. Page/View Tracking
```javascript
// Track when user enters a new page or view
const { trackPageView, events } = useAnalytics();

useEffect(() => {
  trackPageView('FeatureName', {
    source: 'navigation', // or 'deep_link', 'search', etc.
  });
}, []);
```

#### 2. User Actions
```javascript
// Track all user interactions
const { track, events } = useAnalytics();

// Button clicks
track(events.FEATURE_ACTION_COMPLETED, {
  action: 'button_clicked',
  button_name: 'submit',
  context: 'form_submission',
});

// Form submissions
track(events.FORM_SUBMITTED, {
  form_name: 'contact',
  field_count: 5,
  has_errors: false,
});
```

#### 3. Feature-Specific Events
Add new event constants to `ANALYTICS_EVENTS` in `AnalyticsContext.js`:

```javascript
// In ANALYTICS_EVENTS object
NEW_FEATURE_VIEWED: 'new_feature_viewed',
NEW_FEATURE_ACTION: 'new_feature_action',
NEW_FEATURE_COMPLETED: 'new_feature_completed',
NEW_FEATURE_ERROR: 'new_feature_error',
```

#### 4. Error Tracking
```javascript
const { trackError } = useAnalytics();

try {
  // operation
} catch (error) {
  trackError('feature_name', error.message, {
    error_code: error.code,
    user_action: 'attempted_submit',
  });
}
```

### User Properties to Track

Set user properties for segmentation and [behavioral cohorts](https://amplitude.com/docs/faq/behavioral-cohorts):

| Property | When to Set | Purpose |
|----------|-------------|---------|
| `is_admin` | On sign-in | Segment admin vs public users |
| `email` | On sign-in | User identification |
| `preferred_fellowship` | On filter selection | Understand user preferences |
| `preferred_state` | On location search | Geographic segmentation |
| `session_count` | On each session | Engagement tracking |
| `meetings_viewed_count` | Increment on view | Engagement depth |
| `last_search_query` | On search | Search behavior |
| `theme_preference` | On theme toggle | UX insights |

```javascript
const { setUserProperties, incrementUserProperty } = useAnalytics();

// Set properties
setUserProperties({
  preferred_fellowship: 'AA',
  preferred_state: 'CA',
});

// Increment counters
incrementUserProperty('meetings_viewed_count', 1);
```

### Funnel Events to Track

Define clear funnels for key user journeys:

**Meeting Discovery Funnel:**
1. `app_loaded` → User arrives
2. `search_initiated` → User searches
3. `search_completed` → Results shown
4. `meeting_viewed` → User clicks meeting
5. `meeting_directions_clicked` OR `meeting_online_link_clicked` → User takes action

**Admin Workflow Funnel:**
1. `admin_signin_success` → Admin logs in
2. `admin_tab_viewed` → Admin navigates
3. `scrape_started` → Admin initiates scrape
4. `scrape_completed` → Scrape finishes

### Session Replay Integration

[Session Replay](https://amplitude.com/docs/session-replay) is available on Amplitude's paid plans. When enabled:

1. Configure in `AnalyticsContext.js`:
```javascript
amplitude.init(AMPLITUDE_API_KEY, {
  defaultTracking: {
    sessions: true,
    pageViews: true,
    formInteractions: true,
    fileDownloads: true,
  },
  // Enable session replay (requires paid plan)
  plugins: [sessionReplayPlugin()],
});
```

2. Track key moments for replay review:
```javascript
// Mark important moments for session replay filtering
track('checkout_friction_point', { step: 'payment', issue: 'validation_error' });
```

### Components Requiring Analytics Integration

The following components need analytics added:

| Component | Priority | Events to Track |
|-----------|----------|-----------------|
| `CoverageAnalysis.js` | High | State clicked, coverage viewed |
| `SettingsModal.js` | High | Tab changed, settings modified |
| `DownloadPage.js` | High | Download initiated, platform selected |
| `DevDocs.js` | Medium | Section viewed, code copied |
| `SourcesPage.js` | Medium | Source viewed, feed tested |
| `StateHeatmapModal.js` | Medium | State selected, zoom level |
| `Dashboard.js` | Medium | Metrics viewed, time range changed |
| `ScrapePanel.js` | Medium | Feed selected, scrape progress |
| `MeetingMap.js` | Low | (May cause noise - debounce) |

### Performance & API Tracking

Track API performance for monitoring:

```javascript
const { trackApiRequest } = useAnalytics();

const startTime = Date.now();
try {
  const response = await fetch(endpoint);
  trackApiRequest(endpoint, Date.now() - startTime, true, {
    status_code: response.status,
    response_size: response.headers.get('content-length'),
  });
} catch (error) {
  trackApiRequest(endpoint, Date.now() - startTime, false, {
    error_message: error.message,
  });
}
```

### Behavioral Cohorts to Create in Amplitude

After sufficient data collection, create these [cohorts](https://amplitude.com/docs/analytics/define-cohort):

| Cohort Name | Definition | Use Case |
|-------------|------------|----------|
| Power Users | 10+ meetings viewed in 7 days | Feature prioritization |
| New Users | First session in last 7 days | Onboarding analysis |
| Churning Users | No activity in 14 days after 3+ sessions | Re-engagement |
| Mobile Users | Device type = mobile | Mobile UX optimization |
| Admin Active | Admin actions in last 7 days | Admin tool usage |
| Search Failures | search_completed with results_count = 0 | Search improvement |
| High Intent | directions_clicked OR online_link_clicked | Conversion analysis |

### A/B Testing Preparation

For future [Amplitude Experiment](https://amplitude.com/amplitude-experiment) integration:

1. Track variant exposure:
```javascript
track('experiment_viewed', {
  experiment_name: 'new_search_ui',
  variant: 'treatment_a',
});
```

2. Track conversion events tied to experiments:
```javascript
track('experiment_conversion', {
  experiment_name: 'new_search_ui',
  variant: 'treatment_a',
  conversion_event: 'meeting_viewed',
});
```

### Data Quality Checklist

Before merging features with analytics:

- [ ] All new events added to `ANALYTICS_EVENTS` constant
- [ ] Event names follow `snake_case` naming convention
- [ ] Properties limited to 20 per event
- [ ] No PII in event properties (no full addresses, phone numbers)
- [ ] Error cases tracked with `trackError()`
- [ ] User properties set where appropriate
- [ ] Page views tracked for new routes
- [ ] Funnels considered and documented

### Privacy Considerations

- Never track: Full addresses, phone numbers, email content, meeting notes content
- Anonymize: Use meeting IDs instead of names where possible
- Comply with: GDPR, CCPA - implement consent where required
- IP handling: Amplitude uses IP for geolocation then discards by default

---

## Subdomain Skeleton Template

A reusable template for creating new Sober Sidekick subdomain applications with shared design system.

### Template Location

```
subdomain-skeleton/           # GitHub template repository
├── src/
│   ├── components/          # Header, etc.
│   ├── contexts/            # Theme, Auth, Analytics, DataCache
│   ├── pages/               # HomePage, AboutPage, NotFound
│   ├── styles/              # Design system CSS
│   ├── App.js               # Main app
│   └── index.js             # Entry point
├── public/                  # Static assets
├── package.json
├── render.yaml              # Render.com deployment
└── .env.example             # Environment template
```

### When to Offer the Skeleton

**Claude MUST proactively ask users** if they want to use the subdomain skeleton when:

1. User mentions creating a **new React application** for Sober Sidekick
2. User wants to build a **new subdomain** (e.g., `admin.sobersidekick.com`, `docs.sobersidekick.com`)
3. User asks about **starting a new frontend project**
4. User mentions needing **shared styling/components** across apps

### Prompt Format

When any of the above triggers are detected, Claude should ask:

```
🎨 **Would you like to use the Sober Sidekick subdomain skeleton?**

The skeleton template includes:
- ✅ Shared design system (colors, typography, spacing)
- ✅ Pre-built components (buttons, cards, modals, forms)
- ✅ Google Sign-In authentication
- ✅ Amplitude analytics integration
- ✅ Light/dark theme support
- ✅ Responsive layout patterns
- ✅ Render.com deployment config

**Options:**
1. **Yes** - Create new app from skeleton template
2. **No** - Start from scratch
3. **Show me the template** - Preview what's included
```

### Creating a New App from Skeleton

If the user selects **Yes**, Claude should:

1. **Ask for the app name/subdomain**:
   ```
   What subdomain will this be for? (e.g., `admin`, `docs`, `dashboard`)
   ```

2. **Copy the skeleton** to a new directory:
   ```bash
   cp -r subdomain-skeleton ../new-app-name
   cd ../new-app-name
   ```

3. **Update app-specific values**:
   - `package.json` - name field
   - `public/index.html` - title
   - `public/manifest.json` - name, short_name
   - `src/components/Header.js` - logo and app name
   - `render.yaml` - service name

4. **Initialize git and install**:
   ```bash
   git init
   npm install
   ```

5. **Provide next steps**:
   - Set up environment variables
   - Create GitHub repo
   - Connect to Render.com

### MCP Integration

The skeleton can be scaffolded via MCP tools. When an MCP server is available, Claude should use:

```javascript
// MCP tool call example
mcp.scaffold_subdomain_app({
  name: "admin",
  subdomain: "admin.sobersidekick.com",
  features: ["auth", "analytics", "theme"]
})
```

### Design System Documentation

Full documentation available at:
- `docs/DESIGN_SYSTEM.md` - Complete design system reference
- `docs/skeleton/README.md` - Skeleton template guide
- `subdomain-skeleton/README.md` - Quick start guide

### Backwards Compatibility

The skeleton is designed to:
- Share contexts with the Meeting Finder app
- Use identical CSS variables
- Support embedding Meeting Finder as a module
- Maintain consistent analytics events
