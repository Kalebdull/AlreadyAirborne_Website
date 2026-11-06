import type { NextConfig } from "next";

// Cache Components is off on purpose: nearly every page reads the Supabase
// session cookie, so the request-time rendering model is the simpler fit.
const nextConfig: NextConfig = {
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
