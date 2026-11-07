const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf8');
// Fix: set color-racing to oklch(0.404 0.020 230.0) which equals #3f4a56
css = css.replace(/--color-racing:\s*oklch\([^)]+\);/, '--color-racing: oklch(0.404 0.020 230.0);');
fs.writeFileSync('src/app/globals.css', css);
console.log('Updated globals.css');

let themes = fs.readFileSync('src/lib/themes.ts', 'utf8');
css = css.replace('#3f4a57', '#3f4a56');
fs.writeFileSync('src/lib/themes.ts', css);
console.log('Updated themes.ts');
