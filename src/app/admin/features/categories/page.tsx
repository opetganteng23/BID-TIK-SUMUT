import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ResourceManager } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Kategori fitur" };

export default async function Page() {
  await requirePage("content.manage");
  return (
    <ResourceManager
      title="Kategori fitur"
      noun="kategori"
      endpoint="/api/admin/feature-categories"
      reorderable
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
