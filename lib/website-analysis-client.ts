import type { WebsiteAnalysis } from "@/lib/website-analysis/types";

export async function fetchWebsiteAnalysis(): Promise<{
  analysis: WebsiteAnalysis | null;
  error?: string;
}> {
  const response = await fetch("/api/website-analysis", { method: "GET" });
  const payload = (await response.json()) as {
    analysis?: WebsiteAnalysis | null;
    error?: string;
  };

  if (!response.ok) {
    return { analysis: null, error: payload.error ?? "Unable to load website analysis" };
  }

  return { analysis: payload.analysis ?? null };
}

export async function queueWebsiteAnalysis(): Promise<{
  analysis: WebsiteAnalysis | null;
  error?: string;
}> {
  const response = await fetch("/api/website-analysis", { method: "POST" });
  const payload = (await response.json()) as {
    analysis?: WebsiteAnalysis | null;
    error?: string;
  };

  if (!response.ok) {
    return { analysis: null, error: payload.error ?? "Unable to start website analysis" };
  }

  return { analysis: payload.analysis ?? null };
}
