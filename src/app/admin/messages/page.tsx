import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { MessagesInbox } from "@/components/admin/Inboxes";

export const metadata: Metadata = { title: "Pesan" };

export default async function Page() {
  await requirePage("messages.manage");
  return <MessagesInbox />;
}
