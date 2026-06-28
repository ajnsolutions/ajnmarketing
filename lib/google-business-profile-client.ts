import type { GoogleBusinessProfileConnectionStatus } from "@/lib/google-business-profile/types";

export async function fetchGoogleBusinessProfileStatus(): Promise<{
  status: GoogleBusinessProfileConnectionStatus | null;
  error?: string;
}> {
  const response = await fetch("/api/google-business-profile/status", { method: "GET" });
  const payload = (await response.json()) as {
    status?: GoogleBusinessProfileConnectionStatus;
    error?: string;
  };

  if (!response.ok) {
    return { status: null, error: payload.error ?? "Unable to load Google connection status" };
  }

  return { status: payload.status ?? null };
}
