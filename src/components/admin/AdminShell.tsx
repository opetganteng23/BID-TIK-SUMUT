"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, FileText, Image as ImageIcon, Inbox, LayoutDashboard, LogOut, Megaphone, Menu, MessageSquareWarning, Newspaper, ScrollText, Settings, Sparkles, Users, X, BookOpen } from "lucide-react";
import { can, type Permission, type Role } from "@/lib/rbac";
import { api } from "@/components/api";
import { cx } from "@/components/ui";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; perm?: Permission };

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/settings", label: "Site Settings", icon: Settings, perm: "settings.layout" },
  { href: "/admin/hero", label: "Hero", icon: Megaphone, perm: "content.manage" },
  { href: "/admin/about", label: "About", icon: BookOpen, perm: "content.manage" },
  { href: "/admin/news", label: "Berita", icon: Newspaper, perm: "news.write" },
  { href: "/admin/features", label: "Fitur", icon: Sparkles, perm: "content.manage" },
  { href: "/admin/pages", label: "Halaman", icon: FileText, perm: "content.manage" },
  { href: "/admin/media", label: "Media", icon: ImageIcon, perm: "media.upload" },
  { href: "/admin/messages", label: "Pesan", icon: Inbox, perm: "messages.manage" },
  { href: "/admin/complaints", label: "Pengaduan", icon: MessageSquareWarning, perm: "complaints.view" },
  { href: "/admin/users", label: "Pengguna", icon: Users, perm: "users.manage" },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText, perm: "audit.read" },
];

export function AdminShell({ user, children }: { user: { name: string; email: string; role: Role; mustChangePassword: boolean }; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = user.mustChangePassword ? [] : NAV.filter((n) => !n.perm || can(user.role, n.perm));

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
    router.replace("/admin/login");
    router.refresh();
  }

  const nav = (
    <nav aria-label="Menu admin" className="space-y-1 p-3">
      {items.map((n) => {
        const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cx("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium", active ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}>
            <n.icon className="size-4" aria-hidden /> {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-svh flex-1 bg-cloud">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-2 border-b border-border p-4 font-semibold"><BarChart3 className="size-5" aria-hidden /> Panel Admin</div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-4">
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-full border-2 border-border lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu admin">
            <Menu className="size-5" aria-hidden />
          </button>
          <p className="hidden text-sm text-muted sm:block">Prototype. Gunakan data publik atau fiktif saja.</p>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right text-sm leading-tight">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted">{user.role.replace("_", " ")}</p>
            </div>
            <button type="button" onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border px-4 text-sm font-medium hover:bg-surface-2">
              <LogOut className="size-4" aria-hidden /> Keluar
            </button>
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu admin">
            <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Tutup menu" />
            <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface">
              <div className="flex items-center justify-between border-b border-border p-4">
                <span className="font-semibold">Panel Admin</span>
                <button type="button" className="inline-flex size-11 items-center justify-center" onClick={() => setOpen(false)} aria-label="Tutup"><X className="size-5" aria-hidden /></button>
              </div>
              {nav}
            </div>
          </div>
        )}

        <main id="konten" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 p-4 outline-none md:p-8">{children}</main>
      </div>
    </div>
  );
}
