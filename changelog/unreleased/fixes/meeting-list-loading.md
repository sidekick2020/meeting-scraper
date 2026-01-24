**Meeting List Loading**: Fixed loading indicator and search panning issues
- Added missing `isLoading` state check to loading indicator condition so it properly hides once data fetch completes
- Fixed map not panning when searching for a location by setting programmatic pan flag before geocoding
- Search auto-pan now preserves filters instead of clearing them
