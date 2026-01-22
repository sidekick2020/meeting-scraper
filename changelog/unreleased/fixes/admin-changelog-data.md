**Admin Changelog Always Shows Data**: Refactored changelog API to always include unreleased fragments
- Added `parse_unreleased_fragments()` function to read from changelog/unreleased/ directories
- Unreleased changes now appear as first entry in Release Notes with "Unreleased" label
- Works even if CHANGELOG.md is missing or empty - fragments always provide data
- Maps fragment directories to sections: features -> New Features, fixes -> Bug Fixes, improvements -> UI/UX Improvements
