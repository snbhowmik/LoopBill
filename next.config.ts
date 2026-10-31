import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page here is per-user and data-driven, so plain dynamic rendering
  // is used instead of Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
