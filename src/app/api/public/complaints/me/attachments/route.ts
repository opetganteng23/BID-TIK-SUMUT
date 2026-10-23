import { ApiError, assertSameOrigin, ok, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint } from "@/lib/models";
import { requireReporter } from "@/lib/complaint-service";
import { ATTACHMENT_LIMITS, storeAttachments, uploadsEnabled } from "@/lib/attachments";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 30;

// Fungsi serverless Vercel membatasi body sekitar 4,5 MB. Unggah dilakukan satu berkas per permintaan.
const PLATFORM_CAP = process.env.VERCEL ? 4_400_000 : ATTACHMENT_LIMITS.maxFileBytes;

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const id = await requireReporter();
  if (!uploadsEnabled()) throw new ApiError("VALIDATION_ERROR", "Unggah lampiran belum diaktifkan pada lingkungan ini.");
  await rateLimit(`complaint:upload:${id}`, 15, 60 * 60_000);

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > PLATFORM_CAP + 10_000) throw new ApiError("PAYLOAD_TOO_LARGE", "Ukuran berkas melebihi batas unggah lingkungan ini.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", "Berkas wajib dipilih.");

  await connectDb();
  const c = await Complaint.findById(id, "status").lean();
  if (!c) throw new ApiError("NOT_FOUND");
  if (c.status === "closed") throw new ApiError("CONFLICT", "Tiket sudah ditutup.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const [meta] = await storeAttachments(id, [{ name: file.name, type: file.type, size: bytes.length, bytes }]);
  await Complaint.updateOne({ _id: id }, { $push: { attachments: meta } });
  return ok({ id: String(meta.attachmentId), name: meta.name, size: meta.size }, requestId, 201);
});
