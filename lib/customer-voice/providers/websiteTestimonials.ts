/**
 * Website Testimonials — the second Customer Voice provider. Maps
 * website_testimonials rows into ProviderEvidenceInput, exactly mirroring
 * lib/customer-voice/providers/googleBusinessReviews.ts. Google Reviews and
 * Testimonials reinforce each other from here on purely through the
 * existing, already-multi-provider-aware normalize/compose pipeline — no
 * change needed there (Part 3).
 */

import type { CustomerVoiceProvider, CustomerVoiceProviderResult } from "@/lib/customer-voice/provider";
import type {
  CustomerVoiceProviderContext,
  ProviderEvidenceInput,
} from "@/lib/customer-voice/types";
import { CustomerVoiceProviderIds } from "@/lib/customer-voice/types";
import type { WebsiteTestimonialRecord } from "@/lib/testimonials/types";

export function mapTestimonialToEvidence(testimonial: WebsiteTestimonialRecord): ProviderEvidenceInput {
  return {
    externalId: testimonial.id,
    occurredAt: testimonial.occurred_at ?? testimonial.created_at,
    rating: testimonial.rating,
    text: testimonial.quote.trim(),
    language: "en",
    authorDisplayName: testimonial.author_name,
    metadata: {
      ingestionMethod: testimonial.ingestion_method,
      ...(testimonial.source_url ? { sourceUrl: testimonial.source_url } : {}),
    },
  };
}

export type WebsiteTestimonialsLoader = (
  context: CustomerVoiceProviderContext,
) => Promise<WebsiteTestimonialRecord[]>;

export function createWebsiteTestimonialsProvider(
  loadTestimonials: WebsiteTestimonialsLoader,
): CustomerVoiceProvider {
  return {
    id: CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS,
    label: "Website Testimonials",
    async fetchEvidence(context): Promise<CustomerVoiceProviderResult> {
      const testimonials = await loadTestimonials(context);
      const evidence = testimonials.map(mapTestimonialToEvidence).filter((item) => item.text.trim().length > 0);

      return {
        providerId: CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS,
        sourceLabel: "Website Testimonials",
        fetchedAt: (context.now ?? new Date()).toISOString(),
        evidence,
        notes:
          evidence.length === 0
            ? ["No website testimonials available for Customer Voice yet."]
            : undefined,
      };
    },
  };
}
