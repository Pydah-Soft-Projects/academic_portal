import { redirect } from "next/navigation";

export default function StaffAnalyticsRedirectPage() {
  redirect("/reports?tab=staff-analytics");
}

