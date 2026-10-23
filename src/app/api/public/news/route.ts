import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http";
import { listNews } from "@/lib/public-data";

const query = z.object({
  cursor: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(24).default(9),
});

export const GET = route(async ({ req, requestId }) => {
  const q = parseQuery(req, query);
  const { items, hasMore, nextCursor } = await listNews({ limit: q.limit, cursor: q.cursor, category: q.category, q: q.q });
  return ok({ items, hasMore, nextCursor }, requestId);
});
