**Fix card skeleton flicker**: Resolved issue where meeting card skeletons would flash over existing data during refresh operations
- Skeleton placeholders now only appear during initial load or pagination
- When refreshing existing data, cards remain visible with a "Loading..." indicator in the header
- Map cluster and state marker clicks no longer trigger duplicate zoom events from the heatmap click handler
