/**
 * SPA Routing Setup Script
 *
 * This script runs after the React build to configure SPA routing for Render.com.
 * It ensures that direct URL access to routes like /meeting/abc123 works correctly.
 *
 * Render.com static sites handle SPA routing via:
 * 1. 200.html - Served for any path that doesn't match a file (primary method)
 * 2. _redirects file - Netlify-style redirects (backup method)
 * 3. Directory index.html files - For specific known routes
 *
 * This script creates all three to ensure maximum compatibility.
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');

// SPA routes that need directory fallbacks
const SPA_ROUTES = [
  'docs',
  'download',
  'meeting',
  'online-meetings'
];

console.log('Setting up SPA routing for Render.com...');

// Verify build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  console.error('Error: build directory does not exist. Run npm run build first.');
  process.exit(1);
}

// Read the built index.html
const indexHtmlPath = path.join(BUILD_DIR, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  console.error('Error: build/index.html does not exist.');
  process.exit(1);
}
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Create 200.html - Render's primary SPA fallback
// When this file exists, Render serves it for any path that doesn't match a static file
const file200 = path.join(BUILD_DIR, '200.html');
fs.writeFileSync(file200, indexHtml);
console.log('Created: build/200.html (Render SPA fallback)');

// 2. Create 404.html - Secondary fallback
// Some edge cases may hit 404 before the rewrite rules apply
const file404 = path.join(BUILD_DIR, '404.html');
fs.writeFileSync(file404, indexHtml);
console.log('Created: build/404.html (404 fallback to SPA)');

// 3. Create directory index.html files for known routes
// This provides an extra layer of fallback for specific routes
for (const route of SPA_ROUTES) {
  const routeDir = path.join(BUILD_DIR, route);

  // Create directory if it doesn't exist
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }

  // Copy index.html to the route directory
  const routeIndex = path.join(routeDir, 'index.html');
  fs.writeFileSync(routeIndex, indexHtml);
  console.log(`Created: build/${route}/index.html`);
}

// 4. Verify _redirects was copied from public/
const redirectsPath = path.join(BUILD_DIR, '_redirects');
if (fs.existsSync(redirectsPath)) {
  console.log('Verified: build/_redirects exists');
} else {
  // Create _redirects if it wasn't copied (shouldn't happen with CRA)
  const redirectsContent = `# SPA Rewrite Rules for Render.com
/meeting/*  /index.html  200
/docs/*     /index.html  200
/download/* /index.html  200
/online-meetings  /index.html  200
/*          /index.html  200
`;
  fs.writeFileSync(redirectsPath, redirectsContent);
  console.log('Created: build/_redirects (fallback)');
}

console.log('\nSPA routing setup complete!');
console.log('The following mechanisms are in place:');
console.log('  - 200.html: Primary Render.com SPA fallback');
console.log('  - 404.html: Secondary fallback for edge cases');
console.log('  - _redirects: Explicit rewrite rules');
console.log('  - Directory index.html: Route-specific fallbacks');
