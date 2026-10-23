/* eslint-disable @typescript-eslint/no-explicit-any */
import { unstable_cache } from "next/cache";
import { connectDb } from "@/lib/db";
import { About, Feature, FeatureCategory, HeroSlide, News, NewsCategory, Page } from "@/lib/models";
import { publicNewsFilter } from "@/lib/news-state";
import { escapeRegex } from "@/lib/crud";

const plain = <T>(v: unknown): T => JSON.parse(JSON.stringify(v)) as T;

// Proyeksi publik: tidak pernah mengirim rawHtml, penulis (ID), atau data review ke klien.
const NEWS_CARD = "title slug excerpt coverImage coverAlt category publishedAt authorNameSnapshot media contentMode";
const NEWS_DETAIL = `${NEWS_CARD} contentHtml rawHtml seo tags`;

export type NewsCard = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  coverAlt?: string;
  category?: { _id: string; name: string; slug: string };
  publishedAt: string;
  authorNameSnapshot?: string;
  media?: { type: "image" | "video" | "embed"; url: string; alt?: string; caption?: string }[];
  contentMode: "richtext" | "html" | "html_raw";
};
export type NewsDetail = NewsCard & { contentHtml?: string; rawHtml?: string; tags?: string[]; seo?: { title?: string; description?: string; ogImage?: string } };

export const getHeroSlides = unstable_cache(
  async () => {
    await connectDb();
    return plain<any[]>(await HeroSlide.find({ enabled: true }).sort({ order: 1 }).lean());
  },
  ["hero"],
  { tags: ["hero"] },
);

export const getAbout = unstable_cache(
  async () => {
    await connectDb();
    return plain<any | null>(await About.findOne({ key: "singleton" }, { bodyJson: 0 }).lean());
  },
  ["about"],
  { tags: ["about"] },
);

export const getNewsCategories = unstable_cache(
  async () => {
    await connectDb();
    return plain<{ _id: string; name: string; slug: string }[]>(await NewsCategory.find().sort({ name: 1 }).lean());
  },
  ["news-categories"],
  { tags: ["news"] },
);

export const getFeatureCategories = unstable_cache(
  async () => {
    await connectDb();
    return plain<{ _id: string; name: string; slug: string }[]>(await FeatureCategory.find().sort({ order: 1 }).lean());
  },
  ["feature-categories"],
  { tags: ["features"] },
);

export type NewsListArgs = { limit?: number; page?: number; cursor?: string; category?: string; q?: string };

export const listNews = unstable_cache(
  async (args: NewsListArgs = {}) => {
    await connectDb();
    const limit = Math.min(Math.max(args.limit ?? 9, 1), 50);
    const now = new Date();
    const and: any[] = [publicNewsFilter(now)];
    if (args.category) {
      const cat = await NewsCategory.findOne({ slug: args.category }).lean();
      and.push({ category: cat?._id ?? null });
    }
    if (args.q) and.push({ title: { $regex: escapeRegex(args.q.slice(0, 100)), $options: "i" } });
    if (args.cursor) {
      const [iso, id] = Buffer.from(args.cursor, "base64url").toString().split("|");
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime()) && /^[a-f\d]{24}$/i.test(id ?? "")) {
        and.push({ $or: [{ publishedAt: { $lt: d } }, { publishedAt: d, _id: { $lt: id } }] });
      }
    }
    const filter = { $and: and };
    const skip = args.cursor ? 0 : ((args.page ?? 1) - 1) * limit;
    const [rows, total] = await Promise.all([
      News.find(filter, NEWS_CARD).sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit + 1).populate("category", "name slug").lean(),
      args.cursor ? Promise.resolve(0) : News.countDocuments(filter),
    ]);
    const hasMore = rows.length > limit;
    const items = plain<NewsCard[]>(rows.slice(0, limit));
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? Buffer.from(`${last.publishedAt}|${last._id}`).toString("base64url") : null;
    return { items, total, hasMore, nextCursor };
  },
  ["news-list"],
  { tags: ["news"], revalidate: 60 },
);

export const getNewsBySlug = unstable_cache(
  async (slug: string) => {
    await connectDb();
    const doc = await News.findOne({ slug, ...publicNewsFilter() }, NEWS_DETAIL).populate("category", "name slug").lean();
    return doc ? plain<NewsDetail>(doc) : null;
  },
  ["news-detail"],
  { tags: ["news"], revalidate: 60 },
);

export const getRelatedNews = unstable_cache(
  async (id: string, categoryId?: string) => {
    await connectDb();
    const filter: any = { $and: [publicNewsFilter(), { _id: { $ne: id } }, ...(categoryId ? [{ category: categoryId }] : [])] };
    return plain<NewsCard[]>(await News.find(filter, NEWS_CARD).sort({ publishedAt: -1 }).limit(3).lean());
  },
  ["news-related"],
  { tags: ["news"], revalidate: 60 },
);

export const listFeatures = unstable_cache(
  async (category?: string) => {
    await connectDb();
    const filter: any = { enabled: true };
    if (category) {
      const cat = await FeatureCategory.findOne({ slug: category }).lean();
      filter.category = cat?._id ?? null;
    }
    return plain<any[]>(
      await Feature.find(filter, "title slug summary icon category order").sort({ order: 1 }).populate("category", "name slug").lean(),
    );
  },
  ["features-list"],
  { tags: ["features"] },
);

export const getFeatureBySlug = unstable_cache(
  async (slug: string) => {
    await connectDb();
    const doc = await Feature.findOne({ slug, enabled: true }).populate("category", "name slug").lean();
    if (!doc) return null;
    const related = await Feature.find({ enabled: true, _id: { $ne: doc._id }, category: (doc as any).category?._id }, "title slug summary icon")
      .limit(3)
      .lean();
    return plain<any>({ ...doc, related });
  },
  ["feature-detail"],
  { tags: ["features"] },
);

export const getPageBySlug = unstable_cache(
  async (slug: string) => {
    await connectDb();
    const doc = await Page.findOne({ slug, enabled: true }, "title slug contentHtml seo").lean();
    return doc ? plain<any>(doc) : null;
  },
  ["page-detail"],
  { tags: ["pages"] },
);

export const listPageSlugs = unstable_cache(
  async () => {
    await connectDb();
    return plain<{ slug: string; updatedAt: string }[]>(await Page.find({ enabled: true }, "slug updatedAt").lean());
  },
  ["page-slugs"],
  { tags: ["pages"] },
);

export const listNewsSlugs = unstable_cache(
  async () => {
    await connectDb();
    return plain<{ slug: string; updatedAt: string }[]>(await News.find(publicNewsFilter(), "slug updatedAt").lean());
  },
  ["news-slugs"],
  { tags: ["news"], revalidate: 60 },
);

export const listFeatureSlugs = unstable_cache(
  async () => {
    await connectDb();
    return plain<{ slug: string; updatedAt: string }[]>(await Feature.find({ enabled: true }, "slug updatedAt").lean());
  },
  ["feature-slugs"],
  { tags: ["features"] },
);
