"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, HandHelping, Send } from "lucide-react";
import { ApiClientError, api, formatDate } from "@/components/api";
import { Button, Card, Checkbox, EmptyState, Notice, SelectInput, Skeleton, TextArea, TextInput } from "@/components/ui";
import { STATUS_LABEL, type ComplaintStatus } from "@/lib/complaint-state";
import { Pager, SortTh, useSort } from "@/components/admin/table";
import { REGIONS, regionName } from "@/lib/regions";
import { can, type Role } from "@/lib/rbac";

const SUMMARY_KEYS: ComplaintStatus[] = ["submitted", "in_progress", "waiting_reporter", "awaiting_reporter_confirmation", "closed"];
const BY: Record<string, string> = { reporter: "Pelapor", admin: "Petugas", system: "Sistem" };
const CLOSURE: Record<string, string> = { reporter_confirmed: "reporter_confirmed", auto_closed_no_reporter_response: "auto_closed_no_reporter_response" };

export function ComplaintsDashboard({ role, initialStatus }: { role: Role; initialStatus?: string }) {
  const [data, setData] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initialStatus ?? "");
  const [cat, setCat] = useState("");
  const [mine, setMine] = useState("");
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cats, setCats] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState("");
  const sorter = useSort({ sort: "createdAt", dir: "desc" });
  const [exporting, setExporting] = useState(false);
  const [identity, setIdentity] = useState(false);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (cat) p.set("categoryId", cat);
    if (mine) p.set("claimedBy", mine);
    if (region) p.set("region", region);
    if (q) p.set("q", q);
    if (from) p.set("from", new Date(`${from}T00:00:00+07:00`).toISOString());
    if (to) p.set("to", new Date(`${to}T23:59:59+07:00`).toISOString());
    return p;
  }, [status, cat, mine, region, q, from, to]);

  const load = useCallback(async () => {
    try {
      const p = params();
      p.set("page", String(page));
      p.set("limit", "20");
      if (sorter.state) { p.set("sort", sorter.state.sort); p.set("dir", sorter.state.dir); }
      setData(await api<any>(`/api/admin/complaints?${p}`));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat pengaduan.");
      setData({ items: [], total: 0, summary: {} });
    }
  }, [params, page, sorter.state]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api<{ items: any[] }>("/api/admin/complaint-categories?limit=100").then((d) => setCats(d.items.map((c) => ({ value: c._id, label: c.name })))).catch(() => {});
  }, []);

  async function doExport() {
    setExporting(true);
    setError("");
    try {
      const p = params();
      p.delete("q");
      if (identity) p.set("includeIdentity", "true");
      const res = await fetch(`/api/admin/complaints/export?${p}`, { credentials: "same-origin" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? "Ekspor gagal.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "pengaduan.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekspor gagal.");
    } finally {
      setExporting(false);
    }
  }

  const reset = () => { setStatus(""); setCat(""); setMine(""); setQ(""); setFrom(""); setTo(""); sorter.reset(); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Pengaduan</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/complaints/analytics" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-fg hover:opacity-90"><BarChart3 className="size-4" aria-hidden /> Analitik dan laporan</Link>
          <Link href="/admin/complaints/categories" className="inline-flex min-h-11 items-center rounded-full border-2 border-border px-5 text-sm font-medium hover:bg-surface-2">Kategori</Link>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Ringkasan status">
        {SUMMARY_KEYS.map((k) => (
          <li key={k}>
            <button type="button" onClick={() => { setStatus(status === k ? "" : k); setPage(1); }} aria-pressed={status === k} className={`h-full w-full rounded-card border-2 p-4 text-left ${status === k ? "border-fg bg-surface-2" : "border-border bg-surface"}`}>
              <span className="block text-sm text-muted">{STATUS_LABEL[k]}</span>
              <span className="block text-3xl font-semibold">{data?.summary?.[k] ?? 0}</span>
            </button>
          </li>
        ))}
      </ul>

      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <TextInput id="c-q" label="Cari nomor tiket atau subjek" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
          <SelectInput id="c-cat" label="Kategori" value={cat} onChange={(e) => { setPage(1); setCat(e.target.value); }} options={[{ value: "", label: "Semua" }, ...cats]} />
          <SelectInput id="c-region" label="Wilayah" value={region} onChange={(e) => { setPage(1); setRegion(e.target.value); }} options={[{ value: "", label: "Semua" }, ...REGIONS.map((x) => ({ value: x.slug, label: x.name }))]} />
          <SelectInput id="c-mine" label="Petugas" value={mine} onChange={(e) => { setPage(1); setMine(e.target.value); }} options={[{ value: "", label: "Semua" }, { value: "me", label: "Saya" }, { value: "none", label: "Belum diambil" }]} />
          <TextInput id="c-from" label="Dari tanggal" type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          <TextInput id="c-to" label="Sampai tanggal" type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={reset}>Reset filter</Button>
          {can(role, "complaints.export") && (
            <>
              <Button onClick={doExport} loading={exporting}><Download className="size-4" aria-hidden /> Ekspor XLSX</Button>
              {can(role, "complaints.export_sensitive") && <Checkbox id="c-ident" label="Sertakan identitas pelapor (dicatat di audit)" checked={identity} onChange={(e) => setIdentity(e.target.checked)} />}
              <span className="text-sm text-muted">Tanpa rentang tanggal, ekspor memakai 30 hari terakhir.</span>
            </>
          )}
        </div>
      </Card>

      {data === null ? <Skeleton className="h-48" /> : data.items.length === 0 ? <EmptyState title="Belum ada pengaduan">Pengaduan yang masuk akan tampil di sini.</EmptyState> : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daftar pengaduan</caption>
            <thead className="border-b border-border bg-surface-2"><tr>
              <SortTh label="Tiket" field="ticketNumber" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
              <SortTh label="Subjek" field="subject" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
              <SortTh label="Kategori" state={sorter.state} onSort={() => {}} />
              <SortTh label="Wilayah" state={sorter.state} onSort={() => {}} />
              <SortTh label="Status" field="status" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
              <SortTh label="Petugas" state={sorter.state} onSort={() => {}} />
              <SortTh label="Masuk" field="createdAt" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
            </tr></thead>
            <tbody>
              {data.items.map((c: any) => (
                <tr key={c._id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-mono"><Link href={`/admin/complaints/${c._id}`} className="underline underline-offset-4">{c.ticketNumber}</Link></td>
                  <td className="max-w-xs truncate px-4 py-3">{c.subject}</td>
                  <td className="px-4 py-3">{c.categoryId?.name}</td>
                  <td className="px-4 py-3">{c.region ? regionName(c.region) : "-"}</td>
                  <td className="px-4 py-3"><span className="rounded-full border border-border px-2.5 py-0.5 text-xs">{STATUS_LABEL[c.status as ComplaintStatus]}</span></td>
                  <td className="px-4 py-3">{c.claimedBy?.name ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(c.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} total={data.total} limit={20} onPage={setPage} />}
    </div>
  );
}

export function ComplaintDetail({ id, role }: { id: string; role: Role }) {
  const [c, setC] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, m, h] = await Promise.all([api<any>(`/api/admin/complaints/${id}`), api<{ items: any[] }>(`/api/admin/complaints/${id}/messages`), api<{ items: any[] }>(`/api/admin/complaints/${id}/history`)]);
      setC(d);
      setMessages(m.items);
      setHistory(h.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat tiket.");
    }
  }, [id]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act<T>(fn: () => Promise<T>, success: string) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      await fn();
      setOk(success);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Aksi gagal.");
    } finally {
      setBusy(false);
      await load();
    }
  }

  if (!c) return error ? <Notice kind="error">{error}</Notice> : <Skeleton className="h-64" />;
  const handle = can(role, "complaints.handle");
  const canAct = handle && (c.claimedByMe || can(role, "complaints.categories.manage"));
  const closed = c.status === "closed";

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;
    await act(async () => {
      await api(`/api/admin/complaints/${id}/messages`, { body: { body } });
      form.reset();
    }, "Pesan terkirim.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/complaints" className="text-sm underline underline-offset-4">Kembali ke daftar</Link>
          <h1 className="font-mono text-3xl">{c.ticketNumber}</h1>
        </div>
        <span className="rounded-full border-2 border-fg px-4 py-1 text-sm font-semibold">{c.statusLabel}</span>
      </div>
      {ok && <Notice kind="success">{ok}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      <Card className="space-y-3">
        <h2 className="text-xl">{c.subject}</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Pelapor</dt><dd>{c.reporter?.name}</dd></div>
          <div><dt className="text-muted">Telepon</dt><dd>{c.reporter?.phone}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted">Alamat</dt><dd>{c.reporter?.address}</dd></div>
          <div><dt className="text-muted">Kategori</dt><dd>{c.categoryId?.name}</dd></div>
          <div><dt className="text-muted">Wilayah</dt><dd>{c.region ? regionName(c.region) : "Tidak dicatat"}</dd></div>
          <div><dt className="text-muted">Penanggung jawab</dt><dd>{c.claimedBy?.name ?? "Belum diambil"}</dd></div>
          <div><dt className="text-muted">Masuk</dt><dd>{formatDate(c.createdAt, true)} WIB</dd></div>
          {c.confirmationDeadlineAt && <div><dt className="text-muted">Tenggat konfirmasi pelapor</dt><dd>{formatDate(c.confirmationDeadlineAt, true)} WIB</dd></div>}
          {c.closureReason && <div><dt className="text-muted">Alasan penutupan</dt><dd>{CLOSURE[c.closureReason]}</dd></div>}
        </dl>
        {/* Teks tidak tepercaya: dirender sebagai teks biasa. */}
        <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm">{c.description}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl">Tindakan</h2>
        <div className="flex flex-wrap gap-3">
          {c.status === "submitted" && handle && <Button loading={busy} onClick={() => act(() => api(`/api/admin/complaints/${id}/claim`, { body: {} }), "Tiket berhasil diklaim.")}><HandHelping className="size-4" aria-hidden /> Klaim tiket</Button>}
          {canAct && c.allowedNext.includes("waiting_reporter") && <Button variant="secondary" loading={busy} onClick={() => act(() => api(`/api/admin/complaints/${id}/status`, { method: "PATCH", body: { to: "waiting_reporter", note: note || undefined } }), "Status: menunggu informasi pelapor.")}>Minta informasi pelapor</Button>}
          {canAct && c.allowedNext.includes("awaiting_reporter_confirmation") && <Button variant="secondary" loading={busy} onClick={() => act(() => api(`/api/admin/complaints/${id}/status`, { method: "PATCH", body: { to: "awaiting_reporter_confirmation", note: note || undefined } }), "Status: menunggu konfirmasi pelapor (tenggat 7 hari).")}>Nyatakan penanganan selesai</Button>}
          {!canAct && c.status !== "submitted" && !closed && <p className="text-sm text-muted">Hanya petugas yang mengklaim tiket ini yang dapat mengubah status atau membalas.</p>}
          {closed && <p className="text-sm text-muted">Tiket ditutup dan tidak dapat dibuka kembali. Buat tiket baru dengan rujukan nomor ini bila perlu.</p>}
        </div>
        {canAct && !closed && <TextInput id="c-note" label="Catatan perubahan status (opsional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
      </Card>

      <section aria-labelledby="chat">
        <h2 id="chat" className="mb-3 text-xl">Percakapan</h2>
        <ul className="space-y-3">
          {messages.length === 0 && <li className="text-sm text-muted">Belum ada pesan.</li>}
          {messages.map((m) => (
            <li key={m._id} className={m.senderType === "admin" ? "ml-8" : "mr-8"}>
              <div className={`rounded-card border p-3 text-sm ${m.senderType === "admin" ? "border-2 border-fg bg-surface" : "border-border bg-surface-2"}`}>
                <p className="mb-1 text-xs font-semibold">{m.senderType === "admin" ? m.senderLabel ?? "Petugas" : "Pelapor"} &middot; {formatDate(m.createdAt, true)}</p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </li>
          ))}
        </ul>
        {canAct && !closed && (
          <form onSubmit={send} className="mt-4 space-y-3">
            <TextArea id="body" label="Balas pelapor" rows={3} maxLength={3000} required />
            <Button type="submit" loading={busy}><Send className="size-4" aria-hidden /> Kirim</Button>
          </form>
        )}
      </section>

      <section aria-labelledby="att">
        <h2 id="att" className="mb-3 text-xl">Lampiran</h2>
        {(c.attachments ?? []).length === 0 ? <p className="text-sm text-muted">Tidak ada lampiran.</p> : (
          <ul className="space-y-1 text-sm">
            {c.attachments.map((a: any) => (
              <li key={a.attachmentId} className="flex flex-wrap items-center gap-3">
                <span>{a.name} ({Math.round((a.size ?? 0) / 1024)} KB)</span>
                {a.scanStatus === "clean" ? (
                  <a className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4" href={`/api/admin/complaints/${id}/attachments/${a.attachmentId}`}><Download className="size-4" aria-hidden /> Unduh</a>
                ) : (
                  <span className="rounded-full border-2 border-dashed border-fg px-3 py-0.5 text-xs">Menunggu pemindaian, unduhan dinonaktifkan</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hist">
        <h2 id="hist" className="mb-3 text-xl">Riwayat status</h2>
        <ol className="space-y-2 border-l-2 border-border pl-4 text-sm">
          {history.map((h) => (
            <li key={h._id}>
              <span className="font-semibold">{STATUS_LABEL[h.toStatus as ComplaintStatus] ?? h.toStatus}</span>{" "}
              <span className="text-muted">oleh {BY[h.actorType]}{h.actorUserId?.name ? ` (${h.actorUserId.name})` : ""}, {formatDate(h.createdAt, true)} WIB{h.note ? `. ${h.note}` : ""}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
