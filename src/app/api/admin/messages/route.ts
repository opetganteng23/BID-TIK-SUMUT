import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { ContactMessage } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";

const query = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["new", "read", "replied"]).optional(),
});

export const GET = route(async ({ req, requestId }) => {
  await requireUser("messages.manage");
  const { page, limit, status } = parseQuery(req, query);
  await connectDb();
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    ContactMessage.find(filter, { userAgent: 0 }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
  ]);
  return ok({ items, total, page, limit }, requestId);
});
