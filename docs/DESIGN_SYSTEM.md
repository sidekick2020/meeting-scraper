# Sober Sidekick Design System

A comprehensive design system for building consistent applications across the Sober Sidekick platform. This documentation provides everything needed to create skeleton apps that maintain visual and functional consistency while being backwards compatible with existing applications.

---

## Table of Contents

1. [Design Tokens](#design-tokens)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing System](#spacing-system)
5. [Component Library](#component-library)
6. [Layout Patterns](#layout-patterns)
7. [Navigation Patterns](#navigation-patterns)
8. [Context Providers](#context-providers)
9. [Authentication](#authentication)
10. [Routing](#routing)
11. [Analytics](#analytics)
12. [Responsive Design](#responsive-design)
13. [Animations](#animations)
14. [Skeleton App Template](#skeleton-app-template)
15. [Backwards Compatibility](#backwards-compatibility)

---

## Design Tokens

Design tokens are the foundational variables that define the visual language of the design system. All components should reference these tokens rather than hardcoded values.

### CSS Variable Structure

```css
:root {
  /* Background Colors */
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-tertiary: #e2e8f0;
  --bg-hover: rgba(0, 0, 0, 0.06);
  --bg-active: rgba(47, 93, 255, 0.1);

  /* Text Colors */
  --text-primary: #111827;
  --text-secondary: #374151;
  --text-muted: #4b5563;
  --text-faint: #6b7280;

  /* Border Colors */
  --border-light: rgba(0, 0, 0, 0.1);
  --border-medium: rgba(0, 0, 0, 0.18);

  /* Accent Colors */
  --accent-primary: #2f5dff;
  --accent-secondary: #0f2ccf;
  --accent-light: rgba(47, 93, 255, 0.1);

  /* Semantic Colors */
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;

  /* Component Tokens */
  --card-bg: var(--bg-primary);
  --input-bg: var(--bg-secondary);
  --panel-bg: var(--bg-primary);
  --sidebar-width: 260px;
  --header-height: 64px;

  /* Shadow Tokens */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 25px 50px rgba(0, 0, 0, 0.25);

  /* Transition Tokens */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;
  --transition-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  /* Border Radius Tokens */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
}
```

---

## Color System

### Theme Support

The design system supports light and dark themes using the `data-theme` attribute on the document element.

#### Light Theme (Default)

```css
:root, [data-theme="light"] {
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-tertiary: #e2e8f0;
  --bg-hover: rgba(0, 0, 0, 0.06);
  --text-primary: #111827;
  --text-secondary: #374151;
  --text-muted: #4b5563;
  --border-light: rgba(0, 0, 0, 0.1);
  --border-medium: rgba(0, 0, 0, 0.18);
}
```

#### Dark Theme

```css
[data-theme="dark"] {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16162a;
  --bg-tertiary: #1e1e30;
  --bg-hover: rgba(255, 255, 255, 0.06);
  --text-primary: #f3f4f6;
  --text-secondary: #d1d5db;
  --text-muted: #9ca3af;
  --border-light: rgba(255, 255, 255, 0.08);
  --border-medium: rgba(255, 255, 255, 0.15);
  --accent-secondary: #5b7fff;
}
```

### Semantic Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Success | `#22c55e` | Positive actions, confirmations |
| Warning | `#f59e0b` | Cautions, pending states |
| Error | `#ef4444` | Errors, destructive actions |
| Info | `#3b82f6` | Informational content |
| Neutral | `#6b7280` | Disabled states, secondary info |

### Brand Colors (Fellowship Types)

| Fellowship | Color | Background |
|------------|-------|------------|
| AA | `#3b82f6` | `rgba(59, 130, 246, 0.1)` |
| NA | `#a855f7` | `rgba(168, 85, 247, 0.1)` |
| Al-Anon | `#22c55e` | `rgba(34, 197, 94, 0.1)` |
| Other | `#9ca3af` | `rgba(156, 163, 175, 0.1)` |

### Gradient Definitions

```css
/* Primary Gradient (Buttons, Accents) */
--gradient-primary: linear-gradient(135deg, #2f5dff 0%, #0f2ccf 100%);

/* Status Gradients */
--gradient-success: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
--gradient-warning: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
--gradient-info: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
```

---

## Typography

### Font Stack

```css
/* System UI (Primary) */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;

/* Monospace (Code, Logs) */
font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono',
             'Courier New', monospace;

/* UI Monospace (Timestamps, IDs) */
font-family: ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
```

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | `0.625rem` (10px) | Timestamps, micro text |
| `--text-sm` | `0.75rem` (12px) | Badges, captions |
| `--text-base` | `0.875rem` (14px) | Body text, navigation |
| `--text-md` | `1rem` (16px) | Inputs, main content |
| `--text-lg` | `1.125rem` (18px) | Section titles |
| `--text-xl` | `1.25rem` (20px) | Modal headers |
| `--text-2xl` | `1.5rem` (24px) | Page headers |
| `--text-3xl` | `2rem` (32px) | Large statistics |

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--font-normal` | 400 | Body text |
| `--font-medium` | 500 | Labels, emphasis |
| `--font-semibold` | 600 | Headings |
| `--font-bold` | 700 | Statistics, strong |

### Line Heights

```css
--leading-tight: 1.25;   /* Headings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.75; /* Long-form content */
```

---

## Spacing System

### Base Unit

The spacing system uses `0.25rem` (4px) as the base unit.

### Spacing Scale

| Token | Value | Pixels |
|-------|-------|--------|
| `--space-1` | `0.25rem` | 4px |
| `--space-2` | `0.5rem` | 8px |
| `--space-3` | `0.75rem` | 12px |
| `--space-4` | `1rem` | 16px |
| `--space-5` | `1.25rem` | 20px |
| `--space-6` | `1.5rem` | 24px |
| `--space-8` | `2rem` | 32px |
| `--space-10` | `2.5rem` | 40px |
| `--space-12` | `3rem` | 48px |
| `--space-16` | `4rem` | 64px |

### Component Spacing Patterns

| Component | Padding | Gap |
|-----------|---------|-----|
| Cards | `1.5rem` | `1rem` |
| Buttons | `0.5rem 1rem` | `0.5rem` |
| Inputs | `0.875rem 1rem` | - |
| Modals | `1.5rem` | `1rem` |
| Sidebar items | `0.75rem 1rem` | `0.75rem` |

---

## Component Library

### Buttons

#### Base Button

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

#### Button Variants

```css
/* Primary - Gradient blue */
.btn-primary {
  background: var(--gradient-primary);
  color: white;
}
.btn-primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

/* Secondary - Subtle background */
.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
}
.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-medium);
}

/* Success - Green */
.btn-success {
  background: var(--gradient-success);
  color: white;
}

/* Danger - Red */
.btn-danger {
  background: var(--error);
  color: white;
}
.btn-danger:hover {
  background: #dc2626;
}

/* Ghost - Minimal */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

#### Button Sizes

```css
.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

.btn-full {
  width: 100%;
}
```

### Cards

```css
.card {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  transition: all var(--transition-normal);
}

.card-interactive {
  cursor: pointer;
}
.card-interactive:hover {
  background: var(--bg-hover);
  border-color: rgba(47, 93, 255, 0.5);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.card-body {
  color: var(--text-secondary);
}

.card-footer {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-light);
}
```

### Modals

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-light);
}
```

### Form Elements

#### Text Input

```css
.input {
  width: 100%;
  padding: 0.875rem 1rem;
  background: var(--input-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 1rem;
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.input::placeholder {
  color: var(--text-muted);
}

.input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

#### Search Input

```css
.search-input {
  padding: 1rem 1.25rem;
  padding-left: 3rem; /* Space for icon */
  background: var(--input-bg);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 1rem;
}

.search-container {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}
```

#### Select Dropdown

```css
.select {
  padding: 0.875rem 1rem;
  padding-right: 2.5rem;
  background: var(--input-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* Chevron icon */
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
}

.select option {
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

#### Checkbox

```css
.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.checkbox-wrapper:hover {
  background: var(--bg-hover);
}

.checkbox-wrapper input[type="checkbox"] {
  accent-color: var(--accent-primary);
  width: 16px;
  height: 16px;
}

.checkbox-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}
```

#### Form Group

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-help {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.form-error {
  font-size: 0.75rem;
  color: var(--error);
}
```

### Badges & Chips

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-primary {
  background: var(--accent-light);
  color: var(--accent-primary);
}

.badge-success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success);
}

.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.badge-error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}
```

### Progress Bar

```css
.progress-track {
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: inherit;
  transition: width 0.3s ease;
}

/* With label */
.progress-labeled {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 3rem;
}
```

### Loading States

```css
/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--accent-light);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

/* Button spinner */
.btn-loading .btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Skeleton */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 25%,
    var(--border-light) 50%,
    var(--bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

.skeleton-text {
  height: 1rem;
  margin-bottom: 0.5rem;
}

.skeleton-circle {
  border-radius: 50%;
}
```

### Alerts & Messages

```css
.alert {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.alert-success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.alert-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fcd34d;
}

.alert-info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}
```

### Tabs

```css
.tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
}

.tab {
  padding: 0.625rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tab.active {
  background: var(--bg-primary);
  color: var(--accent-primary);
  box-shadow: var(--shadow-sm);
}

/* Tab with count badge */
.tab-count {
  margin-left: 0.375rem;
  padding: 0.125rem 0.375rem;
  background: var(--accent-light);
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
}
```

---

## Layout Patterns

### Page Container

```css
.page-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .page-container {
    padding: 1rem;
  }
}
```

### Header

```css
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.75rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
```

### Sidebar Layout

```css
.layout-with-sidebar {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  z-index: 200;
}

.sidebar-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--border-light);
}

.sidebar-nav {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-light);
}

.main-content {
  margin-left: var(--sidebar-width);
  flex: 1;
  min-height: 100vh;
}

/* Mobile sidebar */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform var(--transition-slow);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .main-content {
    margin-left: 0;
  }

  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 199;
  }
}
```

### Grid Layouts

```css
/* Two-column layout */
.grid-two-col {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2rem;
}

@media (max-width: 968px) {
  .grid-two-col {
    grid-template-columns: 1fr;
  }
}

/* Card grid */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
```

### Slide-in Panel

```css
.slide-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 55%;
  max-width: 800px;
  height: 100vh;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-light);
  transform: translateX(100%);
  transition: transform var(--transition-slow);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.slide-panel.open {
  transform: translateX(0);
}

.slide-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.slide-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.slide-panel-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
}

@media (max-width: 768px) {
  .slide-panel {
    width: 100%;
  }
}
```

---

## Navigation Patterns

### Sidebar Navigation

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-item.active {
  background: var(--accent-light);
  color: var(--accent-primary);
}

.nav-item-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-item-label {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Collapsible nav group */
.nav-group {
  margin-bottom: 0.5rem;
}

.nav-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  color: var(--text-faint);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nav-group-chevron {
  transition: transform var(--transition-fast);
}

.nav-group.expanded .nav-group-chevron {
  transform: rotate(180deg);
}

.nav-group-items {
  overflow: hidden;
  max-height: 0;
  transition: max-height var(--transition-normal);
}

.nav-group.expanded .nav-group-items {
  max-height: 500px;
}
```

### Breadcrumbs

```css
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.breadcrumb-item {
  color: var(--text-muted);
}

.breadcrumb-item:hover {
  color: var(--text-primary);
}

.breadcrumb-separator {
  color: var(--text-faint);
}

.breadcrumb-current {
  color: var(--text-primary);
  font-weight: 500;
}
```

### Mobile Navigation

```css
.mobile-nav-toggle {
  display: none;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .mobile-nav-toggle {
    display: flex;
  }
}

.mobile-nav {
  position: fixed;
  top: var(--header-height);
  left: 0;
  right: 0;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  padding: 1rem;
  transform: translateY(-100%);
  transition: transform var(--transition-slow);
  z-index: 99;
}

.mobile-nav.open {
  transform: translateY(0);
}
```

---

## Context Providers

### Provider Hierarchy

The recommended provider order ensures proper dependency resolution:

```jsx
<React.StrictMode>
  <BrowserRouter>
    <ThemeProvider>
      <AnalyticsProvider>
        <AuthProvider>
          <ParseProvider>
            <DataCacheProvider>
              <MemoryMonitorProvider>
                <App />
              </MemoryMonitorProvider>
            </DataCacheProvider>
          </ParseProvider>
        </AuthProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  </BrowserRouter>
</React.StrictMode>
```

### ThemeContext

Manages light/dark theme switching with localStorage persistence.

```jsx
// Provider
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-theme', theme === 'dark');
    document.body.classList.toggle('light-theme', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      isDark: theme === 'dark',
      isLight: theme === 'light'
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook
const useTheme = () => useContext(ThemeContext);
```

### AuthContext

Handles Google Sign-In authentication with domain validation.

```jsx
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const ALLOWED_DOMAINS = ['sobersidekick.com', 'empathyhealthtech.com'];

  useEffect(() => {
    // Check localStorage for existing session
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      // Validate domain is still allowed
      if (ALLOWED_DOMAINS.some(d => parsed.email?.endsWith(`@${d}`))) {
        setUser(parsed);
      } else {
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (credential) => {
    try {
      const decoded = jwtDecode(credential);
      const domain = decoded.email?.split('@')[1];

      if (!ALLOWED_DOMAINS.includes(domain)) {
        throw new Error('Unauthorized domain');
      }

      const userData = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      };

      localStorage.setItem('auth_user', JSON.stringify(userData));
      setUser(userData);
      setAuthError(null);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  const signOut = () => {
    localStorage.removeItem('auth_user');
    setUser(null);
    // Disable auto-select for next sign-in
    google?.accounts.id.disableAutoSelect();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      authError,
      signIn,
      signOut,
      clearError: () => setAuthError(null)
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook
const useAuth = () => useContext(AuthContext);
```

### DataCacheContext

Provides client-side caching with TTL and LRU eviction.

```jsx
const DataCacheProvider = ({ children }) => {
  const cacheRef = useRef(new Map());
  const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  const MAX_ENTRIES = 100;

  const getCache = (key) => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      cacheRef.current.delete(key);
      return null;
    }

    return entry.data;
  };

  const setCache = (key, data, ttl = DEFAULT_TTL) => {
    // LRU eviction
    if (cacheRef.current.size >= MAX_ENTRIES) {
      const firstKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(firstKey);
    }

    cacheRef.current.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  };

  const invalidateCache = (pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of cacheRef.current.keys()) {
        if (regex.test(key)) {
          cacheRef.current.delete(key);
        }
      }
    } else {
      cacheRef.current.delete(pattern);
    }
  };

  const clearCache = () => {
    cacheRef.current.clear();
  };

  return (
    <DataCacheContext.Provider value={{
      getCache,
      setCache,
      invalidateCache,
      clearCache
    }}>
      {children}
    </DataCacheContext.Provider>
  );
};

// Hooks
const useDataCache = () => useContext(DataCacheContext);

const useCachedFetch = (url, options = {}) => {
  const { getCache, setCache } = useDataCache();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const cached = getCache(url);
      if (cached) {
        setData(cached);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(url);
        const json = await response.json();
        setCache(url, json, options.ttl);
        setData(json);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, isLoading, error };
};
```

### AnalyticsContext

Wraps Amplitude SDK for event tracking.

```jsx
const AnalyticsProvider = ({ children }) => {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current && AMPLITUDE_API_KEY) {
      amplitude.init(AMPLITUDE_API_KEY, {
        defaultTracking: {
          sessions: true,
          pageViews: false, // We track manually
          formInteractions: true,
          fileDownloads: true
        }
      });
      isInitialized.current = true;
    }
  }, []);

  const track = (eventName, properties = {}) => {
    if (!isInitialized.current) return;

    amplitude.track(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  };

  const identify = (userId, properties = {}) => {
    if (!isInitialized.current) return;

    amplitude.setUserId(userId);
    amplitude.identify(new amplitude.Identify()
      .set(properties));
  };

  const trackPageView = (pageName, properties = {}) => {
    track('page_viewed', {
      page_name: pageName,
      ...properties
    });
  };

  return (
    <AnalyticsContext.Provider value={{
      track,
      identify,
      trackPageView,
      events: ANALYTICS_EVENTS
    }}>
      {children}
    </AnalyticsContext.Provider>
  );
};

// Hook
const useAnalytics = () => useContext(AnalyticsContext);
```

---

## Authentication

### Google Sign-In Integration

```jsx
// Initialize Google Sign-In
useEffect(() => {
  if (!window.google) {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true
      });
    };
  }
}, []);

// Render button
google.accounts.id.renderButton(
  document.getElementById('google-signin-button'),
  {
    theme: isDark ? 'filled_black' : 'outline',
    size: 'large',
    width: 280,
    text: 'signin_with',
    shape: 'rectangular'
  }
);
```

### Protected Route Pattern

```jsx
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

// Usage
<Route
  path="/admin/*"
  element={
    <ProtectedRoute>
      <AdminPanel />
    </ProtectedRoute>
  }
/>
```

### Sign-In Modal Component

```jsx
const SignInModal = ({ onClose }) => {
  const { signIn, authError, clearError } = useAuth();
  const { isDark } = useTheme();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Sign In</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="signin-description">
            Sign in with your organization account to access admin features.
          </p>

          <div className="allowed-domains">
            <span>Allowed domains:</span>
            <code>@sobersidekick.com</code>
            <code>@empathyhealthtech.com</code>
          </div>

          {authError && (
            <div className="alert alert-error">
              {authError}
              <button onClick={clearError}>Dismiss</button>
            </div>
          )}

          <div id="google-signin-button" />
        </div>
      </div>
    </div>
  );
};
```

---

## Routing

### React Router Setup

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/download" element={<DownloadPage />} />

        {/* Dynamic routes */}
        <Route path="/meeting/:id" element={<MeetingDetailPage />} />
        <Route path="/online-meetings" element={<OnlineMeetingsPage />} />

        {/* Protected routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <AdminRoutes />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};
```

### SPA Routing for Static Hosts

For hosting on Render.com or similar static hosts, ensure these files exist:

#### `public/_redirects`
```
/docs           /index.html   200
/docs/*         /index.html   200
/download       /index.html   200
/download/*     /index.html   200
/meeting/*      /index.html   200
/online-meetings /index.html  200
/*              /index.html   200
```

#### `render.yaml` routes
```yaml
routes:
  - type: rewrite
    source: /docs
    destination: /index.html
  - type: rewrite
    source: /docs/*
    destination: /index.html
  # ... repeat for each route
```

#### Post-build script (package.json)
```json
{
  "scripts": {
    "postbuild": "cp build/index.html build/200.html && mkdir -p build/docs build/meeting && cp build/index.html build/docs/index.html && cp build/index.html build/meeting/index.html"
  }
}
```

### View State Management

For apps with multiple views (public/admin), use URL params to preserve state:

```jsx
const AppContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = searchParams.get('admin') ? 'admin' : 'public';

  const setView = (view) => {
    if (view === 'admin') {
      setSearchParams({ admin: '1' });
    } else {
      setSearchParams({});
    }
  };

  return (
    <>
      {/* Use CSS hidden class instead of conditional render to preserve state */}
      <PublicView className={currentView !== 'public' ? 'hidden' : ''} />
      <AdminView className={currentView !== 'admin' ? 'hidden' : ''} />
    </>
  );
};
```

---

## Analytics

### Event Naming Conventions

| Rule | Example | Rationale |
|------|---------|-----------|
| Use `snake_case` | `meeting_viewed` | Consistent, queryable |
| Past tense verbs | `search_completed` | Action occurred |
| Noun + Verb | `filter_applied` | Consistent structure |

### Standard Events

```javascript
const ANALYTICS_EVENTS = {
  // Page views
  PAGE_VIEWED: 'page_viewed',

  // User actions
  SEARCH_INITIATED: 'search_initiated',
  SEARCH_COMPLETED: 'search_completed',
  FILTER_APPLIED: 'filter_applied',
  FILTER_CLEARED: 'filter_cleared',

  // Meeting interactions
  MEETING_VIEWED: 'meeting_viewed',
  MEETING_DIRECTIONS_CLICKED: 'meeting_directions_clicked',
  MEETING_SHARED: 'meeting_shared',

  // Authentication
  SIGNIN_INITIATED: 'signin_initiated',
  SIGNIN_SUCCESS: 'signin_success',
  SIGNIN_FAILED: 'signin_failed',
  SIGNOUT_COMPLETED: 'signout_completed',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error'
};
```

### Tracking Patterns

```jsx
// Page view tracking
useEffect(() => {
  trackPageView('home', {
    source: 'direct',
    referrer: document.referrer
  });
}, []);

// Action tracking
const handleSearch = (query) => {
  track(events.SEARCH_INITIATED, { query });

  performSearch(query).then(results => {
    track(events.SEARCH_COMPLETED, {
      query,
      results_count: results.length,
      has_results: results.length > 0
    });
  });
};

// Error tracking
const trackError = (context, message, properties = {}) => {
  track(events.ERROR_OCCURRED, {
    error_context: context,
    error_message: message,
    ...properties
  });
};
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile first approach */
--breakpoint-sm: 480px;   /* Mobile small */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1200px;  /* Large desktop */
```

### Media Query Patterns

```css
/* Mobile-first: base styles for mobile, enhance for larger */
.component {
  padding: 1rem;
  font-size: 0.875rem;
}

@media (min-width: 768px) {
  .component {
    padding: 1.5rem;
    font-size: 1rem;
  }
}

/* Or desktop-first: base for desktop, reduce for smaller */
.sidebar {
  width: 260px;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    transform: translateX(-100%);
  }
}
```

### Responsive Utilities

```css
/* Hide on mobile */
.hide-mobile {
  display: none;
}
@media (min-width: 768px) {
  .hide-mobile {
    display: block;
  }
}

/* Hide on desktop */
.hide-desktop {
  display: block;
}
@media (min-width: 768px) {
  .hide-desktop {
    display: none;
  }
}

/* Stack on mobile */
.flex-stack-mobile {
  display: flex;
  gap: 1rem;
}
@media (max-width: 768px) {
  .flex-stack-mobile {
    flex-direction: column;
  }
}
```

---

## Animations

### Keyframe Definitions

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  50% {
    transform: translateY(-25%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
}
```

### Animation Classes

```css
.animate-fadeIn {
  animation: fadeIn 0.2s ease forwards;
}

.animate-slideDown {
  animation: slideDown 0.3s ease forwards;
}

.animate-slideUp {
  animation: slideUp 0.3s ease forwards;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

.animate-bounce {
  animation: bounce 1s infinite;
}
```

### Transition Utilities

```css
.transition-fast {
  transition: all 0.15s ease;
}

.transition-normal {
  transition: all 0.2s ease;
}

.transition-slow {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.transition-colors {
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.transition-transform {
  transition: transform 0.2s ease;
}
```

---

## Skeleton App Template

### Project Structure

```
skeleton-app/
├── public/
│   ├── index.html
│   ├── _redirects           # SPA routing
│   └── version.json         # App version
├── src/
│   ├── components/
│   │   ├── common/          # Shared components
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── Spinner.jsx
│   │   │   ├── Alert.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Tabs.jsx
│   │   │   └── index.js     # Barrel export
│   │   ├── layout/          # Layout components
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── PageContainer.jsx
│   │   │   └── index.js
│   │   └── features/        # Feature-specific components
│   ├── contexts/
│   │   ├── ThemeContext.jsx
│   │   ├── AuthContext.jsx
│   │   ├── AnalyticsContext.jsx
│   │   ├── DataCacheContext.jsx
│   │   └── index.js         # Barrel export
│   ├── hooks/
│   │   ├── useLocalStorage.js
│   │   ├── useMediaQuery.js
│   │   ├── useCachedFetch.js
│   │   └── index.js
│   ├── utils/
│   │   ├── api.js           # API helpers
│   │   ├── constants.js     # App constants
│   │   ├── helpers.js       # Utility functions
│   │   └── index.js
│   ├── styles/
│   │   ├── tokens.css       # Design tokens
│   │   ├── base.css         # Reset & base styles
│   │   ├── components.css   # Component styles
│   │   ├── utilities.css    # Utility classes
│   │   └── index.css        # Main entry (imports all)
│   ├── App.jsx
│   ├── App.css              # App-specific styles
│   └── index.js
├── package.json
├── render.yaml              # Deployment config
└── README.md
```

### Minimal App Entry Point

```jsx
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, AuthProvider, AnalyticsProvider, DataCacheProvider } from './contexts';
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

### Minimal App Component

```jsx
// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import { Header, Sidebar, PageContainer } from './components/layout';
import { useAuth, useTheme } from './contexts';

const App = () => {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();

  return (
    <div className="app" data-theme={theme}>
      <Header />

      <div className="app-layout">
        {isAuthenticated && <Sidebar />}

        <main className="app-main">
          <PageContainer>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageContainer>
        </main>
      </div>
    </div>
  );
};

export default App;
```

### Package.json Template

```json
{
  "name": "skeleton-app",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^7.0.0",
    "@amplitude/analytics-browser": "^2.0.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "postbuild": "cp build/index.html build/200.html",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
```

---

## Backwards Compatibility

### Integrating Meeting Finder

The skeleton app is designed to accommodate the existing Meeting Finder as a feature module:

#### 1. Mount Point Strategy

```jsx
// In skeleton app's App.jsx
import { lazy, Suspense } from 'react';

// Lazy load the Meeting Finder module
const MeetingFinder = lazy(() => import('./features/meeting-finder'));

const App = () => {
  return (
    <Routes>
      {/* Skeleton routes */}
      <Route path="/" element={<HomePage />} />

      {/* Meeting Finder routes */}
      <Route
        path="/meetings/*"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <MeetingFinder />
          </Suspense>
        }
      />
    </Routes>
  );
};
```

#### 2. Shared Context Integration

Meeting Finder components can access skeleton contexts:

```jsx
// In MeetingFinder component
import { useTheme, useAuth, useAnalytics } from '../../contexts';

const MeetingsExplorer = () => {
  const { theme, isDark } = useTheme();           // Skeleton theme
  const { user, isAuthenticated } = useAuth();    // Skeleton auth
  const { track, events } = useAnalytics();       // Skeleton analytics

  // Meeting Finder logic...
};
```

#### 3. CSS Variable Inheritance

Meeting Finder styles use the same CSS variables:

```css
/* Meeting Finder specific styles */
.meeting-card {
  background: var(--card-bg);           /* From skeleton */
  border: 1px solid var(--border-light); /* From skeleton */
  border-radius: var(--radius-xl);       /* From skeleton */
}
```

#### 4. Shared Component Usage

```jsx
// Meeting Finder can use skeleton components
import { Button, Card, Modal, Badge } from '../../components/common';

const MeetingDetail = ({ meeting }) => {
  return (
    <Card>
      <Badge variant={meeting.fellowship.toLowerCase()}>
        {meeting.fellowship}
      </Badge>
      <h2>{meeting.name}</h2>
      <Button variant="primary" onClick={handleDirections}>
        Get Directions
      </Button>
    </Card>
  );
};
```

### Migration Checklist

When migrating Meeting Finder to skeleton:

- [ ] Replace hardcoded colors with CSS variables
- [ ] Replace custom components with skeleton equivalents
- [ ] Migrate localStorage keys to shared namespace
- [ ] Update import paths for contexts
- [ ] Update analytics event names to shared constants
- [ ] Test theme switching compatibility
- [ ] Test authentication flow
- [ ] Verify responsive behavior
- [ ] Update SPA routing configuration

### Subdomain Configuration

For multiple subdomains sharing the design system:

```
meetings.sobersidekick.com  → Meeting Finder
admin.sobersidekick.com     → Admin Dashboard
docs.sobersidekick.com      → Documentation
app.sobersidekick.com       → Main App
```

Each subdomain uses the same:
- Design tokens (colors, typography, spacing)
- Component library
- Context providers
- Authentication domain validation
- Analytics tracking

Different per subdomain:
- Feature-specific components
- Route configuration
- API endpoints
- Content

---

## Quick Reference

### CSS Variable Cheatsheet

```css
/* Colors */
var(--bg-primary)        /* Main background */
var(--bg-secondary)      /* Secondary background */
var(--bg-tertiary)       /* Tertiary background */
var(--bg-hover)          /* Hover state */
var(--text-primary)      /* Main text */
var(--text-secondary)    /* Secondary text */
var(--text-muted)        /* Muted text */
var(--accent-primary)    /* Brand blue #2f5dff */
var(--border-light)      /* Light borders */

/* Spacing */
var(--space-1) through var(--space-16)

/* Radius */
var(--radius-sm)         /* 6px */
var(--radius-md)         /* 8px */
var(--radius-lg)         /* 12px */
var(--radius-xl)         /* 16px */
var(--radius-full)       /* 9999px (pill) */

/* Shadows */
var(--shadow-sm)
var(--shadow-md)
var(--shadow-lg)
var(--shadow-xl)

/* Transitions */
var(--transition-fast)   /* 0.15s */
var(--transition-normal) /* 0.2s */
var(--transition-slow)   /* 0.3s */
```

### Component Class Prefixes

| Prefix | Component |
|--------|-----------|
| `.btn-` | Buttons |
| `.card-` | Cards |
| `.modal-` | Modals |
| `.input-` | Form inputs |
| `.nav-` | Navigation |
| `.badge-` | Badges |
| `.alert-` | Alerts |
| `.tab-` | Tabs |

### Hook Summary

| Hook | Purpose |
|------|---------|
| `useTheme()` | Theme state & toggle |
| `useAuth()` | Authentication state |
| `useAnalytics()` | Event tracking |
| `useDataCache()` | Cache management |
| `useCachedFetch()` | Cached API requests |

---

## Appendix: Full CSS Token File

See `frontend/src/styles/tokens.css` for the complete token definitions that should be shared across all skeleton apps.
