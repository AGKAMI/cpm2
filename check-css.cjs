const fs = require('fs');
const css = fs.readFileSync('src/app/globals.css', 'utf8');
const start = css.indexOf('[data-theme="paper"][data-palette="titanium"]');
console.log(css.substring(start, start + 250));
