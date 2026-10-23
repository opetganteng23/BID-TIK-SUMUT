import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/rbac";
import { ResourceManager } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Kategori berita" };

export default async function Page() {
  const user = await requirePage("news.write");
  return (
    <ResourceManager
      title="Kategori berita"
      noun="kategori"
      endpoint="/api/admin/news-categories"
      canWrite={can(user.role, "content.manage")}
      fields={[
        { type: "text", name: "name", label: "Nama", required: true, maxLength: 80 },
        { type: "text", name: "slug", label: "Slug (opsional)" },
      ]}
      columns={[
        { key: "name", label: "Nama" },
        { key: "slug", label: "Slug" },
      ]}
    />
  );
}
