/**
 * Structural regressions that must never come back:
 * - every page route has its own loading.tsx skeleton (per-page loaders),
 * - account photos never open in a new browser tab (in-app viewer only),
 * - exactly one <header> per shell (the global header rule).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("app structure", () => {
  it("every page route has a sibling loading.tsx skeleton", () => {
    const pages = walk(appDir).filter((f) => f.endsWith("page.tsx"));
    assert.ok(pages.length >= 40, `expected 40+ pages, found ${pages.length}`);
    const missing = pages.filter((p) => !existsSync(join(dirname(p), "loading.tsx")));
    assert.deepEqual(missing, [], `pages without loading.tsx: ${missing.join(", ")}`);
  });

  it("account images open in-app, never a new tab", () => {
    const page = readFileSync(join(appDir, "accounts", "[id]", "page.tsx"), "utf8");
    assert.ok(!page.includes("window.open"), "account page must not window.open images");
    assert.ok(page.includes("ImageLightbox"), "account page must use the in-app viewer");
  });

  it("one global header per shell, none in page components", () => {
    const storeShell = readFileSync(join(appDir, "..", "components", "StoreShell.tsx"), "utf8");
    assert.equal((storeShell.match(/<header/g) ?? []).length, 1);
    for (const name of ["GameHubShell.tsx", "GameSectionList.tsx", "StoreHub.tsx"]) {
      const raw = readFileSync(join(appDir, "..", "components", name), "utf8");
      // Strip comments first — an explanatory "NOT a <header>" note is not JSX.
      const src = raw.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      assert.ok(!/<header[\s>]/.test(src), `${name} must not render its own <header>`);
    }
  });

  it("no hard-coded light-slate skeleton fills remain", () => {
    const globals = readFileSync(join(appDir, "globals.css"), "utf8");
    assert.ok(globals.includes(".skel-block"), "theme-aware skeleton fill must exist");
    const skelDir = join(appDir, "..", "components", "skeleton");
    for (const file of readdirSync(skelDir)) {
      const src = readFileSync(join(skelDir, file), "utf8");
      assert.ok(!src.includes("#e2e8f0") && !src.includes("#f1f5f9"), `${file} hard-codes a light fill`);
    }
  });
});
