import { NextResponse } from "next/server";
import {
  checkRateLimit,
  runInteractiveDemo,
  trackInteractiveDemoEvent,
  type InteractiveDemoInput,
} from "@/lib/interactive-demo";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEMO_RATE_LIMIT = 5;
const DEMO_WINDOW_MS = 60 * 60 * 1000;

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
    key: `interactive-demo:${ip}`,
    limit: DEMO_RATE_LIMIT,
    windowMs: DEMO_WINDOW_MS,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "You’ve reached the demo limit for now. Please try again later, or create an account to continue.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  let body: Partial<InteractiveDemoInput>;
  try {
    body = (await request.json()) as Partial<InteractiveDemoInput>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl : "";
  if (!websiteUrl.trim()) {
    return NextResponse.json(
      { error: "Website URL is required." },
      { status: 400 },
    );
  }

  const input: InteractiveDemoInput = {
    websiteUrl,
    businessName:
      typeof body.businessName === "string" ? body.businessName : undefined,
    industry: typeof body.industry === "string" ? body.industry : undefined,
    city: typeof body.city === "string" ? body.city : undefined,
    state: typeof body.state === "string" ? body.state : undefined,
  };

  trackInteractiveDemoEvent("demo_started");

  try {
    const result = await runInteractiveDemo(input);
    trackInteractiveDemoEvent("demo_completed");
    return NextResponse.json(
      { result },
      {
        headers: {
          "X-RateLimit-Remaining": String(limit.remaining),
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to run the demo right now.";
    const status = /required|valid|can’t be analyzed|must start/i.test(message)
      ? 400
      : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
