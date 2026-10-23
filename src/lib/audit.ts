import { connectDb } from "@/lib/db";
import { AuditLog } from "@/lib/models";
import type { Types } from "mongoose";

export type AuditInput = {
  actorId?: Types.ObjectId | string | null;
  actorLabel?: string;
  action: string;
  entity: string;
  entityId?: string;
  summary?: string;
  ip?: string;
  requestId?: string;
};

/** Append-only. Jangan pernah mengirim password, OTP, token, atau isi rahasia ke sini. */
export async function audit(input: AuditInput) {
  await connectDb();
  await AuditLog.create({
    ...input,
    summary: input.summary?.slice(0, 300),
    at: new Date(),
  });
}
