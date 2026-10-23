import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI wajib diisi"),
  MONGODB_DB: z.string().min(1).default("bid_tik_sumut"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET minimal 32 karakter"),
  COMPLAINT_SESSION_SECRET: z.string().min(32).optional(),
  COMPLAINT_ACCESS_PEPPER: z.string().min(32).optional(),
  MAIL_HOST: z.string().default("smtp.gmail.com"),
  MAIL_PORT: z.coerce.number().default(465),
  MAIL_USER: z.string().optional(),
  MAIL_APP_PASSWORD: z.string().optional(),
  MAIL_FROM_NAME: z.string().default("BID TIK Polda Sumut"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  COMPLAINT_UPLOAD_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Membaca dan memvalidasi environment saat pertama dipakai (bukan saat build). */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    throw new Error(`Konfigurasi environment tidak valid: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
