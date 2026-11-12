import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // lesson materials and covers are uploaded through Server Actions
    serverActions: { bodySizeLimit: "50mb" },
    proxyClientMaxBodySize: "50mb",
  },
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb"],
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
