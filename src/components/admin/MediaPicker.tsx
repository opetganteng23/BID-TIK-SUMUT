"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImageIcon, Trash2, Upload, X } from "lucide-react";
import { ApiClientError, api } from "@/components/api";
import { Button, Checkbox, EmptyState, Notice, Skeleton, TextInput } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

export type MediaItem = { _id: string; url: string; pathname: string; type: "image" | "video" | "file"; mime?: string; size?: number; alt?: string };
type Kind = "image" | "video" | "logo";

const ACCEPT: Record<Kind, string> = { image: "image/jpeg,image/png,image/webp,image/avif", logo: "image/png,image/webp", video: "video/mp4" };
const LIMIT_TEXT: Record<Kind, string> = { image: "JPG, PNG, WebP, AVIF. Maksimal 5 MB.", logo: "PNG atau WebP. Maksimal 1 MB.", video: "MP4 (H.264). Maksimal 50 MB. Poster wajib." };

/** Unggah langsung ke Vercel Blob (client upload), lalu catat metadata setelah diverifikasi server. */
const RAW_LIMIT = 3 * 1024 * 1024; // hasil base64 harus muat di body fungsi serverless (~4,5 MB)

/** Gambar diubah ke base64 di browser. Berkas besar diperkecil (WebP) agar muat dalam batas body. */
async function toBase64(file: File): Promise<{ base64: string; mime: string }> {
  let blob: Blob = file;
  if (file.size > RAW_LIMIT) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", q));
      if (out && out.size <= RAW_LIMIT) {
        blob = out;
        break;
      }
    }
    if (blob === file) throw new Error("Gambar terlalu besar untuk diproses. Perkecil dimensinya.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Gagal membaca berkas."));
    r.readAsDataURL(blob);
  });
  const [head, base64] = dataUrl.split(",");
  return { base64, mime: /data:([^;]+)/.exec(head)?.[1] ?? blob.type };
}

export async function uploadMedia(file: File, kind: Kind, alt: string, decorative: boolean): Promise<MediaItem> {
  if (kind !== "video") {
    const { base64, mime } = await toBase64(file);
    return api<MediaItem>("/api/admin/media/image", { body: { filename: file.name, mime, base64, kind, alt, decorative } });
  }
  const blob = await upload(`media/${file.name}`, file, {
    access: "public",
    handleUploadUrl: "/api/admin/media/upload",
    clientPayload: JSON.stringify({ kind }),
  });
  return api<MediaItem>("/api/admin/media", { body: { url: blob.url, pathname: blob.pathname, kind, alt, decorative } });
}

export function MediaLibrary({ kind = "image", onPick, manage = false }: { kind?: Kind; onPick?: (m: MediaItem) => void; manage?: boolean }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<MediaItem | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [decorative, setDecorative] = useState(false);
  const [alt, setAlt] = useState("");

  const load = useCallback(async () => {
    try {
      const type = kind === "video" ? "video" : "image";
      const data = await api<{ items: MediaItem[] }>(`/api/admin/media?limit=48&type=${type}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat media.");
      setItems([]);
    }
  }, [kind, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function doUpload() {
    const f = file.current?.files?.[0];
    if (!f) return setError("Pilih berkas terlebih dahulu.");
    if (kind !== "video" && !decorative && !alt.trim()) return setError("Alt text wajib, atau tandai gambar sebagai dekoratif.");
    setBusy(true);
    setError("");
    try {
      const m = await uploadMedia(f, kind, alt, decorative);
      if (file.current) file.current.value = "";
      setAlt("");
      await load();
      onPick?.(m);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Unggah gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/api/admin/media/${toDelete._id}`, { method: "DELETE" });
      setToDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menghapus.");
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Notice kind="error">{error}</Notice>}
      <div className="grid gap-3 rounded-card border border-border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <label htmlFor="media-file" className="mb-1 block text-sm font-medium">Unggah berkas baru</label>
          <input id="media-file" ref={file} type="file" accept={ACCEPT[kind]} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-2 file:border-border file:bg-surface file:px-4" aria-describedby="media-limit" />
          <p id="media-limit" className="mt-1 text-xs text-muted">{LIMIT_TEXT[kind]}</p>
        </div>
        {kind !== "video" && (
          <div>
            <TextInput id="media-alt" label="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} disabled={decorative} maxLength={200} />
            <Checkbox id="media-deco" label="Gambar dekoratif" checked={decorative} onChange={(e) => setDecorative(e.target.checked)} />
          </div>
        )}
        <Button type="button" onClick={doUpload} loading={busy}><Upload className="size-4" aria-hidden /> Unggah</Button>
      </div>

      <TextInput id="media-search" label="Cari media" value={q} onChange={(e) => setQ(e.target.value)} />

      {items === null ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title="Belum ada media">Unggah berkas pertama Anda di atas.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((m) => (
            <li key={m._id} className="group relative overflow-hidden rounded-card border border-border bg-surface">
              <button type="button" onClick={() => onPick?.(m)} disabled={!onPick} className="block w-full text-left disabled:cursor-default" aria-label={onPick ? `Pilih ${m.alt || m.pathname}` : m.alt || m.pathname}>
                {m.type === "image" ? <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="aspect-square w-full object-cover" /> : <span className="flex aspect-square items-center justify-center bg-surface-2"><ImageIcon className="size-8" aria-hidden /></span>}
                <span className="block truncate p-2 text-xs">{m.alt || m.pathname}</span>
              </button>
              {manage && (
                <button type="button" onClick={() => setToDelete(m)} className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-full border-2 border-border bg-surface" aria-label={`Hapus ${m.pathname}`}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog open={!!toDelete} title="Hapus media?" busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)}>
        Berkas akan dihapus permanen. Jika media masih dipakai di konten, penghapusan ditolak dan Anda perlu mengganti referensinya lebih dulu.
      </ConfirmDialog>
    </div>
  );
}

/** Kolom URL gambar dengan tombol pustaka media. */
export function ImageField({ id, label, value, onChange, kind = "image", hint, error }: { id: string; label: string; value: string; onChange: (v: string) => void; kind?: Kind; hint?: string; error?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  return (
    <div className="space-y-2">
      <TextInput id={id} label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..." hint={hint} error={error} />
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => dlg.current?.showModal()}><ImageIcon className="size-4" aria-hidden /> Pilih dari pustaka</Button>
        {value && kind !== "video" && <img src={value} alt="" className="h-11 w-auto rounded-lg border border-border" />}
      </div>
      <dialog ref={dlg} aria-label="Pustaka media" className="m-auto w-[min(96vw,60rem)] rounded-[20px] border border-border bg-surface p-0 text-fg backdrop:bg-black/40">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-xl">Pustaka media</h2>
          <button type="button" onClick={() => dlg.current?.close()} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Tutup"><X className="size-5" aria-hidden /></button>
        </div>
        <div className="max-h-[75svh] overflow-y-auto p-4">
          <MediaLibrary kind={kind} onPick={(m) => { onChange(m.url); dlg.current?.close(); }} />
        </div>
      </dialog>
    </div>
  );
}
