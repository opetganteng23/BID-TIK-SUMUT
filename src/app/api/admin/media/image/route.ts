import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Media } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { MEDIA_RULES, matchesSignature } from "@/lib/media";

const body = z
  .object({
    filename: z.string().max(200),
    mime: z.string().max(60),
    base64: z.string().max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/, "Data gambar tidak valid."),
    kind: z.enum(["image", "logo"]),
    alt: z.string().max(200).default(""),
    decorative: z.boolean().default(false),
  })
  .strict();

/**
 * Gambar diterima sebagai base64, divalidasi (MIME allowlist, ukuran, magic bytes dari byte yang
 * didekode), lalu disimpan sebagai base64 di MongoDB dan dilayani dari /media/<id>.
 */
export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("media.upload");
  const input = await readJson(req, body, 7_200_000);
  const rule = MEDIA_RULES[input.kind];
  if (!input.decorative && !input.alt.trim()) {
    throw new ApiError("VALIDATION_ERROR", undefined, { alt: "Alt text wajib, atau tandai gambar sebagai dekoratif." });
  }
  if (!rule.mimes.includes(input.mime)) throw new ApiError("UNSUPPORTED_MEDIA_TYPE");
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.length === 0 || bytes.length > rule.maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE");
  if (!matchesSignature(input.mime, bytes.subarray(0, 32))) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Isi berkas tidak sesuai tipenya.");

  await connectDb();
  const doc = await Media.create({
    url: "/media/pending",
    pathname: input.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120),
    type: "image",
    mime: input.mime,
    size: bytes.length,
    alt: input.decorative ? "" : input.alt,
    data: bytes.toString("base64"), // dinormalisasi dari byte hasil dekode
    uploadedBy: user.id,
  });
  doc.url = `/media/${doc._id}`;
  await doc.save();
  await audit({ actorId: user.id, action: "media.upload", entity: "media", entityId: String(doc._id), summary: `${doc.pathname} (base64)`, ip: clientIp(req), requestId });
  return ok({ _id: String(doc._id), url: doc.url, pathname: doc.pathname, type: "image", mime: doc.mime, size: doc.size, alt: doc.alt }, requestId, 201);
});
