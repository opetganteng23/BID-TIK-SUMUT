import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/rbac";
import { ResourceManager } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Kategori pengaduan" };

export default async function Page() {
  const user = await requirePage("complaints.view");
  return (
    <ResourceManager
      title="Kategori pengaduan"
      noun="kategori"
      endpoint="/api/admin/complaint-categories"
      reorderable
      searchable
      filters={[{ name: "active", label: "Status", options: [{ value: "true", label: "Aktif" }, { value: "false", label: "Nonaktif" }] }]}
      canWrite={can(user.role, "complaints.categories.manage")}
      fields={[
        { type: "text", name: "name", label: "Nama", required: true, maxLength: 80 },
        { type: "checkbox", name: "active", label: "Aktif (tampil pada formulir publik)" },
      ]}
      columns={[
        { key: "name", label: "Nama", sort: "name" },
        { key: "active", label: "Status", kind: "status", sort: "active" },
      ]}
    />
  );
}
