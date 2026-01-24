**Heatmap Indicator Pre-computation**: Background job to pre-compute clustered heatmap data at 5 zoom tiers
- Creates hierarchical clusters with parent-child relationships for efficient drill-down navigation
- Pre-computes clusters for multiple filter types (all, AA, NA, Al-Anon, Other, and per-state)
- Adds `clusterKey` field to meetings for direct cluster-to-meeting lookup
- Admin endpoints: `/api/admin/heatmap-indicators/generate` and `/api/admin/heatmap-indicators/status`
- Query endpoints: `/api/heatmap-indicators`, `/api/heatmap-indicators/<grid_key>/children`, `/api/heatmap-indicators/<grid_key>/meetings`
- Automatically regenerates indicators after successful scrape completion
- Existing `/api/meetings/heatmap` endpoint now uses pre-computed indicators when available
