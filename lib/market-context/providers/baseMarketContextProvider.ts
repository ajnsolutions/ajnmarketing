import type {
  MarketContextCategory,
  MarketContextItemInput,
  MarketContextProviderContext,
} from "@/lib/market-context/types";

export abstract class BaseMarketContextProvider {
  abstract readonly category: MarketContextCategory;

  abstract fetchItems(context: MarketContextProviderContext): Promise<MarketContextItemInput[]>;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function resolveLocationLabel(context: MarketContextProviderContext): string {
  const { businessProfile } = context;
  const city = businessProfile.city?.trim();
  const state = businessProfile.state?.trim();
  const area = businessProfile.primary_service_area?.trim();

  if (city && state) return `${city}, ${state}`;
  if (area) return area;
  if (city) return city;
  return "your local area";
}

export function resolveIndustry(context: MarketContextProviderContext): string {
  return (
    context.aiMarketingProfile?.industry?.trim() ||
    context.businessProfile.industry?.trim() ||
    "local business"
  );
}

export function resolveServices(context: MarketContextProviderContext): string[] {
  const fromProfile = [
    context.businessProfile.primary_services,
    context.businessProfile.seasonal_services,
    context.businessProfile.emergency_services,
  ]
    .flatMap((raw) => (raw ? raw.split(/[\n,;|•]/) : []))
    .map((item) => item.trim())
    .filter(Boolean);

  const fromAi = context.aiMarketingProfile?.services ?? [];

  return [...new Set([...fromAi, ...fromProfile])].slice(0, 6);
}
