**Map Heatmap Caching**: Improved map performance with persistent heatmap caching
- Heatmaps now persist from cache while loading fresh data (stale-while-revalidate pattern)
- Added region-based cache keys for better cache hit rates across similar map views
- Subtle "Updating..." indicator shows when cached data is displayed while fetching fresh data
- Reduced perceived latency when panning/zooming by showing cached data immediately
