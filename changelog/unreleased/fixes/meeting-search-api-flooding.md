**Meeting Search API Request Flooding**: Fix duplicate API calls when searching for meetings
- Fixed MeetingsExplorer.js callback dependency cascade causing 50+ duplicate /api/meetings calls
- Fixed AdminPanel.js duplicate polling interval setup for /api/status
- Applied same ref-based pattern used in MeetingMap.js heatmap fix (commit 919924e)
