const fs = require('fs');
const path = require('path');
const testFile = 'tests/themes.test.ts';
const content = fs.readFileSync(testFile, 'utf8');
const urlMatch = content.match(/new URL\("([^"]+)"\)/);
if (urlMatch) {
  console.log('URL in test:', urlMatch[1]);
  const resolved = new URL(urlMatch[1], import.meta.url);
  console.log('Resolved:', resolved.href);
  const resolvedPath = resolved.pathname;
  console.log('Resolved path:', resolvedPath);
  const resolvedFsPath = resolvedPath.startsWith('/') ? resolvedPath.slice(1) : resolvedPath;
  console.log('FS path:', resolvedFsPath);
  const cssContent = fs.readFileSync(resolvedFsPath, 'utf8');
  const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;
  const TOKEN = /--color-([a-z-]+):\s*(oklch\([^)]+\))/gi;
  function dayBlock(id) {
    return new RegExp('\\[data-theme="paper"\\]\\[data-palette="' + id + '"\\]\\s*\\{([^}]*)\\}').exec(cssContent)?.[1] ?? '';
  }
  const dayBody = dayBlock('titanium');
  console.log('Day block:', dayBody);
  const tokens = new Map();
  let mm;
  while ((m = TOKEN.exec(dayBody)) !== null) {
    tokens.set(m[1].toLowerCase(), m[2]);
  }
  const racing = tokens.get('racing');
  console.log('racing token:', racing);
}
