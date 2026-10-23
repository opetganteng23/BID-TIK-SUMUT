import { ok, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { ComplaintCategory } from "@/lib/models";

export const GET = route(async ({ requestId }) => {
  await connectDb();
  const items = await ComplaintCategory.find({ active: true }, "name").sort({ order: 1 }).lean();
  return ok({ items: items.map((c) => ({ id: String(c._id), name: c.name })) }, requestId);
});
