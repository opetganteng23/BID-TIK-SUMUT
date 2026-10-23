import { z } from "zod";
import { assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { PasswordReset, User } from "@/lib/models";
import { randomToken, sha256 } from "@/lib/auth/password";
import { rateLimit } from "@/lib/ratelimit";
import { renderEmail, sendMail } from "@/lib/mailer";
import { env } from "@/lib/env";

const body = z.object({ email: z.string().email().max(200) }).strict();

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  await rateLimit(`forgot:ip:${clientIp(req)}`, 10, 60 * 60_000);
  const { email } = await readJson(req, body, 5_000);
  await rateLimit(`forgot:acct:${sha256(email.toLowerCase())}`, 3, 60 * 60_000);
  await connectDb();
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
  if (user) {
    const token = randomToken();
    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({
      userId: user._id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    const url = `${env().NEXT_PUBLIC_SITE_URL}/admin/reset-password?token=${token}`;
    const mail = renderEmail({
      title: "Reset password admin",
      paragraphs: [
        "Kami menerima permintaan reset password. Tautan berlaku 30 menit dan hanya dapat dipakai sekali.",
        "Abaikan email ini bila Anda tidak memintanya.",
      ],
      action: { label: "Atur password baru", url },
    });
    try {
      await sendMail({ to: user.email, subject: "Reset password admin", ...mail });
    } catch (e) {
      console.error(
        JSON.stringify({ requestId, level: "error", name: "reset_mail_failed", message: e instanceof Error ? e.name : "" }),
      );
    }
  }
  // Respons selalu generik agar tidak membocorkan email terdaftar.
  return ok({ message: "Jika email terdaftar, tautan reset telah dikirim." }, requestId);
});
