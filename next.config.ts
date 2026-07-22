import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bump body size limit for bulk photo uploads via server actions.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  eslint: {
    // Linting is run separately; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
