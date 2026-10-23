"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { ApiClientError, api } from "@/components/api";
import { Button, Card, Checkbox, EmptyState, Notice, SelectInput, Skeleton, TextArea, TextInput, cx } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageField } from "@/components/admin/MediaPicker";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Pager, SortTh, useSort } from "@/components/admin/table";

export type Field =
  | { type: "text" | "textarea" | "number" | "url"; name: string; label: string; required?: boolean; hint?: string; maxLength?: number; placeholder?: string }
  | { type: "checkbox"; name: string; label: string; default?: boolean }
  | { type: "select"; name: string; label: string; options?: { value: string; label: string }[]; optionsUrl?: string; emptyLabel?: string; required?: boolean; default?: string }
  | { type: "image"; name: string; label: string; kind?: "image" | "video" | "logo"; hint?: string }
  | { type: "content"; label: string; allowHtml?: boolean }
  | { type: "lines"; name: string; label: string; hint?: string }
  | { type: "repeater"; name: string; label: string; max: number; fields: Field[]; addLabel?: string };

export type Column = { key: string; label: string; kind?: "status" | "path"; /** Nama kolom server untuk pengurutan. Kosong = tidak dapat diurutkan. */ sort?: string };
export type TableFilter = { name: string; label: string; options?: { value: string; label: string }[]; optionsUrl?: string };

function cell(c: Column, row: any): React.ReactNode {
  const v = c.key.split(".").reduce((o: any, k) => (o == null ? o : o[k]), row);
  if (c.kind === "status") return v ? "Aktif" : "Nonaktif";
  if (c.kind === "path") return `/${v ?? ""}`;
  return v === undefined || v === null || v === "" ? "-" : String(v);
}

type Props = {
  title: string;
  endpoint: string;
  fields: Field[];
  columns: Column[];
  noun: string;
  searchable?: boolean;
  filters?: TableFilter[];
  reorderable?: boolean;
  /** Tautan pratinjau: base saja (mis. "/") atau base + nilai kolom `key` (mis. "/fitur/" + slug). */
  preview?: { base: string; key?: string };
  canWrite?: boolean;
  defaults?: Record<string, any>;
};

const emptyOf = (f: Field): any => {
  if (f.type === "checkbox") return f.default ?? true;
  if (f.type === "lines" || f.type === "repeater") return [];
  if (f.type === "number") return "";
  if (f.type === "select") return f.default ?? "";
  if (f.type === "content") return null;
  return "";
};

export function initial(fields: Field[], row: any | null, defaults: Record<string, any> = {}) {
  const v: Record<string, any> = {};
  for (const f of fields) {
    if (f.type === "content") {
      v.contentMode = row?.contentMode ?? "richtext";
      v.contentJson = row?.contentJson ?? null;
      v.contentHtml = row?.contentHtml ?? "";
      continue;
    }
    const raw = row?.[f.name];
    if (f.type === "select") v[f.name] = raw?._id ?? raw ?? defaults[f.name] ?? emptyOf(f);
    else v[f.name] = raw ?? defaults[f.name] ?? emptyOf(f);
  }
  return v;
}

/** Bersihkan nilai sebelum dikirim: string kosong dan angka kosong dihilangkan agar lolos validasi opsional. */
export function clean(fields: Field[], v: Record<string, any>, keepEmpty = false): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.type === "content") {
      out.contentMode = v.contentMode;
      out.contentHtml = v.contentHtml ?? "";
      if (v.contentMode === "richtext" && v.contentJson) out.contentJson = v.contentJson;
      continue;
    }
    const x = v[f.name];
    if (f.type === "number") {
      if (x !== "" && x !== undefined && x !== null) out[f.name] = Number(x);
    } else if (f.type === "repeater") {
      out[f.name] = (x as any[]).map((item) => clean(f.fields, item, keepEmpty));
    } else if (f.type === "select" || f.type === "text" || f.type === "textarea" || f.type === "url" || f.type === "image") {
      if (x !== "" && x !== undefined && x !== null) out[f.name] = x;
      else if (f.type !== "select") out[f.name] = keepEmpty || f.type === "image" ? "" : undefined;
    } else out[f.name] = x;
  }
  return out;
}

export function FieldInput({ f, v, set, errors, path, options }: { f: Field; v: Record<string, any>; set: (patch: Record<string, any>) => void; errors: Record<string, string>; path: string; options: Record<string, { value: string; label: string }[]> }) {
  const id = `${path}${"name" in f ? f.name : "content"}`;
  const err = "name" in f ? errors[f.name] ?? errors[`${path}${f.name}`] : errors.contentHtml;
  switch (f.type) {
    case "text":
    case "url":
      return <TextInput id={id} label={f.label} value={v[f.name] ?? ""} onChange={(e) => set({ [f.name]: e.target.value })} required={f.required} maxLength={f.maxLength} hint={f.hint} placeholder={f.placeholder} error={err} type={f.type === "url" ? "url" : "text"} />;
    case "number":
      return <TextInput id={id} label={f.label} type="number" value={v[f.name] ?? ""} onChange={(e) => set({ [f.name]: e.target.value })} hint={f.hint} error={err} />;
    case "textarea":
      return <TextArea id={id} label={f.label} value={v[f.name] ?? ""} onChange={(e) => set({ [f.name]: e.target.value })} required={f.required} maxLength={f.maxLength} hint={f.hint} error={err} />;
    case "checkbox":
      return <Checkbox id={id} label={f.label} checked={!!v[f.name]} onChange={(e) => set({ [f.name]: e.target.checked })} />;
    case "select": {
      const opts = f.options ?? options[id.replace(path, "")] ?? options[f.name] ?? [];
      return <SelectInput id={id} label={f.label} value={v[f.name] ?? ""} onChange={(e) => set({ [f.name]: e.target.value })} required={f.required} error={err} options={[{ value: "", label: f.emptyLabel ?? "Pilih" }, ...opts]} />;
    }
    case "image":
      return <ImageField id={id} label={f.label} value={v[f.name] ?? ""} onChange={(x) => set({ [f.name]: x })} kind={f.kind} hint={f.hint} error={err} />;
    case "lines":
      return <TextArea id={id} label={f.label} rows={4} value={((v[f.name] as string[]) ?? []).join("\n")} onChange={(e) => set({ [f.name]: e.target.value.split("\n").filter((l) => l.trim() !== "") })} hint={f.hint ?? "Satu per baris."} error={err} />;
    case "content":
      return (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{f.label}</legend>
          {f.allowHtml !== false && (
            <div className="flex gap-2" role="radiogroup" aria-label="Mode konten">
              {(["richtext", "html"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={v.contentMode === m} onClick={() => set({ contentMode: m })} className={cx("min-h-11 rounded-full border-2 px-4 text-sm", v.contentMode === m ? "border-fg bg-primary text-primary-fg" : "border-border")}>
                  {m === "richtext" ? "Rich text" : "HTML (disanitasi)"}
                </button>
              ))}
            </div>
          )}
          {v.contentMode === "html" ? (
            <TextArea id={id} label="HTML" rows={12} value={v.contentHtml ?? ""} onChange={(e) => set({ contentHtml: e.target.value })} hint="Disanitasi di server. Script, style, dan atribut on* dihapus." error={err} />
          ) : (
            <RichTextEditor id={id} label="Isi" html={v.contentHtml ?? ""} json={v.contentJson} onChange={(html, json) => set({ contentHtml: html, contentJson: json })} />
          )}
        </fieldset>
      );
    case "repeater": {
      const items = (v[f.name] as any[]) ?? [];
      return (
        <fieldset className="space-y-3 rounded-card border border-border p-3">
          <legend className="px-1 text-sm font-medium">{f.label}</legend>
          {items.map((item, i) => (
            <div key={i} className="space-y-3 rounded-xl bg-surface-2 p-3">
              {f.fields.map((sub) => (
                <FieldInput key={"name" in sub ? sub.name : "c"} f={sub} v={item} errors={errors} path={`${path}${f.name}-${i}-`} options={options} set={(patch) => set({ [f.name]: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })} />
              ))}
              <Button type="button" variant="danger" onClick={() => set({ [f.name]: items.filter((_, j) => j !== i) })}><Trash2 className="size-4" aria-hidden /> Hapus butir ini</Button>
            </div>
          ))}
          {items.length < f.max && (
            <Button type="button" variant="secondary" onClick={() => set({ [f.name]: [...items, Object.fromEntries(f.fields.map((s) => ["name" in s ? s.name : "x", emptyOf(s)]))] })}>
              <Plus className="size-4" aria-hidden /> {f.addLabel ?? "Tambah"}
            </Button>
          )}
        </fieldset>
      );
    }
  }
}

export function ResourceManager({ title, endpoint, fields, columns, noun, searchable, filters, reorderable, preview, canWrite = true, defaults }: Props) {
  const previewHref = (row: any) => (preview ? (preview.key ? `${preview.base}${row[preview.key]}` : preview.base) : null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<{ row: any | null } | null>(null);
  const [value, setValue] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [options, setOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const limit = reorderable ? 100 : 20;
  const sorter = useSort(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const filterQuery = Object.entries(filterValues).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("");

  const selectUrls = useMemo(() => fields.filter((f): f is Extract<Field, { type: "select" }> => f.type === "select" && !!f.optionsUrl), [fields]);

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: any[]; total: number }>(`${endpoint}?page=${page}&limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}${sorter.query}${filterQuery}`);
      setRows(d.items);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat data.");
      setRows([]);
    }
  }, [endpoint, page, q, limit, sorter.query, filterQuery]);

  useEffect(() => {
    (filters ?? []).filter((f) => f.optionsUrl).forEach(async (f) => {
      try {
        const d = await api<{ items: any[] }>(`${f.optionsUrl}?limit=100`);
        setFilterOptions((o) => ({ ...o, [f.name]: d.items.map((i) => ({ value: i._id, label: i.name ?? i.title })) }));
      } catch {
        /* opsi filter gagal dimuat */
      }
    });
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    selectUrls.forEach(async (f) => {
      try {
        const d = await api<{ items: any[] }>(`${f.optionsUrl}?limit=100`);
        setOptions((o) => ({ ...o, [f.name]: d.items.map((i) => ({ value: i._id, label: i.name ?? i.title })) }));
      } catch {
        /* opsi gagal dimuat: pilihan kosong */
      }
    });
  }, [selectUrls]);

  // Penanda perubahan belum tersimpan.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const open = (row: any | null) => {
    setEditing({ row });
    setValue(initial(fields, row, defaults));
    setErrors({});
    setError("");
    setSuccess("");
    setDirty(false);
    requestAnimationFrame(() => document.getElementById("editor-heading")?.focus());
  };

  const close = () => {
    setEditing(null);
    setDirty(false);
    setConfirmCancel(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setError("");
    try {
      const body = clean(fields, value);
      if (editing.row) await api(`${endpoint}/${editing.row._id}`, { method: "PUT", body });
      else await api(endpoint, { body });
      setSuccess(`${noun} berhasil disimpan.`);
      close();
      await load();
    } catch (err) {
      const c = err instanceof ApiClientError ? err : null;
      setError(c?.message ?? "Gagal menyimpan.");
      setErrors(c?.fields ?? {});
      requestAnimationFrame(() => document.getElementById("res-error")?.focus());
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setSaving(true);
    try {
      await api(`${endpoint}/${toDelete._id}`, { method: "DELETE" });
      setSuccess(`${noun} dihapus.`);
      setToDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menghapus.");
      setToDelete(null);
    } finally {
      setSaving(false);
    }
  }

  async function move(i: number, dir: -1 | 1) {
    if (!rows) return;
    const next = [...rows];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    try {
      await api(endpoint, { method: "PATCH", body: { ids: next.map((r) => r._id) } });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal mengubah urutan.");
      await load();
    }
  }

  const set = (patch: Record<string, any>) => {
    setValue((v) => ({ ...v, ...patch }));
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">{title}</h1>
        {canWrite && !editing && <Button onClick={() => open(null)}><Plus className="size-4" aria-hidden /> Tambah {noun}</Button>}
      </div>

      {success && <Notice kind="success">{success}</Notice>}
      {error && !editing && <Notice kind="error">{error}</Notice>}

      {editing && (
        <Card>
          <form onSubmit={save} className="space-y-5" noValidate>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="editor-heading" tabIndex={-1} className="text-xl outline-none">{editing.row ? `Ubah ${noun}` : `${noun} baru`}</h2>
              {dirty && <span className="rounded-full border-2 border-dashed border-fg px-3 py-1 text-xs font-medium" role="status">Perubahan belum disimpan</span>}
            </div>
            {error && (
              <div id="res-error" tabIndex={-1} className="outline-none">
                <Notice kind="error">{error}</Notice>
              </div>
            )}
            {fields.map((f, i) => (
              <FieldInput key={"name" in f ? f.name : `c${i}`} f={f} v={value} set={set} errors={errors} path="f-" options={options} />
            ))}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>Simpan</Button>
              <Button type="button" variant="secondary" onClick={() => (dirty ? setConfirmCancel(true) : close())}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      {(searchable || (filters && filters.length > 0)) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {searchable && <TextInput id="res-search" label={`Cari ${noun}`} value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />}
          {(filters ?? []).map((f) => (
            <SelectInput key={f.name} id={`flt-${f.name}`} label={f.label} value={filterValues[f.name] ?? ""} onChange={(e) => { setPage(1); setFilterValues((v) => ({ ...v, [f.name]: e.target.value })); }} options={[{ value: "", label: "Semua" }, ...(f.options ?? filterOptions[f.name] ?? [])]} />
          ))}
          {(q || filterQuery || sorter.state) && (
            <div className="flex items-end"><Button variant="secondary" onClick={() => { setQ(""); setFilterValues({}); sorter.reset(); setPage(1); }}>Reset filter dan urutan</Button></div>
          )}
        </div>
      )}

      {rows === null ? (
        <div aria-busy="true" className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title={`Belum ada ${noun}`}>{canWrite ? `Klik "Tambah ${noun}" untuk membuat yang pertama.` : "Data belum tersedia."}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="border-b border-border bg-surface-2">
              <tr>
                {columns.map((c) => <SortTh key={c.key} label={c.label} field={c.sort} state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />)}
                <th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r._id} className="border-b border-border last:border-0">
                  {columns.map((c) => <td key={c.key} className="px-4 py-3 align-middle">{cell(c, r)}</td>)}
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {reorderable && canWrite && !sorter.state && !filterQuery && !q && (
                        <>
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30" aria-label={`Naikkan ${noun} ${i + 1}`}><ArrowUp className="size-4" aria-hidden /></button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30" aria-label={`Turunkan ${noun} ${i + 1}`}><ArrowDown className="size-4" aria-hidden /></button>
                        </>
                      )}
                      {previewHref(r) && <a href={previewHref(r)!} target="_blank" rel="noopener noreferrer" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Pratinjau ${noun}`}><Eye className="size-4" aria-hidden /></a>}
                      {canWrite && <button type="button" onClick={() => open(r)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Ubah ${noun}`}><Pencil className="size-4" aria-hidden /></button>}
                      {canWrite && <button type="button" onClick={() => setToDelete(r)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Hapus ${noun}`}><Trash2 className="size-4" aria-hidden /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!reorderable && <Pager page={page} total={total} limit={limit} onPage={setPage} />}

      <ConfirmDialog open={!!toDelete} title={`Hapus ${noun}?`} busy={saving} onConfirm={remove} onCancel={() => setToDelete(null)}>
        Tindakan ini permanen dan tidak dapat dibatalkan.
      </ConfirmDialog>
      <ConfirmDialog open={confirmCancel} title="Buang perubahan?" confirmLabel="Buang" onConfirm={close} onCancel={() => setConfirmCancel(false)}>
        Ada perubahan yang belum disimpan. Jika Anda keluar, perubahan tersebut hilang.
      </ConfirmDialog>
    </div>
  );
}
