import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { SiteSettings, User, LoginOtp } from "@/lib/models";
import { dummyCompare, randomOtp, sha256, verifyPassword } from "@/lib/auth/password";
import { createSession, signToken } from "@/lib/auth/session";
import { rateLimit, resetRateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { renderEmail, sendMail } from "@/lib/mailer";

const body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }).strict();
const GENERIC = "Email atau password salah.";

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  const input = await readJson(req, body, 10_000);
  const email = input.email.toLowerCase();
  const acctKey = `login:acct:${sha256(email)}`;
  await rateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
  await rateLimit(acctKey, 15, 15 * 60_000);

  await connectDb();
  const user = await User.findOne({ email });
  if (!user || !user.isActive) {
    await dummyCompare(input.password);
    throw new ApiError("UNAUTHENTICATED", GENERIC);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError("RATE_LIMITED", "Akun dikunci sementara. Coba lagi dalam 15 menit.");
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    user.failedLogins += 1;
    if (user.failedLogins >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60_000);
      user.failedLogins = 0;
    }
    await user.save();
    await audit({ actorId: user._id, action: "auth.login_failed", entity: "user", entityId: String(user._id), ip, requestId });
    throw new ApiError("UNAUTHENTICATED", GENERIC);
  }

  user.failedLogins = 0;
  user.lockedUntil = undefined;

  const settings = await SiteSettings.findOne({ key: "singleton" }).lean();
  if (settings?.email?.otpEnabled) {
    const code = randomOtp();
    await LoginOtp.deleteMany({ userId: user._id });
    await LoginOtp.create({
      userId: user._id,
      codeHash: sha256(`${user._id}:${code}`),
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    await user.save();
    const mail = renderEmail({
      title: "Kode masuk admin",
      paragraphs: [
        `Kode verifikasi Anda: ${code}`,
        "Kode berlaku 5 menit. Abaikan email ini bila Anda tidak mencoba masuk.",
      ],
    });
    try {
      await sendMail({ to: user.email, subject: "Kode masuk admin", ...mail });
    } catch (e) {
      console.error(
        JSON.stringify({ requestId, level: "error", name: "otp_mail_failed", message: e instanceof Error ? e.name : "" }),
      );
      throw new ApiError("INTERNAL_ERROR", "Kode verifikasi gagal dikirim. Coba lagi.");
    }
    const challenge = await signToken({ sub: String(user._id) }, 5 * 60, "otp");
    return ok({ otpRequired: true, challenge }, requestId);
  }

  user.lastLoginAt = new Date();
  await user.save();
  await createSession(user);
  await resetRateLimit(acctKey);
  await audit({ actorId: user._id, action: "auth.login", entity: "user", entityId: String(user._id), ip, requestId });
  return ok({ otpRequired: false, mustChangePassword: user.mustChangePassword }, requestId);
});
