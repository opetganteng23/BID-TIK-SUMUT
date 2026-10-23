import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ResourceManager, type Field } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Hero" };

const fields: Field[] = [
  { type: "text", name: "title", label: "Judul", required: true, maxLength: 160 },
  { type: "textarea", name: "description", label: "Deskripsi", maxLength: 400 },
  {
    type: "select",
    name: "mediaType",
    label: "Jenis media",
    default: "image",
    options: [
      { value: "image", label: "Gambar" },
      { value: "video", label: "Video unggah (MP4)" },
      { value: "embed", label: "Embed YouTube/Vimeo" },
    ],
  },
  { type: "image", name: "image", label: "Gambar", hint: "Wajib bila jenis media gambar." },
  { type: "text", name: "alt", label: "Alt text", hint: "Wajib untuk gambar. Jelaskan isi gambar secara singkat.", maxLength: 200 },
  { type: "image", name: "videoUrl", label: "URL video MP4", kind: "video" },
  { type: "image", name: "poster", label: "Gambar poster video" },
  { type: "url", name: "embedUrl", label: "URL embed", hint: "Contoh: https://www.youtube-nocookie.com/embed/ID atau https://player.vimeo.com/video/ID" },
  {
    type: "repeater",
    name: "ctas",
    label: "Tombol ajakan (maks. 2)",
    max: 2,
    addLabel: "Tambah tombol",
    fields: [
      { type: "text", name: "label", label: "Label", required: true, maxLength: 40 },
      { type: "text", name: "href", label: "Tautan", required: true, placeholder: "/berita atau https://..." },
      {
        type: "select",
        name: "style",
        label: "Gaya",
        default: "primary",
        options: [
          { value: "primary", label: "Utama" },
          { value: "secondary", label: "Sekunder" },
        ],
      },
    ],
  },
  { type: "checkbox", name: "enabled", label: "Aktif (tampil di beranda)" },
];

export default async function Page() {
  await requirePage("content.manage");
  return (
    <ResourceManager
      title="Hero"
      noun="slide"
      endpoint="/api/admin/hero"
      fields={fields}
      reorderable
      preview={{ base: "/" }}
      columns={[
        { key: "title", label: "Judul" },
        { key: "mediaType", label: "Media" },
        { key: "enabled", label: "Status", kind: "status" },
      ]}
    />
  );
}
