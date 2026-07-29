/**
 * Customer Voice provider contract.
 *
 * Future providers (Facebook, Yelp, surveys, NPS, tickets, chat, email)
 * implement this interface without changing Business Brain consumers.
 */

import type {
  CustomerVoiceProviderContext,
  CustomerVoiceProviderId,
  ProviderEvidenceInput,
} from "@/lib/customer-voice/types";

export type CustomerVoiceProviderResult = {
  providerId: CustomerVoiceProviderId;
  sourceLabel: string;
  fetchedAt: string;
  evidence: ProviderEvidenceInput[];
  /** Honest notes for operators/diagnostics — never customer copy. */
  notes?: string[];
};

export interface CustomerVoiceProvider {
  readonly id: CustomerVoiceProviderId;
  readonly label: string;
  fetchEvidence(context: CustomerVoiceProviderContext): Promise<CustomerVoiceProviderResult>;
}

export type CustomerVoiceProviderRegistry = ReadonlyMap<
  CustomerVoiceProviderId,
  CustomerVoiceProvider
>;

export function createProviderRegistry(
  providers: readonly CustomerVoiceProvider[],
): CustomerVoiceProviderRegistry {
  const map = new Map<CustomerVoiceProviderId, CustomerVoiceProvider>();
  for (const provider of providers) {
    if (map.has(provider.id)) {
      throw new Error(`Duplicate Customer Voice provider id: ${provider.id}`);
    }
    map.set(provider.id, provider);
  }
  return map;
}
