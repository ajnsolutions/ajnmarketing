import type { MarketContextBriefWithItems } from "@/lib/market-context/types";

export async function fetchMarketContextBrief(): Promise<{
  briefWithItems: MarketContextBriefWithItems | null;
  error?: string;
}> {
  const response = await fetch("/api/market-context", { method: "GET" });
  const payload = (await response.json()) as {
    briefWithItems?: MarketContextBriefWithItems | null;
    error?: string;
  };

  if (!response.ok) {
    return { briefWithItems: null, error: payload.error ?? "Unable to load market context brief" };
  }

  return { briefWithItems: payload.briefWithItems ?? null };
}

export async function refreshMarketContextBrief(): Promise<{
  briefWithItems: MarketContextBriefWithItems | null;
  error?: string;
}> {
  const response = await fetch("/api/market-context", { method: "POST" });
  const payload = (await response.json()) as {
    briefWithItems?: MarketContextBriefWithItems | null;
    error?: string;
  };

  if (!response.ok) {
    return {
      briefWithItems: null,
      error: payload.error ?? "Unable to refresh market context brief",
    };
  }

  return { briefWithItems: payload.briefWithItems ?? null };
}
