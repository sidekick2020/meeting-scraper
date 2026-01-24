**Meeting Tile Flicker Fix**: Fixed flickering of meeting tile covers and scroll position resetting when browsing meetings
- Replaced unstable index-based React keys with stable composite keys
- Meeting cards, map markers, and clusters now maintain identity across re-renders
- Prevents unnecessary component unmount/remount cycles
