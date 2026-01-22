# Dev Team Guide: Building Fast with Claude Code

**Project:** Sober Sidekick Meeting Finder
**Production Site:** [meetings.sobersidekick.com](https://meetings.sobersidekick.com)
**Built with:** 54 PRs, 230+ commits, powered by Claude Code

---

## What We Built

A comprehensive 12-step meeting finder aggregating AA, NA, and Al-Anon meetings from across the United States. In just weeks, we shipped a full-stack application with:

- **React frontend** with interactive maps (Leaflet)
- **Python/Flask backend** with automated data scraping
- **Back4app database** integration
- **Mobile SDK documentation** for iOS and Android

---

## Admin Console Access

**URL:** [meetings.sobersidekick.com](https://meetings.sobersidekick.com) → Click **"Admin"** button (top-right)

**Login:** Google Sign-In with an authorized account. Contact your administrator to add your Google account to the allowed users list.

---

## Feature Overview

### Consumer Features (Public Directory)
| Feature | Description |
|---------|-------------|
| **Interactive Map** | Clustered markers, zoom-to-state, heatmap visualization |
| **Advanced Search** | Multi-day selection, meeting type filters, location autocomplete |
| **Meeting Cards** | Airbnb-style cards with static map images |
| **Meeting Details** | Navigate (Google Maps) and Join Meeting buttons |
| **Mobile Responsive** | Works on all devices |

### Admin Features (Dashboard)
| Feature | Description |
|---------|-------------|
| **Data Scraper** | One-click scraping from 50+ regional feeds |
| **Coverage Analysis** | State-by-state heatmaps and statistics |
| **Meeting Directory** | Search, filter, and edit meetings |
| **User Management** | Invite team members, assign roles |
| **Scrape History** | Per-source audit trail with timestamps |
| **API Versioning** | Switch between stable/beta API versions |
| **Deployment Indicator** | Real-time frontend/backend deployment status |

---

## How to Ship Fast with Claude Code

### 1. Start with Clear, Specific Prompts

```
Good: "Add a loading overlay with darkened background that shows
       timestamped status logs while connecting to the backend"

Bad:  "Make the loading better"
```

Real example from our commit history: The loading overlay feature was implemented in a single PR with a clear description of the visual design (darkened backdrop, blur effect, timestamped logs, auto-retry).

### 2. Use Feature Branches Liberally

Every PR in this project followed the pattern `claude/<feature>-<session-id>`:
- `claude/add-loading-overlay-WCAPa`
- `claude/state-coverage-heatmap-r2Nlt`
- `claude/simplify-scrape-workflow-7jMoQ`

This keeps main clean and makes it easy to review isolated changes.

### 3. Break Down Complex Work

Instead of: "Build an admin dashboard"

Try:
1. "Add Google Sign-In authentication"
2. "Create a meeting directory with search"
3. "Add coverage analysis with state statistics"
4. "Implement the data scraper with progress logs"

### 4. Iterate in Small PRs

Our changelog shows the pattern:
- v1.5.0 → Efficient heatmap view
- v1.5.1 → Light mode improvements
- v1.5.2 → Admin directory filters
- v1.5.3 → State bubble click-to-filter
- v1.5.4 → Script generation for tasks

Each release is small and focused. Ship often.

### 5. Let Claude Read First

Claude Code works best when it reads existing code before making changes. When you say:
- "Fix the search bar" → Claude reads MeetingsExplorer.js first
- "Add a new API endpoint" → Claude reads app.py first

This ensures changes fit the existing patterns and style.

### 6. Use the Changelog Fragments System

We created a system specifically to avoid merge conflicts:

```bash
# Create a fragment instead of editing CHANGELOG.md directly
echo '**Feature Name**: Description' > changelog/unreleased/features/my-feature.md
```

Fragments are auto-compiled on release. See `CLAUDE.md` for details.

### 7. Review Claude's PRs Like Any Other

Claude generates descriptive PR summaries with test plans. Review them critically:
- Check the diff
- Test the feature
- Request changes if needed

---

## Quick Start for New Team Members

```bash
# Clone and run locally
git clone https://github.com/sidekick2020/meeting-scraper.git
cd meeting-scraper

# Backend (terminal 1)
cd backend && pip install -r requirements.txt && python app.py

# Frontend (terminal 2)
cd frontend && npm install && npm start
```

Open http://localhost:3000 and configure Back4app credentials in Settings.

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `frontend/src/components/AdminPanel.js` | Main admin dashboard |
| `frontend/src/components/MeetingsExplorer.js` | Public meeting browser |
| `backend/app.py` | Flask API server |
| `backend/scraper.py` | Meeting feed scraper |
| `CLAUDE.md` | Instructions for Claude Code sessions |

---

## The Results

By using Claude Code effectively, we achieved:
- **54 merged PRs** in rapid succession
- **230+ commits** with clear, descriptive messages
- **Full-stack features** shipped in hours, not days
- **Consistent code style** across the entire codebase

The key isn't that Claude writes perfect code—it's that the iteration cycle is so fast that you can ship, test, and refine continuously.

---

**Questions?** Check the [/docs endpoint](https://meetings.sobersidekick.com/docs) or open an issue on GitHub.

*Built with care by Sober Sidekick — You're Never Alone.*
