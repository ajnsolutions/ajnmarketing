import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { composeCustomerVoiceIntelligence } from "@/lib/customer-voice/compose";
import { normalizeProviderBatch } from "@/lib/customer-voice/normalize";
import { createProviderRegistry, type CustomerVoiceProvider } from "@/lib/customer-voice/provider";
import { createGoogleBusinessReviewsProvider } from "@/lib/customer-voice/providers/googleBusinessReviews";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { GoogleBusinessReview } from "@/lib/google-business/types";
import { createClient } from "@/lib/supabase/server";

async function loadGoogleReviews(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<GoogleBusinessReview[]> {
  const { data, error } = await supabase
    .from("google_business_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("review_created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("[CustomerVoice] google reviews load failed", {
      businessProfileId,
      error: error.message,
    });
    return [];
  }
  return (data as GoogleBusinessReview[] | null) ?? [];
}

function defaultProviders(supabase: SupabaseClient): CustomerVoiceProvider[] {
  return [
    createGoogleBusinessReviewsProvider(async (context) =>
      loadGoogleReviews(supabase, context.userId, context.businessProfileId),
    ),
  ];
}

/**
 * Business Brain Customer Voice service — generate intelligence once, reuse everywhere.
 * Phase 1: foundation only (no Growth Advisor / Marketing Health UI wiring).
 */
export async function getCustomerVoiceIntelligence(input: {
  userId: string;
  businessProfileId: string;
  supabase?: SupabaseClient;
  providers?: CustomerVoiceProvider[];
  knownServices?: string[];
  now?: Date;
}): Promise<CustomerVoiceIntelligence> {
  const supabase = input.supabase ?? (await createClient());
  const providers = input.providers ?? defaultProviders(supabase);
  const registry = createProviderRegistry(providers);
  const now = input.now ?? new Date();

  const evidence = [];
  for (const provider of registry.values()) {
    const result = await provider.fetchEvidence({
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      now,
    });
    evidence.push(
      ...normalizeProviderBatch({
        providerId: result.providerId,
        sourceLabel: result.sourceLabel,
        evidence: result.evidence,
        knownServices: input.knownServices,
        now,
      }),
    );
  }

  return composeCustomerVoiceIntelligence({
    businessProfileId: input.businessProfileId,
    evidence,
    now,
  });
}

export async function getCustomerVoiceIntelligenceForCurrentUser(
  businessProfileId: string,
): Promise<CustomerVoiceIntelligence | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return getCustomerVoiceIntelligence({
    userId: user.id,
    businessProfileId,
    supabase,
  });
}
