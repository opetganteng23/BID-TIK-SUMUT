import { ok, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { ComplaintStatusHistory } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { objectId } from "@/lib/crud";

export const GET = route(async ({ ctx, requestId }) => {
  await requireUser("complaints.view");
  const id = objectId((await ctx.params).id);
  await connectDb();
  const items = await ComplaintStatusHistory.find({ complaintId: id }).sort({ createdAt: 1 }).populate("actorUserId", "name").lean();
  return ok({ items }, requestId);
});
