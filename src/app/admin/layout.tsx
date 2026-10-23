import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Halaman login/reset tidak punya sesi: tampilkan polos. Perlindungan halaman lain ada di (panel)/layout.
  const user = await getSessionUser();
  if (!user) return <main id="konten" className="flex-1">{children}</main>;
  return <AdminShell user={user}>{children}</AdminShell>;
}
