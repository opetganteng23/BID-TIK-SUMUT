import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { LoginOtp, User } from "@/lib/models";
import { sha256 } from "@/lib/auth/password";
import { createSession, verifyToken } from "@/lib/auth/session";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const body = z
  .object({ challenge: z.string().min(10).max(2000), code: z.string().regex(/^\d{6}$/, "Kode harus 6 digit.") })
  .strict();

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  await rateLimit(`otp:ip:${ip}`, 30, 15 * 60_000);
  const input = await readJson(req, body, 5_000);
  const payload = await verifyToken(input.challenge, "otp");
  if (!payload || typeof payload.sub !== "string") {
    throw new ApiError("UNAUTHENTICATED", "Verifikasi kedaluwarsa. Masuk ulang.");
  }

  await connectDb();
  const otp = await LoginOtp.findOne({ userId: payload.sub });
  if (!otp || otp.expiresAt < new Date()) throw new ApiError("UNAUTHENTICATED", "Kode kedaluwarsa. Masuk ulang.");
  if (otp.attempts >= 5) {
    await otp.deleteOne();
    throw new ApiError("RATE_LIMITED", "Terlalu banyak percobaan. Masuk ulang.");
  }
  if (otp.codeHash !== sha256(`${payload.sub}:${input.code}`)) {
    otp.attempts += 1;
    await otp.save();
    throw new ApiError("UNAUTHENTICATED", "Kode salah.");
  }
  await otp.deleteOne();

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new ApiError("UNAUTHENTICATED");
  user.lastLoginAt = new Date();
  await user.save();
  await createSession(user);
  await audit({ actorId: user._id, action: "auth.login_otp", entity: "user", entityId: String(user._id), ip, requestId });
  return ok({ mustChangePassword: user.mustChangePassword }, requestId);
});
