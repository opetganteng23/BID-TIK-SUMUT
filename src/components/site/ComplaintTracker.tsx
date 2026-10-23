"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, LogOut, Paperclip, Send } from "lucide-react";
import { ApiClientError, api, formatDate } from "@/components/api";
import { Button, Card, Notice, Skeleton, TextArea, TextInput } from "@/components/ui";

type Detail = {
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  statusLabel: string;
  claimed: boolean;
  createdAt: string;
  confirmationDeadlineAt?: string;
  closedAt?: string;
  closureReason?: string;
  attachments: { id: string; name: string; size: number }[];
  history: { status: string; label: string; by: string; at: string }[];
};
type Msg = { id: string; from: "reporter" | "admin"; label: string; body: string; at: string };

const BY: Record<string, string> = { reporter: "Pelapor", admin: "Petugas", system: "Sistem" };
const CLOSURE: Record<string, string> = { reporter_confirmed: "Dikonfirmasi selesai oleh pelapor", auto_closed_no_reporter_response: "Ditutup otomatis karena tidak ada respons selama 7 hari" };

function Login({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      // Kode akses hanya dikirim di body POST, tidak pernah di URL.
      await api("/api/public/complaints/access", { body: { ticketNumber: fd.get("ticketNumber"), accessCode: fd.get("accessCode") } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="max-w-md">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-muted">Masukkan nomor tiket dan kode akses yang Anda terima saat mengajukan pengaduan. Nomor tiket saja tidak cukup.</p>
        {error && <Notice kind="error">{error}</Notice>}
        <TextInput id="ticketNumber" label="Nomor tiket" required autoComplete="off" autoCapitalize="characters" placeholder="PGD-XXXX-XXXX" />
        <TextInput id="accessCode" label="Kode akses" type="password" required autoComplete="off" />
        <Button type="submit" loading={busy}>Buka tiket</Button>
      </form>
    </Card>
  );
}

export function ComplaintTracker({ uploadsEnabled }: { uploadsEnabled: boolean }) {
  const [phase, setPhase] = useState<"loading" | "login" | "ready">("loading");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([api<Detail>("/api/public/complaints/me"), api<{ items: Msg[] }>("/api/public/complaints/me/messages")]);
      setDetail(d);
      setMessages(m.items);
      setPhase("ready");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) setPhase("login");
      else {
        setError(err instanceof ApiClientError ? err.message : "Gagal memuat tiket.");
        setPhase("login");
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Muat ulang berkala agar balasan petugas muncul tanpa refresh manual.
  useEffect(() => {
    if (phase !== "ready") return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [phase, load]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;
    setSending(true);
    setError("");
    try {
      await api("/api/public/complaints/me/messages", { body: { body } });
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Pesan gagal dikirim.");
    } finally {
      setSending(false);
    }
  }

  async function confirm(resolved: boolean) {
    setActing(true);
    setError("");
    try {
      await api("/api/public/complaints/me/confirmation", { body: { resolved } });
      setNotice(resolved ? "Terima kasih. Tiket ditutup." : "Tiket dikembalikan ke petugas untuk ditindaklanjuti.");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Aksi gagal.");
      await load();
    } finally {
      setActing(false);
    }
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setActing(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      await api("/api/public/complaints/me/attachments", { form });
      if (fileRef.current) fileRef.current.value = "";
      setNotice("Lampiran terunggah.");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unggah gagal.");
    } finally {
      setActing(false);
    }
  }

  async function logout() {
    await api("/api/public/complaints/access/logout", { method: "POST", body: {} }).catch(() => {});
    setDetail(null);
    setMessages([]);
    setPhase("login");
  }

  if (phase === "loading") return <div aria-busy="true" className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /></div>;
  if (phase === "login" || !detail) return <>{error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}<Login onDone={load} /></>;

  const closed = detail.status === "closed";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-lg">{detail.ticketNumber}</p>
        <Button variant="secondary" onClick={logout}><LogOut className="size-4" aria-hidden /> Keluar</Button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border-2 border-fg px-4 py-1 text-sm font-semibold">{detail.statusLabel}</span>
          <span className="text-sm text-muted">{detail.category}</span>
        </div>
        <h2 className="text-2xl">{detail.subject}</h2>
        <p className="whitespace-pre-wrap text-sm">{detail.description}</p>
        <p className="text-sm text-muted">Diajukan {formatDate(detail.createdAt, true)} WIB. {detail.claimed ? "Sudah ditangani petugas." : "Menunggu diambil petugas."}</p>
        {closed && detail.closureReason && <p className="text-sm font-medium">{CLOSURE[detail.closureReason]}</p>}
      </Card>

      {detail.status === "waiting_reporter" && <Notice kind="info">Petugas meminta informasi tambahan. Silakan balas pada percakapan di bawah.</Notice>}

      {detail.status === "awaiting_reporter_confirmation" && (
        <Card className="space-y-3 border-2 border-fg">
          <h2 className="text-xl">Apakah masalah Anda sudah selesai?</h2>
          <p className="text-sm text-muted">
            Petugas menyatakan penanganan selesai. Jika tidak ada respons hingga {formatDate(detail.confirmationDeadlineAt, true)} WIB, tiket ditutup otomatis.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => confirm(true)} loading={acting}><CheckCircle2 className="size-4" aria-hidden /> Ya, sudah selesai</Button>
            <Button variant="secondary" onClick={() => confirm(false)} loading={acting}>Belum selesai</Button>
          </div>
        </Card>
      )}

      <section aria-labelledby="percakapan">
        <h2 id="percakapan" className="mb-3 text-xl">Percakapan</h2>
        <ul className="space-y-3" aria-live="polite">
          {messages.length === 0 && <li className="text-sm text-muted">Belum ada pesan.</li>}
          {messages.map((m) => (
            <li key={m.id} className={m.from === "reporter" ? "ml-8" : "mr-8"}>
              <div className={`rounded-card border p-3 text-sm ${m.from === "reporter" ? "border-border bg-surface-2" : "border-2 border-fg bg-surface"}`}>
                <p className="mb-1 text-xs font-semibold">{m.label} &middot; <time dateTime={m.at}>{formatDate(m.at, true)}</time></p>
                {/* Teks biasa: React meng-escape, tidak pernah dirender sebagai HTML. */}
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </li>
          ))}
        </ul>
        {!closed ? (
          <form onSubmit={send} className="mt-4 space-y-3">
            <TextArea id="body" label="Balas petugas" required rows={3} maxLength={3000} />
            <Button type="submit" loading={sending}><Send className="size-4" aria-hidden /> Kirim pesan</Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">Tiket sudah ditutup dan tidak dapat dibuka kembali. Buat pengaduan baru bila diperlukan.</p>
        )}
      </section>

      <section aria-labelledby="lampiran">
        <h2 id="lampiran" className="mb-3 text-xl">Lampiran</h2>
        {detail.attachments.length === 0 ? <p className="text-sm text-muted">Tidak ada lampiran.</p> : (
          <ul className="space-y-1 text-sm">
            {detail.attachments.map((a) => (
              <li key={a.id}>
                <a className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4" href={`/api/public/complaints/me/attachments/${a.id}`}>
                  <Download className="size-4" aria-hidden /> {a.name} ({Math.round(a.size / 1024)} KB)
                </a>
              </li>
            ))}
          </ul>
        )}
        {uploadsEnabled && !closed && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label htmlFor="tambah" className="sr-only">Tambah lampiran</label>
            <input id="tambah" ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-2 file:border-border file:bg-surface file:px-4" />
            <Button variant="secondary" type="button" onClick={upload} loading={acting}><Paperclip className="size-4" aria-hidden /> Unggah</Button>
          </div>
        )}
      </section>

      <section aria-labelledby="riwayat">
        <h2 id="riwayat" className="mb-3 text-xl">Riwayat status</h2>
        <ol className="space-y-2 border-l-2 border-border pl-4">
          {detail.history.map((h, i) => (
            <li key={i} className="text-sm">
              <span className="font-semibold">{h.label}</span> <span className="text-muted">oleh {BY[h.by] ?? h.by}, {formatDate(h.at, true)} WIB</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
