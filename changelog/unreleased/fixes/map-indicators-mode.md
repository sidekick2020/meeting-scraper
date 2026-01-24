**Map Indicators Not Showing**: Fixed cluster indicators not displaying on the map
- Backend returns `mode='indicators'` for pre-computed data, but frontend only checked for `mode='clustered'`
- Updated condition to accept both modes so cluster markers display correctly at zoom levels 6-12
