const fs = require('fs');
const css = fs.readFileSync('src/app/globals.css', 'utf8');
const idx = css.indexOf('[data-theme="paper"][data-palette="titanium"]');
console.log(css.substring(idx, idx + 300));
