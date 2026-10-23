import type { Metadata } from "next";
import Link from "next/link";
import { requirePage } from "@/lib/auth/guard";
import { ResourceManager, type Field } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Fitur" };

const fields: Field[] = [
  { type: "text", name: "title", label: "Judul", required: true, maxLength: 160 },
  { type: "text", name: "slug", label: "Slug (opsional)", hint: "Dibuat otomatis dari judul bila kosong." },
  { type: "textarea", name: "summary", label: "Ringkasan", maxLength: 300 },
  { type: "text", name: "icon", label: "Nama ikon lucide", hint: "Contoh: ShieldCheck, Globe, Server (huruf awal kapital).", placeholder: "Sparkles" },
  { type: "select", name: "category", label: "Kategori", optionsUrl: "/api/admin/feature-categories", emptyLabel: "Tanpa kategori" },
  { type: "image", name: "heroImage", label: "Gambar utama" },
  { type: "text", name: "heroAlt", label: "Alt text gambar utama", maxLength: 200 },
  { type: "content", label: "Deskripsi panjang" },
  { type: "lines", name: "highlights", label: "Poin-poin" },
  {
    type: "repeater",
    name: "gallery",
    label: "Galeri",
    max: 30,
    addLabel: "Tambah gambar",
    fields: [
      { type: "image", name: "url", label: "Gambar" },
      { type: "text", name: "alt", label: "Alt text", required: true },
    ],
  },
  { type: "number", name: "order", label: "Urutan" },
  { type: "checkbox", name: "enabled", label: "Aktif" },
];

export default async function Page() {
  await requirePage("content.manage");
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link href="/admin/features/categories" className="underline underline-offset-4">
          Kelola kategori fitur
        </Link>
      </p>
      <ResourceManager
        title="Fitur"
        noun="fitur"
        endpoint="/api/admin/features"
        fields={fields}
        searchable
        filters={[
          { name: "category", label: "Kategori", optionsUrl: "/api/admin/feature-categories" },
          { name: "enabled", label: "Status", options: [{ value: "true", label: "Aktif" }, { value: "false", label: "Nonaktif" }] },
        ]}
        preview={{ base: "/fitur/", key: "slug" }}
        columns={[
          { key: "title", label: "Judul", sort: "title" },
          { key: "category.name", label: "Kategori" },
          { key: "order", label: "Urutan", sort: "order" },
          { key: "enabled", label: "Status", kind: "status", sort: "enabled" },
        ]}
      />
    </div>
  );
}
