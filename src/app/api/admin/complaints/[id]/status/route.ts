import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { objectId } from "@/lib/crud";
import { audit } from "@/lib/audit";
import { adminStatusSchema } from "@/lib/complaint-schemas";
import { applyTransition } from "@/lib/complaint-service";
import { can } from "@/lib/rbac";

export const PATCH = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("complaints.handle");
  const id = objectId((await ctx.params).id);
  const input = await readJson(req, adminStatusSchema, 5_000);
  await connectDb();
  const c = await Complaint.findById(id, "claimedBy ticketNumber").lean();
  if (!c) throw new ApiError("NOT_FOUND");
  // Hanya petugas yang mengklaim (atau Admin/Super Admin) yang dapat mengubah status.
  const isClaimer = !!c.claimedBy && String(c.claimedBy) === user.id;
  if (!isClaimer && !can(user.role, "complaints.categories.manage")) {
    throw new ApiError("FORBIDDEN", "Hanya petugas yang mengklaim tiket ini yang dapat mengubah statusnya.");
  }
  // Status berasal dari state machine server; klien hanya memilih target yang diizinkan.
  const updated = await applyTransition({ complaintId: id, to: input.to, actor: "admin", actorUserId: user.id, note: input.note });
  await audit({
    actorId: user.id,
    action: "complaint.status",
    entity: "complaint",
    entityId: String(id),
    summary: `${c.ticketNumber} -> ${input.to}`,
    ip: clientIp(req),
    requestId,
  });
  return ok({ status: updated.status, confirmationDeadlineAt: updated.confirmationDeadlineAt }, requestId);
});
