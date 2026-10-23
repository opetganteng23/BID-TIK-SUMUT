import { z } from "zod";
import { ApiError } from "@/lib/http";

/** Parameter standar tabel: halaman, ukuran, pencarian, urutan. Whitelist kolom urut dicek per endpoint. */
export const tableQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  sort: z.string().max(40).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

/** Membangun sort Mongo dari parameter. Kolom di luar whitelist ditolak (bukan diabaikan). */
export function buildSort(sort: string | undefined, dir: "asc" | "desc" | undefined, allowed: readonly string[], fallback: Record<string, 1 | -1>): Record<string, 1 | -1> {
  if (!sort) return fallback;
  if (!allowed.includes(sort)) throw new ApiError("VALIDATION_ERROR", "Kolom urutan tidak valid.", { sort: "Kolom urutan tidak valid." });
  const d = dir === "desc" ? -1 : 1;
  // _id sebagai penentu urutan agar paginasi stabil.
  return sort === "_id" ? { _id: d } : { [sort]: d, _id: d };
}

/** Filter kesetaraan berbasis whitelist dari query string. "true"/"false" menjadi boolean. */
export function pickFilters(req: Request, allowed: readonly string[]): Record<string, string | boolean> {
  const url = new URL(req.url);
  const out: Record<string, string | boolean> = {};
  for (const key of allowed) {
    const v = url.searchParams.get(key);
    if (v === null || v === "") continue;
    if (v.length > 64 || v.startsWith("$")) throw new ApiError("VALIDATION_ERROR");
    out[key] = v === "true" ? true : v === "false" ? false : v;
  }
  return out;
}
