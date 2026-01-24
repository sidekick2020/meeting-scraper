**Fix meeting list not loading after location update**: Fixed a race condition where selecting a new location from search would cause the meeting list to show 0 meetings
- The map fires both `moveend` and `zoomend` events when panning, but the programmatic pan flag was only protecting against the first event
- Added debounced reset of the programmatic pan flag to handle rapid successive events
- Also fixed the meeting count display to show accurate "showing X of Y" text instead of a hardcoded value
