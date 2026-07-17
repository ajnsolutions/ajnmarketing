import { redirect } from "next/navigation";

export const metadata = {
  title: "Results",
  description:
    "What's improving for your business — visibility, reviews, engagement, and Marketing Health.",
};

/** Canonical customer destination is Results; keep this route for deep links. */
export default function AnalyticsRoute() {
  redirect("/dashboard/results");
}
