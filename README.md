# Sober Sidekick - 12-Step Meeting Finder

A comprehensive meeting management system by [Sober Sidekick](https://sobersidekick.com) that aggregates AA, NA, Al-Anon, and other 12-step support group meetings from across the United States. Built with React and Python/Flask, powered by Back4app.

**You're Never Alone.**

## Overview

This system provides:

- **Admin Dashboard** - Manage and monitor meeting data with a modern, responsive interface
- **Public Meeting Directory** - Airbnb-style browsable interface for finding meetings
- **Data Scraper** - Automated collection from official 12-step organization feeds
- **Mobile SDK Support** - iOS and Android integration guides included
- **Real-time Analytics** - Coverage analysis and statistics by state/region

## Features

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

## Tech Stack

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

## Prerequisites

- Python 3.8+
- Node.js 16+
- Back4app account ([Create free](https://www.back4app.com/))
- Google Cloud Console project (for authentication)

## Try It Now

**Production Version**: Visit the live app hosted on Render:
- **Frontend**: [https://meeting-scraper-frontend.onrender.com](https://meeting-scraper-frontend.onrender.com)
- **Admin Dashboard**: Click "Admin" in the top right to access the dashboard

No setup required - just browse meetings or sign in with Google to access admin features.

---

## Local Development

If you prefer to run the app locally:

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

1. Create a new app at [Back4app](https://www.back4app.com/)
2. Navigate to **App Settings > Security & Keys**
3. Copy your **Application ID** and **REST API Key**
4. In the dashboard, click Settings and enter your credentials

## Project Structure

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
└── README.md
```

## API Reference

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

## Deployment

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

Set environment variable:
- `REACT_APP_BACKEND_URL` = Your backend URL

## Mobile Integration

The documentation includes comprehensive guides for integrating meeting data into mobile apps:

- **iOS**: ParseSwift SDK with SwiftUI examples
- **Android**: Parse-SDK-Android with Jetpack Compose examples

Access these guides from the Docs section in the admin dashboard.

## Data Schema

Each meeting record includes:

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

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `SMTP_HOST` | Email server (for invites) | - |
| `SMTP_USER` | Email username | - |
| `SMTP_PASS` | Email password | - |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend API URL | http://localhost:5000 |
| `REACT_APP_GOOGLE_CLIENT_ID` | Google OAuth client ID | - |

## Troubleshooting

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

- **Issues**: [GitHub Issues](https://github.com/sidekick2020/meeting-scraper/issues)
- **Documentation**: Access from the Docs section in the dashboard
- **Back4app**: [Back4app Documentation](https://www.back4app.com/docs)

---

**Built with care by [Sober Sidekick](https://sobersidekick.com) - You're Never Alone.**
