**Amplitude Analytics Integration**: Comprehensive analytics tracking throughout the application
- Added AnalyticsContext for centralized event tracking with Amplitude SDK
- Tracks all public user flows: search queries, filter changes, map interactions, meeting views
- Tracks online meetings page: fellowship filters, time-of-day filters, meeting selections
- Tracks admin actions: scraper start/stop/reset, tab navigation, settings access
- Tracks authentication events: sign-in success/failure, sign-out with user identification
- Tracks navigation events: sidebar navigation, theme toggle, page views
- Supports user identification for admin users
- Environment variable `REACT_APP_AMPLITUDE_API_KEY` configures the API key
- Gracefully degrades when API key is not configured (logs events in development)
