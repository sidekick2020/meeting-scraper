**Optimize Meeting Loading**: Significantly reduced load times for meeting list and map

- Added server-side caching for meeting queries (3 min TTL), heatmap data (5 min TTL), and state counts (10 min TTL)
- Implemented background pre-caching at startup for state counts and default heatmap view
- Added new `/api/meetings/initial-load` endpoint that returns meetings, state counts, and metadata in a single request
- Reduced redundant Back4app API calls through intelligent cache key management
- Connection pooling now used consistently across all Back4app requests
