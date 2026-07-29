import "server-only";

import { composeExternalIntelligence } from "@/lib/external-intelligence/compose";
import { normalizeProviderBatch } from "@/lib/external-intelligence/normalize";
import {
  createExternalIntelligenceProviderRegistry,
  type ExternalIntelligenceProvider,
} from "@/lib/external-intelligence/provider";
import { createDesignedExternalProviders } from "@/lib/external-intelligence/providers/designed";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";

/**
 * Business Brain External Intelligence service — generate once, reuse everywhere.
 * Foundation: provider interfaces only (designed providers return empty signals).
 * Pass `providers` in tests / Phase 2 to inject real sources.
 *
 * Future consumers: Recommendation Engine, Growth Advisor, Marketing Health,
 * Smart Uploads, AI agents. No consumer should re-analyze raw provider payloads.
 */
export async function getExternalIntelligence(input: {
  userId: string;
  businessProfileId: string;
  providers?: ExternalIntelligenceProvider[];
  knownGoalKeys?: string[];
  now?: Date;
}): Promise<ExternalIntelligence> {
  const providers = input.providers ?? createDesignedExternalProviders();
  const registry = createExternalIntelligenceProviderRegistry(providers);
  const now = input.now ?? new Date();

  const signals = [];
  for (const provider of registry.values()) {
    const result = await provider.fetchSignals({
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      knownGoalKeys: input.knownGoalKeys,
      now,
    });
    signals.push(
      ...normalizeProviderBatch({
        providerId: result.providerId,
        sourceLabel: result.sourceLabel,
        signals: result.signals,
        now,
      }),
    );
  }

  return composeExternalIntelligence({
    businessProfileId: input.businessProfileId,
    signals,
    knownGoalKeys: input.knownGoalKeys,
    now,
  });
}
