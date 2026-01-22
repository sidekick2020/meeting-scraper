**Build Performance Optimizations**: Prevent stuck builds and improve CI reliability
- Add 45-minute timeout to build jobs to prevent infinite hangs
- Add notarization timeout (25 min) with automatic retry (up to 3 attempts)
- Add progress logging during notarization (updates every 2 minutes)
- Improve caching: include npm cache and electron-builder cache
- Use `npm ci --prefer-offline` for faster, reproducible installs
