import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_BASE,
  PALETTE_IDS,
} from "../src/lib/themes.ts";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const HEX = /^#[0-9a-f]{6}$/i;

/** oklch(L C H) -> sRGB #rrggbb (Björn Ottosson's OKLab matrices). */
function oklchToHex(L: number, C: number, H: number): string {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
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
  return "#" + channels.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;
const TOKEN = /--color-([a-z-]+):\s*(oklch\([^)]+\))/gi;

/** Pull `--color-<name>` oklch values out of a css block body. */
function tokens(body: string): Map<string, string> {
  const map = new Map<string, string>();
  let m;
  while ((m = TOKEN.exec(body)) !== null) {
    map.set(m[1].toLowerCase(), m[2]);
  }
  return map;
}

/** Body of `[data-palette="<id>"] { ... }` (the night accent overrides). */
function nightBlock(id: string): string {
  return new RegExp(`\\[data-palette="${id}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
}

/** Body of `[data-theme="paper"][data-palette="<id>"] { ... }`. */
function dayBlock(id: string): string {
  return new RegExp(`\\[data-theme="paper"\\]\\[data-palette="${id}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
}

/** Body of the `@theme { ... }` primitives block (night neutrals). */
const themeBody = /@theme\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

/** Body of the standalone daylight token block `[data-theme="paper"] { ... }`. */
const dayTokensBody = /\n\[data-theme="paper"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

/** Picker hex vs css oklch, within +/-1 per channel (formatting round-off). */
function hexClose(cssColor: string, pickerHex: string): boolean {
  const m = cssColor.match(OKLCH);
  assert.ok(m, `not an oklch colour: ${cssColor}`);
  const cssHex = oklchToHex(Number(m[1]), Number(m[2]), Number(m[3]));
  return (
    Math.abs(parseInt(cssHex.slice(1, 3), 16) - parseInt(pickerHex.slice(1, 3), 16)) <= 1 &&
    Math.abs(parseInt(cssHex.slice(3, 5), 16) - parseInt(pickerHex.slice(3, 5), 16)) <= 1 &&
    Math.abs(parseInt(cssHex.slice(5, 7), 16) - parseInt(pickerHex.slice(5, 7), 16)) <= 1
  );
}

describe("theme palettes", () => {
  it("ships eight unique palettes with the default in the list", () => {
    assert.equal(PALETTES.length, 8);
    assert.deepEqual(
      PALETTES.map((palette) => palette.id),
      [...PALETTE_IDS],
    );
    assert.ok(PALETTE_IDS.includes(DEFAULT_PALETTE));
  });

  it("keeps both single-tone and double-tone groups populated", () => {
    const single = PALETTES.filter((palette) => palette.tone === "single");
    const double = PALETTES.filter((palette) => palette.tone === "double");
    assert.ok(single.length >= 3);
    assert.ok(double.length >= 3);
  });

  it("uses six-digit hex colours for every mode", () => {
    for (const palette of PALETTES) {
      for (const mode of ["night", "paper"] as const) {
        const colors = palette[mode];
        for (const color of [colors.primary, colors.deep, colors.secondary]) {
          assert.match(color, HEX, `${palette.id} ${mode} has an invalid colour`);
        }
      }
    }
    for (const mode of ["night", "paper"] as const) {
      for (const color of Object.values(PALETTE_BASE[mode])) {
        assert.match(color, HEX);
      }
    }
  });

  it("keeps globals.css (oklch) in sync with the picker's hex labels", () => {
    // picker role -> css token
    type AccentRole = "primary" | "deep" | "secondary";
    const role: Record<AccentRole, string> = {
      primary: "racing",
      deep: "racing-deep",
      secondary: "blueprint",
    };
    for (const palette of PALETTES) {
      assert.ok(
        css.includes(`[data-palette="${palette.id}"]`),
        `missing night block for ${palette.id}`,
      );
      assert.ok(
        css.includes(`[data-theme="paper"][data-palette="${palette.id}"]`),
        `missing daylight block for ${palette.id}`,
      );
      const nightBody = nightBlock(palette.id);
      const dayBody = dayBlock(palette.id);
      assert.ok(nightBody, `night block not parsed for ${palette.id}`);
      assert.ok(dayBody, `daylight block not parsed for ${palette.id}`);
      const nightTokens = tokens(nightBody);
      const dayTokens = tokens(dayBody);
      for (const roleName of Object.keys(role) as AccentRole[]) {
        const tokenName = role[roleName];
        const cssValue = nightTokens.get(tokenName);
        assert.ok(cssValue, `globals.css night ${palette.id} missing --color-${tokenName}`);
        assert.ok(
          hexClose(cssValue, palette.night[roleName]),
          `globals.css ${palette.id} night --color-${tokenName} (${cssValue}) drifted from picker ${palette.night[roleName]}`,
        );
        const dayValue = dayTokens.get(tokenName);
        assert.ok(dayValue, `globals.css daylight ${palette.id} missing --color-${tokenName}`);
        assert.ok(
          hexClose(dayValue, palette.paper[roleName]),
          `globals.css ${palette.id} daylight --color-${tokenName} (${dayValue}) drifted from picker ${palette.paper[roleName]}`,
        );
      }
    }
  });

  it("keeps the neutral surfaces in sync with PALETTE_BASE", () => {
    assert.ok(themeBody, "@theme block not found");
    assert.ok(dayTokensBody, 'daylight [data-theme="paper"] block not found');
    const nightTokens = tokens(themeBody);
    const dayTokens = tokens(dayTokensBody);
    type SurfaceRole = "bg" | "surface" | "ink";
    const surfaceRole: Record<SurfaceRole, string> = {
      bg: "paper",
      surface: "paper-raised",
      ink: "ink",
    };
    for (const roleName of Object.keys(surfaceRole) as SurfaceRole[]) {
      const tokenName = surfaceRole[roleName];
      const nightValue = nightTokens.get(tokenName);
      assert.ok(nightValue, `@theme missing --color-${tokenName}`);
      assert.ok(
        hexClose(nightValue, PALETTE_BASE.night[roleName]),
        `night --color-${tokenName} (${nightValue}) drifted from PALETTE_BASE ${PALETTE_BASE.night[roleName]}`,
      );
      const dayValue = dayTokens.get(tokenName);
      assert.ok(dayValue, `daylight block missing --color-${tokenName}`);
      assert.ok(
        hexClose(dayValue, PALETTE_BASE.paper[roleName]),
        `daylight --color-${tokenName} (${dayValue}) drifted from PALETTE_BASE ${PALETTE_BASE.paper[roleName]}`,
      );
    }
  });

  it("removes the old green accent from the stylesheet", () => {
    for (const color of ["#74f0b4", "#2fbf82", "#0a7a4e", "#08603d", "#d8ffe8", "#baffd9"]) {
      assert.ok(!css.toLowerCase().includes(color), `old green ${color} still in globals.css`);
    }
  });
});
