import type { Metadata } from "next";
import { getSiteUrl, siteDescription, siteName, tagline } from "@/lib/site-content";

type PageMetaInput = {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description = siteDescription,
  path = "/",
  noIndex = false,
}: PageMetaInput): Metadata {
  const siteUrl = getSiteUrl();
  const url = path === "/" ? siteUrl : `${siteUrl}${path}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName,
      title: `${title} | ${siteName}`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteName}`,
      description,
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

export function buildRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${siteName} | Your Local Marketing Employee`,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    applicationName: siteName,
    keywords: [
      "local marketing",
      "Google Business Profile",
      "review management",
      "local SEO for contractors",
      "done-for-you marketing",
    ],
    icons: {
      icon: "/images/AJN marketing_favicon.png",
      apple: "/images/AJN marketing_favicon.png",
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: siteUrl,
      siteName,
      title: `${siteName} | Your Local Marketing Employee`,
      description: siteDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteName} | Your Local Marketing Employee`,
      description: tagline,
    },
  };
}

export function organizationJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    description: siteDescription,
    logo: `${siteUrl}/images/AJN_marketing_logo.png`,
  };
}
