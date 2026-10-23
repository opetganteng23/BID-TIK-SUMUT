import { ApiError, ok, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { objectId } from "@/lib/crud";
import { allowedAdminTargets, STATUS_LABEL, type ComplaintStatus } from "@/lib/complaint-state";

export const GET = route(async ({ ctx, requestId }) => {
  const user = await requireUser("complaints.view");
  const id = objectId((await ctx.params).id);
  await connectDb();
  const c = await Complaint.findById(id, "-accessCodeHash").populate("categoryId", "name").populate("claimedBy", "name").lean();
  if (!c) throw new ApiError("NOT_FOUND");
  const claimedBy = c.claimedBy as unknown as { _id: unknown; name?: string } | null;
  return ok(
    {
      ...c,
      statusLabel: STATUS_LABEL[c.status as ComplaintStatus],
      allowedNext: allowedAdminTargets(c.status as ComplaintStatus),
      claimedByMe: !!claimedBy && String(claimedBy._id) === user.id,
    },
    requestId,
  );
});
