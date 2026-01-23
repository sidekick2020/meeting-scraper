**Simplified MapView Bounds Loading**: Dramatically simplified the public meeting list loading logic
- Meetings now load based on map bounds with a fixed limit of 50
- Removed complex network-adaptive batch loading
- Removed infinite scroll in favor of simple bounds-based queries
- Filters are applied server-side for better performance
- Client-side filtering retained only for search queries and accessibility options
