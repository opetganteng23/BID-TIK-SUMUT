import { z } from "zod";
import { del } from "@vercel/blob";
import { ApiError, assertSameOrigin, clientIp, ok, parseQuery, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Media } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { MEDIA_RULES, isBlobUrl, matchesSignature, mediaTypeOf, type MediaKind } from "@/lib/media";
import { escapeRegex } from "@/lib/crud";

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  q: z.string().max(100).optional(),
  type: z.enum(["image", "video", "file"]).optional(),
});

export const GET = route(async ({ req, requestId }) => {
  await requireUser("media.upload");
  const { page, limit, q, type } = parseQuery(req, listQuery);
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (q) filter.$or = [{ pathname: { $regex: escapeRegex(q), $options: "i" } }, { alt: { $regex: escapeRegex(q), $options: "i" } }];
  if (type) filter.type = type;
  const [items, total] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Media.countDocuments(filter),
  ]);
  return ok({ items, total, page, limit }, requestId);
});

const register = z
  .object({
    url: z.string().url().max(1000),
    pathname: z.string().max(300),
    kind: z.enum(["image", "video", "logo"]),
    alt: z.string().max(200).default(""),
    decorative: z.boolean().default(false),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

/** Mencatat media setelah unggahan: verifikasi URL Blob, MIME, ukuran, dan magic bytes. */
export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("media.upload");
  const input = await readJson(req, register, 10_000);
  if (!isBlobUrl(input.url)) throw new ApiError("VALIDATION_ERROR", "URL media tidak berasal dari storage yang diizinkan.");
  const kind = input.kind as MediaKind;
  const rule = MEDIA_RULES[kind];
  if (kind !== "video" && !input.decorative && !input.alt.trim()) {
    throw new ApiError("VALIDATION_ERROR", undefined, { alt: "Alt text wajib, atau tandai gambar sebagai dekoratif." });
  }

  const head = await fetch(input.url, { headers: { Range: "bytes=0-31" }, cache: "no-store" });
  if (!head.ok && head.status !== 206) throw new ApiError("VALIDATION_ERROR", "Berkas tidak dapat diverifikasi.");
  const mime = (head.headers.get("content-type") ?? "").split(";")[0].trim();
  const range = head.headers.get("content-range");
  const size = range ? Number(range.split("/")[1]) : Number(head.headers.get("content-length") ?? 0);
  const bytes = new Uint8Array(await head.arrayBuffer());

  const fail = async (code: "UNSUPPORTED_MEDIA_TYPE" | "PAYLOAD_TOO_LARGE") => {
    await del(input.url).catch(() => {});
    throw new ApiError(code);
  };
  if (!rule.mimes.includes(mime) || !matchesSignature(mime, bytes)) return fail("UNSUPPORTED_MEDIA_TYPE");
  if (!size || size > rule.maxBytes) return fail("PAYLOAD_TOO_LARGE");

  await connectDb();
  const doc = await Media.create({
    url: input.url,
    pathname: input.pathname,
    type: mediaTypeOf(mime),
    mime,
    size,
    width: input.width,
    height: input.height,
    alt: input.decorative ? "" : input.alt,
    uploadedBy: user.id,
  });
  await audit({ actorId: user.id, action: "media.upload", entity: "media", entityId: String(doc._id), summary: input.pathname, ip: clientIp(req), requestId });
  return ok(doc.toObject(), requestId, 201);
});
