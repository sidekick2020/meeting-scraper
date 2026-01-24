**Back4App as Source of Truth for Scrape History**: Improved data reliability
- Back4App is now the primary source of truth for scrape history data
- Server writes to Back4App first, then updates local cache
- Added CacheManager-based caching with 2-minute TTL for performance
- Added `?refresh=true` query parameter to force fresh Back4App fetch
- Response includes `source` field indicating data origin (cache/back4app/memory_fallback)
- In-memory cache serves as fallback during Back4App outages
