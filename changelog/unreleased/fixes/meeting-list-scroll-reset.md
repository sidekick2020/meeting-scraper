**Fix Meeting List Scroll Reset and Filter Flickering**: Resolved issues with scroll position resetting and list flickering when toggling filters
- Batched thumbnail state updates to prevent 20+ rapid re-render cycles
- Use stable memoized meeting ID keys for scroll restoration dependencies
- Changed filteredMeetings from useState + useEffect to useMemo for synchronous updates
- Eliminates visible flicker when toggling Online/Hybrid filters
