**Fix Meeting List Scroll Reset**: Resolved issue where the meeting list scroll position would reset to top when thumbnails load
- Batched thumbnail state updates to prevent 20+ rapid re-render cycles
- Use stable memoized meeting ID keys for scroll restoration dependencies
- Eliminates race conditions between thumbnail loading and scroll restoration
