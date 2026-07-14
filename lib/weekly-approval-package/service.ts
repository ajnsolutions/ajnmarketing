import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import { collectWeeklyPackageItems } from "@/lib/weekly-approval-package/collect";
import {
  buildExecutiveSummary,
  formatWeekLabel,
  groupWeeklyPackageItems,
} from "@/lib/weekly-approval-package/group";
import { renderWeeklyApprovalPackageHtml } from "@/lib/weekly-approval-package/renderHtml";
import { renderWeeklyApprovalPackageText } from "@/lib/weekly-approval-package/renderText";
import {
  buildWeeklyPackageAbsoluteUrl,
  createWeeklyPackageSignedToken,
  resolveWeeklyPackageBaseUrl,
} from "@/lib/weekly-approval-package/signedLinks";
import type {
  GenerateWeeklyApprovalPackageInput,
  WeeklyApprovalPackage,
} from "@/lib/weekly-approval-package/types";
import { buildEmailActionAbsoluteUrl, createEmailActionToken } from "@/lib/email-actions/tokens";
import {
  createCorrelationId,
  withWorkflowTiming,
} from "@/lib/observability/workflowLogger";

/**
 * Build a complete Weekly Approval Package (HTML + plain text + signed links)
 * for one tenant. Does not send email, approve content, or publish.
 */
export async function generateWeeklyApprovalPackageForUser(
  input: GenerateWeeklyApprovalPackageInput,
  supabaseClient?: SupabaseClient
): Promise<WeeklyApprovalPackage> {
  const correlationId = createCorrelationId();
  return withWorkflowTiming(
    {
      correlationId,
      tenantUserId: input.userId,
      businessProfileId: input.businessProfileId,
      pipelineStage: "weekly_approval_package",
    },
    async () => generateWeeklyApprovalPackageForUserInner(input, supabaseClient)
  );
}

async function generateWeeklyApprovalPackageForUserInner(
  input: GenerateWeeklyApprovalPackageInput,
  supabaseClient?: SupabaseClient
): Promise<WeeklyApprovalPackage> {
  const supabase = supabaseClient ?? (await createClient());
  const now = input.now ?? new Date();
  const baseUrl = resolveWeeklyPackageBaseUrl(input.baseUrl);
  const ttl = input.linkTtlSeconds;

  // Defense in depth: profile must belong to this userId.
  const profile = await getBusinessProfileForUserId(supabase, input.userId);
  if (!profile || profile.id !== input.businessProfileId) {
    throw new Error("Business profile not found for this user.");
  }

  const approveAllToken = createWeeklyPackageSignedToken({
    purpose: "approve_all",
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    ttlSeconds: ttl,
    now,
  });
  const approvalCenterToken = createWeeklyPackageSignedToken({
    purpose: "approval_center",
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    ttlSeconds: ttl,
    now,
  });

  const approveAllUrl = buildWeeklyPackageAbsoluteUrl(baseUrl, approveAllToken);
  const approvalCenterUrl = buildWeeklyPackageAbsoluteUrl(baseUrl, approvalCenterToken);

  const rawItems = await collectWeeklyPackageItems({
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    supabase,
    buildItemReviewUrl: (itemId) =>
      buildWeeklyPackageAbsoluteUrl(
        baseUrl,
        createWeeklyPackageSignedToken({
          purpose: "review_item",
          userId: input.userId,
          businessProfileId: input.businessProfileId,
          itemId,
          ttlSeconds: ttl,
          now,
        })
      ),
  });

  // One-click email action links (see lib/email-actions) require a known recipient
  // email to bind the token to -- graceful degradation when it's unavailable rather
  // than minting a token whose recipient cross-check can never pass. Enriched BEFORE
  // grouping so both pkg.items and pkg.groups[].items carry the same action URLs.
  const recipientEmail = input.recipientEmail?.trim() || null;
  const eligibleContentApprovalIds = rawItems
    .map((item) => item.contentApprovalId)
    .filter((id): id is string => Boolean(id));

  let enrichedItems = rawItems;
  if (recipientEmail) {
    enrichedItems = rawItems.map((item) => {
      if (!item.contentApprovalId) return item;

      const approveActionUrl = buildEmailActionAbsoluteUrl(
        baseUrl,
        createEmailActionToken({
          action: "approve",
          userId: input.userId,
          businessProfileId: input.businessProfileId,
          emailRecipient: recipientEmail,
          contentApprovalId: item.contentApprovalId,
          recommendationId: item.recommendationId,
          ttlSeconds: ttl,
          now,
        })
      );
      const rejectActionUrl = buildEmailActionAbsoluteUrl(
        baseUrl,
        createEmailActionToken({
          action: "reject",
          userId: input.userId,
          businessProfileId: input.businessProfileId,
          emailRecipient: recipientEmail,
          contentApprovalId: item.contentApprovalId,
          recommendationId: item.recommendationId,
          ttlSeconds: ttl,
          now,
        })
      );

      return { ...item, approveActionUrl, rejectActionUrl };
    });
  }

  const approveAllActionUrl =
    recipientEmail && eligibleContentApprovalIds.length > 0
      ? buildEmailActionAbsoluteUrl(
          baseUrl,
          createEmailActionToken({
            action: "approve_all",
            userId: input.userId,
            businessProfileId: input.businessProfileId,
            emailRecipient: recipientEmail,
            contentApprovalIds: eligibleContentApprovalIds,
            ttlSeconds: ttl,
            now,
          })
        )
      : null;

  const groups = groupWeeklyPackageItems(enrichedItems);
  const items = groups.flatMap((g) => g.items);
  const executiveSummary = buildExecutiveSummary(items);
  const weekLabel = formatWeekLabel(now);
  const recipientName = input.recipientName?.trim() || "there";
  const businessName =
    input.businessName?.trim() || profile.business_name?.trim() || "Your Business";
  const subject =
    items.length === 0
      ? `AJN Marketing — nothing pending for ${businessName}`
      : `Your Weekly AJN Marketing Content is Ready (${items.length} item${items.length === 1 ? "" : "s"})`;

  const pkg: WeeklyApprovalPackage = {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    businessName,
    recipientEmail: input.recipientEmail ?? null,
    recipientName,
    generatedAt: now.toISOString(),
    weekLabel,
    subject,
    executiveSummary,
    groups,
    items,
    approveAllUrl,
    approvalCenterUrl,
    approveAllActionUrl,
    html: "",
    text: "",
    isEmpty: items.length === 0,
  };

  pkg.html = renderWeeklyApprovalPackageHtml(pkg);
  pkg.text = renderWeeklyApprovalPackageText(pkg);
  return pkg;
}

export async function generateWeeklyApprovalPackageForCurrentUser(options?: {
  baseUrl?: string;
}): Promise<WeeklyApprovalPackage | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getBusinessProfileForUserId(supabase, user.id);
  if (!profile) return null;

  const recipientName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  return generateWeeklyApprovalPackageForUser(
    {
      userId: user.id,
      businessProfileId: profile.id,
      businessName: profile.business_name?.trim() || "Your Business",
      recipientName,
      recipientEmail: user.email ?? null,
      baseUrl: resolveWeeklyPackageBaseUrl(options?.baseUrl),
    },
    supabase
  );
}
