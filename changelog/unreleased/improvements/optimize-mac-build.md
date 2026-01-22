**Optimized Mac Build Workflow**: Significantly faster Mac builds with multiple improvements
- Universal binary option: Single build for both Apple Silicon and Intel (one notarization instead of two)
- Conditional notarization: `mac-v*` tags skip notarization for fast test builds (~5 min vs ~30 min)
- Improved caching: Direct node_modules caching for faster installs
- Workflow dispatch options: Choose build mode and skip notarization manually
