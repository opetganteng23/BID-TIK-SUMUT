import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ComplaintDetail } from "@/components/admin/ComplaintsAdmin";

export const metadata: Metadata = { title: "Detail pengaduan" };

export default async function Page(props: PageProps<"/admin/complaints/[id]">) {
  const user = await requirePage("complaints.view");
  const { id } = await props.params;
  return <ComplaintDetail id={id} role={user.role} />;
}
