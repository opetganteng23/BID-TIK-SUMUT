import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ResourceManager } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Halaman" };

export default async function Page() {
  await requirePage("content.manage");
  return (
    <ResourceManager
      title="Halaman statis"
      noun="halaman"
      endpoint="/api/admin/pages"
      searchable
      filters={[{ name: "enabled", label: "Status", options: [{ value: "true", label: "Aktif" }, { value: "false", label: "Nonaktif" }] }]}
      preview={{ base: "/", key: "slug" }}
      fields={[
        { type: "text", name: "title", label: "Judul", required: true, maxLength: 160 },
        { type: "text", name: "slug", label: "Slug (opsional)", hint: "Contoh: profil, kebijakan-privasi. Tidak boleh memakai rute yang dipesan sistem." },
        { type: "content", label: "Isi halaman" },
        { type: "checkbox", name: "enabled", label: "Aktif" },
      ]}
      columns={[
        { key: "title", label: "Judul", sort: "title" },
        { key: "slug", label: "Slug", kind: "path", sort: "slug" },
        { key: "enabled", label: "Status", kind: "status", sort: "enabled" },
      ]}
    />
  );
}
