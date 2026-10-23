import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { createSession, requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const body = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }).strict();

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const me = await requireUser(undefined, { allowPasswordChange: true });
  const input = await readJson(req, body, 5_000);
  await connectDb();
  const user = await User.findById(me.id);
  if (!user) throw new ApiError("UNAUTHENTICATED");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ApiError("VALIDATION_ERROR", undefined, { currentPassword: "Password saat ini salah." });
  }
  if (input.currentPassword === input.newPassword) {
    throw new ApiError("VALIDATION_ERROR", undefined, { newPassword: "Password baru harus berbeda." });
  }
  user.passwordHash = await hashPassword(input.newPassword);
  user.mustChangePassword = false;
  user.sessionVersion += 1;
  user.failedLogins = 0;
  user.lockedUntil = undefined;
  await user.save();
  await createSession(user);
  await audit({
    actorId: user._id,
    action: "auth.password_changed",
    entity: "user",
    entityId: String(user._id),
    ip: clientIp(req),
    requestId,
  });
  return ok({}, requestId);
});
