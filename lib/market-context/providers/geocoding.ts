/**
 * Resolves US city/state to coordinates for Weather.gov lookups.
 *
 * TODO: Add persisted lat/lon on business_profiles and optional Google Geocoding
 * when WEATHER_GOV or paid geocoding accuracy is required beyond city-center estimates.
 */

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

export type GeocodedLocation = {
  latitude: number;
  longitude: number;
  label: string;
  source: "census" | "open-meteo";
};

export function normalizeUsStateCode(state: string | null | undefined): string | null {
  if (!state?.trim()) return null;

  const trimmed = state.trim();
  const upper = trimmed.toUpperCase();

  if (US_STATE_CODES.has(upper)) {
    return upper;
  }

  return US_STATE_NAMES[trimmed.toLowerCase()] ?? null;
}

export function isUsLocation(state: string | null | undefined): boolean {
  return normalizeUsStateCode(state) !== null;
}

function buildAddressLine(city: string, stateCode: string): string {
  return `${city}, ${stateCode}`;
}

async function geocodeWithCensus(city: string, stateCode: string): Promise<GeocodedLocation | null> {
  const address = encodeURIComponent(buildAddressLine(city, stateCode));
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${address}&benchmark=Public_AR_Current&format=json`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    result?: {
      addressMatches?: Array<{
        matchedAddress?: string;
        coordinates?: { x?: number; y?: number };
      }>;
    };
  };

  const match = payload.result?.addressMatches?.[0];
  const longitude = match?.coordinates?.x;
  const latitude = match?.coordinates?.y;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return {
    latitude,
    longitude,
    label: match?.matchedAddress ?? buildAddressLine(city, stateCode),
    source: "census",
  };
}

async function geocodeWithOpenMeteo(city: string, stateCode: string): Promise<GeocodedLocation | null> {
  const params = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json",
    countryCode: "US",
  });

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    results?: Array<{
      name?: string;
      admin1?: string;
      latitude?: number;
      longitude?: number;
    }>;
  };

  const result =
    payload.results?.find((entry) => entry.admin1?.toUpperCase() === stateCode) ??
    payload.results?.[0];

  if (
    typeof result?.latitude !== "number" ||
    typeof result?.longitude !== "number"
  ) {
    return null;
  }

  return {
    latitude: result.latitude,
    longitude: result.longitude,
    label: `${result.name ?? city}, ${stateCode}`,
    source: "open-meteo",
  };
}

export async function resolveUsCoordinates(input: {
  city?: string | null;
  state?: string | null;
}): Promise<GeocodedLocation | null> {
  const city = input.city?.trim();
  const stateCode = normalizeUsStateCode(input.state);

  if (!city || !stateCode) {
    return null;
  }

  try {
    const census = await geocodeWithCensus(city, stateCode);
    if (census) return census;
  } catch {
    // Fall through to alternate geocoder.
  }

  try {
    return await geocodeWithOpenMeteo(city, stateCode);
  } catch {
    return null;
  }
}
