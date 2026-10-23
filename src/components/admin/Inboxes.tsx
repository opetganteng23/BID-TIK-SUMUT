"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { Mail, Reply } from "lucide-react";
import { ApiClientError, api, formatDate } from "@/components/api";
import { Button, Card, EmptyState, Notice, Skeleton, TextArea, TextInput, SelectInput } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const STATUS: Record<string, string> = { new: "Baru", read: "Dibaca", replied: "Dibalas" };

export function MessagesInbox() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<any | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: any[]; total: number }>(`/api/admin/messages?page=${page}&limit=20${status ? `&status=${status}` : ""}`);
      setRows(d.items);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat pesan.");
      setRows([]);
    }
  }, [page, status]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Pesan</h1>
      <SelectInput id="f-status" label="Filter status" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={[{ value: "", label: "Semua" }, { value: "new", label: "Baru" }, { value: "read", label: "Dibaca" }, { value: "replied", label: "Dibalas" }]} />
      {error && !open && <Notice kind="error">{error}</Notice>}
      {rows === null ? <Skeleton className="h-40" /> : rows.length === 0 ? <EmptyState title="Belum ada pesan masuk" /> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {rows.map((m) => (
            <li key={m._id}>
              <button type="button" onClick={() => view(m)} className="flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                <Mail className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1"><span className={m.status === "new" ? "font-semibold" : ""}>{m.subject}</span><span className="block truncate text-sm text-muted">{m.name} &middot; {formatDate(m.createdAt, true)}</span></span>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">{STATUS[m.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {total > 20 && (
        <nav aria-label="Paginasi" className="flex justify-between">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
          <Button variant="secondary" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
        </nav>
      )}
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

export function AuditTable() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const d = await api<{ items: any[]; total: number }>(`/api/admin/audit?page=${page}&limit=50${action ? `&action=${encodeURIComponent(action)}` : ""}`);
      setRows(d.items);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat audit log.");
      setRows([]);
    }
  }, [page, action]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Audit Log</h1>
      <p className="text-sm text-muted">Hanya-baca. Retensi awal prototype 90 hari.</p>
      <TextInput id="a-filter" label="Filter aksi (awalan, mis. news. atau auth.)" value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} />
      {error && <Notice kind="error">{error}</Notice>}
      {rows === null ? <Skeleton className="h-40" /> : rows.length === 0 ? <EmptyState title="Belum ada catatan" /> : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit log</caption>
            <thead className="border-b border-border bg-surface-2"><tr>{["Waktu", "Aksi", "Entitas", "Ringkasan", "IP"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
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
      {total > 50 && (
        <nav aria-label="Paginasi" className="flex justify-between">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
          <Button variant="secondary" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
        </nav>
      )}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", editor: "Editor" };

export function UsersManager({ meId }: { meId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<{ user: any; kind: "deactivate" | "reset" } | null>(null);
  const [newPass, setNewPass] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: any[] }>("/api/admin/users?limit=100");
      setRows(d.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat pengguna.");
      setRows([]);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setFe({});
    try {
      await api("/api/admin/users", { body: { name: fd.get("name"), email: fd.get("email"), role: fd.get("role"), password: fd.get("password") } });
      setOk("Pengguna dibuat. Pengguna wajib mengganti password saat login pertama.");
      setCreating(false);
      await load();
    } catch (err) {
      const c = err instanceof ApiClientError ? err : null;
      setError(c?.message ?? "Gagal membuat pengguna.");
      setFe(c?.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, msg: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body });
      setOk(msg);
      setTarget(null);
      setNewPass("");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan.");
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Pengguna</h1>
        {!creating && <Button onClick={() => { setCreating(true); setOk(""); }}>Tambah pengguna</Button>}
      </div>
      {ok && <Notice kind="success">{ok}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {creating && (
        <Card>
          <form onSubmit={create} className="space-y-4" noValidate>
            <h2 className="text-xl">Pengguna baru</h2>
            <TextInput id="name" label="Nama" required error={fe.name} />
            <TextInput id="email" label="Email" type="email" required error={fe.email} />
            <SelectInput id="role" label="Peran" defaultValue="editor" options={[{ value: "editor", label: "Editor" }, { value: "admin", label: "Admin" }, { value: "super_admin", label: "Super Admin" }]} />
            <TextInput id="password" label="Password awal" type="password" autoComplete="new-password" hint="Minimal 12 karakter. Pengguna wajib menggantinya saat login pertama." required error={fe.password} />
            <div className="flex gap-3"><Button type="submit" loading={busy}>Buat</Button><Button type="button" variant="secondary" onClick={() => setCreating(false)}>Batal</Button></div>
          </form>
        </Card>
      )}
      {rows === null ? <Skeleton className="h-40" /> : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daftar pengguna</caption>
            <thead className="border-b border-border bg-surface-2"><tr>{["Nama", "Email", "Peran", "Status", "Login terakhir", "Aksi"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <label className="sr-only" htmlFor={`role-${u._id}`}>Peran {u.name}</label>
                    <select id={`role-${u._id}`} className="min-h-11 rounded-lg border-2 border-border bg-surface px-2" value={u.role} disabled={u._id === meId} onChange={(e) => patch(u._id, { role: e.target.value }, "Peran diperbarui. Sesi pengguna tersebut dicabut.")}>
                      {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">{u.isActive ? "Aktif" : "Nonaktif"}{u.mustChangePassword ? " (wajib ganti password)" : ""}</td>
                  <td className="px-4 py-3">{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : "-"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {u._id !== meId && (u.isActive ? <Button variant="secondary" onClick={() => setTarget({ user: u, kind: "deactivate" })}>Nonaktifkan</Button> : <Button variant="secondary" onClick={() => patch(u._id, { isActive: true }, "Pengguna diaktifkan.")}>Aktifkan</Button>)}
                      <Button variant="secondary" onClick={() => setTarget({ user: u, kind: "reset" })}>Reset password</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog open={target?.kind === "deactivate"} title="Nonaktifkan pengguna?" confirmLabel="Nonaktifkan" busy={busy} onCancel={() => setTarget(null)} onConfirm={() => target && patch(target.user._id, { isActive: false }, "Pengguna dinonaktifkan dan sesinya dicabut.")}>
        {target?.user.name} tidak akan dapat masuk lagi sampai diaktifkan kembali.
      </ConfirmDialog>
      <ConfirmDialog open={target?.kind === "reset"} title="Reset password?" confirmLabel="Reset" busy={busy} onCancel={() => { setTarget(null); setNewPass(""); }} onConfirm={() => target && newPass.length >= 12 && patch(target.user._id, { resetPassword: newPass }, "Password direset. Pengguna wajib menggantinya saat login berikutnya.")}>
        <TextInput id="reset-pass" label="Password sementara baru" type="password" autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} hint="Minimal 12 karakter." />
      </ConfirmDialog>
    </div>
  );
}
