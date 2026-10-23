import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ComplaintAnalytics } from "@/components/admin/ComplaintAnalytics";

export const metadata: Metadata = { title: "Analitik Pengaduan" };

export default async function Page() {
  const user = await requirePage("complaints.view");
  return <ComplaintAnalytics role={user.role} />;
}
