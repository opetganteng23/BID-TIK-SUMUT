import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http";
import { buildSort, pickFilters, tableQuery } from "@/lib/listing";
import { connectDb } from "@/lib/db";
import { AuditLog } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { escapeRegex } from "@/lib/crud";

const query = tableQuery.extend({ action: z.string().max(60).optional() });
const SORTABLE = ["at", "action", "entity"] as const;

// Hanya-baca: tidak ada endpoint ubah atau hapus audit.
export const GET = route(async ({ req, requestId }) => {
  await requireUser("audit.read");
  const { page, limit, action, q, sort, dir } = parseQuery(req, query);
  await connectDb();
  const filter: Record<string, unknown> = { ...pickFilters(req, ["entity"]) };
  if (action) filter.action = { $regex: `^${escapeRegex(action)}` };
  if (q) filter.summary = { $regex: escapeRegex(q), $options: "i" };
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(buildSort(sort, dir, SORTABLE, { at: -1 })).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return ok({ items, total, page, limit }, requestId);
});
