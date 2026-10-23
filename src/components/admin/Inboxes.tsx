"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { Reply } from "lucide-react";
import { ApiClientError, api, formatDate } from "@/components/api";
import { Button, Card, EmptyState, Notice, SelectInput, Skeleton, TextArea, TextInput } from "@/components/ui";
import { Pager, SortTh, useSort } from "@/components/admin/table";

const STATUS: Record<string, string> = { new: "Baru", read: "Dibaca", replied: "Dibalas" };

export function MessagesInbox() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const sorter = useSort({ sort: "createdAt", dir: "desc" });
  const [open, setOpen] = useState<any | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: any[]; total: number }>(`/api/admin/messages?page=${page}&limit=20${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}${sorter.query}`);
      setRows(d.items);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat pesan.");
      setRows([]);
    }
  }, [page, status, q, sorter.query]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function view(m: any) {
    setOpen(m);
    setReply("");
    setOk("");
    setError("");
    if (m.status === "new") {
      await api(`/api/admin/messages/${m._id}`, { method: "PATCH", body: { action: "mark_read" } }).catch(() => {});
      void load();
    }
  }

  async function send() {
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/messages/${open._id}`, { method: "PATCH", body: { action: "reply", body: reply } });
      setOk("Balasan terkirim.");
      setReply("");
      setOpen({ ...open, status: "replied" });
      void load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Balasan gagal dikirim.");
    } finally {
      setBusy(false);
    }
  }

  const onSort = (f: string) => { setPage(1); sorter.toggle(f); };
  const filtered = !!(q || status);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Pesan</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput id="m-q" label="Cari nama, email, atau subjek" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <SelectInput id="f-status" label="Status" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={[{ value: "", label: "Semua" }, { value: "new", label: "Baru" }, { value: "read", label: "Dibaca" }, { value: "replied", label: "Dibalas" }]} />
        {(filtered || sorter.state?.sort !== "createdAt" || sorter.state?.dir !== "desc") && <div className="flex items-end"><Button variant="secondary" onClick={() => { setQ(""); setStatus(""); sorter.reset(); setPage(1); }}>Reset filter dan urutan</Button></div>}
      </div>
      {error && !open && <Notice kind="error">{error}</Notice>}
      {rows === null ? <Skeleton className="h-40" /> : rows.length === 0 ? <EmptyState title={filtered ? "Tidak ada pesan yang cocok" : "Belum ada pesan masuk"} /> : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Pesan kontak</caption>
            <thead className="border-b border-border bg-surface-2">
              <tr>
                <SortTh label="Subjek" field="subject" state={sorter.state} onSort={onSort} />
                <SortTh label="Pengirim" field="name" state={sorter.state} onSort={onSort} />
                <SortTh label="Status" field="status" state={sorter.state} onSort={onSort} />
                <SortTh label="Diterima" field="createdAt" state={sorter.state} onSort={onSort} />
                <th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m._id} className="border-b border-border last:border-0">
                  <td className={`px-4 py-3 ${m.status === "new" ? "font-semibold" : ""}`}>{m.subject}</td>
                  <td className="px-4 py-3">{m.name}<span className="block text-xs text-muted">{m.email}</span></td>
                  <td className="px-4 py-3"><span className="rounded-full border border-border px-2.5 py-0.5 text-xs">{STATUS[m.status]}</span></td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(m.createdAt, true)}</td>
                  <td className="px-4 py-2 text-right"><Button variant="secondary" onClick={() => view(m)}>Buka</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} limit={20} onPage={setPage} />
      {open && (
        <Card className="space-y-3">
          <h2 className="text-xl">{open.subject}</h2>
          <p className="text-sm text-muted">{open.name} &lt;{open.email}&gt;{open.phone ? ` / ${open.phone}` : ""} &middot; {formatDate(open.createdAt, true)} &middot; {STATUS[open.status]}</p>
          {/* Teks tidak tepercaya: dirender sebagai teks biasa. */}
          <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm">{open.message}</p>
          {ok && <Notice kind="success">{ok}</Notice>}
          {error && <Notice kind="error">{error}</Notice>}
          <TextArea id="reply" label="Balas via email" rows={5} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex gap-3">
            <Button onClick={send} loading={busy} disabled={reply.trim().length < 5}><Reply className="size-4" aria-hidden /> Kirim balasan</Button>
            <Button variant="secondary" onClick={() => setOpen(null)}>Tutup</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

const ENTITIES = ["user", "news", "news_category", "page", "feature", "feature_category", "hero", "about", "settings", "media", "contact_message", "message", "complaint", "complaint_category"];

export function AuditTable() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [q, setQ] = useState("");
  const sorter = useSort({ sort: "at", dir: "desc" });
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), limit: "50" });
      if (action) p.set("action", action);
      if (entity) p.set("entity", entity);
      if (q) p.set("q", q);
      const d = await api<{ items: any[]; total: number }>(`/api/admin/audit?${p}${sorter.query}`);
      setRows(d.items);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat audit log.");
      setRows([]);
    }
  }, [page, action, entity, q, sorter.query]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  const onSort = (f: string) => { setPage(1); sorter.toggle(f); };
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Audit Log</h1>
      <p className="text-sm text-muted">Hanya-baca. Retensi awal prototype 90 hari.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput id="a-q" label="Cari ringkasan" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <TextInput id="a-filter" label="Awalan aksi (mis. news. atau auth.)" value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} />
        <SelectInput id="a-entity" label="Entitas" value={entity} onChange={(e) => { setPage(1); setEntity(e.target.value); }} options={[{ value: "", label: "Semua" }, ...ENTITIES.map((v) => ({ value: v, label: v }))]} />
        {(q || action || entity || sorter.state?.sort !== "at" || sorter.state?.dir !== "desc") && <div className="flex items-end"><Button variant="secondary" onClick={() => { setQ(""); setAction(""); setEntity(""); sorter.reset(); setPage(1); }}>Reset filter dan urutan</Button></div>}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {rows === null ? <Skeleton className="h-40" /> : rows.length === 0 ? <EmptyState title="Tidak ada catatan yang cocok" /> : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit log</caption>
            <thead className="border-b border-border bg-surface-2">
              <tr>
                <SortTh label="Waktu" field="at" state={sorter.state} onSort={onSort} />
                <SortTh label="Aksi" field="action" state={sorter.state} onSort={onSort} />
                <SortTh label="Entitas" field="entity" state={sorter.state} onSort={onSort} />
                <SortTh label="Ringkasan" state={sorter.state} onSort={onSort} />
                <SortTh label="IP" state={sorter.state} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2">{formatDate(r.at, true)}</td>
                  <td className="px-4 py-2 font-medium">{r.action}</td>
                  <td className="px-4 py-2">{r.entity}{r.entityId ? ` #${String(r.entityId).slice(-6)}` : ""}</td>
                  <td className="max-w-xs truncate px-4 py-2" title={r.summary}>{r.summary}</td>
                  <td className="px-4 py-2">{r.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} limit={50} onPage={setPage} />
    </div>
  );
}
