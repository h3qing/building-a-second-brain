import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // The site is fully static: every route is prerendered at build time, so it
  // can be hosted on Vercel, Netlify, Cloudflare Pages, or any static host.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // This project sits inside a larger repository that has its own lockfile.
  // Pin the root so Turbopack resolves against this directory, not the parent.
  turbopack: { root: here },
};

export default nextConfig;
