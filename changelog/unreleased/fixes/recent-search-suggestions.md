**Fix Recent Search Suggestions**: Clicking on a recent search suggestion now properly pans the map to that location and loads meetings
- Added missing handler for 'recent' type suggestions in handleSuggestionClick
- Uses geocodeAndPanMap to find and pan to the searched location
