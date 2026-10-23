import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ComplaintsDashboard } from "@/components/admin/ComplaintsAdmin";

export const metadata: Metadata = { title: "Pengaduan" };

export default async function Page(props: PageProps<"/admin/complaints">) {
  const user = await requirePage("complaints.view");
  const status = (await props.searchParams).status;
  return <ComplaintsDashboard role={user.role} initialStatus={typeof status === "string" ? status : undefined} />;
}
