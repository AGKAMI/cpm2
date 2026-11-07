const fs = require('fs');
const content = fs.readFileSync('src/lib/themes.ts', 'utf8');
const lines = content.split('\n');
console.log('Line 52:', JSON.stringify(lines[51]));
