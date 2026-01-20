const fs = require('fs');
const path = require('path');

const version = {
  version: process.env.npm_package_version || '1.0.0',
  buildTime: new Date().toISOString()
};

const outputPath = path.join(__dirname, '..', 'public', 'version.json');

fs.writeFileSync(outputPath, JSON.stringify(version, null, 2));

console.log('Generated version.json:', version);
