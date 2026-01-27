**Meetings Page Fix**: Fixed crash caused by variable initialization order error
- Moved `hasActiveFilters` declaration before `clearFilters` callback to fix Temporal Dead Zone error
- The variable was being referenced in useCallback dependency array before initialization
- Error manifested as "Cannot access 'Kt' before initialization" in production build
