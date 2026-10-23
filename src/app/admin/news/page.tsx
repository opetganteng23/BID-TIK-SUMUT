import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { NewsManager } from "@/components/admin/NewsManager";

export const metadata: Metadata = { title: "Berita" };

export default async function Page(props: PageProps<"/admin/news">) {
  const user = await requirePage("news.write");
  const status = (await props.searchParams).status;
  return <NewsManager role={user.role} userId={user.id} initialStatus={typeof status === "string" ? status : undefined} />;
}
