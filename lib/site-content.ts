export const siteName = "AJN Marketing";

export const tagline =
  "We make sure your town finds you on Google — and you don't have to do anything.";

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/industries", label: "Industries" },
  { href: "/demo", label: "Free Demo" },
] as const;

export const howItWorksSteps = [
  {
    step: "1",
    title: "Scan",
    description:
      "We review your Google Business Profile, website, reviews, and local competitors so we know exactly where you stand.",
  },
  {
    step: "2",
    title: "Generate",
    description:
      "We create profile updates, review replies, and local content tailored to your trade and your town.",
  },
  {
    step: "3",
    title: "Approve",
    description:
      "You get a simple email or text. Tap approve — or skip if you're busy. Nothing goes live without your OK.",
  },
  {
    step: "4",
    title: "Publish",
    description:
      "Approved updates go live on Google and your web presence. You stay visible without lifting a finger.",
  },
  {
    step: "5",
    title: "Report",
    description:
      "Every week you get a plain-English report: what changed, what's working, and what we're doing next.",
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
    title: "Local-aware AI content",
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
      "Approve updates from your phone between jobs. No logins, no meetings, no marketing homework.",
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
