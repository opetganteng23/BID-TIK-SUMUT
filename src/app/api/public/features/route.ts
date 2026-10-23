import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http";
import { listFeatures } from "@/lib/public-data";

const query = z.object({ category: z.string().max(100).optional() });

export const GET = route(async ({ req, requestId }) => {
  const { category } = parseQuery(req, query);
  return ok({ items: await listFeatures(category) }, requestId);
});
