import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security upgrade marker (agent-driven upgrade run)
  experimental: {
    agentUpgrade: "security",
    // Next 16 caps request bodies at 10MB by default. The fleet-ledger bulk
    // image upload posts many MB at once (30 gallery photos ~= 95MB), so the
    // body was truncated mid-multipart and request.formData() threw
    // "expected boundary after body" -> every multi-image upload 500'd.
    proxyClientMaxBodySize: "150mb",
  },
  serverExternalPackages: ["better-sqlite3"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    remotePatterns: [
      { protocol: "https", hostname: "cpm2-bay.vercel.app" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost", port: "3001" },
    ],
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
