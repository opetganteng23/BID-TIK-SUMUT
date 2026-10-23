export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type Envelope<T> =
  | { ok: true; data: T; meta?: { requestId: string } }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

/** Klien fetch untuk semua endpoint JSON. Melempar ApiClientError dengan pesan yang aman ditampilkan. */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const method = opts.method ?? (opts.body || opts.form ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: opts.body ? { "content-type": "application/json" } : undefined,
      body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError("Tidak dapat terhubung ke server. Periksa koneksi Anda.", "NETWORK", 0);
  }
  let json: Envelope<T> | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    /* respons bukan JSON */
  }
  if (!json || !json.ok) {
    const err = json && !json.ok ? json.error : null;
    throw new ApiClientError(err?.message ?? "Terjadi kesalahan pada server.", err?.code ?? "INTERNAL_ERROR", res.status, err?.fields);
  }
  return json.data;
}

export const formatDate = (d?: string | Date | null, withTime = false) => {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(d));
};

/** Mengunduh berkas dari endpoint terproteksi (cookie sesi) dan memicu simpan di peramban. */
export async function downloadFile(url: string, fallbackName: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(j?.error?.message ?? "Unduhan gagal.");
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  a.click();
  URL.revokeObjectURL(a.href);
}
