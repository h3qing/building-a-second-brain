// Emitted as a static file at build time (required by `output: "export"`).
export const dynamic = "force-static";

import type { MetadataRoute } from "next";
import { practiceAreas, site } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "/", priority: 1 },
    { path: "/practice-areas", priority: 0.9 },
    { path: "/attorney", priority: 0.8 },
    { path: "/contact", priority: 0.9 },
    { path: "/disclaimer", priority: 0.2 },
  ];

  return [
    ...routes.map((route) => ({
      url: `${site.url}${route.path}`,
      lastModified: new Date(),
      priority: route.priority,
    })),
    ...practiceAreas.map((area) => ({
      url: `${site.url}/practice-areas/${area.slug}`,
      lastModified: new Date(),
      priority: 0.7,
    })),
  ];
}
