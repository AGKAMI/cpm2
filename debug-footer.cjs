const fs = require('fs');
const css = fs.readFileSync('src/components/AppShell.tsx', 'utf8');
const lines = css.split('\n');
for (let i = 349; i <= 356; i++) {
  console.log((i+1) + ': "' + lines[i] + '"');
}
