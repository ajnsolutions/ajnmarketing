import { NextResponse } from "next/server";
import { getStrategicMarketingCalendarForCurrentUser } from "@/lib/strategic-marketing-calendar/calendar-service";
import { createClient } from "@/lib/supabase/server";

/**
 * Read-only Strategic Marketing Calendar aggregation.
 * No mutations. No schedules. Auth + business profile required.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const result = await getStrategicMarketingCalendarForCurrentUser(
    {
      view: searchParams.get("view"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
      anchor: searchParams.get("anchor"),
      categories: searchParams.get("categories"),
      filterGroups: searchParams.get("filterGroups"),
    },
    { supabaseClient: supabase },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ calendar: result.calendar });
}
