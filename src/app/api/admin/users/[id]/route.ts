import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { objectId } from "@/lib/crud";

const patch = z
  .object({
    name: z.string().trim().min(2).max(120),
    role: z.enum(["super_admin", "admin", "editor"]),
    isActive: z.boolean(),
    resetPassword: passwordSchema,
  })
  .partial()
  .strict();

async function otherActiveSuperAdmins(excludeId: unknown) {
  return User.countDocuments({ role: "super_admin", isActive: true, _id: { $ne: excludeId } });
}

export const PATCH = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const actor = await requireUser("users.manage");
  const id = objectId((await ctx.params).id);
  const input = await readJson(req, patch, 10_000);
  await connectDb();
  const user = await User.findById(id);
  if (!user) throw new ApiError("NOT_FOUND");

  const losesSuper =
    user.role === "super_admin" &&
    ((input.role && input.role !== "super_admin") || input.isActive === false);
  if (losesSuper && (await otherActiveSuperAdmins(user._id)) === 0) {
    throw new ApiError("CONFLICT", "Harus tersisa minimal satu Super Admin aktif.");
  }
  if (String(user._id) === actor.id && (input.isActive === false || (input.role && input.role !== user.role))) {
    throw new ApiError("CONFLICT", "Anda tidak dapat menonaktifkan atau mengubah peran akun sendiri.");
  }

  const changes: string[] = [];
  if (input.name) { user.name = input.name; changes.push("name"); }
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
  await audit({
    actorId: actor.id,
    action: "user.update",
    entity: "user",
    entityId: String(user._id),
    summary: changes.join(","),
    ip: clientIp(req),
    requestId,
  });
  return ok({ id: String(user._id), role: user.role, isActive: user.isActive }, requestId);
});
