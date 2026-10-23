import { ok, parseQuery, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { STATUSES, buildFilter, listQuery } from "@/lib/complaint-query";

/** Semua admin dapat melihat semua tiket. Daftar tidak membawa uraian atau kontak pelapor. */
export const GET = route(async ({ req, requestId }) => {
  const user = await requireUser("complaints.view");
  const q = parseQuery(req, listQuery);
  await connectDb();
  const filter = buildFilter(q, user.id);
  const [items, total, grouped] = await Promise.all([
    Complaint.find(filter, "ticketNumber subject status createdAt updatedAt lastMessageAt claimedBy claimedAt confirmationDeadlineAt reporter.name categoryId")
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate("categoryId", "name")
      .populate("claimedBy", "name")
      .lean(),
    Complaint.countDocuments(filter),
    Complaint.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const summary = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const g of grouped) summary[g._id] = g.n;
  return ok({ items, total, page: q.page, limit: q.limit, summary }, requestId);
});
