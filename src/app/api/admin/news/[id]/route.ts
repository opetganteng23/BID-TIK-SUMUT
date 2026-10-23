/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { News } from "@/lib/models";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { newsSchema } from "@/lib/schemas";
import { prepareNewsContent, uniqueNewsSlug } from "@/lib/news-service";
import { objectId } from "@/lib/crud";
import { revalidate } from "@/lib/settings";

async function loadAuthorized(id: string, user: SessionUser) {
  await connectDb();
  const doc = await News.findById(objectId(id));
  if (!doc) throw new ApiError("NOT_FOUND");
  const isOwner = String(doc.authorId) === user.id;
  if (!isOwner && !can(user.role, "news.manage_others")) throw new ApiError("NOT_FOUND");
  return { doc, isOwner };
}

export const GET = route(async ({ ctx, requestId }) => {
  const user = await requireUser("news.write");
  const { doc } = await loadAuthorized((await ctx.params).id, user);
  // html_raw tidak dikirim ke peran yang tidak berhak.
  const out = doc.toObject() as any;
  if (!can(user.role, "news.raw")) delete out.rawHtml;
  return ok(out, requestId);
});

export const PUT = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("news.write");
  const { doc, isOwner } = await loadAuthorized((await ctx.params).id, user);
  const isAdmin = can(user.role, "news.manage_others");
  if (!isAdmin && !(isOwner && doc.status === "draft")) {
    throw new ApiError("FORBIDDEN", "Berita hanya dapat diubah saat berstatus draft.");
  }
  const data = (await readJson(req, newsSchema.partial().strict(), 2_000_000)) as Record<string, any>;
  if (data.slug && data.slug !== doc.slug) data.slug = await uniqueNewsSlug(data.slug, doc._id);
  const modeChanged = data.contentMode && data.contentMode !== doc.contentMode;
  prepareNewsContent(data, user, doc.contentMode);
  // Editor tidak boleh menetapkan jadwal atau status.
  if (!isAdmin) delete data.publishedAt;
  doc.set(data);
  await doc.save();
  await audit({
    actorId: user.id,
    action: modeChanged ? "news.content_mode_changed" : "news.update",
    entity: "news",
    entityId: String(doc._id),
    summary: modeChanged ? `mode ${data.contentMode}` : doc.title,
    ip: clientIp(req),
    requestId,
  });
  if (doc.status === "published" || doc.status === "scheduled") revalidate("news");
  return ok(doc.toObject(), requestId);
});

export const DELETE = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("news.write");
  const { doc, isOwner } = await loadAuthorized((await ctx.params).id, user);
  const isAdmin = can(user.role, "news.manage_others");
  if (!isAdmin && !(isOwner && doc.status === "draft")) throw new ApiError("FORBIDDEN");
  await doc.deleteOne();
  await audit({ actorId: user.id, action: "news.delete", entity: "news", entityId: String(doc._id), summary: doc.title, ip: clientIp(req), requestId });
  revalidate("news");
  return ok({}, requestId);
});
