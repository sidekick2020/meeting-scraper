**Map Indicator Job Logging & Coverage Fix**: Enhanced job monitoring and fixed coverage analysis timeout
- Added detailed logging with timestamps and progress visualization for map indicator jobs
- Job logs now visible in admin console with auto-scroll during execution
- Progress shows detailed phase info (e.g., "5/42 filters", "12,500 meetings loaded")
- Fixed coverage analysis timeout by using efficient Parse aggregate API
- Increased coverage cache TTL to 15 minutes (Back4App as source of truth)
