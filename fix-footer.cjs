const fs = require('fs');
let css = fs.readFileSync('src/components/AppShell.tsx', 'utf8');
css = css.replace('className="relative mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 sm:pb-16"', 'className="relative mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 sm:pb-16 bg-background"');
fs.writeFileSync('src/components/AppShell.tsx', css);
console.log('done');