**Coverage Analysis Speed Fix**: Added backend API fallback for faster loading
- Coverage analysis now falls back to backend `/api/coverage` endpoint when Parse SDK is unavailable
- Backend uses efficient MongoDB aggregate query instead of batch fetching
- Eliminates "Unable to connect to Parse API" errors that caused infinite loading
