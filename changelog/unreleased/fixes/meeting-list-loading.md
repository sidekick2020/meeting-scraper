**Meeting List Loading**: Fixed issue where meeting list would remain stuck on "Loading meetings..." even when the map showed data
- Removed race condition where initial no-bounds fetch could overwrite bounds-filtered results
- Auto-fetch now triggers reliably when map has data but list is empty
- List now properly queries database for meetings within the visible map bounds
