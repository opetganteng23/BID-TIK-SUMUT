import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { objectId } from "@/lib/crud";
import { assertCanManageUser } from "@/lib/user-policy";
import type { Role } from "@/lib/rbac";

const patch = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    role: z.enum(["super_admin", "admin", "editor"]),
    isActive: z.boolean(),
    resetPassword: passwordSchema,
  })
  .partial()
  .strict();

const otherActiveSuperAdmins = (excludeId: unknown) => User.countDocuments({ role: "super_admin", isActive: true, _id: { $ne: excludeId } });

export const GET = route(async ({ ctx, requestId }) => {
  await requireUser("users.manage");
  await connectDb();
  const u = await User.findById(objectId((await ctx.params).id), { passwordHash: 0, failedLogins: 0 }).lean();
  if (!u) throw new ApiError("NOT_FOUND");
  return ok(u, requestId);
});

export const PATCH = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const actor = await requireUser("users.manage");
  const id = objectId((await ctx.params).id);
  const input = await readJson(req, patch, 10_000);
  await connectDb();
  const user = await User.findById(id);
  if (!user) throw new ApiError("NOT_FOUND");
  assertCanManageUser(actor.role, user.role as Role, input.role);

  const isSelf = String(user._id) === actor.id;
  const losesSuper = user.role === "super_admin" && ((input.role && input.role !== "super_admin") || input.isActive === false);
  if (losesSuper && (await otherActiveSuperAdmins(user._id)) === 0) {
    throw new ApiError("CONFLICT", "Harus tersisa minimal satu Super Admin aktif.");
  }
  if (isSelf && (input.isActive === false || (input.role && input.role !== user.role))) {
    throw new ApiError("CONFLICT", "Anda tidak dapat menonaktifkan atau mengubah peran akun sendiri.");
  }
  if (isSelf && input.resetPassword) {
    throw new ApiError("CONFLICT", "Gunakan menu Ganti password untuk akun Anda sendiri.");
  }

  const changes: string[] = [];
  if (input.name && input.name !== user.name) {
    user.name = input.name;
    changes.push("name");
  }
  if (input.email && input.email.toLowerCase() !== user.email) {
    const email = input.email.toLowerCase();
    if (await User.exists({ email, _id: { $ne: user._id } })) {
      throw new ApiError("CONFLICT", "Email sudah terdaftar.", { email: "Email sudah terdaftar." });
    }
    user.email = email;
    user.sessionVersion += 1;
    changes.push("email");
  }
  if (input.role && input.role !== user.role) {
    user.role = input.role;
    user.sessionVersion += 1;
    changes.push(`role=${input.role}`);
  }
  if (input.isActive !== undefined && input.isActive !== user.isActive) {
    user.isActive = input.isActive;
    user.sessionVersion += 1;
    changes.push(`isActive=${input.isActive}`);
  }
  if (input.resetPassword) {
    user.passwordHash = await hashPassword(input.resetPassword);
    user.mustChangePassword = true;
    user.sessionVersion += 1;
    user.failedLogins = 0;
    user.lockedUntil = undefined;
    changes.push("password_reset"); // nilai password tidak pernah dicatat
  }
  await user.save();
  await audit({ actorId: actor.id, action: "user.update", entity: "user", entityId: String(user._id), summary: changes.join(","), ip: clientIp(req), requestId });
  return ok({ id: String(user._id), role: user.role, isActive: user.isActive }, requestId);
});

export const DELETE = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const actor = await requireUser("users.manage");
  const id = objectId((await ctx.params).id);
  await connectDb();
  const user = await User.findById(id);
  if (!user) throw new ApiError("NOT_FOUND");
  assertCanManageUser(actor.role, user.role as Role);
  if (String(user._id) === actor.id) throw new ApiError("CONFLICT", "Anda tidak dapat menghapus akun sendiri.");
  if (user.role === "super_admin" && (await otherActiveSuperAdmins(user._id)) === 0) {
    throw new ApiError("CONFLICT", "Harus tersisa minimal satu Super Admin aktif.");
  }
  await user.deleteOne();
  // Berita lama tetap memakai authorNameSnapshot; sesi pengguna ini otomatis tidak valid karena akun hilang.
  await audit({ actorId: actor.id, action: "user.delete", entity: "user", entityId: String(id), summary: `${user.email} (${user.role})`, ip: clientIp(req), requestId });
  return ok({}, requestId);
});
