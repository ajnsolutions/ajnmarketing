import type {
  ContentGenerationRequest,
  ContentGenerationResult,
} from "@/lib/content-generator/types";

export async function generateContent(
  request: ContentGenerationRequest
): Promise<{ result: ContentGenerationResult | null; error?: string }> {
  const response = await fetch("/api/content-generator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as {
    result?: ContentGenerationResult | null;
    error?: string;
  };

  if (!response.ok) {
    return { result: null, error: payload.error ?? "Unable to generate content" };
  }

  return { result: payload.result ?? null };
}
