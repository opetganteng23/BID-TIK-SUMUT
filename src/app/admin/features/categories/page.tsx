import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ResourceManager } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Kategori layanan" };

export default async function Page() {
  await requirePage("content.manage");
  return (
    <ResourceManager
      title="Kategori layanan"
      noun="kategori"
      endpoint="/api/admin/feature-categories"
      reorderable
      searchable
      fields={[
        { type: "text", name: "name", label: "Nama", required: true, maxLength: 80 },
        { type: "text", name: "slug", label: "Slug (opsional)" },
      ]}
      columns={[
        { key: "name", label: "Nama", sort: "name" },
        { key: "slug", label: "Slug" },
      ]}
    />
  );
}
