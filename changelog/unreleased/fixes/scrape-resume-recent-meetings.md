**Scrape Resume Recent Meetings**: Fixed "Recently Added Meetings" showing empty when resuming a scrape
- When resuming a scrape, the recent meetings list now fetches the last 20 meetings from the database
- Previously, the list was always reset to empty on resume, showing "No Meetings Yet" despite saved meetings
