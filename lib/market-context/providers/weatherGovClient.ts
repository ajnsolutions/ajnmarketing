import "server-only";

const WEATHER_GOV_BASE = "https://api.weather.gov";

function weatherGovUserAgent(): string {
  return (
    process.env.WEATHER_GOV_USER_AGENT?.trim() ||
    "AJN Marketing Market Context (https://ajnmarketing.com)"
  );
}

export type WeatherGovForecastPeriod = {
  name: string;
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
};

export type WeatherGovForecast = {
  forecastUrl: string;
  office: string | null;
  gridId: string | null;
  periods: WeatherGovForecastPeriod[];
};

async function weatherGovFetch<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json",
      "User-Agent": weatherGovUserAgent(),
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

export async function fetchWeatherGovForecast(
  latitude: number,
  longitude: number
): Promise<WeatherGovForecast | null> {
  const pointsUrl = `${WEATHER_GOV_BASE}/points/${formatCoordinate(latitude)},${formatCoordinate(longitude)}`;

  const points = await weatherGovFetch<{
    properties?: {
      forecast?: string;
      gridId?: string;
      gridX?: number;
      gridY?: number;
    };
  }>(pointsUrl);

  const forecastUrl = points?.properties?.forecast;
  if (!forecastUrl) {
    return null;
  }

  const forecast = await weatherGovFetch<{
    properties?: {
      periods?: WeatherGovForecastPeriod[];
    };
  }>(forecastUrl);

  const periods = forecast?.properties?.periods ?? [];
  if (periods.length === 0) {
    return null;
  }

  return {
    forecastUrl,
    office: points.properties?.gridId ?? null,
    gridId: points.properties?.gridId ?? null,
    periods: periods.slice(0, 14),
  };
}

export function summarizeWeatherOutlook(periods: WeatherGovForecastPeriod[]): string {
  const daytime = periods.filter((period) => period.isDaytime).slice(0, 7);
  if (daytime.length === 0) {
    return periods[0]?.shortForecast ?? "Mixed conditions expected this week.";
  }

  const highlights = daytime
    .slice(0, 4)
    .map((period) => `${period.name}: ${period.shortForecast}`)
    .join("; ");

  return highlights;
}

export function findWeekendPeriods(
  periods: WeatherGovForecastPeriod[],
  referenceDate: Date
): WeatherGovForecastPeriod[] {
  return periods.filter((period) => {
    const start = new Date(period.startTime);
    const day = start.getDay();
    const daysUntil = Math.ceil(
      (start.setHours(0, 0, 0, 0) - new Date(referenceDate).setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24)
    );

    return (day === 6 || day === 0) && daysUntil >= 0 && daysUntil <= 7;
  });
}
