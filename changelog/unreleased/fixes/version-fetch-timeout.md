**Fix version check timeout errors**: Resolved "signal is aborted without reason" errors during backend cold starts
- Fixed `DeploymentBanner.js` to use proper `AbortController` instead of invalid `timeout` option
- Increased timeout from 10s to 30s to accommodate Render cold start delays
