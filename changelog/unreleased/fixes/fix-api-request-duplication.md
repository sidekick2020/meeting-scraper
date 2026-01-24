**Fix Infinite API Request Loop**: Resolved critical bug causing 100+ duplicate requests per second
- Fixed filter-change useEffect that had callback dependencies causing infinite loops
- Now uses refs to call callbacks, only depending on filter values
- Uses Parse/Back4App directly for individual meetings at high zoom levels
