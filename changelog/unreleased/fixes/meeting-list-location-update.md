**Fix meeting list not loading after location update**: Fixed race conditions where selecting a new location from search would cause the meeting list to show 0 meetings or stale data
- The map fires both `moveend` and `zoomend` events when panning, but the programmatic pan flag was only protecting against the first event - added debounced reset to handle rapid successive events
- Fixed mismatch between the request deduplication key (using filtersRef) and actual API call (using closure variables) which could cause wrong filters to be applied
- Fixed the meeting count display to show accurate "showing X of Y" text instead of a hardcoded value
