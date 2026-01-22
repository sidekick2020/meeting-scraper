**Parse Connection Consolidation**: Optimized Parse/Back4app connection handling
- Removed redundant `/api/config` fetch calls from App, LoadingOverlay, MeetingsExplorer, and AdminPanel
- All components now use single `useParse()` hook for connection status
- Parse SDK initializes synchronously at module load time (before React renders)
- Reduces initial page load network requests from 5+ to 1
- Single source of truth for Parse/Back4app configuration and connection status
