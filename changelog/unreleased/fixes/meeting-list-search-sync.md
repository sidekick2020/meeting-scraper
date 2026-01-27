**Meeting List Not Syncing with Location Search**: Fixed issue where the meeting list showed "0 meetings" while the map displayed meeting clusters when searching for a location
- When using the search bar to find a location (e.g., "Bentonville, Benton County"), the text search query was not being cleared after the map panned to the location
- This caused the client-side filter to look for meetings matching the full location string in meeting names/cities, which never matched
- Now clears the text search query when performing geographic searches via the Search button or clicking recent searches
