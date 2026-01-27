# Sober Sidekick Skeleton App Template

This directory contains reusable templates for creating new applications that share the Sober Sidekick design system. All templates are backwards compatible with the existing Meeting Finder application.

## Quick Start

### 1. Create a New React App

```bash
npx create-react-app my-new-app
cd my-new-app
```

### 2. Install Dependencies

```bash
npm install react-router-dom@7 @amplitude/analytics-browser jwt-decode
```

### 3. Copy Template Files

Copy the following directories to your new app:

```bash
# Copy styles
cp -r docs/skeleton/styles/* src/styles/

# Copy contexts
cp -r docs/skeleton/contexts/* src/contexts/
```

### 4. Update Your App Entry Point

```jsx
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  ThemeProvider,
  AuthProvider,
  AnalyticsProvider,
  DataCacheProvider
} from './contexts';
import App from './App';
import './styles/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AnalyticsProvider>
          <AuthProvider>
            <DataCacheProvider>
              <App />
            </DataCacheProvider>
          </AuthProvider>
        </AnalyticsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

### 5. Set Environment Variables

Create a `.env` file:

```bash
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
REACT_APP_AMPLITUDE_API_KEY=your-amplitude-api-key
```

---

## Directory Structure

```
skeleton/
├── styles/
│   ├── tokens.css       # Design tokens (colors, spacing, typography)
│   ├── base.css         # CSS reset and base styles
│   ├── components.css   # Component styles (buttons, cards, modals)
│   ├── layout.css       # Layout patterns (header, sidebar, grid)
│   ├── utilities.css    # Utility classes
│   └── index.css        # Main entry point (imports all)
├── contexts/
│   ├── ThemeContext.jsx     # Light/dark theme management
│   ├── AuthContext.jsx      # Google Sign-In authentication
│   ├── AnalyticsContext.jsx # Amplitude event tracking
│   ├── DataCacheContext.jsx # Client-side data caching
│   └── index.js             # Barrel export
└── README.md            # This file
```

---

## Styles

### Design Tokens

All visual decisions are encoded as CSS custom properties in `tokens.css`. Use these instead of hardcoded values:

```css
/* Good */
.my-component {
  background: var(--bg-primary);
  color: var(--text-secondary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
}

/* Avoid */
.my-component {
  background: #f8fafc;
  color: #374151;
  padding: 16px;
  border-radius: 8px;
}
```

### Theme Support

The design system supports light and dark themes automatically. Set the theme via the `data-theme` attribute:

```jsx
import { useTheme } from './contexts';

const ThemeToggle = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button onClick={toggleTheme}>
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
};
```

### Component Classes

Pre-built component styles are available:

```jsx
// Buttons
<button className="btn btn-primary">Primary</button>
<button className="btn btn-secondary">Secondary</button>
<button className="btn btn-danger">Danger</button>
<button className="btn btn-ghost">Ghost</button>

// Cards
<div className="card">
  <div className="card-header">
    <h3 className="card-title">Title</h3>
  </div>
  <div className="card-body">Content</div>
  <div className="card-footer">
    <button className="btn btn-primary">Action</button>
  </div>
</div>

// Badges
<span className="badge badge-success">Active</span>
<span className="badge badge-warning">Pending</span>
<span className="badge badge-error">Failed</span>

// Forms
<div className="form-group">
  <label className="form-label">Email</label>
  <input className="input" type="email" />
  <span className="form-help">We'll never share your email.</span>
</div>
```

### Utility Classes

Tailwind-style utility classes are available:

```jsx
<div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
  <span className="text-lg font-semibold text-primary">Title</span>
  <span className="text-sm text-muted ml-auto">Subtitle</span>
</div>
```

---

## Context Providers

### ThemeContext

Manages light/dark theme with localStorage persistence and system preference detection.

```jsx
import { useTheme } from './contexts';

const MyComponent = () => {
  const { theme, setTheme, toggleTheme, isDark, isLight } = useTheme();

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
    </div>
  );
};
```

### AuthContext

Handles Google Sign-In with domain validation.

```jsx
import { useAuth } from './contexts';

const MyComponent = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    signOut,
    renderSignInButton,
    authError
  } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      renderSignInButton('signin-button');
    }
  }, [isAuthenticated, renderSignInButton]);

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return (
      <div>
        {authError && <div className="alert alert-error">{authError}</div>}
        <div id="signin-button" />
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
};
```

### AnalyticsContext

Standardized event tracking with Amplitude.

```jsx
import { useAnalytics } from './contexts';

const MyComponent = () => {
  const { track, events, trackPageView, trackError } = useAnalytics();

  // Track page view on mount
  useEffect(() => {
    trackPageView('my_page', { section: 'main' });
  }, [trackPageView]);

  const handleClick = () => {
    track(events.BUTTON_CLICKED, {
      button_name: 'submit',
      context: 'my_form'
    });
  };

  const handleError = (error) => {
    trackError('my_component', error.message, {
      error_code: error.code
    });
  };

  return <button onClick={handleClick}>Submit</button>;
};
```

### DataCacheContext

Client-side caching with automatic TTL expiration.

```jsx
import { useDataCache, useCachedFetch } from './contexts';

// Option 1: Automatic cached fetching
const MyComponent = () => {
  const { data, isLoading, error, refetch } = useCachedFetch('/api/data', {
    ttl: 5 * 60 * 1000, // 5 minutes
    transform: (json) => json.results,
    refetchOnStale: true
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.map(item => <div key={item.id}>{item.name}</div>)}
      <button onClick={refetch}>Refresh</button>
    </div>
  );
};

// Option 2: Manual cache management
const MyOtherComponent = () => {
  const { getCache, setCache, invalidateCache } = useDataCache();

  const fetchData = async () => {
    const cached = getCache('my-data');
    if (cached) return cached;

    const response = await fetch('/api/data');
    const data = await response.json();

    setCache('my-data', data, 10 * 60 * 1000); // 10 min TTL
    return data;
  };

  const refreshData = () => {
    invalidateCache('my-data');
    fetchData();
  };

  return <button onClick={refreshData}>Refresh</button>;
};
```

---

## Layout Patterns

### Basic App Layout

```jsx
import { Routes, Route } from 'react-router-dom';

const App = () => {
  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-logo">My App</div>
          <nav className="header-nav">
            <a className="header-nav-item active" href="/">Home</a>
            <a className="header-nav-item" href="/about">About</a>
          </nav>
          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="page-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  );
};
```

### Sidebar Layout

```jsx
const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">Admin</span>
        </div>
        <nav className="sidebar-nav">
          <a className="nav-item active" href="/admin">
            <span className="nav-item-icon">📊</span>
            Dashboard
          </a>
          <a className="nav-item" href="/admin/users">
            <span className="nav-item-icon">👥</span>
            Users
          </a>
        </nav>
      </aside>

      <main className="page-container-with-sidebar">
        {children}
      </main>
    </div>
  );
};
```

---

## Backwards Compatibility

### Integrating Meeting Finder

The skeleton is designed to embed the existing Meeting Finder as a module:

```jsx
import { lazy, Suspense } from 'react';

const MeetingFinder = lazy(() => import('./features/meeting-finder'));

const App = () => {
  return (
    <Routes>
      {/* Skeleton routes */}
      <Route path="/" element={<HomePage />} />

      {/* Embedded Meeting Finder */}
      <Route
        path="/meetings/*"
        element={
          <Suspense fallback={<div className="spinner" />}>
            <MeetingFinder />
          </Suspense>
        }
      />
    </Routes>
  );
};
```

### Shared Contexts

Meeting Finder components can access skeleton contexts:

```jsx
// In a Meeting Finder component
import { useTheme, useAuth, useAnalytics } from '../../contexts';

const MeetingsExplorer = () => {
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { track, events } = useAnalytics();

  // Use shared state...
};
```

### CSS Variable Inheritance

Meeting Finder styles should use the same CSS variables:

```css
.meeting-card {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
}
```

---

## SPA Routing for Render.com

For static hosting, ensure proper SPA routing:

### 1. Create `public/_redirects`

```
/*    /index.html   200
```

### 2. Add postbuild script in `package.json`

```json
{
  "scripts": {
    "postbuild": "cp build/index.html build/200.html"
  }
}
```

### 3. Configure `render.yaml` (if using)

```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

---

## Subdomain Configuration

For multiple subdomains sharing the design system:

| Subdomain | Purpose | Shared |
|-----------|---------|--------|
| `meetings.sobersidekick.com` | Meeting Finder | Styles, Contexts, Auth |
| `admin.sobersidekick.com` | Admin Dashboard | Styles, Contexts, Auth |
| `docs.sobersidekick.com` | Documentation | Styles, Theme |
| `app.sobersidekick.com` | Main App | Everything |

Each subdomain uses the same:
- Design tokens and styles
- Context providers
- Authentication (same allowed domains)
- Analytics tracking

---

## Migration Checklist

When migrating an existing app:

- [ ] Replace hardcoded colors with CSS variables
- [ ] Replace custom components with skeleton equivalents
- [ ] Update import paths for contexts
- [ ] Update localStorage keys to shared namespace
- [ ] Update analytics event names to use `ANALYTICS_EVENTS`
- [ ] Test theme switching
- [ ] Test authentication flow
- [ ] Verify responsive behavior
- [ ] Add SPA routing configuration

---

## Contributing

When extending the design system:

1. Add new tokens to `tokens.css`
2. Add new component styles to `components.css`
3. Add new events to `ANALYTICS_EVENTS` in `AnalyticsContext.jsx`
4. Update this README with documentation
5. Ensure backwards compatibility with existing apps
