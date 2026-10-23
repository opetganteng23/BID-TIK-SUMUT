import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { AuditLog } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { escapeRegex } from "@/lib/crud";

const query = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().max(60).optional(),
});

// Hanya-baca: tidak ada endpoint ubah atau hapus audit.
export const GET = route(async ({ req, requestId }) => {
  await requireUser("audit.read");
  const { page, limit, action } = parseQuery(req, query);
  await connectDb();
  const filter = action ? { action: { $regex: `^${escapeRegex(action)}` } } : {};
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return ok({ items, total, page, limit }, requestId);
});
