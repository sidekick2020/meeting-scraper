**Admin Connection Status**: Fixed false "Disconnected" status in admin panel
- Connection status now derived from Parse/Back4app initialization (permanent once configured)
- Removed unreliable polling-based connection detection
- Shows "Not Configured" instead of "Disconnected" when Parse keys are missing
