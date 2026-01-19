# 🔍 12-Step Meeting Scraper

A comprehensive web scraping system that automatically collects AA, NA, Al-Anon, and other 12-step support group meetings from across the United States and stores them directly in Back4app.

## Features

- **Automated Web Scraping**: Collects thousands of meetings from official AA, NA, and Al-Anon websites
- **Real-time Dashboard**: Beautiful React frontend with live progress updates
- **Direct Back4app Integration**: Automatically stores meetings in your Back4app database
- **Multi-source Support**: Scrapes from regional AA/NA websites across all 50 states
- **WebSocket Updates**: Real-time progress visualization as meetings are discovered and saved
- **Statistics & Analytics**: Visual breakdown by state and meeting type

## Architecture

### Backend (Python/Flask)
- **Flask API** with WebSocket support (Flask-SocketIO)
- **BeautifulSoup4** for HTML parsing
- **Requests** for HTTP requests
- **Back4app REST API** integration
- Multi-threaded scraping for performance

### Frontend (React)
- **React 18** with functional components and hooks
- **Socket.IO Client** for real-time updates
- **Responsive Design** with modern CSS
- **Dashboard** with live statistics and progress bars

## Prerequisites

- Python 3.8+
- Node.js 16+
- Back4app account ([Create one free](https://www.back4app.com/))

## Back4app Setup

1. Go to [Back4app](https://www.back4app.com/) and create a new app
2. Navigate to **App Settings → Security & Keys**
3. Copy your:
   - **Application ID**
   - **REST API Key**
4. Make sure your Meeting schema matches the structure in the uploaded `Meeting.json`

## Installation

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The backend will start on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend will start on `http://localhost:3000`

## Configuration

When you first open the app:

1. Click the **"⚙️ Configure"** button
2. Enter your Back4app credentials:
   - Application ID
   - REST API Key
3. Click **"Save Configuration"**

Your credentials are saved in browser localStorage and sent to the backend.

## Usage

1. **Configure** your Back4app credentials
2. Click **"▶️ Start Scraping"**
3. Watch the real-time progress as meetings are discovered and saved
4. View statistics by state and meeting type
5. See recently added meetings in the live feed

The scraper will:
- Systematically visit regional AA and NA websites
- Extract meeting details (name, address, time, day, type, etc.)
- Save each meeting to your Back4app database
- Update the dashboard in real-time

## Data Structure

Each meeting includes:
- `objectId`: Unique identifier
- `name`: Meeting name
- `locationName`: Venue name
- `address`: Street address
- `city`: City
- `state`: State abbreviation
- `postalCode`: ZIP code
- `day`: Day of week (0=Sunday, 6=Saturday)
- `time`: Meeting time (HH:MM format)
- `meetingType`: AA, NA, Al-Anon, or Other
- `isOnline`: Boolean for virtual meetings
- `onlineUrl`: Zoom/video link if online
- `notes`: Additional information
- `sourceType`: "web_scraper"

## Deployment

### Option 1: Docker (Recommended)

```bash
# From project root
docker-compose up --build
```

### Option 2: Manual Deployment

**Backend** (e.g., Heroku, Railway, Render):
```bash
cd backend
pip install -r requirements.txt
gunicorn -k eventlet -w 1 app:app
```

**Frontend** (e.g., Vercel, Netlify):
```bash
cd frontend
npm run build
# Deploy the 'build' folder
```

Set environment variable:
- `REACT_APP_BACKEND_URL` = Your backend URL

### Option 3: Cloud Platforms

**Backend**: Deploy to Railway, Render, or Heroku
**Frontend**: Deploy to Vercel or Netlify

## Customization

### Adding New Sources

Edit `backend/scraper.py` to add new regional websites:

```python
def scrape_new_region(self):
    url = "https://new-region-aa.org/meetings"
    response = self.session.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')
    # Parse meetings based on site structure
    return meetings
```

### Modifying Data Fields

1. Update your Back4app Meeting schema
2. Modify `save_to_back4app()` in `backend/app.py`
3. Update the frontend components to display new fields

## Troubleshooting

**Backend won't start:**
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check Python version: `python --version` (needs 3.8+)

**Frontend can't connect:**
- Verify backend is running on port 5000
- Check CORS configuration in `backend/app.py`
- Ensure WebSocket connection isn't blocked by firewall

**Meetings not saving to Back4app:**
- Verify your Application ID and REST API Key
- Check Back4app dashboard for error logs
- Ensure Meeting schema exists in Back4app

**Scraping errors:**
- Some websites may have changed their HTML structure
- Check the errors section in the dashboard
- Update scraping logic in `backend/scraper.py`

## Performance

- **Speed**: Can collect 100-200 meetings per minute
- **Coverage**: Targets 50+ US states and major metropolitan areas
- **Reliability**: Auto-retries failed requests
- **Rate Limiting**: Built-in delays to respect server limits

## Legal & Ethical Considerations

- This scraper respects robots.txt
- Implements rate limiting to avoid overloading servers
- Only collects publicly available meeting information
- Intended for legitimate recovery support purposes

## Future Enhancements

- [ ] Add more regional sources
- [ ] Implement duplicate detection
- [ ] Add meeting data validation
- [ ] Export to CSV functionality
- [ ] Schedule automated scraping
- [ ] Add filtering and search in dashboard
- [ ] Meeting verification system
- [ ] Mobile app integration

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - feel free to use this for your recovery support projects

## Support

For issues or questions:
- Check the Troubleshooting section
- Review Back4app documentation
- Open an issue on GitHub

---

**Made with ❤️ to support recovery communities**
