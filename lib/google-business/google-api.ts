import "server-only";

export async function googleApiFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & { error?: { message?: string; status?: string } };

  if (!response.ok) {
    const message =
      payload.error?.message ??
      `Google API request failed (${response.status}) for ${url}`;
    throw new Error(message);
  }

  return payload;
}

export const GOOGLE_ACCOUNT_MANAGEMENT_BASE =
  "https://mybusinessaccountmanagement.googleapis.com/v1";
export const GOOGLE_BUSINESS_INFORMATION_BASE =
  "https://mybusinessbusinessinformation.googleapis.com/v1";
export const GOOGLE_MY_BUSINESS_V4_BASE = "https://mybusiness.googleapis.com/v4";
export const GOOGLE_BUSINESS_PERFORMANCE_BASE =
  "https://businessprofileperformance.googleapis.com/v1";
