**Meeting List Location Search**: Fixed issue where the meeting list didn't update when searching for a location on the map
- Map pins would update after location search, but the meeting list remained empty
- Caused by searchQuery filter using Nominatim's full display name which didn't match meeting data
- Now clears searchQuery when selecting a location, relying on proper city/state filters instead
