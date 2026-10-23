import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { ContactMessage } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { objectId } from "@/lib/crud";
import { renderEmail, sendMail } from "@/lib/mailer";

export const GET = route(async ({ ctx, requestId }) => {
  await requireUser("messages.manage");
  await connectDb();
  const doc = await ContactMessage.findById(objectId((await ctx.params).id)).lean();
  if (!doc) throw new ApiError("NOT_FOUND");
  return ok(doc, requestId);
});

const patch = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_read") }).strict(),
  z.object({ action: z.literal("reply"), body: z.string().trim().min(5).max(4000) }).strict(),
]);

export const PATCH = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("messages.manage");
  const id = objectId((await ctx.params).id);
  const input = await readJson(req, patch, 20_000);
  await connectDb();
  const doc = await ContactMessage.findById(id);
  if (!doc) throw new ApiError("NOT_FOUND");

  if (input.action === "mark_read") {
    if (doc.status === "new") {
      doc.status = "read";
      await doc.save();
    }
    return ok({ status: doc.status }, requestId);
  }

  // Status hanya menjadi "replied" setelah SMTP menerima pesan.
  const mail = renderEmail({
    title: `Re: ${doc.subject}`,
    paragraphs: input.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
  });
  try {
    await sendMail({ to: doc.email, subject: `Re: ${doc.subject}`, ...mail });
  } catch (e) {
    console.error(JSON.stringify({ requestId, level: "error", name: "reply_mail_failed", message: e instanceof Error ? e.name : "" }));
    throw new ApiError("INTERNAL_ERROR", "Balasan gagal dikirim. Pesan tetap tersimpan.");
  }
  doc.status = "replied";
  await doc.save();
  await audit({ actorId: user.id, action: "message.reply", entity: "contact_message", entityId: String(id), ip: clientIp(req), requestId });
  return ok({ status: doc.status }, requestId);
});
