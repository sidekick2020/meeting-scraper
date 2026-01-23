**Fix Parse/Back4App Connection**: Fixed initialization order bug that broke all data loading
- Backend session headers were being set before environment variables were defined
- Moved BACK4APP_APP_ID and BACK4APP_REST_KEY definitions before session initialization
- Meetings, scrape history, and all Back4App data now load correctly
