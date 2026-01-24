**Direct Parse SDK Queries**: Public frontend now queries Back4app directly, bypassing the backend
- Added `fetchMeetings()` and `fetchMeetingsByState()` methods to ParseContext
- MeetingsExplorer uses Parse SDK directly when available, falls back to backend API
- MeetingMap state-level data fetched directly from Parse SDK
- Reduces load on Render-hosted backend server
- Improves latency for public users (one less network hop)
- Backend now focuses on scraping and admin functions only
