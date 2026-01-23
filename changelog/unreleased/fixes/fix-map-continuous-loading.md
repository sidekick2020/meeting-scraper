**Fix Map Continuous Loading**: Fixed an issue where the map would continuously reload data
- The map now only performs initial data fetch once, instead of re-fetching when callbacks change
- Uses refs to store callbacks to prevent useEffect from re-running unnecessarily
- Data now loads only after user interaction (zoom/pan) as expected
