/**
 * Weekly Approval Package — types.
 * See docs/WEEKLY_APPROVAL_PACKAGE.md.
 */

import type { ClientRecommendationDecisionPackage } from "@/lib/recommendation-presentation/types";

export const WeeklyPackageItemKinds = {
  CONTENT_DRAFT: "content_draft",
  REVIEW_REPLY: "review_reply",
  GBP_UPDATE: "gbp_update",
} as const;

export type WeeklyPackageItemKind =
  (typeof WeeklyPackageItemKinds)[keyof typeof WeeklyPackageItemKinds];

export const WeeklyPackagePlatforms = {
  GOOGLE_BUSINESS_PROFILE: "google_business_profile",
  REVIEW_REPLY: "review_reply",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  LINKEDIN: "linkedin",
  EMAIL: "email",
  OTHER: "other",
} as const;

export type WeeklyPackagePlatform =
  (typeof WeeklyPackagePlatforms)[keyof typeof WeeklyPackagePlatforms];

export type WeeklyPackageItem = {
  id: string;
  kind: WeeklyPackageItemKind;
  platform: WeeklyPackagePlatform;
  platformLabel: string;
  title: string;
  summary: string;
  recommendationId: string | null;
  contentApprovalId: string | null;
  reviewId: string | null;
  /** Client presentation package when this item is recommendation-linked. */
  recommendationPackage: ClientRecommendationDecisionPackage | null;
  whyNow: string | null;
  expectedBenefit: string | null;
  createdAt: string;
  /** Signed, time-limited link into the Approval Center for this item ("Edit"). */
  reviewUrl: string;
  /** One-click email action links (see lib/email-actions). Only set for items with a
   * contentApprovalId and only when a recipient email is known to bind the token to --
   * review-reply items and recipient-less generations leave these null, falling back to
   * reviewUrl/Approval Center only. */
  approveActionUrl: string | null;
  rejectActionUrl: string | null;
};

export type WeeklyPackagePlatformGroup = {
  platform: WeeklyPackagePlatform;
  platformLabel: string;
  items: WeeklyPackageItem[];
};

export type WeeklyPackageExecutiveSummary = {
  totalItems: number;
  headline: string;
  byPlatform: Array<{ platform: WeeklyPackagePlatform; label: string; count: number }>;
};

export type WeeklyApprovalPackage = {
  userId: string;
  businessProfileId: string;
  businessName: string;
  recipientEmail: string | null;
  recipientName: string;
  generatedAt: string;
  weekLabel: string;
  subject: string;
  executiveSummary: WeeklyPackageExecutiveSummary;
  groups: WeeklyPackagePlatformGroup[];
  items: WeeklyPackageItem[];
  approveAllUrl: string;
  approvalCenterUrl: string;
  /** One-click "Approve All" email action link (see lib/email-actions) -- executes
   * directly rather than redirecting into the Approval Center. Null when no recipient
   * email is known or there are no eligible (contentApprovalId-bearing) items. */
  approveAllActionUrl: string | null;
  html: string;
  text: string;
  isEmpty: boolean;
};

export type WeeklyPackageSignedLinkPurpose = "approve_all" | "review_item" | "approval_center";

export type WeeklyPackageSignedLinkPayload = {
  v: 1;
  purpose: WeeklyPackageSignedLinkPurpose;
  userId: string;
  businessProfileId: string;
  itemId?: string;
  exp: number;
};

export type GenerateWeeklyApprovalPackageInput = {
  userId: string;
  businessProfileId: string;
  businessName: string;
  recipientName?: string;
  recipientEmail?: string | null;
  /** Absolute origin for signed links, e.g. https://app.ajnmarketing.com */
  baseUrl: string;
  /** Link TTL in seconds (default 7 days). */
  linkTtlSeconds?: number;
  now?: Date;
};
