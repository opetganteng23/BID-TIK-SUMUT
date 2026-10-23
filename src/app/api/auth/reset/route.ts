import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { PasswordReset, User } from "@/lib/models";
import { hashPassword, passwordSchema, sha256 } from "@/lib/auth/password";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const body = z.object({ token: z.string().min(20).max(200), newPassword: passwordSchema }).strict();
const INVALID = "Tautan reset tidak valid atau sudah kedaluwarsa.";

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  await rateLimit(`reset:ip:${clientIp(req)}`, 20, 60 * 60_000);
  const input = await readJson(req, body, 5_000);
  await connectDb();
  // Sekali pakai dan atomik: hanya satu permintaan yang dapat menandai token terpakai.
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash: sha256(input.token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!reset) throw new ApiError("VALIDATION_ERROR", INVALID);
  const user = await User.findById(reset.userId);
  if (!user) throw new ApiError("VALIDATION_ERROR", INVALID);
  user.passwordHash = await hashPassword(input.newPassword);
  user.sessionVersion += 1;
  user.failedLogins = 0;
  user.lockedUntil = undefined;
  user.mustChangePassword = false;
  await user.save();
  await audit({
    actorId: user._id,
    action: "auth.password_reset",
    entity: "user",
    entityId: String(user._id),
    ip: clientIp(req),
    requestId,
  });
  return ok({}, requestId);
});
