**State Marker Click Fix**: Fixed issue where clicking state markers on the map didn't properly zoom and load meetings
- Set programmatic pan flag before state click to prevent filter clearing
- Added state and city filters to map bounds change handler
- Ensures meetings load correctly when clicking state bubbles
