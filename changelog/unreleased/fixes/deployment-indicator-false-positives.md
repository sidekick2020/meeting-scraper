**Deployment Indicator False Positives**: Fixed deployment indicator appearing when no deployment is occurring
- Increased failure thresholds to be more tolerant of Render cold starts and network hiccups
- Increased backend timeout from 15s to 20s to handle slow cold starts
- Fixed interval not resetting to normal speed after connection recovers
- Indicator now requires 30+ seconds of failures before showing deployment status
