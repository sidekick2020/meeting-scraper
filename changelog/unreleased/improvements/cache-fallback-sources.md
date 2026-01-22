**Sources Menu Cache Fallback**: Improved sources selection menu with cache fallback and default selection
- Uses cached sources as fallback while loading the full list, eliminating loading skeleton when cache is available
- Shows subtle "Refreshing..." indicator when updating cached data
- Added "Never Scraped" quick-select button for sources that have never been scraped
- Changed default selection to only include sources that have never been scraped (instead of never scraped + older than 7 days)
