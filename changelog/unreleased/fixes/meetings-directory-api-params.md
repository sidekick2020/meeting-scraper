**Fixed Meetings Directory Not Loading**: Corrected API parameter names and improved error handling
- Directory was sending `meetingType`, `isOnline`, `isHybrid` instead of `type`, `online`, `hybrid`
- Backend ignored unrecognized parameters, causing filters not to work
- Added support for in-person filter (online=false) in backend
- Added error display and retry button when directory fetch fails
- Simplified fetch trigger to ensure meetings always load when opening directory
