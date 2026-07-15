export const siteName = "AJN Marketing";

/** Canonical marketing tagline — used in meta and footer. */
export const tagline =
  "AJN Marketing becomes your marketing employee — keeping local businesses visible, consistent, and discoverable.";

export const siteDescription =
  "Stop worrying about marketing. AJN Marketing keeps your Google Business Profile strong, creates local content, manages reviews, and improves over time — with your approval every week.";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return fromEnv || "https://ajnmarketing.com";
}

/** Primary conversion destination for “Get Started”. */
export const getStartedHref = "/demo" as const;

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const footerExtraLinks = [
  { href: "/industries", label: "Industries" },
  { href: "/for-agencies", label: "For Agencies" },
  { href: "/demo", label: "Free Demo" },
  { href: "/signup", label: "Create Account" },
  { href: "/login", label: "Log In" },
] as const;

export const howItWorksSteps = [
  {
    step: "1",
    title: "Connect",
    description:
      "Share your business basics and connect Google Business Profile so we understand how you show up today.",
  },
  {
    step: "2",
    title: "Learn",
    description:
      "We study your services, location, reviews, competitors, and local market signals — including Market Context.",
  },
  {
    step: "3",
    title: "Create",
    description:
      "We draft profile updates, review replies, posts, and content tailored to your trade and your town.",
  },
  {
    step: "4",
    title: "Approve",
    description:
      "You get a simple weekly email or text. Review and approve in minutes — nothing goes live without your OK.",
  },
  {
    step: "5",
    title: "Publish",
    description:
      "Approved updates go live on Google and your web presence while you stay focused on the work that pays.",
  },
  {
    step: "6",
    title: "Improve",
    description:
      "We track what’s working, learn from outcomes, and refine recommendations so marketing gets sharper over time.",
  },
] as const;

export const platformPillars = [
  {
    title: "Be Found",
    description:
      "Strengthen your Google Business Profile and local visibility so nearby customers can find you.",
    items: [
      "Google Business Profile optimization",
      "Local visibility support",
      "Search-friendly business information",
    ],
  },
  {
    title: "Stay Active",
    description:
      "Publish useful, local content consistently — without adding marketing homework to your week.",
    items: [
      "Social and Google posts",
      "Blog and website-ready drafts",
      "Seasonal and timely marketing",
    ],
  },
  {
    title: "Build Trust",
    description:
      "Respond to reviews professionally and keep your reputation active and credible.",
    items: [
      "Review monitoring",
      "AI-assisted reply drafts for your approval",
      "Reputation consistency",
    ],
  },
  {
    title: "Learn & Improve",
    description:
      "Understand local opportunities and steadily improve what we recommend for your business.",
    items: [
      "Plain-English analytics",
      "Market Context signals",
      "Recommendation learning over time",
    ],
  },
] as const;

export const weeklyApprovalSteps = [
  {
    title: "Receive one email",
    description: "Your weekly package of recommended updates arrives by email or text.",
  },
  {
    title: "Review recommendations",
    description: "See what we suggest for Google, reviews, and local content — in plain English.",
  },
  {
    title: "Approve in minutes",
    description: "Tap approve, edit, or skip. You’re always in control.",
  },
  {
    title: "AJN handles the rest",
    description: "We publish what you approve and keep your marketing moving.",
  },
] as const;

export const features = [
  {
    title: "Google Business Profile optimization",
    description:
      "Your listing stays complete, accurate, and competitive so nearby customers choose you first.",
  },
  {
    title: "Review monitoring and reply drafts",
    description:
      "We watch new reviews and draft thoughtful replies for you to approve — fast, professional, on-brand.",
  },
  {
    title: "Local-aware content",
    description:
      "Posts and updates written for your city, your services, and the seasons — not generic filler.",
  },
  {
    title: "Weekly plain-English reports",
    description:
      "No dashboards to decode. Just a clear summary of progress and next steps you can read in two minutes.",
  },
  {
    title: "Email/SMS approval flow",
    description:
      "Approve updates from your phone between jobs. No meetings, no marketing homework.",
  },
  {
    title: "Market Context & learning",
    description:
      "Local signals and outcome learning help recommendations stay relevant as your market changes.",
  },
] as const;

export const pricingTiers = [
  {
    name: "Starter",
    price: 99,
    description: "For one-location businesses getting their Google presence in order.",
    highlights: [
      "Google Business Profile optimization",
      "Review monitoring and reply drafts",
      "2 local content posts per month",
      "Weekly email report",
    ],
  },
  {
    name: "Growth",
    price: 199,
    description: "For busy owners who want steady visibility and more local content.",
    highlights: [
      "Everything in Starter",
      "4 local content posts per month",
      "Competitor visibility tracking",
      "Priority review response drafts",
    ],
    featured: true,
  },
  {
    name: "Pro",
    price: 299,
    description: "For established trades ready to dominate their local market.",
    highlights: [
      "Everything in Growth",
      "8 local content posts per month",
      "Multi-location support",
      "Monthly strategy call (optional)",
    ],
  },
] as const;

export const targetIndustries = [
  "Contractors",
  "Plumbers",
  "Roofers",
  "HVAC",
  "Landscapers",
  "Electricians",
  "Painters",
  "Cleaners",
] as const;

export const guaranteeSummary =
  "Every plan includes our 90-day visibility guarantee. If your Google Business Profile visibility doesn’t improve, you don’t pay.";
