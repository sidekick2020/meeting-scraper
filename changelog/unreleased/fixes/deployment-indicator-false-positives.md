**Deployment Indicator Simplified**: Removed complex polling loop that caused false positives
- Removed continuous 5-second polling and failure threshold logic
- Single 60-second check for version updates (not aggressive polling)
- Indicator only appears when an actual update is available
- No more "deployment in progress" false positives from network hiccups
