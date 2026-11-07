const fs = require('fs');
const css = fs.readFileSync('src/app/globals.css', 'utf8');
const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;
const TOKEN = /--color-([a-z-]+):\s*(oklch\([^)]+\))/gi;
function dayBlock(id) {
  return new RegExp('\\[data-theme="paper"\\]\\[data-palette="' + id + '"\\]\\s*\\{([^}]*)\\}').exec(css)?.[1] ?? '';
}
const dayBody = dayBlock('titanium');
console.log('Day block:', dayBody);
const tokens = new Map();
let m;
while ((m = TOKEN.exec(dayBody)) !== null) {
  console.log('Token:', m[1], '=', m[2]);
  tokens.set(m[1].toLowerCase(), m[2]);
}
const racing = tokens.get('racing');
console.log('racing token:', racing);
if (racing) {
  const m2 = racing.match(OKLCH);
  if (m2) {
    const L = Number(m2[1]), C = Number(m2[2]), H = Number(m2[3]);
    console.log('L,C,H:', L, C, H);
    function oklchToHex(L, C, H) {
      const hr = (H * Math.PI) / 180;
      const a = C * Math.cos(hr);
      const b = C * Math.sin(hr);
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.8948417775 * a - 1.2914855480 * b;
      const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
      const lin = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      ];
      const channels = lin.map((c) => {
        const v = Math.min(1, Math.max(0, c));
        const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(srgb * 255);
      });
      return '#' + channels.map((v) => v.toString(16).padStart(2, '0')).join('');
    }
    const hex = oklchToHex(L, C, H);
    console.log('Hex:', hex);
  }
}
