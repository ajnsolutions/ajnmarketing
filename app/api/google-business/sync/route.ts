import { NextResponse } from "next/server";
import { syncGoogleBusinessForCurrentUser } from "@/lib/google-business/service";

export async function POST() {
  const result = await syncGoogleBusinessForCurrentUser();

  if (!result.success && result.error === "Unauthorized") {
    return NextResponse.json(result, { status: 401 });
  }

  if (!result.success && !result.syncLog) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
