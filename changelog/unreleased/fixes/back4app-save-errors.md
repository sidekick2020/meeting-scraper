**Fix Back4app Save Errors**: Resolve "Nested keys should not contain '$' or '.' characters" errors
- Added `sanitize_keys_for_parse()` function to recursively sanitize dictionary keys before saving to Back4app/Parse
- Replaces `$` with `_dollar_` and `.` with `_dot_` in all nested key names
- Applied sanitization to single meeting saves, batch saves, and scrape history saves
- Failed saves are already tracked in real-time and saved to the ScrapeHistory class for analysis
