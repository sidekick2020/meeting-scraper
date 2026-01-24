**Meeting List Scroll Fix**: Fixed choppy scrolling and scroll position resetting to top
- Added scroll position preservation using refs and useLayoutEffect
- Scroll position is maintained during client-side filtering (search/accessibility)
- Scroll resets to top appropriately when new data is fetched
- Added CSS containment and content-visibility for smoother scroll performance
