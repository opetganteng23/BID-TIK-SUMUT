import { ApiError, ok, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint, ComplaintStatusHistory } from "@/lib/models";
import { autoCloseDue, requireReporter } from "@/lib/complaint-service";
import { STATUS_LABEL, type ComplaintStatus } from "@/lib/complaint-state";

export const GET = route(async ({ requestId }) => {
  const id = await requireReporter();
  await autoCloseDue({ complaintId: id });
  await connectDb();
  const c = await Complaint.findById(id).populate("categoryId", "name").lean();
  if (!c) throw new ApiError("NOT_FOUND");
  const history = await ComplaintStatusHistory.find({ complaintId: id }, "toStatus actorType createdAt").sort({ createdAt: 1 }).lean();
  const category = c.categoryId as unknown as { name?: string } | null;
  // Hanya informasi yang aman untuk pelapor: tanpa identitas petugas atau catatan internal.
  return ok(
    {
      ticketNumber: c.ticketNumber,
      subject: c.subject,
      description: c.description,
      category: category?.name ?? "",
      status: c.status,
      statusLabel: STATUS_LABEL[c.status as ComplaintStatus],
      claimed: !!c.claimedBy,
      createdAt: c.createdAt,
      awaitingConfirmationAt: c.awaitingConfirmationAt,
      confirmationDeadlineAt: c.confirmationDeadlineAt,
      closedAt: c.closedAt,
      closureReason: c.closureReason,
      attachments: (c.attachments ?? []).map((a) => ({ id: String(a.attachmentId), name: a.name, size: a.size })),
      history: history.map((h) => ({
        status: h.toStatus,
        label: STATUS_LABEL[h.toStatus as ComplaintStatus] ?? h.toStatus,
        by: h.actorType,
        at: h.createdAt,
      })),
    },
    requestId,
    200,
    { "cache-control": "no-store" },
  );
});
