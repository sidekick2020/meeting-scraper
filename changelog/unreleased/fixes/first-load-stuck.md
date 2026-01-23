**Fix First Load Stuck Issue**: Resolved a race condition that could cause the meetings list to remain stuck in a loading state on first load
- Fixed React Strict Mode compatibility issue with initial fetch effect
- Added proper cleanup handling to prevent stale state updates
- Ensured loading state is properly cleared even when effects are re-run
