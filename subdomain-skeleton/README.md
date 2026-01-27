# Sober Sidekick Subdomain Skeleton

A GitHub template for creating new subdomain applications that share the Sober Sidekick design system.

## Quick Start

### Option 1: Use GitHub Template (Recommended)

1. Click **"Use this template"** on GitHub
2. Name your repo (e.g., `admin.sobersidekick.com`)
3. Clone and install:

```bash
git clone https://github.com/your-org/your-new-repo
cd your-new-repo
npm install
npm start
```

### Option 2: Via Claude Code MCP

When starting a new project, Claude will ask:

> "Would you like to use the Sober Sidekick subdomain skeleton?"

Select **Yes** to scaffold a new app with the shared design system.

### Option 3: Manual Clone

```bash
npx degit sidekick2020/subdomain-skeleton my-new-app
cd my-new-app
npm install
npm start
```

---

## What's Included

```
subdomain-skeleton/
├── public/
│   ├── index.html          # HTML template
│   ├── _redirects          # SPA routing for Render/Netlify
│   └── manifest.json       # PWA manifest
├── src/
│   ├── components/         # Shared components
│   │   └── Header.js       # App header with nav & theme toggle
│   ├── contexts/           # React context providers
│   │   ├── ThemeContext.js     # Light/dark theme
│   │   ├── AuthContext.js      # Google Sign-In
│   │   ├── AnalyticsContext.js # Amplitude tracking
│   │   ├── DataCacheContext.js # Client-side caching
│   │   └── index.js            # Barrel export
│   ├── pages/              # Page components
│   │   ├── HomePage.js
│   │   ├── AboutPage.js
│   │   └── NotFound.js
│   ├── styles/             # Design system CSS
│   │   ├── tokens.css      # Design tokens
│   │   ├── base.css        # Reset & base styles
│   │   ├── components.css  # Component styles
│   │   ├── layout.css      # Layout patterns
│   │   ├── utilities.css   # Utility classes
│   │   └── index.css       # Main entry
│   ├── App.js              # Main app component
│   └── index.js            # Entry point
├── .env.example            # Environment variables template
├── package.json
├── render.yaml             # Render.com deployment config
└── README.md
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required for Google Sign-In
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id

# Required for Analytics (production)
REACT_APP_AMPLITUDE_API_KEY=your-amplitude-api-key

# Optional: API backend URL
REACT_APP_API_URL=https://api.sobersidekick.com
```

### Allowed Auth Domains

Edit `src/contexts/AuthContext.js` to configure allowed email domains:

```javascript
const ALLOWED_DOMAINS = ['sobersidekick.com', 'empathyhealthtech.com'];
```

---

## Customization

### 1. Update App Name

- `public/index.html` - Update `<title>`
- `public/manifest.json` - Update `name` and `short_name`
- `src/components/Header.js` - Update logo and app name

### 2. Add Routes

Edit `src/App.js`:

```javascript
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/about" element={<AboutPage />} />
  {/* Add your routes here */}
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

### 3. Add Analytics Events

Edit `src/contexts/AnalyticsContext.js` to add custom events:

```javascript
export const ANALYTICS_EVENTS = {
  // ... existing events
  MY_CUSTOM_EVENT: 'my_custom_event',
};
```

---

## Design System

### Using Design Tokens

Always use CSS variables instead of hardcoded values:

```css
/* Good */
.my-component {
  background: var(--bg-primary);
  color: var(--text-secondary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
}
```

### Theme Support

Theme switches automatically via `data-theme` attribute:

```jsx
const { theme, toggleTheme, isDark } = useTheme();
```

### Component Classes

```jsx
// Buttons
<button className="btn btn-primary">Primary</button>
<button className="btn btn-secondary">Secondary</button>

// Cards
<div className="card">
  <div className="card-header">
    <h3 className="card-title">Title</h3>
  </div>
  <div className="card-body">Content</div>
</div>

// Badges
<span className="badge badge-success">Active</span>
```

---

## Deployment

### Render.com (Recommended)

1. Connect your GitHub repo to Render
2. The `render.yaml` is pre-configured for static site deployment
3. Add environment variables in Render dashboard

### Netlify

1. Connect your GitHub repo
2. Build command: `npm run build`
3. Publish directory: `build`
4. The `_redirects` file handles SPA routing

### Vercel

1. Import your GitHub repo
2. Framework preset: Create React App
3. Build automatically detected

---

## Subdomain Consistency

All Sober Sidekick subdomains share:

| Feature | Shared |
|---------|--------|
| Design tokens (colors, spacing) | ✅ |
| Component styles | ✅ |
| Theme (light/dark) | ✅ |
| Authentication domains | ✅ |
| Analytics events | ✅ |

---

## License

MIT - Sober Sidekick / Empathy Health Tech
