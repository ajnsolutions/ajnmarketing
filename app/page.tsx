import type { Metadata } from "next";
import {
  HomeAiSearch,
  HomeFinalCta,
  HomeGuarantee,
  HomeHero,
  HomeHowItWorks,
  HomePillars,
  HomePricingTeaser,
  HomeProblem,
  HomeSolution,
  HomeTrust,
  HomeWeeklyApproval,
} from "@/components/home/homepage-sections";
import { organizationJsonLd } from "@/lib/site-metadata";
import { siteDescription, siteName } from "@/lib/site-content";

export const metadata: Metadata = {
  title: {
    absolute: `${siteName} | Your Local Marketing Employee`,
  },
  description: siteDescription,
};

export default function HomePage() {
  const jsonLd = organizationJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeHero />
      <HomeProblem />
      <HomeSolution />
      <HomeHowItWorks />
      <HomePillars />
      <HomeWeeklyApproval />
      <HomeAiSearch />
      <HomeTrust />
      <HomeGuarantee />
      <HomePricingTeaser />
      <HomeFinalCta />
    </>
  );
}
