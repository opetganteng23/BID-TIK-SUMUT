"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { ApiClientError, api, formatDate } from "@/components/api";
import { Button, Card, EmptyState, Notice, SelectInput, Skeleton, TextInput } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pager, SortTh, useSort } from "@/components/admin/table";
import type { Role } from "@/lib/rbac";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", editor: "Editor" };
const LIMIT = 20;

type Target = { user: any; kind: "deactivate" | "activate" | "reset" | "delete" } | null;

export function UsersManager({ meId, actorRole }: { meId: string; actorRole: Role }) {
  const isSuper = actorRole === "super_admin";
  const [rows, setRows] = useState<any[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const sorter = useSort({ sort: "createdAt", dir: "desc" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState<{ id: string | null } | null>(null);
  const [values, setValues] = useState({ name: "", email: "", role: "editor", password: "" });
  const [fe, setFe] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Target>(null);
  const [newPass, setNewPass] = useState("");

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (q) p.set("q", q);
      if (role) p.set("role", role);
      if (active) p.set("isActive", active);
      const d = await api<{ items: any[]; total: number }>(`/api/admin/users?${p}${sorter.query}`);
      setRows(d.items);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat pengguna.");
      setRows([]);
    }
  }, [page, q, role, active, sorter.query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const manageable = (u: any) => isSuper || u.role !== "super_admin";
  const roleOptions = [
    { value: "editor", label: "Editor" },
    { value: "admin", label: "Admin" },
    ...(isSuper ? [{ value: "super_admin", label: "Super Admin" }] : []),
  ];

  function openForm(u: any | null) {
    setFe({});
    setError("");
    setOk("");
    setValues(u ? { name: u.name, email: u.email, role: u.role, password: "" } : { name: "", email: "", role: "editor", password: "" });
    setForm({ id: u?._id ?? null });
    requestAnimationFrame(() => document.getElementById("user-form-title")?.focus());
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setFe({});
    try {
      if (form.id) {
        await api(`/api/admin/users/${form.id}`, { method: "PATCH", body: { name: values.name, email: values.email, role: values.role } });
        setOk("Pengguna diperbarui. Sesi pengguna tersebut dicabut bila email atau peran berubah.");
      } else {
        await api("/api/admin/users", { body: values });
        setOk("Pengguna dibuat. Pengguna wajib mengganti password saat login pertama.");
      }
      setForm(null);
      await load();
    } catch (err) {
      const c = err instanceof ApiClientError ? err : null;
      setError(c?.message ?? "Gagal menyimpan.");
      setFe(c?.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      await fn();
      setOk(success);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Aksi gagal.");
    } finally {
      setBusy(false);
      setTarget(null);
      setNewPass("");
      await load();
    }
  }

  const act = (u: any, body: Record<string, unknown>, msg: string) => run(() => api(`/api/admin/users/${u._id}`, { method: "PATCH", body }), msg);
  const filtered = !!(q || role || active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Pengguna</h1>
        {!form && <Button onClick={() => openForm(null)}><Plus className="size-4" aria-hidden /> Tambah pengguna</Button>}
      </div>
      {!isSuper && <Notice kind="info">Sebagai Admin, Anda dapat mengelola Admin dan Editor. Akun Super Admin hanya dapat dikelola oleh Super Admin.</Notice>}
      {ok && <Notice kind="success">{ok}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      {form && (
        <Card>
          <form onSubmit={save} className="space-y-4" noValidate>
            <h2 id="user-form-title" tabIndex={-1} className="text-xl outline-none">{form.id ? "Ubah pengguna" : "Pengguna baru"}</h2>
            <TextInput id="u-name" label="Nama" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required error={fe.name} />
            <TextInput id="u-email" label="Email" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} required error={fe.email} />
            <SelectInput id="u-role" label="Peran" value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value })} options={roleOptions} error={fe.role} />
            {!form.id && <TextInput id="u-pass" label="Password awal" type="password" autoComplete="new-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} hint="Minimal 12 karakter. Pengguna wajib menggantinya saat login pertama." required error={fe.password} />}
            <div className="flex flex-wrap gap-3"><Button type="submit" loading={busy}>Simpan</Button><Button type="button" variant="secondary" onClick={() => setForm(null)}>Batal</Button></div>
          </form>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput id="u-q" label="Cari nama atau email" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <SelectInput id="u-f-role" label="Peran" value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} options={[{ value: "", label: "Semua" }, ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))]} />
        <SelectInput id="u-f-active" label="Status" value={active} onChange={(e) => { setPage(1); setActive(e.target.value); }} options={[{ value: "", label: "Semua" }, { value: "true", label: "Aktif" }, { value: "false", label: "Nonaktif" }]} />
        {(filtered || sorter.state?.sort !== "createdAt" || sorter.state?.dir !== "desc") && (
          <div className="flex items-end"><Button variant="secondary" onClick={() => { setQ(""); setRole(""); setActive(""); sorter.reset(); setPage(1); }}>Reset filter dan urutan</Button></div>
        )}
      </div>

      {rows === null ? <Skeleton className="h-48" /> : rows.length === 0 ? (
        <EmptyState title={filtered ? "Tidak ada pengguna yang cocok" : "Belum ada pengguna"}>{filtered ? "Ubah kata kunci atau filter." : "Tambahkan pengguna pertama."}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daftar pengguna</caption>
            <thead className="border-b border-border bg-surface-2">
              <tr>
                <SortTh label="Nama" field="name" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
                <SortTh label="Email" field="email" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
                <SortTh label="Peran" field="role" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
                <SortTh label="Status" field="isActive" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
                <SortTh label="Login terakhir" field="lastLoginAt" state={sorter.state} onSort={(f) => { setPage(1); sorter.toggle(f); }} />
                <th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const self = u._id === meId;
                const can = manageable(u);
                const btn = "inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30";
                return (
                  <tr key={u._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{u.name}{self && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-normal">Anda</span>}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                    <td className="px-4 py-3">{u.isActive ? "Aktif" : "Nonaktif"}{u.mustChangePassword ? " (wajib ganti password)" : ""}</td>
                    <td className="whitespace-nowrap px-4 py-3">{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : "-"}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button type="button" className={btn} disabled={!can} onClick={() => openForm(u)} aria-label={`Ubah ${u.name}`} title="Ubah"><Pencil className="size-4" aria-hidden /></button>
                        <button type="button" className={btn} disabled={!can || self} onClick={() => setTarget({ user: u, kind: "reset" })} aria-label={`Reset password ${u.name}`} title="Reset password"><KeyRound className="size-4" aria-hidden /></button>
                        <button type="button" className={btn} disabled={!can || self} onClick={() => (u.isActive ? setTarget({ user: u, kind: "deactivate" }) : act(u, { isActive: true }, "Pengguna diaktifkan."))} aria-label={`${u.isActive ? "Nonaktifkan" : "Aktifkan"} ${u.name}`} title={u.isActive ? "Nonaktifkan" : "Aktifkan"}><Power className="size-4" aria-hidden /></button>
                        <button type="button" className={btn} disabled={!can || self} onClick={() => setTarget({ user: u, kind: "delete" })} aria-label={`Hapus ${u.name}`} title="Hapus"><Trash2 className="size-4" aria-hidden /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />

      <ConfirmDialog open={target?.kind === "deactivate"} title="Nonaktifkan pengguna?" confirmLabel="Nonaktifkan" busy={busy} onCancel={() => setTarget(null)} onConfirm={() => target && act(target.user, { isActive: false }, "Pengguna dinonaktifkan dan sesinya dicabut.")}>
        {target?.user.name} tidak akan dapat masuk sampai diaktifkan kembali.
      </ConfirmDialog>
      <ConfirmDialog open={target?.kind === "delete"} title="Hapus pengguna?" confirmLabel="Hapus" busy={busy} onCancel={() => setTarget(null)} onConfirm={() => target && run(() => api(`/api/admin/users/${target.user._id}`, { method: "DELETE" }), "Pengguna dihapus.")}>
        Akun {target?.user.name} ({target?.user.email}) dihapus permanen. Berita yang pernah ditulisnya tetap ada dengan nama penulis tersimpan. Bila hanya ingin menutup akses, gunakan Nonaktifkan.
      </ConfirmDialog>
      <ConfirmDialog open={target?.kind === "reset"} title="Reset password?" confirmLabel="Reset" busy={busy} onCancel={() => { setTarget(null); setNewPass(""); }} onConfirm={() => target && newPass.length >= 12 && act(target.user, { resetPassword: newPass }, "Password direset. Pengguna wajib menggantinya saat login berikutnya.")}>
        <TextInput id="reset-pass" label="Password sementara baru" type="password" autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} hint="Minimal 12 karakter. Semua sesi pengguna dicabut." />
      </ConfirmDialog>
    </div>
  );
}
