import { StrategicMarketingCalendarPage } from "@/components/dashboard/strategic-marketing-calendar-page";
import { getStrategicMarketingCalendarForCurrentUser } from "@/lib/strategic-marketing-calendar/calendar-service";
import { zonedDateKey } from "@/lib/strategic-marketing-calendar/calendar-timezone";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Strategic Marketing Calendar",
  description:
    "Read-only view of marketing priorities, campaigns, publishing, and market context.",
};

export default async function StrategicMarketingCalendarRoute() {
  const result = await getStrategicMarketingCalendarForCurrentUser({ view: "month" });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    redirect("/dashboard");
  }

  const anchor = zonedDateKey(new Date(), result.calendar.timezone);

  return (
    <StrategicMarketingCalendarPage
      initialCalendar={result.calendar}
      initialAnchor={anchor}
    />
  );
}
