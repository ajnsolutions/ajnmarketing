import type { SupabaseClient } from "@supabase/supabase-js";

export type SmartUploadFactEmbeddingRecord = {
  id: string;
  user_id: string;
  business_profile_id: string;
  fact_id: string;
  provider_id: string;
  dimensions: number;
  embedding: number[];
  created_at: string;
};

export async function upsertFactEmbedding(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    factId: string;
    providerId: string;
    dimensions: number;
    embedding: number[];
  },
): Promise<boolean> {
  const { error } = await supabase.from("smart_upload_fact_embeddings").upsert(
    {
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      fact_id: input.factId,
      provider_id: input.providerId,
      dimensions: input.dimensions,
      embedding: input.embedding,
    },
    { onConflict: "fact_id,provider_id" },
  );

  return !error;
}

export async function getFactEmbeddingsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  providerId: string,
): Promise<SmartUploadFactEmbeddingRecord[]> {
  const { data, error } = await supabase
    .from("smart_upload_fact_embeddings")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("provider_id", providerId);

  if (error || !data) return [];
  return data as SmartUploadFactEmbeddingRecord[];
}
