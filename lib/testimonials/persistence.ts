import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExtractedTestimonialKnowledgeItem,
  RawTestimonialInput,
  TestimonialIngestionMethod,
  TestimonialKnowledgeFactRecord,
  WebsiteTestimonialRecord,
} from "@/lib/testimonials/types";

export async function createTestimonial(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    testimonial: RawTestimonialInput;
    ingestionMethod: TestimonialIngestionMethod;
  },
): Promise<WebsiteTestimonialRecord | null> {
  const { data, error } = await supabase
    .from("website_testimonials")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      author_name: input.testimonial.authorName ?? null,
      author_title: input.testimonial.authorTitle ?? null,
      quote: input.testimonial.quote,
      source_url: input.testimonial.sourceUrl ?? null,
      rating: input.testimonial.rating ?? null,
      occurred_at: input.testimonial.occurredAt ?? null,
      ingestion_method: input.ingestionMethod,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return data as WebsiteTestimonialRecord;
}

export async function bulkCreateTestimonials(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    testimonials: RawTestimonialInput[];
    ingestionMethod: TestimonialIngestionMethod;
  },
): Promise<WebsiteTestimonialRecord[]> {
  if (input.testimonials.length === 0) return [];

  const { data, error } = await supabase
    .from("website_testimonials")
    .insert(
      input.testimonials.map((testimonial) => ({
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        author_name: testimonial.authorName ?? null,
        author_title: testimonial.authorTitle ?? null,
        quote: testimonial.quote,
        source_url: testimonial.sourceUrl ?? null,
        rating: testimonial.rating ?? null,
        occurred_at: testimonial.occurredAt ?? null,
        ingestion_method: input.ingestionMethod,
      })),
    )
    .select("*");

  if (error || !data) return [];
  return data as WebsiteTestimonialRecord[];
}

export async function getTestimonialForUser(
  supabase: SupabaseClient,
  userId: string,
  testimonialId: string,
): Promise<WebsiteTestimonialRecord | null> {
  const { data, error } = await supabase
    .from("website_testimonials")
    .select("*")
    .eq("user_id", userId)
    .eq("id", testimonialId)
    .maybeSingle();

  if (error || !data) return null;
  return data as WebsiteTestimonialRecord;
}

export async function listTestimonialsForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<WebsiteTestimonialRecord[]> {
  const { data, error } = await supabase
    .from("website_testimonials")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as WebsiteTestimonialRecord[];
}

/** Real deletion — facts cascade via FK. */
export async function deleteTestimonial(
  supabase: SupabaseClient,
  userId: string,
  testimonialId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("website_testimonials")
    .delete()
    .eq("user_id", userId)
    .eq("id", testimonialId);

  return !error;
}

export async function updateTestimonialFactCount(
  supabase: SupabaseClient,
  userId: string,
  testimonialId: string,
  factCount: number,
): Promise<void> {
  await supabase
    .from("website_testimonials")
    .update({ fact_count: factCount })
    .eq("user_id", userId)
    .eq("id", testimonialId);
}

export async function replaceKnowledgeFactsForTestimonial(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    testimonialId: string;
    items: ExtractedTestimonialKnowledgeItem[];
  },
): Promise<TestimonialKnowledgeFactRecord[]> {
  await supabase.from("testimonial_knowledge_facts").delete().eq("testimonial_id", input.testimonialId);

  await updateTestimonialFactCount(supabase, input.userId, input.testimonialId, input.items.length);

  if (input.items.length === 0) return [];

  const { data, error } = await supabase
    .from("testimonial_knowledge_facts")
    .insert(
      input.items.map((item) => ({
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        testimonial_id: input.testimonialId,
        category: item.category,
        fact: item.fact,
        source_excerpt: item.sourceExcerpt,
        confidence: item.confidence,
      })),
    )
    .select("*");

  if (error || !data) return [];
  return data as TestimonialKnowledgeFactRecord[];
}

export async function getActiveTestimonialKnowledgeForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<TestimonialKnowledgeFactRecord[]> {
  const { data, error } = await supabase
    .from("testimonial_knowledge_facts")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as TestimonialKnowledgeFactRecord[];
}
