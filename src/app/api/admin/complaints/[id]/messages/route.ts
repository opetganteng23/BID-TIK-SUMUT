import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint, ComplaintMessage } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { objectId } from "@/lib/crud";
import { audit } from "@/lib/audit";
import { messageSchema } from "@/lib/complaint-schemas";
import { can } from "@/lib/rbac";

export const GET = route(async ({ ctx, requestId }) => {
  await requireUser("complaints.view");
  const id = objectId((await ctx.params).id);
  await connectDb();
  const items = await ComplaintMessage.find({ complaintId: id }).sort({ createdAt: 1 }).limit(500).lean();
  return ok({ items }, requestId);
});

export const POST = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("complaints.handle");
  const id = objectId((await ctx.params).id);
  const { body } = await readJson(req, messageSchema, 10_000);
  await connectDb();
  const c = await Complaint.findById(id, "status claimedBy ticketNumber").lean();
  if (!c) throw new ApiError("NOT_FOUND");
  if (c.status === "closed") throw new ApiError("CONFLICT", "Tiket sudah ditutup.");
  const isClaimer = !!c.claimedBy && String(c.claimedBy) === user.id;
  if (!isClaimer && !can(user.role, "complaints.categories.manage")) {
    throw new ApiError("FORBIDDEN", "Klaim tiket terlebih dahulu untuk membalas pelapor.");
  }
  const msg = await ComplaintMessage.create({
    complaintId: id,
    senderType: "admin",
    senderUserId: user.id,
    senderLabel: user.name,
    body,
  });
  await Complaint.updateOne({ _id: id }, { $set: { lastMessageAt: new Date() } });
  await audit({ actorId: user.id, action: "complaint.message", entity: "complaint", entityId: String(id), summary: c.ticketNumber, ip: clientIp(req), requestId });
  return ok({ id: String(msg._id) }, requestId, 201);
});
