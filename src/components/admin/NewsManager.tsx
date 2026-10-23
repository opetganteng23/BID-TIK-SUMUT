"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { ApiClientError, api, formatDate } from "@/components/api";
import { Button, Card, Checkbox, EmptyState, Notice, SelectInput, Skeleton, TextArea, TextInput } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pager, SortTh, useSort } from "@/components/admin/table";
import { FieldInput } from "@/components/admin/ResourceManager";
import { ImageField } from "@/components/admin/MediaPicker";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { transition, type NewsAction, type NewsStatus } from "@/lib/news-state";
import { can, type Role } from "@/lib/rbac";

const STATUS_LABEL: Record<NewsStatus, string> = { draft: "Draft", review: "Menunggu review", scheduled: "Terjadwal", published: "Terbit", archived: "Arsip" };
const ACTIONS: { action: NewsAction; slug: string; label: string; danger?: boolean }[] = [
  { action: "submit_review", slug: "submit-review", label: "Ajukan untuk ditinjau" },
  { action: "withdraw", slug: "withdraw", label: "Tarik kembali ke draft" },
  { action: "request_revision", slug: "request-revision", label: "Minta revisi" },
  { action: "approve", slug: "approve", label: "Setujui (jadwalkan)" },
  { action: "publish", slug: "publish", label: "Terbitkan sekarang" },
  { action: "archive", slug: "archive", label: "Arsipkan", danger: true },
  { action: "restore", slug: "restore", label: "Pulihkan ke draft" },
];

const toLocal = (d?: string) => {
  if (!d) return "";
  const dt = new Date(d);
  const off = dt.getTimezoneOffset() * 60_000;
  return new Date(dt.getTime() - off).toISOString().slice(0, 16);
};

type Form = Record<string, any>;
const blank = (): Form => ({ title: "", slug: "", excerpt: "", coverImage: "", coverAlt: "", contentMode: "richtext", contentHtml: "", contentJson: null, rawHtml: "", category: "", tags: [], publishedAt: "", media: [], seoTitle: "", seoDescription: "", seoOgImage: "" });

export function NewsManager({ role, userId, initialStatus }: { role: Role; userId: string; initialStatus?: string }) {
  const isAdmin = can(role, "news.manage_others");
  const canRaw = can(role, "news.raw");
  const [rows, setRows] = useState<any[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(initialStatus ?? "");
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<{ value: string; label: string }[]>([]);
  const [catFilter, setCatFilter] = useState("");
  const sorter = useSort({ sort: "updatedAt", dir: "desc" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [doc, setDoc] = useState<any>(null);
  const [form, setForm] = useState<Form>(blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewed, setPreviewed] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [confirm, setConfirm] = useState<{ slug: string; label: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: any[]; total: number }>(`/api/admin/news?page=${page}&limit=20${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}${catFilter ? `&category=${catFilter}` : ""}${sorter.query}`);
      setRows(d.items);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat berita.");
      setRows([]);
    }
  }, [page, status, q, catFilter, sorter.query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api<{ items: any[] }>("/api/admin/news-categories?limit=100")
      .then((d) => setCats(d.items.map((c) => ({ value: c._id, label: c.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function open(id: string | null) {
    setError("");
    setOk("");
    setErrors({});
    setDirty(false);
    setPreviewed(false);
    if (!id) {
      setDoc(null);
      setForm(blank());
      setEditing({ id: null });
      return;
    }
    try {
      const d = await api<any>(`/api/admin/news/${id}`);
      setDoc(d);
      setForm({
        title: d.title ?? "",
        slug: d.slug ?? "",
        excerpt: d.excerpt ?? "",
        coverImage: d.coverImage ?? "",
        coverAlt: d.coverAlt ?? "",
        contentMode: d.contentMode ?? "richtext",
        contentHtml: d.contentHtml ?? "",
        contentJson: d.contentJson ?? null,
        rawHtml: d.rawHtml ?? "",
        category: d.category?._id ?? d.category ?? "",
        tags: d.tags ?? [],
        publishedAt: toLocal(d.publishedAt),
        media: d.media ?? [],
        seoTitle: d.seo?.title ?? "",
        seoDescription: d.seo?.description ?? "",
        seoOgImage: d.seo?.ogImage ?? "",
      });
      setEditing({ id });
      requestAnimationFrame(() => document.getElementById("news-heading")?.focus());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal membuka berita.");
    }
  }

  const set = (p: Form) => {
    setForm((f) => ({ ...f, ...p }));
    setDirty(true);
    setOk("");
  };

  const isOwner = !doc || String(doc.authorId) === userId;
  const status0: NewsStatus = doc?.status ?? "draft";
  const editable = isAdmin || (isOwner && status0 === "draft");

  function body() {
    const b: Form = {
      title: form.title,
      excerpt: form.excerpt || undefined,
      coverImage: form.coverImage || "",
      coverAlt: form.coverAlt || undefined,
      contentMode: form.contentMode,
      category: form.category || "",
      tags: form.tags,
      media: (form.media as any[]).map((m) => ({ type: m.type, url: m.url, alt: m.alt || undefined, caption: m.caption || undefined })),
      seo: { title: form.seoTitle || undefined, description: form.seoDescription || undefined, ogImage: form.seoOgImage || "" },
    };
    if (form.slug) b.slug = form.slug;
    if (form.contentMode === "html_raw") b.rawHtml = form.rawHtml;
    else {
      b.contentHtml = form.contentHtml;
      if (form.contentMode === "richtext" && form.contentJson) b.contentJson = form.contentJson;
    }
    if (isAdmin && form.publishedAt) b.publishedAt = new Date(form.publishedAt).toISOString();
    return b;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    setErrors({});
    try {
      const res = editing.id ? await api<any>(`/api/admin/news/${editing.id}`, { method: "PUT", body: body() }) : await api<any>("/api/admin/news", { body: body() });
      setDirty(false);
      setOk("Berita disimpan.");
      setPreviewKey((k) => k + 1);
      if (!editing.id) {
        await open(String(res._id));
        setOk("Berita disimpan.");
      } else {
        setDoc((d: any) => ({ ...d, ...res }));
      }
      void load();
    } catch (err) {
      const c = err instanceof ApiClientError ? err : null;
      setError(c?.message ?? "Gagal menyimpan.");
      setErrors(c?.fields ?? {});
      requestAnimationFrame(() => document.getElementById("news-error")?.focus());
    } finally {
      setSaving(false);
    }
  }

  async function runAction(slug: string) {
    if (!doc) return;
    setSaving(true);
    setError("");
    try {
      const payload: Form = {};
      if (slug === "approve" && schedule) payload.publishedAt = new Date(schedule).toISOString();
      if (doc.contentMode === "html_raw") payload.previewed = previewed;
      const r = await api<{ status: string }>(`/api/admin/news/${doc._id}/${slug}`, { body: payload });
      setConfirm(null);
      await open(String(doc._id));
      setOk(`Status berubah menjadi ${STATUS_LABEL[r.status as NewsStatus]}.`);
      void load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Aksi gagal.");
      setConfirm(null);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!doc) return;
    setSaving(true);
    try {
      await api(`/api/admin/news/${doc._id}`, { method: "DELETE" });
      setDeleteOpen(false);
      setEditing(null);
      setOk("Berita dihapus.");
      void load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menghapus.");
      setDeleteOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const availableActions = doc ? ACTIONS.filter((a) => transition({ action: a.action, from: status0, role, isOwner }).ok) : [];
  const f = errors;

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="news-heading" tabIndex={-1} className="text-3xl outline-none">{editing.id ? "Ubah berita" : "Berita baru"}</h1>
          <div className="flex items-center gap-2">
            {dirty && <span className="rounded-full border-2 border-dashed border-fg px-3 py-1 text-xs font-medium" role="status">Perubahan belum disimpan</span>}
            <Button variant="secondary" onClick={() => { if (dirty && !window.confirm("Ada perubahan yang belum disimpan. Keluar?")) return; setEditing(null); setDirty(false); }}>Kembali ke daftar</Button>
          </div>
        </div>

        {ok && <Notice kind="success">{ok}</Notice>}
        {error && <div id="news-error" tabIndex={-1} className="outline-none"><Notice kind="error">{error}</Notice></div>}
        {doc && !editable && <Notice kind="info">Berita berstatus {STATUS_LABEL[status0]} dan tidak dapat diubah oleh Anda. Gunakan aksi alur kerja di bawah.</Notice>}

        {doc && (
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border-2 border-fg px-4 py-1 text-sm font-semibold">{STATUS_LABEL[status0]}</span>
              {doc.publishedAt && <span className="text-sm text-muted">Tayang: {formatDate(doc.publishedAt, true)} WIB</span>}
              <span className="text-sm text-muted">Penulis: {doc.authorNameSnapshot}</span>
              {(status0 === "published" || status0 === "scheduled") && <a className="inline-flex items-center gap-1 text-sm underline underline-offset-4" href={`/berita/${doc.slug}`} target="_blank" rel="noopener noreferrer"><Eye className="size-4" aria-hidden /> Lihat di situs</a>}
            </div>
            {availableActions.some((a) => a.action === "approve") && <TextInput id="schedule" label="Jadwal tayang (kosong = langsung tayang)" type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />}
            {doc.contentMode === "html_raw" && availableActions.some((a) => a.action === "approve" || a.action === "publish") && (
              <Checkbox id="previewed" label="Saya telah meninjau pratinjau HTML mentah di bawah" checked={previewed} onChange={(e) => setPreviewed(e.target.checked)} />
            )}
            <div className="flex flex-wrap gap-2">
              {availableActions.map((a) => (
                <Button key={a.slug} type="button" variant={a.danger ? "danger" : "secondary"} loading={saving} disabled={dirty} onClick={() => (a.danger ? setConfirm({ slug: a.slug, label: a.label }) : runAction(a.slug))}>
                  {a.label}
                </Button>
              ))}
              {availableActions.length === 0 && <p className="text-sm text-muted">Tidak ada aksi alur kerja yang tersedia untuk Anda pada status ini.</p>}
            </div>
            {dirty && availableActions.length > 0 && <p className="text-sm text-muted">Simpan perubahan terlebih dahulu sebelum menjalankan aksi.</p>}
          </Card>
        )}

        <Card>
          <form onSubmit={save} className="space-y-5" noValidate>
            <fieldset disabled={!editable} className="space-y-5">
              <TextInput id="n-title" label="Judul" value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={200} error={f.title} />
              <TextInput id="n-slug" label="Slug (opsional)" value={form.slug} onChange={(e) => set({ slug: e.target.value })} hint="Dibuat otomatis dari judul bila kosong." error={f.slug} />
              <TextArea id="n-excerpt" label="Ringkasan" value={form.excerpt} onChange={(e) => set({ excerpt: e.target.value })} maxLength={400} />
              <SelectInput id="n-cat" label="Kategori" value={form.category} onChange={(e) => set({ category: e.target.value })} options={[{ value: "", label: "Tanpa kategori" }, ...cats]} />
              <ImageField id="n-cover" label="Gambar sampul" value={form.coverImage} onChange={(v) => set({ coverImage: v })} />
              <TextInput id="n-alt" label="Alt text sampul" value={form.coverAlt} onChange={(e) => set({ coverAlt: e.target.value })} maxLength={200} />

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Mode konten</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mode konten">
                  {([["richtext", "Rich text"], ["html", "HTML (disanitasi)"], ...(canRaw ? [["html_raw", "HTML mentah (sandbox)"]] : [])] as [string, string][]).map(([m, l]) => (
                    <button key={m} type="button" role="radio" aria-checked={form.contentMode === m} onClick={() => set({ contentMode: m })} className={`min-h-11 rounded-full border-2 px-4 text-sm ${form.contentMode === m ? "border-fg bg-primary text-primary-fg" : "border-border"}`}>{l}</button>
                  ))}
                </div>
                {form.contentMode === "richtext" && <RichTextEditor id="n-body" label="Isi berita" html={form.contentHtml} json={form.contentJson} onChange={(html, json) => set({ contentHtml: html, contentJson: json })} />}
                {form.contentMode === "html" && <TextArea id="n-html" label="HTML" rows={14} value={form.contentHtml} onChange={(e) => set({ contentHtml: e.target.value })} hint="Disanitasi di server dengan whitelist ketat. Script, style, dan atribut on* dihapus." error={f.contentHtml} />}
                {form.contentMode === "html_raw" && (
                  <>
                    <Notice kind="info">HTML mentah dirender di iframe sandbox tanpa akses ke situs. Hanya Super Admin yang dapat memakai mode ini. Pratinjau wajib sebelum terbit.</Notice>
                    <TextArea id="n-raw" label="HTML/CSS/JS" rows={14} value={form.rawHtml} onChange={(e) => set({ rawHtml: e.target.value })} />
                    {doc?.slug && !dirty && <iframe key={previewKey} title="Pratinjau HTML mentah" src={`/embed/news/${doc.slug}?preview=1`} sandbox="allow-scripts allow-popups" className="h-96 w-full rounded-card border border-border" />}
                    {dirty && <p className="text-sm text-muted">Simpan untuk memperbarui pratinjau.</p>}
                  </>
                )}
              </fieldset>

              <FieldInput f={{ type: "lines", name: "tags", label: "Tag" }} v={form} errors={{}} path="n-" options={{}} set={set} />
              <FieldInput
                f={{ type: "repeater", name: "media", label: "Galeri media", max: 30, addLabel: "Tambah media", fields: [
                  { type: "select", name: "type", label: "Jenis", default: "image", options: [{ value: "image", label: "Gambar" }, { value: "video", label: "Video MP4" }, { value: "embed", label: "Embed YouTube/Vimeo" }] },
                  { type: "image", name: "url", label: "URL" },
                  { type: "text", name: "alt", label: "Alt text (wajib untuk gambar)" },
                  { type: "text", name: "caption", label: "Keterangan" },
                ] }}
                v={form}
                errors={{}}
                path="n-"
                options={{}}
                set={set}
              />
              {isAdmin && <TextInput id="n-pub" label="Waktu tayang (opsional)" type="datetime-local" value={form.publishedAt} onChange={(e) => set({ publishedAt: e.target.value })} hint="Zona waktu perangkat Anda." />}

              <fieldset className="space-y-3 rounded-card border border-border p-3">
                <legend className="px-1 text-sm font-medium">SEO</legend>
                <TextInput id="n-seo-t" label="Judul SEO" value={form.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} maxLength={120} />
                <TextArea id="n-seo-d" label="Deskripsi SEO" rows={2} value={form.seoDescription} onChange={(e) => set({ seoDescription: e.target.value })} maxLength={300} />
                <ImageField id="n-seo-i" label="Gambar Open Graph" value={form.seoOgImage} onChange={(v) => set({ seoOgImage: v })} />
              </fieldset>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              {editable && <Button type="submit" loading={saving}>Simpan</Button>}
              {doc && editable && <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>Hapus berita</Button>}
            </div>
          </form>
        </Card>

        <ConfirmDialog open={!!confirm} title={confirm?.label ?? ""} confirmLabel="Lanjutkan" busy={saving} onCancel={() => setConfirm(null)} onConfirm={() => confirm && runAction(confirm.slug)}>
          Berita yang diarsipkan hilang dari daftar, pencarian, sitemap, dan berita terkait di situs publik.
        </ConfirmDialog>
        <ConfirmDialog open={deleteOpen} title="Hapus berita?" busy={saving} onCancel={() => setDeleteOpen(false)} onConfirm={remove}>
          Berita dihapus permanen dan tidak dapat dipulihkan.
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Berita</h1>
        <div className="flex gap-2">
          <Link href="/admin/news/categories" className="inline-flex min-h-11 items-center rounded-full border-2 border-border px-5 text-sm font-medium hover:bg-surface-2">Kategori</Link>
          <Button onClick={() => open(null)}><Plus className="size-4" aria-hidden /> Berita baru</Button>
        </div>
      </div>
      {ok && <Notice kind="success">{ok}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput id="n-q" label="Cari judul" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <SelectInput id="n-st" label="Status" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={[{ value: "", label: "Semua" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
        <SelectInput id="n-cat-f" label="Kategori" value={catFilter} onChange={(e) => { setPage(1); setCatFilter(e.target.value); }} options={[{ value: "", label: "Semua" }, ...cats]} />
        {(q || status || catFilter || sorter.state?.sort !== "updatedAt" || sorter.state?.dir !== "desc") && <div className="flex items-end"><Button variant="secondary" onClick={() => { setQ(""); setStatus(""); setCatFilter(""); sorter.reset(); setPage(1); }}>Reset filter dan urutan</Button></div>}
      </div>
      {rows === null ? <Skeleton className="h-48" /> : rows.length === 0 ? <EmptyState title="Belum ada berita">Klik &quot;Berita baru&quot; untuk memulai.</EmptyState> : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daftar berita</caption>
            <thead className="border-b border-border bg-surface-2"><tr>
              <SortTh label="Judul" field="title" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
              <SortTh label="Status" field="status" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
              <SortTh label="Kategori" state={sorter.state} onSort={() => {}} />
              <SortTh label="Penulis" state={sorter.state} onSort={() => {}} />
              <SortTh label="Diperbarui" field="updatedAt" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
              <th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3">{STATUS_LABEL[r.status as NewsStatus]}</td>
                  <td className="px-4 py-3">{r.category?.name ?? "-"}</td>
                  <td className="px-4 py-3">{r.authorNameSnapshot}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(r.updatedAt, true)}</td>
                  <td className="px-4 py-2"><button type="button" onClick={() => open(r._id)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Buka ${r.title}`}><Pencil className="size-4" aria-hidden /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} limit={20} onPage={setPage} />
    </div>
  );
}
