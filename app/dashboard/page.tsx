import { redirect } from "next/navigation";
import { FirstDaysHome } from "@/components/dashboard/first-days-home";
import { getFirstDaysHomeForCurrentUser } from "@/lib/dashboard/first-days-home-server";

export default async function DashboardPage() {
  const firstDays = await getFirstDaysHomeForCurrentUser();

  if (firstDays?.isEarlyCustomer) {
    return <FirstDaysHome model={firstDays} />;
  }

  redirect("/dashboard/command-center");
}
