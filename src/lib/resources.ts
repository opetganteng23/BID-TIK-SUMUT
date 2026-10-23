/* eslint-disable @typescript-eslint/no-explicit-any */
import { crud } from "@/lib/crud";
import { ApiError } from "@/lib/http";
import { sanitizeContent } from "@/lib/sanitize";
import {
  complaintCategorySchema,
  featureCategorySchema,
  featureSchema,
  heroSchema,
  newsCategorySchema,
  pageSchema,
} from "@/lib/schemas";
import { Complaint, ComplaintCategory, Feature, FeatureCategory, HeroSlide, News, NewsCategory, Page } from "@/lib/models";

function sanitizeBody(data: Record<string, any>) {
  if (typeof data.contentHtml === "string") data.contentHtml = sanitizeContent(data.contentHtml);
  return data;
}

export const hero = crud({
  model: HeroSlide as any,
  entity: "hero",
  searchField: "title",
  sortable: ["order", "title", "mediaType", "enabled", "createdAt"],
  filterable: ["enabled", "mediaType"],
  readPermission: "content.manage",
  writePermission: "content.manage",
  schema: heroSchema,
  sort: { order: 1 },
  tags: ["hero"],
  prepare: (d) => {
    if (d.mediaType === "image" && d.image && !d.alt) {
      throw new ApiError("VALIDATION_ERROR", undefined, { alt: "Alt text wajib untuk gambar." });
    }
    return d;
  },
});

export const features = crud({
  model: Feature as any,
  entity: "feature",
  sortable: ["title", "order", "enabled", "createdAt"],
  filterable: ["enabled", "category"],
  readPermission: "content.manage",
  writePermission: "content.manage",
  schema: featureSchema,
  searchField: "title",
  sort: { order: 1 },
  slugFrom: "title",
  tags: ["features"],
  populate: "category",
  prepare: (d) => sanitizeBody(d),
});

export const featureCategories = crud({
  model: FeatureCategory as any,
  entity: "feature_category",
  searchField: "name",
  sortable: ["name", "order", "createdAt"],
  readPermission: "content.manage",
  writePermission: "content.manage",
  schema: featureCategorySchema,
  sort: { order: 1 },
  slugFrom: "name",
  tags: ["features"],
  beforeDelete: async (id) => {
    if (await Feature.exists({ category: id })) {
      throw new ApiError("CONFLICT", "Kategori masih dipakai oleh fitur.");
    }
  },
});

export const newsCategories = crud({
  model: NewsCategory as any,
  entity: "news_category",
  searchField: "name",
  sortable: ["name", "createdAt"],
  readPermission: "news.write",
  writePermission: "content.manage",
  schema: newsCategorySchema,
  sort: { name: 1 },
  slugFrom: "name",
  tags: ["news"],
  beforeDelete: async (id) => {
    if (await News.exists({ category: id })) {
      throw new ApiError("CONFLICT", "Kategori masih dipakai oleh berita.");
    }
  },
});

export const pages = crud({
  model: Page as any,
  entity: "page",
  sortable: ["title", "slug", "enabled", "updatedAt", "createdAt"],
  filterable: ["enabled"],
  readPermission: "content.manage",
  writePermission: "content.manage",
  schema: pageSchema,
  searchField: "title",
  slugFrom: "title",
  reserveSlugs: true,
  tags: ["pages"],
  prepare: (d) => sanitizeBody(d),
});

export const complaintCategories = crud({
  model: ComplaintCategory as any,
  entity: "complaint_category",
  searchField: "name",
  sortable: ["name", "order", "active", "createdAt"],
  filterable: ["active"],
  readPermission: "complaints.view",
  writePermission: "complaints.categories.manage",
  schema: complaintCategorySchema,
  sort: { order: 1 },
  slugFrom: "name",
  tags: ["complaint-categories"],
  beforeDelete: async (id) => {
    if (await Complaint.exists({ categoryId: id })) {
      throw new ApiError("CONFLICT", "Kategori sudah dipakai pengaduan. Nonaktifkan saja.");
    }
  },
});
