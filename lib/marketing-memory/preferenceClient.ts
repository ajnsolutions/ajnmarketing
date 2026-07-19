/**
 * Browser-safe helpers for Marketing Memory preference/override HTTP routes.
 * Server modules stay in preferenceService / overrideService (server-only).
 */

export type PreferenceApiRow = {
  id: string;
  preference_type: string;
  factor_type: string | null;
  factor_value: string | null;
  instruction_text: string;
  is_active: boolean;
  active_until: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type OverrideApiRow = {
  id: string;
  override_type: string;
  factor_type: string | null;
  factor_value: string | null;
  is_permanent: boolean;
  notes: string | null;
  promoted_to_preference_id: string | null;
  created_at: string;
};

export async function fetchMarketingMemoryPreferences(): Promise<{
  preferences: PreferenceApiRow[];
  disabledContextCategories: string[];
}> {
  const response = await fetch("/api/marketing-memory/preferences");
  if (!response.ok) {
    throw new Error("Failed to load preferences");
  }
  const data = (await response.json()) as {
    preferences?: PreferenceApiRow[];
    disabledContextCategories?: string[];
  };
  return {
    preferences: data.preferences ?? [],
    disabledContextCategories: data.disabledContextCategories ?? [],
  };
}

export async function saveMarketingMemoryPreference(body: Record<string, unknown>): Promise<PreferenceApiRow> {
  const response = await fetch("/api/marketing-memory/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { preference?: PreferenceApiRow; error?: string };
  if (!response.ok || !data.preference) {
    throw new Error(data.error ?? "Failed to save preference");
  }
  return data.preference;
}

export async function deactivateMarketingMemoryPreference(id: string): Promise<PreferenceApiRow> {
  const response = await fetch("/api/marketing-memory/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = (await response.json()) as { preference?: PreferenceApiRow; error?: string };
  if (!response.ok || !data.preference) {
    throw new Error(data.error ?? "Failed to deactivate preference");
  }
  return data.preference;
}

export async function fetchMarketingMemoryOverrides(): Promise<OverrideApiRow[]> {
  const response = await fetch("/api/marketing-memory/overrides");
  if (!response.ok) {
    throw new Error("Failed to load overrides");
  }
  const data = (await response.json()) as { overrides?: OverrideApiRow[] };
  return data.overrides ?? [];
}
