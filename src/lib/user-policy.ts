import { ApiError } from "@/lib/http";
import type { Role } from "@/lib/rbac";

/**
 * Pagar pengelolaan pengguna. Admin boleh mengelola Admin dan Editor, tetapi tidak boleh membuat,
 * mengubah, mereset, menonaktifkan, atau menghapus Super Admin, dan tidak boleh memberi peran
 * Super Admin kepada siapa pun (mencegah eskalasi hak akses).
 */
export function assertCanManageUser(actorRole: Role, targetRole: Role, newRole?: Role) {
  if (actorRole === "super_admin") return;
  if (targetRole === "super_admin" || newRole === "super_admin") {
    throw new ApiError("FORBIDDEN", "Hanya Super Admin yang dapat mengelola atau memberi peran Super Admin.");
  }
}
