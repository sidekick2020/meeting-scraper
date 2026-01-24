**Fix Backend Connection Status**: Hide "Connecting to backend..." message when Parse is properly configured
- Prevents confusing UI where connecting spinner appeared even when Parse/Back4app was already initialized
- Only shows connecting status when neither Flask backend nor Parse is available
