import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/interactive-demo/rate-limit";
import { runPublicBusinessDiscovery, PublicSnapshotUpstreamError } from "@/lib/business-discovery/public/service";
import { validatePublicSnapshotRequest, PublicSnapshotValidationError } from "@/lib/business-discovery/public/validateRequest";
import { PublicSnapshotUrlError } from "@/lib/business-discovery/public/urlSafety";
import { PublicSnapshotFetchError } from "@/lib/business-discovery/public/fetchWebsite";
import { trackPublicSnapshotEvent } from "@/lib/business-discovery/public/observability";
import {
  PUBLIC_SNAPSHOT_MAX_REQUEST_BYTES,
  PublicSnapshotErrorCodes,
  type PublicSnapshotErrorResponse,
} from "@/lib/business-discovery/public/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Conservative, matching the existing interactive-demo precedent
// (lib/interactive-demo — 5 requests/hour/IP) for the same reason: every
// request can trigger up to two OpenAI calls (extraction + AI Marketing
// Profile synthesis).
const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function errorResponse(code: (typeof PublicSnapshotErrorCodes)[keyof typeof PublicSnapshotErrorCodes], message: string, status: number) {
  const body: PublicSnapshotErrorResponse = { error: { code, message } };
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  const limit = checkRateLimit({
    key: `public-business-discovery:${ip}`,
    limit: RATE_LIMIT,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!limit.allowed) {
    trackPublicSnapshotEvent("rate_limited");
    return NextResponse.json(
      {
        error: {
          code: PublicSnapshotErrorCodes.RATE_LIMITED,
          message: "You've reached the limit for free snapshots right now. Please try again later.",
        },
      } satisfies PublicSnapshotErrorResponse,
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return errorResponse(PublicSnapshotErrorCodes.VALIDATION_FAILED, "Request must be application/json.", 415);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > PUBLIC_SNAPSHOT_MAX_REQUEST_BYTES) {
    return errorResponse(PublicSnapshotErrorCodes.VALIDATION_FAILED, "Request body is too large.", 413);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > PUBLIC_SNAPSHOT_MAX_REQUEST_BYTES) {
    return errorResponse(PublicSnapshotErrorCodes.VALIDATION_FAILED, "Request body is too large.", 413);
  }

  let parsedBody: unknown;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return errorResponse(PublicSnapshotErrorCodes.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }

  let validatedRequest;
  try {
    validatedRequest = validatePublicSnapshotRequest(parsedBody);
  } catch (error) {
    trackPublicSnapshotEvent("validation_rejected");
    const message = error instanceof PublicSnapshotValidationError ? error.message : "Invalid request.";
    return errorResponse(PublicSnapshotErrorCodes.VALIDATION_FAILED, message, 400);
  }

  try {
    const result = await runPublicBusinessDiscovery(validatedRequest);
    return NextResponse.json(
      { result },
      { headers: { "X-RateLimit-Remaining": String(limit.remaining) } }
    );
  } catch (error) {
    if (error instanceof PublicSnapshotUrlError) {
      return errorResponse(PublicSnapshotErrorCodes.BLOCKED_URL, error.message, 400);
    }
    if (error instanceof PublicSnapshotFetchError) {
      if (error.code === "timeout") {
        return errorResponse(PublicSnapshotErrorCodes.TIMEOUT, error.message, 504);
      }
      return errorResponse(PublicSnapshotErrorCodes.UPSTREAM_UNAVAILABLE, error.message, 502);
    }
    if (error instanceof PublicSnapshotUpstreamError) {
      return errorResponse(PublicSnapshotErrorCodes.TIMEOUT, "That's taking longer than expected. Please try again.", 504);
    }

    // Never leak the raw error/stack to the client — log server-side only via console.error,
    // consistent with the rest of the codebase's error-boundary convention.
    console.error("[PublicBusinessDiscovery] Unhandled error", error);
    return errorResponse(
      PublicSnapshotErrorCodes.INTERNAL_ERROR,
      "We couldn't complete that snapshot right now. Please try again shortly.",
      500
    );
  }
}
