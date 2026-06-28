import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";

export async function fetchAiMarketingProfile(): Promise<{
  profile: AiMarketingProfile | null;
  error?: string;
}> {
  const response = await fetch("/api/ai-marketing-profile", { method: "GET" });
  const payload = (await response.json()) as {
    profile?: AiMarketingProfile | null;
    error?: string;
  };

  if (!response.ok) {
    return { profile: null, error: payload.error ?? "Unable to load AI marketing profile" };
  }

  return { profile: payload.profile ?? null };
}

export async function refreshAiMarketingProfile(): Promise<{
  profile: AiMarketingProfile | null;
  error?: string;
}> {
  const response = await fetch("/api/ai-marketing-profile", { method: "POST" });
  const payload = (await response.json()) as {
    profile?: AiMarketingProfile | null;
    error?: string;
  };

  if (!response.ok) {
    return { profile: null, error: payload.error ?? "Unable to refresh AI marketing profile" };
  }

  return { profile: payload.profile ?? null };
}
