import type { NextConfig } from "next";

// Baseline hardening headers. The CSP only restricts directives that cannot
// break the current pages (framing, plugins, <base>). form-action is left out
// because checkout and OAuth redirect to external hosts after a POST. A full
// script/style CSP needs nonces and is tracked in docs/audit/REMAINING_TASKS.md.
// Config headers win over a route handler's own value, so CSP and
// Referrer-Policy skip /auth/*: the confirmation interstitial sets a stricter
// CSP and no-referrer itself.
const pageHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  turbopack: { root: process.cwd() },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/((?!auth/).*)", headers: pageHeaders },
    ];
  },
};

export default nextConfig;
