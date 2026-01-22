**Backend Connection Stability**: Fixed race condition in meeting directory
- MeetingsExplorer now waits for connection status to resolve before fetching data
- Added `isConnectionReady` helper to ParseContext for consistent connection state checking
- Eliminates redundant connection attempts and provides stable, singular connection management
