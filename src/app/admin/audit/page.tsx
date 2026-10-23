import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { AuditTable } from "@/components/admin/Inboxes";

export const metadata: Metadata = { title: "Audit Log" };

export default async function Page() {
  await requirePage("audit.read");
  return <AuditTable />;
}
