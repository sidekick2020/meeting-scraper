**Fix Admin Directory Display**: Resolved issue where the admin console meeting directory showed empty results
- Fixed race condition in useEffect caused by `cachedDirectory` creating new object references on each render
- Added ref-based guard to prevent infinite fetch loop when clearing meetings during filter changes
- Directory now properly loads and displays meetings when navigating to the section
