import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is fully static: every route is prerendered at build time, so it
  // can be hosted on Vercel, Netlify, Cloudflare Pages, or any static host.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
