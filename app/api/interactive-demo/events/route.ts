import { NextResponse } from "next/server";
import {
  checkRateLimit,
  trackInteractiveDemoEvent,
  type InteractiveDemoFunnelEvent,
} from "@/lib/interactive-demo";

const ALLOWED: InteractiveDemoFunnelEvent[] = [
  "demo_started",
  "demo_completed",
  "cta_clicked",
];

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = checkRateLimit({
    key: `interactive-demo-events:${ip}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: { event?: string };
  try {
    body = (await request.json()) as { event?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!body.event || !ALLOWED.includes(body.event as InteractiveDemoFunnelEvent)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // demo_started / demo_completed are also tracked server-side on the main route;
  // cta_clicked is client-only.
  if (body.event === "cta_clicked") {
    trackInteractiveDemoEvent("cta_clicked");
  }

  return NextResponse.json({ ok: true });
}
