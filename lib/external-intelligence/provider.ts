/**
 * External Intelligence provider contract.
 *
 * Future providers (Google Trends, Weather, Local Events, Industry News,
 * GBP Insights, Competitor Monitoring, Holiday Calendars, Search Console)
 * implement this interface without changing Business Brain consumers.
 *
 * Foundation ships interfaces only — no live provider integrations.
 */

import type {
  ExternalIntelligenceProviderContext,
  ExternalIntelligenceProviderId,
  ProviderSignalInput,
} from "@/lib/external-intelligence/types";

export type ExternalIntelligenceProviderResult = {
  providerId: ExternalIntelligenceProviderId;
  sourceLabel: string;
  fetchedAt: string;
  signals: ProviderSignalInput[];
  /** Honest notes for operators/diagnostics — never customer copy. */
  notes?: string[];
};

export interface ExternalIntelligenceProvider {
  readonly id: ExternalIntelligenceProviderId;
  readonly label: string;
  fetchSignals(
    context: ExternalIntelligenceProviderContext,
  ): Promise<ExternalIntelligenceProviderResult>;
}

export type ExternalIntelligenceProviderRegistry = ReadonlyMap<
  ExternalIntelligenceProviderId,
  ExternalIntelligenceProvider
>;

export function createExternalIntelligenceProviderRegistry(
  providers: readonly ExternalIntelligenceProvider[],
): ExternalIntelligenceProviderRegistry {
  const map = new Map<ExternalIntelligenceProviderId, ExternalIntelligenceProvider>();
  for (const provider of providers) {
    if (map.has(provider.id)) {
      throw new Error(`Duplicate External Intelligence provider id: ${provider.id}`);
    }
    map.set(provider.id, provider);
  }
  return map;
}

/**
 * Placeholder providers for registry design / future wiring.
 * Each returns empty signals — never fabricates market conditions.
 */
export function createUnimplementedProvider(
  id: ExternalIntelligenceProviderId,
  label: string,
): ExternalIntelligenceProvider {
  return {
    id,
    label,
    async fetchSignals() {
      return {
        providerId: id,
        sourceLabel: label,
        fetchedAt: new Date().toISOString(),
        signals: [],
        notes: [`Provider '${id}' is designed but not implemented in foundation.`],
      };
    },
  };
}
