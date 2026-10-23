import { z } from "zod";
import { objectIdString } from "@/lib/schemas";

// Format telepon Indonesia: 08xx, +628xx, atau 628xx; 9 sampai 13 digit setelah awalan.
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .refine((v) => /^(\+62|62|0)8[1-9]\d{7,11}$/.test(v), "Nomor telepon tidak valid.");

// Teks tanpa karakter kontrol; tampil sebagai teks (React meng-escape), tidak pernah sebagai HTML.
const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} terlalu pendek.`)
    .max(max, `${label} terlalu panjang.`)
    .refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), `${label} mengandung karakter tidak valid.`);

export const createComplaintSchema = z
  .object({
    name: text(2, 100, "Nama"),
    address: text(5, 300, "Alamat"),
    phone: phoneSchema,
    categoryId: objectIdString,
    subject: text(5, 200, "Subjek"),
    description: text(20, 5000, "Uraian"),
    privacyConsent: z.literal(true, { error: "Persetujuan pemberitahuan privasi wajib." }),
    website: z.string().max(200).optional(), // honeypot: diperiksa di route, terisi berarti bot
  })
  .strict();

export const accessSchema = z
  .object({
    ticketNumber: z.string().trim().min(8).max(20),
    accessCode: z.string().trim().min(10).max(40),
  })
  .strict();

export const messageSchema = z.object({ body: text(1, 3000, "Pesan") }).strict();

export const confirmationSchema = z.object({ resolved: z.boolean(), note: text(0, 500, "Catatan").optional() }).strict();

export const adminStatusSchema = z
  .object({
    to: z.enum(["waiting_reporter", "awaiting_reporter_confirmation"]),
    note: text(0, 500, "Catatan").optional(),
  })
  .strict();
