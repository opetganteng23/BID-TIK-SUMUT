import { z } from "zod";
import { Types } from "mongoose";
import { escapeRegex } from "@/lib/crud";
import { objectIdString } from "@/lib/schemas";

export const STATUSES = ["submitted", "in_progress", "waiting_reporter", "awaiting_reporter_confirmation", "closed"] as const;

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  sort: z.enum(["createdAt", "ticketNumber", "status", "subject", "updatedAt"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  status: z.enum(STATUSES).optional(),
  categoryId: objectIdString.optional(),
  claimedBy: z.union([objectIdString, z.literal("me"), z.literal("none")]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export function buildFilter(q: z.infer<typeof listQuery>, meId: string) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.categoryId) filter.categoryId = new Types.ObjectId(q.categoryId);
  if (q.claimedBy === "me") filter.claimedBy = new Types.ObjectId(meId);
  else if (q.claimedBy === "none") filter.claimedBy = { $exists: false };
  else if (q.claimedBy) filter.claimedBy = new Types.ObjectId(q.claimedBy);
  if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.q) {
    const re = { $regex: escapeRegex(q.q), $options: "i" };
    filter.$or = [{ ticketNumber: re }, { subject: re }];
  }
  return filter;
}

