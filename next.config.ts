import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  generateBuildId: async () => {
    // Force cache bust on each deploy
    return `build-${Date.now()}`;
  },
};

export default nextConfig;
