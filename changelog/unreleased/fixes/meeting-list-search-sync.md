**Meeting List Not Syncing with Location Search**: Fixed issue where the meeting list showed "0 meetings" while the map displayed meeting clusters when searching for a location
- When searching for a location via Nominatim (typing or clicking autocomplete suggestions), the city filter was being set based on Nominatim's response
- The city filter uses exact match, but Nominatim city names often don't match database values (case sensitivity, format differences)
- Now clears state/city filters for Nominatim-based location searches and relies on geographic bounds for filtering
- The header still displays the correct location name via mapCenterLocation
