**Version History Tab**: New Version History tab in Settings showing merged pull requests
- Displays PR history with number, title, and type badges (Feature, Bug Fix, Improvement, etc.)
- Shows merge date, branch name, and commit count for each PR
- Expandable cards reveal individual commits within each PR
- Direct links to view PRs on GitHub
- New `/api/pr-history` endpoint extracts PR data from git merge commits
- 10-minute caching for optimal performance
