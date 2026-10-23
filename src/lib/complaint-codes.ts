import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Tanpa karakter ambigu (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomString(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Nomor tiket acak, tidak berurutan. Contoh: PGD-7K2M-9QXA */
export function generateTicketNumber(): string {
  return `PGD-${randomString(4)}-${randomString(4)}`;
}

/** Kode akses 20 karakter (sekitar 99 bit entropi), dikelompokkan agar mudah disalin. */
export function generateAccessCode(): string {
  const raw = randomString(20);
  return raw.match(/.{5}/g)!.join("-");
}

export function normalizeTicket(input: string): string {
  return input.trim().toUpperCase();
}

export function normalizeAccessCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** HMAC-SHA256 dengan pepper: cocok untuk token berentropi tinggi. */
export function hashAccessCode(code: string, pepper: string): string {
  return createHmac("sha256", pepper).update(normalizeAccessCode(code)).digest("hex");
}

export function verifyAccessCode(code: string, expectedHash: string, pepper: string): boolean {
  const actual = Buffer.from(hashAccessCode(code, pepper), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
