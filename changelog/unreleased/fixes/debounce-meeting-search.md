**Meeting Search Debounce**: Fixed search input performance and behavior
- Added 300ms debounce to meeting search filter to prevent excessive re-filtering on every keystroke
- Fixed issue where empty search field would not show meetings - now immediately clears the filter when search is empty
