import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a sub-folder of the repo; keep Next from treating the
  // parent folder as its root.
  outputFileTracingRoot: __dirname,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
