**Fix API Status Polling Pile-up**: Prevent concurrent status requests from accumulating
- Added request-in-flight tracking to skip polling if a previous request is still pending
- Implemented AbortController for proper request cancellation on component unmount
- Fixes issue where slow server responses caused dozens of concurrent API requests
