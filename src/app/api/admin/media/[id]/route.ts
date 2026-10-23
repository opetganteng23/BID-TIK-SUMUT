import { z } from "zod";
import { del } from "@vercel/blob";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { About, Feature, HeroSlide, Media, News, Page, SiteSettings } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { escapeRegex, objectId } from "@/lib/crud";

async function usageCount(url: string) {
  const re = { $regex: escapeRegex(url) };
  const counts = await Promise.all([
    News.countDocuments({ $or: [{ coverImage: url }, { "media.url": url }, { contentHtml: re }, { "seo.ogImage": url }] }),
    HeroSlide.countDocuments({ $or: [{ image: url }, { poster: url }, { videoUrl: url }] }),
    Feature.countDocuments({ $or: [{ heroImage: url }, { "gallery.url": url }, { contentHtml: re }] }),
    Page.countDocuments({ contentHtml: re }),
    About.countDocuments({ $or: [{ image: url }, { body: re }] }),
    SiteSettings.countDocuments({
      $or: [{ logoLight: url }, { logoDark: url }, { favicon: url }, { "seo.ogImage": url }, { "marquees.items.logo": url }],
    }),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}

export const PUT = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("media.upload");
  const id = objectId((await ctx.params).id);
  const { alt } = await readJson(req, z.object({ alt: z.string().max(200) }).strict(), 5_000);
  await connectDb();
  const doc = await Media.findByIdAndUpdate(id, { $set: { alt } }, { new: true }).lean();
  if (!doc) throw new ApiError("NOT_FOUND");
  await audit({ actorId: user.id, action: "media.update", entity: "media", entityId: String(id), ip: clientIp(req), requestId });
  return ok(doc, requestId);
});

export const DELETE = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("media.delete");
  const id = objectId((await ctx.params).id);
  await connectDb();
  const doc = await Media.findById(id);
  if (!doc) throw new ApiError("NOT_FOUND");
  const used = await usageCount(doc.url);
  if (used > 0) {
    throw new ApiError("CONFLICT", `Media masih dipakai di ${used} konten. Ganti referensinya terlebih dahulu.`);
  }
  if (!doc.url.startsWith("/media/")) await del(doc.url).catch(() => {});
  await doc.deleteOne();
  await audit({ actorId: user.id, action: "media.delete", entity: "media", entityId: String(id), summary: doc.pathname, ip: clientIp(req), requestId });
  return ok({}, requestId);
});
