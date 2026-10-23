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

  it("keeps globals.css in sync with the picker data", () => {
    for (const palette of PALETTES) {
      assert.ok(
        css.includes(`[data-palette="${palette.id}"]`),
        `missing night block for ${palette.id}`,
      );
      assert.ok(
        css.includes(`[data-theme="paper"][data-palette="${palette.id}"]`),
        `missing daylight block for ${palette.id}`,
      );
      for (const mode of ["night", "paper"] as const) {
        for (const color of Object.values(palette[mode])) {
          assert.ok(
            css.toLowerCase().includes(color.toLowerCase()),
            `globals.css is missing ${color} from ${palette.id} ${mode}`,
          );
        }
      }
    }
  });

  it("removes the old green accent from the stylesheet", () => {
    for (const color of ["#74f0b4", "#2fbf82", "#0a7a4e", "#08603d", "#d8ffe8", "#baffd9"]) {
      assert.ok(!css.toLowerCase().includes(color), `old green ${color} still in globals.css`);
    }
  });
});
