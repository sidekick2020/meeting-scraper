# 🚀 Dev Team Guide: Building Fast with Claude Code

> *"The key isn't that Claude writes perfect code—it's that the iteration cycle is so fast that you can ship, test, and refine continuously."*

---

|  |  |
|--|--|
| 🌐 **Production** | [meetings.sobersidekick.com](https://meetings.sobersidekick.com) |
| 📊 **Stats** | 54 PRs · 230+ commits · Weeks not months |
| 🛠️ **Stack** | React + Flask + Back4app |

---

## ⚠️ Important: Admin Access

> **🛑 Do not perform any admin operations without onboarding from me first.**
>
> The admin console controls live production data for thousands of meetings. Before you:
> - Run any scrape operations
> - Edit or delete meetings
> - Manage users or permissions
> - Change any settings
>
> **Schedule a 15-minute walkthrough with me.** I'll show you the ropes and make sure you're set up for success.

---

## 🔐 Admin Console Login

| Step | Action |
|------|--------|
| 1️⃣ | Go to [meetings.sobersidekick.com](https://meetings.sobersidekick.com) |
| 2️⃣ | Click the **"Admin"** button (top-right corner) |
| 3️⃣ | Sign in with your **Google account** |
| 4️⃣ | If access denied → Ask me to add your email to the allowed list |

---

## 📱 What Users See (Public Features)

The public-facing meeting finder that helps people in recovery:

| Feature | What it does |
|---------|--------------|
| 🗺️ **Interactive Map** | Clustered markers that expand on zoom, state-level heatmaps showing meeting density |
| 🔍 **Smart Search** | Pick multiple days, filter by 13 meeting types, location autocomplete with recent searches |
| 🃏 **Meeting Cards** | Beautiful Airbnb-style cards with mini static maps for each location |
| 📍 **Quick Actions** | "Navigate" opens Google Maps directions; "Join Meeting" opens video call links |
| 📱 **Mobile Ready** | Fully responsive—works great on phones and tablets |

---

## 🛠️ What Admins See (Dashboard Features)

The control center for managing meeting data:

| Feature | What it does |
|---------|--------------|
| ⚡ **Data Scraper** | One-click import from 50+ regional AA/NA feeds across the US |
| 📈 **Coverage Analysis** | Interactive state heatmaps, population-weighted stats, gap identification |
| 📋 **Meeting Directory** | Search, filter, bulk edit—manage thousands of meetings efficiently |
| 👥 **User Management** | Invite team members via email, assign Standard or Admin roles |
| 📜 **Scrape History** | Full audit trail—who scraped what, when, with per-source breakdowns |
| 🔄 **API Versioning** | Toggle between stable and beta API versions in Settings |
| 🚦 **Deploy Status** | Real-time indicator when frontend or backend is deploying |

---

## 💡 How to Ship Fast with Claude Code

### 1. Write Clear, Specific Prompts

```
✅ Good: "Add a loading overlay with darkened background that shows
         timestamped status logs while connecting to the backend"

❌ Bad:  "Make the loading better"
```

The more specific you are about the *what* and the *how*, the better the result.

---

### 2. Use Feature Branches

Every PR follows the pattern: `claude/<feature>-<session-id>`

```
claude/add-loading-overlay-WCAPa
claude/state-coverage-heatmap-r2Nlt
claude/simplify-scrape-workflow-7jMoQ
```

This keeps `main` clean and makes code review straightforward.

---

### 3. Break Down Big Features

| ❌ Instead of... | ✅ Try this... |
|-----------------|----------------|
| "Build an admin dashboard" | 1. "Add Google Sign-In authentication" |
| | 2. "Create a meeting directory with search" |
| | 3. "Add coverage analysis with state statistics" |
| | 4. "Implement the data scraper with progress logs" |

Smaller tasks = faster feedback = better results.

---

### 4. Ship Small, Ship Often

Our version history tells the story:

```
v1.5.0 → Efficient heatmap view
v1.5.1 → Light mode improvements
v1.5.2 → Admin directory filters
v1.5.3 → State bubble click-to-filter
v1.5.4 → Script generation for tasks
```

Each release is focused. Don't bundle unrelated changes.

---

### 5. Let Claude Read First

Claude works best when it understands existing code before making changes:

- *"Fix the search bar"* → Claude reads `MeetingsExplorer.js` first
- *"Add a new API endpoint"* → Claude reads `app.py` first

This ensures new code matches existing patterns and style.

---

### 6. Use Changelog Fragments

We avoid merge conflicts with a fragment system:

```bash
# Create a fragment instead of editing CHANGELOG.md
echo '**My Feature**: What it does' > changelog/unreleased/features/my-feature.md
```

Fragments auto-compile on release. See `CLAUDE.md` for details.

---

### 7. Review Like Any Other PR

Claude generates PR summaries with test plans. Treat them like any code review:

- ✅ Read the diff carefully
- ✅ Test the feature locally
- ✅ Request changes if something's off

---

## 🏃 Quick Start

```bash
# Clone the repo
git clone https://github.com/sidekick2020/meeting-scraper.git
cd meeting-scraper

# Terminal 1: Backend
cd backend && pip install -r requirements.txt && python app.py

# Terminal 2: Frontend
cd frontend && npm install && npm start
```

Open **http://localhost:3000** → Configure Back4app credentials in Settings.

---

## 📁 Key Files

| File | What it's for |
|------|---------------|
| `frontend/src/components/AdminPanel.js` | Main admin dashboard UI |
| `frontend/src/components/MeetingsExplorer.js` | Public meeting browser |
| `backend/app.py` | Flask API server |
| `backend/scraper.py` | Meeting feed scraper logic |
| `CLAUDE.md` | Instructions for Claude Code sessions |

---

## 📚 Resources

| Link | Description |
|------|-------------|
| [Production Site](https://meetings.sobersidekick.com) | Live application |
| [API Docs](https://meetings.sobersidekick.com/docs) | Developer documentation |
| [GitHub Repo](https://github.com/sidekick2020/meeting-scraper) | Source code & issues |

---

<p align="center">
  <strong>Built with ❤️ by Sober Sidekick</strong><br>
  <em>You're Never Alone.</em>
</p>
