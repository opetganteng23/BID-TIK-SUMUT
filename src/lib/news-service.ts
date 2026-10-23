/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiError } from "@/lib/http";
import { sanitizeContent, stripHtml } from "@/lib/sanitize";
import { can } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { slugify } from "@/lib/slug";
import { News } from "@/lib/models";
import type { Types } from "mongoose";

export async function uniqueNewsSlug(base: string, ignoreId?: Types.ObjectId) {
  const root = slugify(base);
  if (!root) throw new ApiError("VALIDATION_ERROR", undefined, { slug: "Slug tidak valid." });
  const filter: Record<string, unknown> = { slug: root };
  if (ignoreId) filter._id = { $ne: ignoreId };
  if (await News.exists(filter)) throw new ApiError("CONFLICT", "Slug sudah dipakai.", { slug: "Slug sudah dipakai." });
  return root;
}

/** Validasi mode konten per peran dan sanitasi di server (MTS Section 11). */
export function prepareNewsContent(data: Record<string, any>, user: SessionUser, existingMode?: string) {
  const mode = data.contentMode ?? existingMode;
  const touchingRaw = mode === "html_raw" || data.rawHtml !== undefined || existingMode === "html_raw";
  if (touchingRaw && !can(user.role, "news.raw")) {
    throw new ApiError("FORBIDDEN", "Mode HTML mentah hanya untuk Super Admin.");
  }
  if (typeof data.contentHtml === "string") data.contentHtml = sanitizeContent(data.contentHtml);
  if (mode !== "html_raw") delete data.rawHtml;
  if (!data.excerpt && data.contentHtml) data.excerpt = stripHtml(data.contentHtml).slice(0, 200);
  if (Array.isArray(data.media)) {
    for (const m of data.media) {
      if (m.type === "image" && !m.alt) throw new ApiError("VALIDATION_ERROR", undefined, { media: "Alt text wajib untuk gambar." });
    }
  }
  if (data.category === "") data.category = undefined;
  return data;
}
