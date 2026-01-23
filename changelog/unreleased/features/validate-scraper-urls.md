**URL Validation and Draft Scripts**: Enhanced source discovery with live URL validation and draft script management
- URL patterns are now validated before being suggested - only shows URLs that actually return meeting data
- New "Try" button attempts to scrape the site and generates a Python script based on findings
- Generated scripts are saved as drafts in the source section for later review
- Click on any draft to expand and see the full Python script with copy functionality
- Drafts track meeting count, feed type, and validation status
- Toggle between "validated only" (slower, more accurate) and "all patterns" (faster) discovery modes
- Backend endpoints for draft CRUD operations (`/api/sources/drafts`, `/api/sources/try-scrape`, `/api/sources/validate-url`)
