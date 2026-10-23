import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/rbac";

/** Gerbang server untuk halaman admin: sesi, ganti password wajib, dan izin. */
export async function requirePage(permission?: Permission, opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/admin/change-password");
  if (permission && !can(user.role, permission)) redirect("/admin?denied=1");
  return user;
}
