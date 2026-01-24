**Meetings List Scroll Stability**: Fixed scroll position resetting to top when thumbnails load in background
- Uses meeting ID anchoring instead of raw scroll position
- Detects actual data changes by comparing meeting IDs (not object references)
- Preserves scroll position when same meetings get thumbnail updates
