**Fix Map Thumbnail Loading Failures**: Throttle concurrent thumbnail requests to prevent browser connection exhaustion
- Added throttled request queue utility that limits concurrent requests based on network speed (1-4 parallel)
- Replaced Promise.all batch approach that overwhelmed browser's 6-connection-per-host limit
- Thumbnails now load progressively as each completes rather than waiting for entire batch
- Added abort controller support to cancel pending requests when user navigates
