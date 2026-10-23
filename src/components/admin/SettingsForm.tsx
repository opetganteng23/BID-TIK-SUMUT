"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ApiClientError, api } from "@/components/api";
import { Button, Card, Notice, cx } from "@/components/ui";
import { FieldInput, clean, initial, type Field } from "@/components/admin/ResourceManager";
import { can, type Role } from "@/lib/rbac";

type Group = { id: string; label: string; perm: "settings.identity" | "settings.layout"; object?: string; fields: Field[] };

const link: Field[] = [
  { type: "text", name: "label", label: "Label", required: true },
  { type: "text", name: "href", label: "Tautan", required: true, placeholder: "/berita atau https://..." },
];

const GROUPS: Group[] = [
  {
    id: "identity",
    label: "Identitas",
    perm: "settings.identity",
    fields: [
      { type: "text", name: "siteName", label: "Nama situs", required: true },
      { type: "text", name: "tagline", label: "Tagline" },
      { type: "text", name: "orgName", label: "Nama lembaga" },
      { type: "image", name: "logoLight", label: "Logo (tema terang)", kind: "logo", hint: "Kosongkan untuk memakai logo bawaan (Lambang Polda Sumut dan TIK Polri)." },
      { type: "image", name: "logoDark", label: "Logo (tema gelap)", kind: "logo" },
      { type: "image", name: "favicon", label: "Favicon", kind: "logo" },
      { type: "checkbox", name: "maintenanceMode", label: "Mode pemeliharaan (situs publik ditutup sementara)", default: false },
      { type: "textarea", name: "maintenanceMessage", label: "Pesan pemeliharaan" },
    ],
  },
  {
    id: "navbar",
    label: "Navbar",
    perm: "settings.layout",
    fields: [
      {
        type: "repeater",
        name: "menu",
        label: "Menu (maks. 2 tingkat)",
        max: 12,
        addLabel: "Tambah menu",
        fields: [
          ...link,
          { type: "checkbox", name: "openInNewTab", label: "Buka di tab baru", default: false },
          { type: "checkbox", name: "enabled", label: "Aktif" },
          {
            type: "repeater",
            name: "children",
            label: "Submenu",
            max: 12,
            addLabel: "Tambah submenu",
            fields: [...link, { type: "checkbox", name: "openInNewTab", label: "Buka di tab baru", default: false }, { type: "checkbox", name: "enabled", label: "Aktif" }],
          },
        ],
      },
    ],
  },
  {
    id: "sections",
    label: "Section dan berita beranda",
    perm: "settings.layout",
    fields: [
      {
        type: "repeater",
        name: "sections",
        label: "Urutan dan status section",
        max: 4,
        addLabel: "Tambah section",
        fields: [
          { type: "select", name: "key", label: "Section", required: true, options: [{ value: "hero", label: "Hero" }, { value: "about", label: "About" }, { value: "news", label: "Berita" }, { value: "features", label: "Layanan" }] },
          { type: "checkbox", name: "enabled", label: "Aktif" },
          { type: "number", name: "order", label: "Urutan (angka kecil tampil lebih dulu)" },
          { type: "text", name: "title", label: "Judul" },
          { type: "text", name: "subtitle", label: "Subjudul" },
        ],
      },
      { type: "number", name: "newsHomeCount", label: "Jumlah berita di beranda", hint: "1 sampai 24. Bawaan 6." },
      { type: "text", name: "newsHomeCategory", label: "Slug kategori berita beranda (opsional)" },
    ],
  },
  {
    id: "marquees",
    label: "Running text",
    perm: "settings.layout",
    fields: [
      {
        type: "repeater",
        name: "marquees",
        label: "Pita berjalan di pembatas section",
        max: 6,
        addLabel: "Tambah pita",
        fields: [
          { type: "text", name: "id", label: "ID unik (tanpa spasi)", required: true },
          { type: "select", name: "after", label: "Tampil setelah section", required: true, options: [{ value: "hero", label: "Hero" }, { value: "about", label: "About" }, { value: "news", label: "Berita" }, { value: "features", label: "Layanan" }] },
          { type: "checkbox", name: "enabled", label: "Aktif" },
          { type: "number", name: "speed", label: "Kecepatan (10 sampai 200)" },
          { type: "select", name: "direction", label: "Arah", default: "left", options: [{ value: "left", label: "Ke kiri" }, { value: "right", label: "Ke kanan" }] },
          { type: "number", name: "height", label: "Tinggi px (32 sampai 160)" },
          {
            type: "repeater",
            name: "items",
            label: "Butir",
            max: 40,
            addLabel: "Tambah butir",
            fields: [
              { type: "select", name: "type", label: "Jenis", default: "text", options: [{ value: "text", label: "Teks" }, { value: "logo", label: "Logo" }] },
              { type: "text", name: "text", label: "Teks (untuk jenis teks)" },
              { type: "image", name: "logo", label: "Logo (PNG/WebP)", kind: "logo" },
              { type: "text", name: "alt", label: "Alt text logo" },
              { type: "text", name: "href", label: "Tautan (opsional)" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "footer",
    label: "Footer",
    perm: "settings.layout",
    object: "footer",
    fields: [
      { type: "textarea", name: "about", label: "Info lembaga" },
      { type: "textarea", name: "address", label: "Alamat" },
      { type: "lines", name: "phones", label: "Nomor telepon/WhatsApp" },
      { type: "lines", name: "emails", label: "Email" },
      { type: "text", name: "hours", label: "Jam layanan" },
      { type: "url", name: "mapEmbedUrl", label: "URL embed peta (opsional)" },
      { type: "repeater", name: "quickLinks", label: "Tautan cepat", max: 12, addLabel: "Tambah tautan", fields: link },
      { type: "repeater", name: "socials", label: "Media sosial", max: 8, addLabel: "Tambah tautan", fields: link },
      { type: "text", name: "copyright", label: "Hak cipta" },
    ],
  },
  {
    id: "seo",
    label: "SEO",
    perm: "settings.layout",
    object: "seo",
    fields: [
      { type: "text", name: "defaultTitle", label: "Judul bawaan" },
      { type: "text", name: "titleTemplate", label: "Templat judul", hint: "Harus memuat %s. Contoh: %s | BID TIK Polda Sumut" },
      { type: "textarea", name: "defaultDescription", label: "Deskripsi bawaan" },
      { type: "image", name: "ogImage", label: "Gambar Open Graph" },
      { type: "checkbox", name: "robotsIndex", label: "Izinkan mesin pencari mengindeks situs (matikan selama prototype)", default: false },
    ],
  },
  {
    id: "accessibility",
    label: "Aksesibilitas",
    perm: "settings.layout",
    object: "accessibility",
    fields: [
      { type: "select", name: "defaultTheme", label: "Tema bawaan", default: "system", options: [{ value: "system", label: "Ikuti sistem" }, { value: "light", label: "Terang" }, { value: "dark", label: "Gelap" }] },
      { type: "number", name: "defaultFontScale", label: "Skala font bawaan", hint: "0,875 sampai 1,5. Bawaan 1." },
      { type: "checkbox", name: "ttsEnabled", label: "Aktifkan fitur bacakan (TTS)" },
      { type: "text", name: "ttsDefaultLang", label: "Bahasa TTS bawaan", placeholder: "id-ID" },
    ],
  },
  {
    id: "email",
    label: "Email",
    perm: "settings.identity",
    object: "email",
    fields: [
      { type: "lines", name: "contactRecipients", label: "Penerima notifikasi formulir kontak", hint: "Kredensial SMTP hanya diatur lewat environment, bukan di sini." },
      { type: "text", name: "emailSubjectPrefix", label: "Awalan subjek email" },
      { type: "checkbox", name: "otpEnabled", label: "Wajibkan OTP email saat login admin (disarankan)", default: false },
    ],
  },
];

export function SettingsForm({ role, settings }: { role: Role; settings: Record<string, any> }) {
  const groups = GROUPS.filter((g) => can(role, g.perm));
  const [active, setActive] = useState(groups[0]?.id ?? "");
  const [data, setData] = useState<Record<string, Record<string, any>>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, initial(g.fields, g.object ? settings[g.object] : settings)])),
  );
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ok, setOk] = useState("");

  const group = groups.find((g) => g.id === active);
  if (!group) return <Notice kind="error">Anda tidak memiliki izin untuk mengubah pengaturan.</Notice>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!group) return;
    setSaving(true);
    setError("");
    setFieldErrors({});
    setOk("");
    try {
      const body = clean(group.fields, data[group.id], true);
      // Harmonisasi nilai opsional agar sesuai skema server.
      if (body.newsHomeCategory === "") delete body.newsHomeCategory;
      if (group.object === "footer" && body.mapEmbedUrl === undefined) body.mapEmbedUrl = "";
      await api("/api/admin/settings", { method: "PUT", body: group.object ? { [group.object]: body } : body });
      setDirty((d) => ({ ...d, [group.id]: false }));
      setOk(`Pengaturan "${group.label}" disimpan. Perubahan tampil di situs publik.`);
    } catch (err) {
      const c = err instanceof ApiClientError ? err : null;
      setError(c?.message ?? "Gagal menyimpan.");
      setFieldErrors(c?.fields ?? {});
      requestAnimationFrame(() => document.getElementById("set-error")?.focus());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Site Settings</h1>
      <div role="tablist" aria-label="Grup pengaturan" className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button key={g.id} role="tab" type="button" aria-selected={active === g.id} onClick={() => { setActive(g.id); setOk(""); setError(""); }} className={cx("min-h-11 rounded-full border-2 px-4 text-sm font-medium", active === g.id ? "border-fg bg-primary text-primary-fg" : "border-border hover:bg-surface-2")}>
            {g.label}
            {dirty[g.id] && <span aria-label="belum disimpan"> *</span>}
          </button>
        ))}
      </div>
      <Card>
        <form onSubmit={save} className="space-y-5" noValidate role="tabpanel" aria-label={group.label}>
          {ok && <Notice kind="success">{ok}</Notice>}
          {error && <div id="set-error" tabIndex={-1} className="outline-none"><Notice kind="error">{error}</Notice></div>}
          {group.fields.map((f, i) => (
            <FieldInput
              key={"name" in f ? f.name : i}
              f={f}
              v={data[group.id]}
              errors={fieldErrors}
              path="s-"
              options={{}}
              set={(patch) => {
                setData((d) => ({ ...d, [group.id]: { ...d[group.id], ...patch } }));
                setDirty((d) => ({ ...d, [group.id]: true }));
              }}
            />
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={saving}>Simpan</Button>
            <a href="/" target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">Pratinjau situs</a>
            {dirty[group.id] && <span className="rounded-full border-2 border-dashed border-fg px-3 py-1 text-xs font-medium" role="status">Perubahan belum disimpan</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
