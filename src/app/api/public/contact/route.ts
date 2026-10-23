import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { ContactMessage, SiteSettings } from "@/lib/models";
import { contactSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/ratelimit";
import { renderEmail, sendMail } from "@/lib/mailer";

export const maxDuration = 30;

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  await rateLimit(`contact:ip:${ip}`, 5, 60 * 60_000);
  const input = await readJson(req, contactSchema, 20_000);

  // Honeypot terisi: berpura-pura sukses tanpa menyimpan apa pun.
  if (input.website) return ok({ received: true }, requestId, 201);

  await connectDb();
  const { website: _hp, ...fields } = input;
  void _hp;
  const msg = await ContactMessage.create({ ...fields, ip, userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200) });

  // Pesan tetap tersimpan walau SMTP gagal. Kegagalan hanya dicatat di log server.
  let notified = true;
  try {
    const settings = await SiteSettings.findOne({ key: "singleton" }, "email").lean();
    const to = settings?.email?.contactRecipients ?? [];
    if (to.length) {
      const prefix = settings?.email?.emailSubjectPrefix ?? "[BID TIK]";
      const mail = renderEmail({
        title: "Pesan baru dari formulir kontak",
        paragraphs: [`Dari: ${fields.name} <${fields.email}>`, `Subjek: ${fields.subject}`, fields.message],
      });
      await sendMail({ to, subject: `${prefix} ${fields.subject}`, replyTo: fields.email, ...mail });
    }
  } catch (e) {
    notified = false;
    console.error(JSON.stringify({ requestId, level: "error", name: "contact_notify_failed", message: e instanceof Error ? e.name : "" }));
  }
  if (!msg) throw new ApiError("INTERNAL_ERROR");
  return ok({ received: true, notified }, requestId, 201);
});
