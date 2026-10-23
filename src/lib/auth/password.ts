import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Password minimal 12 karakter.")
  .max(128, "Password terlalu panjang.");

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Perbandingan semu agar waktu respons login sama untuk email yang tidak terdaftar.
let dummyHash: Promise<string> | undefined;
export async function dummyCompare(plain: string) {
  dummyHash ??= bcrypt.hash("tidak-dipakai", 12);
  await bcrypt.compare(plain, await dummyHash);
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const randomOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
