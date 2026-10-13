import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  turbopack: { root: process.cwd() },
};

export default nextConfig;
