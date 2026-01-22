**Data Caching System**: Platform-wide data caching to improve navigation experience
- Added DataCacheContext with configurable TTL and stale-while-revalidate
- Meetings Explorer caches meetings, filters, and available states
- Admin Panel caches feeds, directory, and scraping state
- Settings Modal caches users, versions, and changelog
- Scrape History, Coverage Analysis, and Tasks Panel now cache data
- Data persists during navigation, only refreshes on manual action or TTL expiry
