const fs = require('fs');
let content = fs.readFileSync('src/lib/themes.ts', 'utf8');
css = css.replace('#3f4a56', '#3f4a57');
fs.writeFileSync('src/lib/themes.ts', css);
console.log('Updated themes.ts');