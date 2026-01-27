**Pause Meeting Finder in Background**: Meeting finder API requests are now paused when viewing the admin panel
- Reduces unnecessary API calls when the admin panel is in the foreground
- Meeting finder state (filters, map position) is preserved when switching views
- Data fetching resumes automatically when returning to the meeting finder
