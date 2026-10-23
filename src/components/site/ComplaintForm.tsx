"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Copy, Paperclip, Send } from "lucide-react";
import { ApiClientError, api } from "@/components/api";
import { Button, Checkbox, Notice, SelectInput, TextArea, TextInput } from "@/components/ui";
import { REGIONS } from "@/lib/regions";

type Result = { ticketNumber: string; accessCode: string };
type Upload = { name: string; status: "ok" | "gagal"; message?: string };

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL = 25 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png"];

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input id={id} readOnly value={value} className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-border bg-surface-2 px-3 font-mono text-lg tracking-wider" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* abaikan */ } }}>
          {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          <span>{done ? "Tersalin" : "Salin"}</span>
        </Button>
      </div>
    </div>
  );
}

export function ComplaintForm({ categories, uploadsEnabled }: { categories: { id: string; name: string }[]; uploadsEnabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState("");

  function checkFiles(files: File[]): string {
    if (files.length > MAX_FILES) return "Maksimal 5 lampiran.";
    let total = 0;
    for (const f of files) {
      if (!TYPES.includes(f.type)) return `Berkas "${f.name}" tidak diizinkan. Hanya PDF, JPG, dan PNG.`;
      if (f.size > MAX_BYTES) return `Berkas "${f.name}" melebihi 10 MB.`;
      total += f.size;
    }
    return total > MAX_TOTAL ? "Total lampiran melebihi 25 MB." : "";
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const files = Array.from(fileRef.current?.files ?? []);
    const fe = checkFiles(files);
    setFileError(fe);
    if (fe) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<Result>("/api/public/complaints", {
        body: {
          name: fd.get("name"),
          address: fd.get("address"),
          region: fd.get("region"),
          phone: fd.get("phone"),
          categoryId: fd.get("categoryId"),
          subject: fd.get("subject"),
          description: fd.get("description"),
          privacyConsent: fd.get("privacyConsent") === "on",
          website: fd.get("website") || undefined,
        },
      });
      setResult(res);
      // Lampiran diunggah satu per satu setelah tiket dibuat (sesi pelapor sudah aktif).
      const out: Upload[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        try {
          await api("/api/public/complaints/me/attachments", { form });
          out.push({ name: file.name, status: "ok" });
        } catch (err) {
          out.push({ name: file.name, status: "gagal", message: err instanceof ApiClientError ? err.message : "Gagal diunggah." });
        }
        setUploads([...out]);
      }
    } catch (err) {
      const c = err instanceof ApiClientError ? err : null;
      setError({ message: c?.message ?? "Pengaduan gagal dikirim.", fields: c?.fields });
      requestAnimationFrame(() => document.getElementById("form-error")?.focus());
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <Notice kind="success">Pengaduan Anda telah diterima.</Notice>
        <div className="space-y-4 rounded-card border-2 border-fg p-5">
          <h2 className="text-xl">Simpan data berikut sekarang</h2>
          <CopyField id="tiket" label="Nomor tiket" value={result.ticketNumber} />
          <CopyField id="kode" label="Kode akses rahasia" value={result.accessCode} />
          <Notice kind="info">
            Kode akses <strong>hanya ditampilkan satu kali</strong> dan tidak dapat diambil kembali, bahkan oleh petugas. Jika kode hilang, Anda harus membuat pengaduan baru. Jangan bagikan kode ini kepada siapa pun.
          </Notice>
        </div>
        {uploads.length > 0 && (
          <ul className="space-y-1 text-sm" aria-label="Status unggah lampiran">
            {uploads.map((u) => (
              <li key={u.name}>{u.status === "ok" ? "Terunggah" : "Gagal"}: {u.name}{u.message ? ` (${u.message})` : ""}</li>
            ))}
          </ul>
        )}
        <Link href="/pengaduan/lacak" className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-fg">Lacak pengaduan</Link>
      </div>
    );
  }

  const f = error?.fields ?? {};
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && (
        <div id="form-error" tabIndex={-1} className="outline-none">
          <Notice kind="error">
            {error.message}
            {Object.keys(f).length > 0 && <ul className="mt-2 list-disc pl-5">{Object.entries(f).map(([k, v]) => <li key={k}>{v}</li>)}</ul>}
          </Notice>
        </div>
      )}
      <TextInput id="name" label="Nama lengkap" required maxLength={100} autoComplete="name" error={f.name} />
      <TextArea id="address" label="Alamat" required rows={2} maxLength={300} autoComplete="street-address" error={f.address} />
      <SelectInput id="region" label="Kabupaten/Kota lokasi kejadian" required defaultValue="" error={f.region} hint="Dipakai untuk pemetaan sebaran pengaduan." options={[{ value: "", label: "Pilih kabupaten/kota" }, ...REGIONS.map((x) => ({ value: x.slug, label: x.name }))]} />
      <TextInput id="phone" label="Nomor telepon" type="tel" required inputMode="tel" autoComplete="tel" placeholder="08123456789" hint="Gunakan nomor Indonesia yang aktif." error={f.phone} />
      <SelectInput id="categoryId" label="Kategori" required defaultValue="" error={f.categoryId} options={[{ value: "", label: "Pilih kategori" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
      <TextInput id="subject" label="Subjek" required maxLength={200} error={f.subject} />
      <TextArea id="description" label="Uraian pengaduan" required rows={7} maxLength={5000} hint="Jelaskan kejadian dengan jelas (minimal 20 karakter)." error={f.description} />

      {uploadsEnabled ? (
        <div className="space-y-1.5">
          <label htmlFor="lampiran" className="flex items-center gap-2 text-sm font-medium"><Paperclip className="size-4" aria-hidden /> Lampiran (opsional)</label>
          <input id="lampiran" ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-2 file:border-border file:bg-surface file:px-4" aria-describedby="lampiran-hint" />
          <p id="lampiran-hint" className="text-sm text-muted">PDF, JPG, atau PNG. Maksimal 5 berkas, 10 MB per berkas, 25 MB total.</p>
          {fileError && <Notice kind="error">{fileError}</Notice>}
        </div>
      ) : (
        <p className="text-sm text-muted">Unggah lampiran belum tersedia pada lingkungan ini.</p>
      )}

      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Jangan diisi</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <Checkbox id="privacyConsent" required label={<>Saya telah membaca dan menyetujui pemberitahuan privasi. Data saya dipakai hanya untuk menindaklanjuti pengaduan ini.</>} />
        {f.privacyConsent && <p className="mt-1 text-sm font-medium">{f.privacyConsent}</p>}
      </div>
      <Button type="submit" loading={busy}><Send className="size-4" aria-hidden /> Kirim pengaduan</Button>
    </form>
  );
}
