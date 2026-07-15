import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const routes = [
    "",
    "/features",
    "/how-it-works",
    "/pricing",
    "/about",
    "/contact",
    "/industries",
    "/demo",
    "/for-agencies",
    "/ai-demo",
  ];

  return routes.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
