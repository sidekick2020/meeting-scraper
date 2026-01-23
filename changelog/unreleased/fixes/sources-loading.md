**Fix Sources Loading State**: Fixed bug where Sources page would show "Loading sources..." forever
- Changed loading condition to use proper `feedsLoading` state instead of checking array length
- Added skeleton loading UI for sources table during loading
- Shows "No sources configured" message when sources array is actually empty
