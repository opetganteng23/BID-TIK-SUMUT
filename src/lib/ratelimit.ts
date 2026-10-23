import { connectDb } from "@/lib/db";
import { RateLimit } from "@/lib/models";
import { ApiError } from "@/lib/http";

/**
 * Pembatas laju berbasis MongoDB (atomik lewat upsert + $inc).
 * Counter hanya menyimpan kunci dan hitungan, tanpa isi permintaan.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  await connectDb();
  const now = Date.now();
  const doc = await RateLimit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now + windowMs) } },
    { upsert: true, new: true },
  );
  if (doc.count > limit) {
    const retry = Math.max(1, Math.ceil((doc.expiresAt.getTime() - now) / 1000));
    throw new ApiError("RATE_LIMITED", undefined, undefined, { "retry-after": String(retry) });
  }
}

export async function resetRateLimit(key: string) {
  await connectDb();
  await RateLimit.deleteOne({ key });
}
