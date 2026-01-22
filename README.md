# Sober Sidekick - 12-Step Meeting Finder

A comprehensive meeting management system by <a href="https://sobersidekick.com" target="_blank">Sober Sidekick</a> that aggregates AA, NA, Al-Anon, and other 12-step support group meetings from across the United States. Built with React and Python/Flask, powered by Back4app.

**You're Never Alone.**

## Overview

| Feature | Description |
|---------|-------------|
| **Admin Dashboard** | Manage and monitor meeting data with a modern, responsive interface |
| **Public Directory** | Airbnb-style browsable interface for finding meetings |
| **Data Scraper** | Automated collection from official 12-step organization feeds |
| **Mobile SDKs** | iOS and Android integration guides included |
| **Analytics** | Coverage analysis and statistics by state/region |

## Quick Start

**Try it now**: <a href="https://meeting-scraper-frontend.onrender.com" target="_blank">https://meeting-scraper-frontend.onrender.com</a>

**Documentation**: <a href="https://meeting-scraper-frontend.onrender.com/docs" target="_blank">https://meeting-scraper-frontend.onrender.com/docs</a>

### Desktop App (Mac)

Download the native Mac app for a dedicated experience:

**<a href="https://meeting-scraper-frontend.onrender.com/download" target="_blank">Download for Mac →</a>**

- Available for Apple Silicon (M1/M2/M3) and Intel Macs
- No installation required - just drag to Applications
- Always connects to the latest data

### Render Dashboards

| Service | Live URL | Render Dashboard |
|---------|----------|------------------|
| **Frontend** | <a href="https://meeting-scraper-frontend.onrender.com" target="_blank">meeting-scraper-frontend.onrender.com</a> | <a href="https://dashboard.render.com/static/srv-d0ff8np6ubrc73b7lii0" target="_blank">Open Dashboard</a> |
| **Backend API** | <a href="https://meeting-scraper.onrender.com" target="_blank">meeting-scraper.onrender.com</a> | <a href="https://dashboard.render.com/web/srv-d0f9gm68d50c73813op0" target="_blank">Open Dashboard</a> |

Or run locally:

```bash
# Backend
cd backend && pip install -r requirements.txt && python app.py

# Frontend (new terminal)
cd frontend && npm install && npm start
```

---

## Current Coverage

### Active Feeds (10 States)

| State | Feeds | Types | Est. Meetings |
|-------|-------|-------|---------------|
| **Alabama** | Birmingham AA, West Alabama AA, Alabama NA | AA, NA | ~500 |
| **Arizona** | Phoenix AA | AA | ~400 |
| **California** | Bay Area AA, San Diego AA | AA | ~600 |
| **Colorado** | Boulder AA | AA | ~200 |
| **Georgia** | Atlanta AA | AA | ~800 |
| **Indiana** | Indianapolis AA | AA | ~470 |
| **Missouri** | Missouri NA | NA | ~624 |
| **Texas** | Houston AA, Austin AA | AA | ~1,500 |
| **Virginia** | Richmond AA, Blue Ridge AA | AA | ~742 |
| **Washington** | Eastside AA (Seattle) | AA | ~439 |

<details>
<summary><strong>Priority States Needing Coverage</strong></summary>

The following high-population states currently have **no active feeds**:

| State | Population | Priority |
|-------|------------|----------|
| Florida | 22.6M | Critical |
| New York | 19.6M | Critical |
| Pennsylvania | 13.0M | High |
| Illinois | 12.6M | High |
| Ohio | 11.8M | High |
| North Carolina | 10.8M | High |
| Michigan | 10.0M | High |
| New Jersey | 9.3M | High |

</details>

<details>
<summary><strong>How to Add a New Feed</strong></summary>

Most AA/NA websites use one of two feed formats:

**TSML (12 Step Meeting List)** - WordPress plugin used by most AA sites:
```
https://[domain]/wp-admin/admin-ajax.php?action=meetings
```

**BMLT (Basic Meeting List Toolkit)** - Used by many NA regions:
```
https://[bmlt-server]/main_server/client_interface/json/?switcher=GetSearchResults&services[]=XX
```

To contribute:
1. Find your local AA/NA intergroup website
2. Check if it uses TSML or BMLT (look for "Meeting Guide" app compatibility)
3. Open an issue or PR with the feed URL and state coverage

</details>

---

## Screenshots

> Screenshots coming soon. To add screenshots, place images in `docs/screenshots/` and update references below.

| View | Description |
|------|-------------|
| **Public Directory** | Browse meetings with map and filters |
| **Admin Dashboard** | Real-time scraping progress |
| **Coverage Analysis** | State-by-state coverage metrics |
| **Developer Docs** | iOS & Android SDK guides |

---

<details>
<summary><h2>Architecture</h2></summary>

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│                     (React 18 + Leaflet)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Public    │  │   Admin     │  │  Coverage   │  │    Docs    │ │
│  │  Directory  │  │  Dashboard  │  │  Analysis   │  │   Portal   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
└─────────┼────────────────┼────────────────┼───────────────┼────────┘
          │                │                │               │
          └────────────────┼────────────────┘               │
                           ▼                                │
┌─────────────────────────────────────────────────────────────────────┐
│                          BACKEND API                                 │
│                      (Python Flask + Gunicorn)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Meetings   │  │   Scraper   │  │    User     │  │  Coverage  │ │
│  │    CRUD     │  │   Engine    │  │ Management  │  │   Stats    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
└─────────┼────────────────┼────────────────┼───────────────┼────────┘
          │                │                │               │
          ▼                ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DATABASE                                    │
│                    (Back4app / Parse Server)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Meetings   │  │   Users     │  │   Scrape    │  │  Activity  │ │
│  │   Class     │  │   Class     │  │   History   │  │    Logs    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
          ▲
          │  Data Sources
          │
┌─────────┴───────────────────────────────────────────────────────────┐
│                       EXTERNAL FEEDS                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  TSML/JSON  │  │    BMLT     │  │   Google    │                 │
│  │   (AA/NA)   │  │  (NA/CA)    │  │   Sheets    │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Scraping**: Backend fetches meeting data from TSML and BMLT feeds
2. **Transformation**: Raw data is normalized to a standard schema
3. **Deduplication**: Unique keys prevent duplicate entries
4. **Storage**: Meetings saved to Back4app Parse database
5. **API**: RESTful endpoints serve data to frontend and mobile apps
6. **Display**: React frontend renders maps and lists for users

</details>

<details>
<summary><h2>Features</h2></summary>

### Data Management
- Automated web scraping from 50+ regional AA/NA/Al-Anon feeds
- Intelligent deduplication using unique key matching
- Automatic geocoding for addresses without coordinates
- Bulk import/export capabilities

### Admin Dashboard
- Google Sign-In authentication
- Real-time scraping progress with activity logs
- Coverage analysis with population-weighted metrics
- Meeting editor with map visualization
- User management with role-based access (Standard/Admin)
- Scrape history and audit trail

### Public Directory
- Interactive map with clustered markers
- Advanced filtering (day, time, type, location)
- Search with autocomplete suggestions
- Mobile-responsive Airbnb-style card layout
- Meeting detail views with directions

### Developer Features
- RESTful API for all operations
- iOS SDK integration guide (ParseSwift)
- Android SDK integration guide (Parse-SDK-Android)
- Comprehensive API documentation
- Back4app Parse integration

</details>

<details>
<summary><h2>Tech Stack</h2></summary>

### Backend
| Technology | Purpose |
|------------|---------|
| Python 3.8+ | Runtime |
| Flask | Web framework |
| Requests | HTTP client |
| Nominatim | Geocoding |
| Back4app | Database (Parse) |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| Google Identity | Authentication |
| Leaflet | Maps |
| CSS3 | Styling (no frameworks) |

### Prerequisites
- Python 3.8+
- Node.js 16+
- Back4app account (<a href="https://www.back4app.com/" target="_blank">Create free</a>)
- Google Cloud Console project (for authentication)

</details>

<details>
<summary><h2>Local Development</h2></summary>

### 1. Clone the Repository

```bash
git clone https://github.com/sidekick2020/meeting-scraper.git
cd meeting-scraper
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The backend starts on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend starts on `http://localhost:3000`

### 4. Configure Back4app

1. Create a new app at <a href="https://www.back4app.com/" target="_blank">Back4app</a>
2. Navigate to **App Settings > Security & Keys**
3. Copy your **Application ID** and **REST API Key**
4. In the dashboard, click Settings and enter your credentials

</details>

<details>
<summary><h2>Project Structure</h2></summary>

```
meeting-scraper/
├── backend/
│   ├── app.py              # Flask API server
│   ├── scraper.py          # Meeting feed scraper
│   ├── requirements.txt    # Python dependencies
│   └── feeds/              # Feed configuration
├── frontend/
│   ├── public/
│   │   ├── favicon.svg     # App icon
│   │   └── index.html      # HTML template
│   └── src/
│       ├── components/     # React components
│       │   ├── AdminPanel.js
│       │   ├── MeetingsExplorer.js
│       │   ├── MeetingDetail.js
│       │   ├── DevDocs.js
│       │   └── ...
│       ├── contexts/       # React contexts
│       ├── App.js          # Main app component
│       └── App.css         # Styles
├── docs/
│   ├── MOBILE_QUICKSTART.md
│   └── screenshots/
└── README.md
```

</details>

<details>
<summary><h2>API Reference</h2></summary>

### Status & Control

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get scraper status and statistics |
| `/api/start` | POST | Start scraping process |
| `/api/stop` | POST | Stop scraping process |
| `/api/feeds` | GET | List available data feeds |

### Meetings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/meetings` | GET | List meetings with pagination |
| `/api/meetings/<id>` | GET | Get single meeting |
| `/api/meetings/<id>` | PUT | Update meeting |
| `/api/meetings/<id>` | DELETE | Delete meeting |

### Users (Admin)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | GET | List all dashboard users |
| `/api/users` | POST | Invite new user |
| `/api/users/<id>` | PUT | Update user role |
| `/api/users/<id>` | DELETE | Remove user |

</details>

## Data Schema

Each meeting record in the `Meetings` class includes:

| Field | Type | Description |
|-------|------|-------------|
| `objectId` | String | Unique identifier |
| `name` | String | Meeting name |
| `meetingType` | String | AA, NA, Al-Anon, etc. |
| `day` | Number | Day of week (0=Sun, 6=Sat) |
| `time` | String | Start time (HH:MM) |
| `address` | String | Street address |
| `city` | String | City |
| `state` | String | State abbreviation |
| `latitude` | Number | GPS latitude |
| `longitude` | Number | GPS longitude |
| `isOnline` | Boolean | Virtual meeting flag |
| `onlineUrl` | String | Zoom/video link |
| `types` | Array | Meeting type codes |

📋 **[Full Schema Documentation →](docs/SCHEMA.md)** - Complete field reference, type codes, and query examples

<details>
<summary><h2>Deployment</h2></summary>

### Docker (Recommended)

```bash
docker-compose up --build
```

### Manual Deployment

**Backend** (Render, Railway, Heroku):
```bash
cd backend
pip install -r requirements.txt
gunicorn -k eventlet -w 1 app:app
```

**Frontend** (Vercel, Netlify):
```bash
cd frontend
npm run build
# Deploy the 'build' folder
```

### Environment Variables

#### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `SMTP_HOST` | Email server (for invites) | - |
| `SMTP_USER` | Email username | - |
| `SMTP_PASS` | Email password | - |

#### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend API URL | http://localhost:5000 |
| `REACT_APP_GOOGLE_CLIENT_ID` | Google OAuth client ID | - |

</details>

## Mobile Integration

Integrate meeting data directly into your iOS and Android apps using Back4app's Parse SDK.

| Platform | SDK | Guide |
|----------|-----|-------|
| **iOS** | <a href="https://github.com/parse-community/Parse-Swift" target="_blank">ParseSwift</a> | SwiftUI + async/await examples |
| **Android** | <a href="https://github.com/parse-community/Parse-SDK-Android" target="_blank">Parse-SDK-Android</a> | Jetpack Compose + Coroutines |

### Quick Example (iOS)

```swift
// Query meetings by state
let meetings = try await ParseQuery<Meeting>()
    .where("state" == "CA")
    .order([.ascending("day"), .ascending("time")])
    .find()
```

### Quick Example (Android)

```kotlin
// Query meetings by state
val query = ParseQuery.getQuery(Meeting::class.java)
query.whereEqualTo("state", "CA")
query.orderByAscending("day")
val meetings = query.find()
```

📱 **[Full Mobile Quick Start Guide →](docs/MOBILE_QUICKSTART.md)**

The guide includes:
- Complete model definitions for both platforms
- Query examples (by state, day, type, location)
- Nearby meeting search with geolocation
- Offline caching setup
- Error handling patterns

<details>
<summary><h2>Troubleshooting</h2></summary>

### Backend Issues
- Ensure Python 3.8+ is installed
- Install all dependencies: `pip install -r requirements.txt`
- Check Back4app credentials are correct

### Frontend Issues
- Clear browser cache and localStorage
- Verify backend is running and accessible
- Check console for CORS errors

### Scraping Issues
- Some feeds may be temporarily unavailable
- Check the activity log for specific errors
- Review rate limiting on external sites

</details>

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

## Legal & Ethical Considerations

- Respects robots.txt on all scraped sites
- Implements rate limiting to avoid server overload
- Only collects publicly available meeting information
- Intended for legitimate recovery support purposes

## License

MIT License - See [LICENSE](LICENSE) for details.

## Support

- **Issues**: <a href="https://github.com/sidekick2020/meeting-scraper/issues" target="_blank">GitHub Issues</a>
- **Documentation**: <a href="https://meeting-scraper-frontend.onrender.com/docs" target="_blank">/docs endpoint</a> or via dashboard
- **Render**: See [Render Dashboards](#render-dashboards) above for direct links
- **Back4app**: <a href="https://www.back4app.com/docs" target="_blank">Back4app Documentation</a>

---

**Built with care by <a href="https://sobersidekick.com" target="_blank">Sober Sidekick</a> - You're Never Alone.**
