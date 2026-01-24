**Fix feedbackEmails schema mismatch**: Resolve save errors when feedback_emails field is an object instead of array
- Added `normalize_to_array` helper function to handle different input formats
- Extracts email addresses from objects, strings, or arrays into a consistent array format
- Prevents "schema mismatch for Meetings.feedbackEmails; expected Array but got Object" errors
