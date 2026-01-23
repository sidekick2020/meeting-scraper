**Fix Map Loading Memory Leaks**: Fixed memory leaks in the map component
- Added missing AbortController cleanup when MapDataLoader unmounts, preventing fetch requests from hanging
- Added mounted flag to HeatmapLayer to prevent dynamic import callbacks from executing after unmount
