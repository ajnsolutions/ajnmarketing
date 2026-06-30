import "server-only";

const NAGER_DATE_BASE = "https://date.nager.at/api/v3";

export type NagerHoliday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  types: string[];
};

export async function fetchNagerPublicHolidays(
  year: number,
  countryCode: string
): Promise<NagerHoliday[]> {
  const response = await fetch(
    `${NAGER_DATE_BASE}/PublicHolidays/${year}/${countryCode.toUpperCase()}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as NagerHoliday[];
  return Array.isArray(payload) ? payload : [];
}

export async function fetchUpcomingNagerHolidays(input: {
  countryCode: string;
  referenceDate: Date;
  maxDaysAhead?: number;
  limit?: number;
}): Promise<NagerHoliday[]> {
  const maxDaysAhead = input.maxDaysAhead ?? 45;
  const limit = input.limit ?? 5;
  const year = input.referenceDate.getFullYear();
  const referenceMs = new Date(input.referenceDate).setHours(0, 0, 0, 0);

  const [currentYear, nextYear] = await Promise.all([
    fetchNagerPublicHolidays(year, input.countryCode),
    fetchNagerPublicHolidays(year + 1, input.countryCode),
  ]);

  const holidays = [...currentYear, ...nextYear]
    .filter((holiday) => {
      const holidayMs = new Date(`${holiday.date}T12:00:00`).getTime();
      const daysUntil = Math.ceil((holidayMs - referenceMs) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= maxDaysAhead;
    })
    .sort(
      (a, b) =>
        new Date(`${a.date}T12:00:00`).getTime() - new Date(`${b.date}T12:00:00`).getTime()
    );

  const unique = new Map<string, NagerHoliday>();
  for (const holiday of holidays) {
    unique.set(`${holiday.date}:${holiday.name}`, holiday);
  }

  return [...unique.values()].slice(0, limit);
}

export function holidayMarketingAngle(holidayName: string): string {
  const lower = holidayName.toLowerCase();

  if (lower.includes("new year")) {
    return "fresh-start promotions and annual planning";
  }
  if (lower.includes("valentine")) {
    return "community appreciation and gift/service bundles";
  }
  if (lower.includes("independence") || lower.includes("july 4")) {
    return "patriotic community posts and holiday hours";
  }
  if (lower.includes("thanksgiving")) {
    return "gratitude messaging and seasonal prep reminders";
  }
  if (lower.includes("christmas") || lower.includes("holiday")) {
    return "holiday hours, gifting, and year-end thank-you content";
  }
  if (lower.includes("memorial") || lower.includes("veterans")) {
    return "respectful community recognition and service availability messaging";
  }
  if (lower.includes("labor")) {
    return "team appreciation and end-of-summer scheduling reminders";
  }

  return "timely seasonal content and local availability messaging";
}
