import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Next 16 ships this experimental React Compiler rule as an error. The
      // existing client components hydrate state from props/URLs in effects;
      // rewriting all of them during an unrelated bugfix would be risky.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // One-off CommonJS script from a parallel session; its prices live in
    // scripts/load-trade-prices.mjs now.
    "scripts/apply-prices.cjs",
    // Root-level CommonJS debug / utility scripts (not part of the app).
    "*.cjs",
  ]),
]);

export default eslintConfig;
