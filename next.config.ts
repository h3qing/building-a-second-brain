import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PostHog proxy below must receive paths exactly as the SDK sends them.
  skipTrailingSlashRedirect: true,
  // First-party proxy for PostHog (hosts mirror src/lib/analytics/config.ts).
  // The path is deliberately unobvious so ad blockers see same-origin traffic.
  // Static assets must be listed before the catch-all.
  async rewrites() {
    return [
      {
        source: "/parchment/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/parchment/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/parchment/flags",
        destination: "https://us.i.posthog.com/flags",
      },
    ];
  },
};

export default nextConfig;
