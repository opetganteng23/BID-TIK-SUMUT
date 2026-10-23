import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http";
import { buildSort, tableQuery } from "@/lib/listing";
import { escapeRegex } from "@/lib/crud";
import { connectDb } from "@/lib/db";
import { ContactMessage } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";

const query = tableQuery.extend({ status: z.enum(["new", "read", "replied"]).optional() });
const SORTABLE = ["createdAt", "name", "subject", "status"] as const;

export const GET = route(async ({ req, requestId }) => {
  await requireUser("messages.manage");
  const { page, limit, status, q, sort, dir } = parseQuery(req, query);
  await connectDb();
  const filter: Record<string, unknown> = status ? { status } : {};
  if (q) {
    const re = { $regex: escapeRegex(q), $options: "i" };
    filter.$or = [{ name: re }, { email: re }, { subject: re }];
  }
  const [items, total] = await Promise.all([
    ContactMessage.find(filter, { userAgent: 0 }).sort(buildSort(sort, dir, SORTABLE, { createdAt: -1 })).skip((page - 1) * limit).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
  ]);
  return ok({ items, total, page, limit }, requestId);
});
