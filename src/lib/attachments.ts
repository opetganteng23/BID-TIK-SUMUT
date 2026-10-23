import { Types } from "mongoose";
import { ApiError } from "@/lib/http";
import { env } from "@/lib/env";
import { connectDb } from "@/lib/db";
import { Complaint, ComplaintAttachment } from "@/lib/models";
import { matchesSignature } from "@/lib/media";

// Batas V1 sebagai konstanta server (bukan input pengguna).
export const ATTACHMENT_LIMITS = {
  maxFiles: 5,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
  mimes: ["application/pdf", "image/jpeg", "image/png"],
  extensions: { "application/pdf": [".pdf"], "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] } as Record<string, string[]>,
} as const;

export function uploadsEnabled() {
  return env().COMPLAINT_UPLOAD_ENABLED;
}

/** Adapter pemindai malware. Tanpa scanner, lampiran tetap `pending_scan` dan tidak dapat diunduh. */
export interface MalwareScanner {
  scan(data: Buffer, mime: string): Promise<"clean" | "infected" | "pending_scan">;
}
let scanner: MalwareScanner | null = null;
export function registerScanner(s: MalwareScanner) {
  scanner = s;
}

export type IncomingFile = { name: string; type: string; size: number; bytes: Buffer };

export function validateFile(f: IncomingFile) {
  const lower = f.name.toLowerCase();
  const exts = ATTACHMENT_LIMITS.extensions[f.type];
  if (!exts || !exts.some((e) => lower.endsWith(e))) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Hanya PDF, JPG, dan PNG yang diizinkan.");
  if (f.bytes.length === 0) throw new ApiError("VALIDATION_ERROR", "Berkas kosong.");
  if (f.bytes.length > ATTACHMENT_LIMITS.maxFileBytes) throw new ApiError("PAYLOAD_TOO_LARGE", "Ukuran per berkas maksimal 10 MB.");
  if (!matchesSignature(f.type, f.bytes.subarray(0, 32))) {
    throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Isi berkas tidak sesuai dengan tipenya.");
  }
}

/** Menyimpan berkas ke storage privat (koleksi MongoDB, dilayani hanya lewat proxy terotorisasi). */
export async function storeAttachments(complaintId: Types.ObjectId, files: IncomingFile[]) {
  if (files.length === 0) return [];
  if (!uploadsEnabled()) throw new ApiError("VALIDATION_ERROR", "Unggah lampiran belum diaktifkan pada lingkungan ini.");
  if (files.length > ATTACHMENT_LIMITS.maxFiles) throw new ApiError("VALIDATION_ERROR", "Maksimal 5 lampiran per tiket.");
  files.forEach(validateFile);
  await connectDb();

  const existing = await Complaint.findById(complaintId, "attachments").lean();
  const prev = existing?.attachments ?? [];
  const newTotal = files.reduce((a, f) => a + f.bytes.length, 0);
  const prevTotal = prev.reduce((a, x) => a + (x.size ?? 0), 0);
  if (prev.length + files.length > ATTACHMENT_LIMITS.maxFiles) throw new ApiError("VALIDATION_ERROR", "Maksimal 5 lampiran per tiket.");
  if (prevTotal + newTotal > ATTACHMENT_LIMITS.maxTotalBytes) throw new ApiError("PAYLOAD_TOO_LARGE", "Total lampiran maksimal 25 MB.");

  const metas = [];
  for (const f of files) {
    const scanStatus = scanner ? await scanner.scan(f.bytes, f.type) : "pending_scan";
    if (scanStatus === "infected") throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Berkas ditolak oleh pemindai keamanan.");
    const safeName = f.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const doc = await ComplaintAttachment.create({ complaintId, name: safeName, mime: f.type, size: f.bytes.length, data: f.bytes, scanStatus });
    metas.push({ attachmentId: doc._id, name: safeName, mime: f.type, size: f.bytes.length, scanStatus });
  }
  return metas;
}
