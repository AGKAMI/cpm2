/**
 * Deterministic SVG thumbnail generated from a car's name.
 *
 * A product with no uploaded photo used to render an empty grey box - the
 * `.no-photo-svg` div had a background but no content, so the card looked
 * broken. This returns a self-contained data URL that renders the car's name
 * over a dark gradient, so every card always shows something.
 *
 * Used as a CSS background-image rather than through next/image, because the
 * image optimizer refuses data: URLs.
 */
const A = String.fromCharCode(38); // ampersand

const ENTITIES: Record<string, string> = {
  [A]: A + "amp;",
  [String.fromCharCode(60)]: A + "lt;",
  [String.fromCharCode(62)]: A + "gt;",
  [String.fromCharCode(34)]: A + "quot;",
  [String.fromCharCode(39)]: A + "#39;",
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

export function coverImageFromName(name: string, w = 400, h = 500): string {
  const label = name.length > 26 ? `${name.slice(0, 26)}...` : name;
    // Gradient stop syntax is NOT a valid fill value on its own - it needs a
    // real <linearGradient> def referenced by url(#...).
    const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#1f2937"/>` +
    `<stop offset="50%" stop-color="#374151"/>` +
    `<stop offset="100%" stop-color="#1f2937"/>` +
    `</linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<text x="${w / 2}" y="${h / 2}" font-family="system-ui, -apple-system, sans-serif" ` +
    `font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle" ` +
    `dominant-baseline="middle" letter-spacing="1">${esc(label)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
