import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { UsersManager } from "@/components/admin/Inboxes";

export const metadata: Metadata = { title: "Pengguna" };

export default async function Page() {
  const user = await requirePage("users.manage");
  return <UsersManager meId={user.id} />;
}
