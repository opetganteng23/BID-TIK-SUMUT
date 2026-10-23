/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { assertSameOrigin, clientIp, ok, parseQuery, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { News } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { newsSchema } from "@/lib/schemas";
import { prepareNewsContent, uniqueNewsSlug } from "@/lib/news-service";
import { escapeRegex } from "@/lib/crud";

const query = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]).optional(),
});

export const GET = route(async ({ req, requestId }) => {
  const user = await requireUser("news.write");
  const { page, limit, q, status } = parseQuery(req, query);
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };
  if (status) filter.status = status;
  // Editor hanya melihat berita miliknya sendiri.
  if (!can(user.role, "news.manage_others")) filter.authorId = user.id;
  const [items, total] = await Promise.all([
    News.find(filter, { contentJson: 0, contentHtml: 0, rawHtml: 0 })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("category", "name")
      .lean(),
    News.countDocuments(filter),
  ]);
  return ok({ items, total, page, limit }, requestId);
});

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("news.write");
  // status tidak diterima dari klien: berita baru selalu draft.
  const data = (await readJson(req, newsSchema.strict(), 2_000_000)) as Record<string, any>;
  await connectDb();
  data.slug = await uniqueNewsSlug(data.slug || data.title);
  prepareNewsContent(data, user);
  const doc = await News.create({
    ...data,
    status: "draft",
    publishedAt: undefined,
    authorId: user.id,
    authorNameSnapshot: user.name,
  });
  await audit({
    actorId: user.id,
    action: "news.create",
    entity: "news",
    entityId: String(doc._id),
    summary: `${doc.title} (mode ${doc.contentMode})`,
    ip: clientIp(req),
    requestId,
  });
  return ok(doc.toObject(), requestId, 201);
});
