**Parse JS SDK Integration**: Added proper Parse SDK initialization for direct Back4app access
- Initialize Parse SDK synchronously at module load time (before React renders)
- Created ParseContext with useParse() hook for component access
- Enables direct database queries from frontend (optional, backend proxy still works)
- Includes connection status monitoring and offline caching support
- Follows Parse best practices: initialize once at app entry point
