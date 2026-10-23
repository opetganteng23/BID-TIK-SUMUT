import { ApiError, assertSameOrigin, clientIp, ok, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint, ComplaintStatusHistory } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { objectId } from "@/lib/crud";
import { audit } from "@/lib/audit";

export const POST = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("complaints.handle");
  const id = objectId((await ctx.params).id);
  await connectDb();
  const now = new Date();
  // Atomik: hanya berhasil bila tiket masih belum diklaim. Dua petugas bersamaan, hanya satu menang.
  const claimed = await Complaint.findOneAndUpdate(
    { _id: id, status: "submitted", claimedBy: { $exists: false } },
    { $set: { claimedBy: user.id, claimedAt: now, status: "in_progress" } },
    { new: true },
  );
  if (!claimed) {
    const exists = await Complaint.exists({ _id: id });
    if (!exists) throw new ApiError("NOT_FOUND");
    throw new ApiError("CONFLICT", "Tiket sudah diklaim petugas lain atau tidak lagi berstatus Belum Diambil.");
  }
  await ComplaintStatusHistory.create({
    complaintId: id,
    fromStatus: "submitted",
    toStatus: "in_progress",
    actorType: "admin",
    actorUserId: user.id,
    note: "Tiket diklaim",
  });
  await audit({ actorId: user.id, action: "complaint.claim", entity: "complaint", entityId: String(id), summary: claimed.ticketNumber, ip: clientIp(req), requestId });
  return ok({ status: claimed.status }, requestId);
});
