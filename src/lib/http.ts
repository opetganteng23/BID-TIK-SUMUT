import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { randomUUID } from "node:crypto";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "PASSWORD_CHANGE_REQUIRED";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Periksa kembali data yang dimasukkan.",
  UNAUTHENTICATED: "Sesi tidak valid. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki izin untuk aksi ini.",
  PASSWORD_CHANGE_REQUIRED: "Anda harus mengganti password terlebih dahulu.",
  NOT_FOUND: "Data tidak ditemukan.",
  CONFLICT: "Permintaan bertentangan dengan keadaan data saat ini.",
  PAYLOAD_TOO_LARGE: "Ukuran data melebihi batas.",
  UNSUPPORTED_MEDIA_TYPE: "Tipe berkas tidak diizinkan.",
  RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi beberapa saat lagi.",
  INTERNAL_ERROR: "Terjadi kesalahan pada server.",
};

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly fields?: Record<string, string>,
    readonly headers?: Record<string, string>,
  ) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.status = STATUS[code];
  }
}

export type Ctx = { params: Promise<Record<string, string>> };

type Meta = { requestId: string };

export function ok<T>(data: T, requestId: string, status = 200, headers?: HeadersInit) {
  const body: { ok: true; data: T; meta: Meta } = { ok: true, data, meta: { requestId } };
  return NextResponse.json(body, { status, headers });
}

export function fail(err: ApiError, requestId: string) {
  const res = NextResponse.json(
    {
      ok: false,
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
      meta: { requestId },
    },
    { status: err.status, headers: err.headers },
  );
  res.headers.set("x-request-id", requestId);
  return res;
}

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

export type HandlerArgs = { req: Request; ctx: Ctx; requestId: string };

/**
 * Pembungkus route handler: request ID, format respons seragam, pemetaan error.
 * Tidak pernah membocorkan stack trace atau pesan driver ke klien.
 */
export function route(fn: (a: HandlerArgs) => Promise<Response | NextResponse>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const requestId = randomUUID();
    try {
      const res = await fn({ req, ctx, requestId });
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      if (err instanceof ApiError) return fail(err, requestId);
      if (err instanceof ZodError) {
        return fail(new ApiError("VALIDATION_ERROR", undefined, zodFields(err)), requestId);
      }
      // Hanya jenis error dan request ID yang dicatat, tanpa data pengguna.
      console.error(
        JSON.stringify({
          requestId,
          level: "error",
          name: err instanceof Error ? err.name : "unknown",
          message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
        }),
      );
      return fail(new ApiError("INTERNAL_ERROR"), requestId);
    }
  };
}

/** Verifikasi header Origin/Host untuk semua mutasi (CSRF). */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new ApiError("FORBIDDEN", "Origin tidak valid.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError("FORBIDDEN", "Origin tidak valid.");
  }
  if (originHost !== host) throw new ApiError("FORBIDDEN", "Origin tidak valid.");
}

/** Tolak operator `$` dan kunci berbahaya pada input mentah (NoSQL injection). */
export function assertNoOperators(value: unknown, depth = 0) {
  if (depth > 20) throw new ApiError("VALIDATION_ERROR");
  if (Array.isArray(value)) return value.forEach((v) => assertNoOperators(v, depth + 1));
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith("$") || k.includes(".") || k === "__proto__") {
        throw new ApiError("VALIDATION_ERROR", "Input mengandung karakter yang tidak diizinkan.");
      }
      assertNoOperators(v, depth + 1);
    }
  }
}

export async function readJson<T>(req: Request, schema: ZodType<T>, maxBytes = 1_000_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Format JSON tidak valid.");
  }
  assertNoOperators(raw);
  return schema.parse(raw);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k.startsWith("$")) throw new ApiError("VALIDATION_ERROR");
    raw[k] = v;
  });
  return schema.parse(raw);
}
