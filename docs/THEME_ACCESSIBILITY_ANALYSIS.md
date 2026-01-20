# Theme Accessibility Analysis

## Executive Summary

This document identifies **significant theme compatibility issues** where colors are optimized for only one mode, causing poor contrast and visibility when users switch between light and dark themes.

---

## CRITICAL ISSUES (High Impact)

### 1. History Status Badges - FAILS Light Mode

**Location:** `frontend/src/App.css:2538-2551`

| Status | Color | Light BG Contrast | Dark BG Contrast |
|--------|-------|-------------------|------------------|
| completed | `#86efac` (pale green) | ~2.1:1 | ~8:1 |
| failed | `#fca5a5` (pale red) | ~2.3:1 | ~7:1 |
| stopped | `#fcd34d` (pale yellow) | ~1.8:1 | ~9:1 |

**Problem:** These light/pastel colors are designed for dark backgrounds. On light backgrounds (white `#ffffff`), they fail WCAG AA contrast requirements (4.5:1 minimum).

---

### 2. Schema Type Badges - FAILS Light Mode

**Location:** `frontend/src/App.css:3314-3337`

```css
.type-badge.type-string { color: #4ade80; }   /* Light green */
.type-badge.type-number { color: #60a5fa; }   /* Light blue */
.type-badge.type-boolean { color: #c084fc; }  /* Light purple */
.type-badge.type-array { color: #facc15; }    /* Bright yellow - WORST */
.type-badge.type-date { color: #f472b6; }     /* Light pink */
```

**Problem:** Yellow `#facc15` has a contrast ratio of approximately **1.4:1** against white - severely fails accessibility standards. All these bright colors are optimized for dark mode only.

---

### 3. User Status Badges - FAILS Dark Mode

**Location:** `frontend/src/App.css:4178-4191`

| Status | Color | Light BG Contrast | Dark BG Contrast |
|--------|-------|-------------------|------------------|
| pending | `#b45309` (dark amber) | ~5.2:1 | ~2.1:1 |
| active | `#15803d` (dark green) | ~5.8:1 | ~2.3:1 |
| suspended | `#b91c1c` (dark red) | ~5.5:1 | ~2.0:1 |

**Problem:** These **dark, saturated colors** are designed for light backgrounds. On dark backgrounds (`#252538`), they have insufficient contrast and poor readability.

---

### 4. Coverage Status Text - FAILS Light Mode

**Location:** `frontend/src/App.css:2813-2816`

```css
.status-none { color: #ef4444; }       /* Red - OK in both */
.status-low { color: #f97316; }        /* Orange - Marginal */
.status-below-avg { color: #eab308; }  /* Yellow - FAILS light */
.status-good { color: #22c55e; }       /* Green - Marginal in light */
```

**Problem:** Yellow text `#eab308` has **~2:1 contrast** on white backgrounds, severely failing WCAG standards. Used inline in `frontend/src/components/CoverageAnalysis.js:48-53` where the same colors are applied to badge backgrounds.

---

### 5. Leaflet Map Popup Tip - Hardcoded White

**Location:** `frontend/src/App.css:1387-1389`

```css
.leaflet-popup-tip {
  background: white;  /* Hardcoded! */
}
```

**Problem:** In dark mode, the popup arrow/tip remains white while surrounding elements adapt, creating a visual inconsistency.

---

### 6. Connection Status Indicators - Marginal in Light Mode

**Location:** `frontend/src/App.css:172-180`

```css
.connection-status.connected { color: #4ade80; }     /* Light green */
.connection-status.disconnected { color: #f87171; }  /* Light red */
```

**Problem:** These bright, saturated colors have marginal contrast (~3:1) on light backgrounds.

---

## MODERATE ISSUES

### 7. Meeting Type Badges - Not Theme-Aware

**Location:** `frontend/src/App.css:611-614`

```css
.type-aa { color: #3b82f6; }     /* Blue */
.type-na { color: #22c55e; }     /* Green */
.type-alanon { color: #a855f7; } /* Purple */
```

**Problem:** Mid-tone colors that work acceptably in both themes but could be optimized with CSS variables for better contrast.

---

### 8. Map Component Colors - Hardcoded JavaScript

**Location:** `frontend/src/components/MeetingMap.js:15-57, 206, 239-244`

| Element | Colors | Issue |
|---------|--------|-------|
| Default marker | `#667eea` | No theme adaptation |
| Online marker | `#22c55e` | No theme adaptation |
| Heat gradient | `#667eea -> #764ba2 -> #f59e0b -> #ef4444` | Hardcoded |
| Marker border | `white` | Always white in both themes |
| Legend dots | `#667eea`, `#22c55e` | Hardcoded inline styles |

---

### 9. Coverage Analysis Badge Colors - Hardcoded JS Function

**Location:** `frontend/src/components/CoverageAnalysis.js:48-53`

```javascript
const getCoverageColor = (coveragePer100k, avgCoverage) => {
  if (coveragePer100k === 0) return '#ef4444';    // Red
  if (coveragePer100k < avgCoverage * 0.5) return '#f97316'; // Orange
  if (coveragePer100k < avgCoverage) return '#eab308'; // Yellow - POOR
  return '#22c55e'; // Green
};
```

**Problem:** Colors determined by JavaScript logic, impossible to theme via CSS. Yellow especially problematic when used as badge background on light theme.

---

### 10. Base Styles Not Theme-Reactive

**Location:** `frontend/src/index.css:7-12`

```css
body {
  background: linear-gradient(135deg, #f5f7ff 0%, #eaefff 100%);
  color: #151414;
}
```

**Problem:** Fallback styles are light-mode only. If CSS variables fail to load or on initial paint, users may see a flash of incorrect colors.

---

### 11. No-Coverage Section Header - Hardcoded Red

**Location:** `frontend/src/App.css:2841-2845`

```css
.no-coverage-section h4 {
  color: #ef4444;  /* Hardcoded red */
}
```

**Problem:** Red text on light backgrounds has lower contrast than on dark backgrounds.

---

## CONTRAST RATIO SUMMARY TABLE

| Component | Color | Light Mode | Dark Mode | Verdict |
|-----------|-------|------------|-----------|---------|
| History completed | `#86efac` | 2.1:1 | 8:1 | Fails light |
| History stopped | `#fcd34d` | 1.8:1 | 9:1 | Fails light |
| Type-array badge | `#facc15` | 1.4:1 | 10:1 | **Severely fails light** |
| User status-active | `#15803d` | 5.8:1 | 2.3:1 | Fails dark |
| User status-pending | `#b45309` | 5.2:1 | 2.1:1 | Fails dark |
| status-below-avg | `#eab308` | 2:1 | 8:1 | Fails light |
| Connection connected | `#4ade80` | 3:1 | 8:1 | Marginal light |

*WCAG AA requires 4.5:1 for normal text, 3:1 for large text/UI*

---

## MISSING CSS VARIABLES

The codebase references `--accent-hover` in some styles but this variable is **never defined** in the theme declarations, which could cause undefined styling behavior.

---

## RECOMMENDATIONS

### 1. Split status colors by theme

Create both light/dark variants for status indicators:

```css
[data-theme="light"] {
  --status-success: #15803d;
  --status-success-bg: rgba(34, 197, 94, 0.15);
  --status-warning: #b45309;
  --status-warning-bg: rgba(245, 158, 11, 0.15);
  --status-error: #b91c1c;
  --status-error-bg: rgba(239, 68, 68, 0.15);
}

[data-theme="dark"] {
  --status-success: #86efac;
  --status-success-bg: rgba(34, 197, 94, 0.2);
  --status-warning: #fcd34d;
  --status-warning-bg: rgba(251, 191, 36, 0.2);
  --status-error: #fca5a5;
  --status-error-bg: rgba(239, 68, 68, 0.2);
}
```

### 2. Convert hardcoded JS colors to CSS variables

Reference CSS custom properties from JavaScript:

```javascript
// Instead of:
return '#22c55e';

// Use:
const styles = getComputedStyle(document.documentElement);
return styles.getPropertyValue('--status-success').trim();
```

### 3. Add semantic color variables

Define colors by purpose, not just value:

```css
:root {
  /* Semantic status colors */
  --color-success: var(--status-success);
  --color-warning: var(--status-warning);
  --color-error: var(--status-error);
  --color-info: var(--accent-primary);

  /* Meeting type colors */
  --color-type-aa: ...;
  --color-type-na: ...;
  --color-type-alanon: ...;
}
```

### 4. Fix yellow accessibility

Yellow requires dark backgrounds or should be replaced with amber/orange alternatives in light mode. Consider using `#a16207` (dark amber) for light mode instead of `#eab308`.

### 5. Theme-aware map components

Pass theme context to map components and adjust colors dynamically:

```javascript
const { isDark } = useTheme();
const markerColor = isDark ? '#667eea' : '#4f46e5';
const markerBorder = isDark ? 'white' : '#1e1b4b';
```

### 6. Add the missing --accent-hover variable

```css
[data-theme="light"] {
  --accent-hover: #1e40af;
}

[data-theme="dark"] {
  --accent-hover: #93c5fd;
}
```

---

## FILES REQUIRING CHANGES

| File | Priority | Changes Needed |
|------|----------|----------------|
| `frontend/src/App.css` | High | Add theme-aware status color variables, fix hardcoded colors |
| `frontend/src/components/CoverageAnalysis.js` | High | Use CSS variables instead of hardcoded colors |
| `frontend/src/components/MeetingMap.js` | Medium | Add theme context, use theme-aware colors |
| `frontend/src/index.css` | Low | Add dark mode fallback styles |

---

## WCAG COMPLIANCE NOTES

- **WCAG 2.1 Level AA** requires:
  - 4.5:1 contrast ratio for normal text
  - 3:1 contrast ratio for large text (18pt+) and UI components

- **WCAG 2.1 Level AAA** requires:
  - 7:1 contrast ratio for normal text
  - 4.5:1 contrast ratio for large text

Current implementation fails AA compliance for multiple components in at least one theme mode.
