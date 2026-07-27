import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/interactive-demo/rate-limit";
import { SNAPSHOT_FUNNEL_EVENTS, trackSnapshotFunnelEvent, type SnapshotFunnelEvent } from "@/lib/snapshot-ui/experienceAnalytics";

export const runtime = "nodejs";

const ALLOWED_METADATA_KEYS = new Set(["section", "insightKey", "errorCode"]);
const MAX_METADATA_VALUE_LENGTH = 80;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Strips anything outside the tiny approved shape — this is the actual enforcement point for "never log private content." */
function sanitizeMetadata(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (typeof value !== "string") continue;
    out[key] = value.slice(0, MAX_METADATA_VALUE_LENGTH);
  }
  return out;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = checkRateLimit({ key: `snapshot-events:${ip}`, limit: 120, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: { event?: string; metadata?: unknown };
  try {
    body = (await request.json()) as { event?: string; metadata?: unknown };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!body.event || !SNAPSHOT_FUNNEL_EVENTS.includes(body.event as SnapshotFunnelEvent)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  trackSnapshotFunnelEvent(body.event as SnapshotFunnelEvent, sanitizeMetadata(body.metadata));
  return NextResponse.json({ ok: true });
}
