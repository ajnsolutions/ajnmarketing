import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-content";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/onboarding/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
