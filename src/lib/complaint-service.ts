import { cookies } from "next/headers";
import { Types } from "mongoose";
import { ApiError } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { env } from "@/lib/env";
import { Complaint, ComplaintStatusHistory, ReporterSession } from "@/lib/models";
import { signToken, verifyToken } from "@/lib/auth/session";
import { canTransition, confirmationDeadline, type ComplaintActor, type ComplaintStatus } from "@/lib/complaint-state";

export const REPORTER_COOKIE = "bid_reporter";
const IDLE_MS = 30 * 60_000;
const MAX_MS = 8 * 60 * 60_000;

export function complaintSecrets() {
  const e = env();
  if (!e.COMPLAINT_SESSION_SECRET || !e.COMPLAINT_ACCESS_PEPPER) {
    throw new ApiError("INTERNAL_ERROR", "Modul pengaduan belum dikonfigurasi.");
  }
  return { session: e.COMPLAINT_SESSION_SECRET, pepper: e.COMPLAINT_ACCESS_PEPPER };
}

// ---- Sesi pelapor: cookie JWT berisi ID sesi, status sesi disimpan di DB (dapat dicabut, idle timeout) ----

export async function startReporterSession(complaintId: Types.ObjectId) {
  complaintSecrets();
  await connectDb();
  const now = Date.now();
  const s = await ReporterSession.create({
    complaintId,
    lastActivityAt: new Date(now),
    expiresAt: new Date(now + MAX_MS),
  });
  const token = await signToken({ sid: String(s._id) }, MAX_MS / 1000, "reporter");
  const jar = await cookies();
  jar.set(REPORTER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_MS / 1000,
  });
}

export async function endReporterSession() {
  const jar = await cookies();
  const token = jar.get(REPORTER_COOKIE)?.value;
  if (token) {
    const p = await verifyToken(token, "reporter");
    if (p && typeof p.sid === "string" && Types.ObjectId.isValid(p.sid)) {
      await connectDb();
      await ReporterSession.updateOne({ _id: p.sid }, { $set: { revoked: true } });
    }
  }
  jar.delete(REPORTER_COOKIE);
}

/** Mengembalikan ID tiket yang sesinya valid. Memperbarui aktivitas (idle 30 menit, maksimum 8 jam). */
export async function requireReporter(): Promise<Types.ObjectId> {
  const jar = await cookies();
  const token = jar.get(REPORTER_COOKIE)?.value;
  const payload = token ? await verifyToken(token, "reporter") : null;
  if (!payload || typeof payload.sid !== "string" || !Types.ObjectId.isValid(payload.sid)) {
    throw new ApiError("UNAUTHENTICATED", "Sesi berakhir. Masukkan nomor tiket dan kode akses kembali.");
  }
  await connectDb();
  const now = new Date();
  const s = await ReporterSession.findOneAndUpdate(
    {
      _id: payload.sid,
      revoked: false,
      expiresAt: { $gt: now },
      lastActivityAt: { $gt: new Date(now.getTime() - IDLE_MS) },
    },
    { $set: { lastActivityAt: now } },
  );
  if (!s) throw new ApiError("UNAUTHENTICATED", "Sesi berakhir. Masukkan nomor tiket dan kode akses kembali.");
  return s.complaintId as Types.ObjectId;
}

// ---- Transisi status (server-side state machine) ----

export async function applyTransition(opts: {
  complaintId: Types.ObjectId;
  to: ComplaintStatus;
  actor: ComplaintActor;
  actorUserId?: string;
  note?: string;
  closureReason?: "reporter_confirmed" | "auto_closed_no_reporter_response";
  /** Pencocokan tenggat untuk job auto-close agar tidak menutup berdasarkan data usang. */
  deadlineBefore?: Date;
}) {
  await connectDb();
  const current = await Complaint.findById(opts.complaintId, "status").lean();
  if (!current) throw new ApiError("NOT_FOUND");
  const from = current.status as ComplaintStatus;
  if (!canTransition(from, opts.to, opts.actor)) {
    throw new ApiError("CONFLICT", "Perubahan status tidak diizinkan dari keadaan saat ini.");
  }
  const now = new Date();
  const set: Record<string, unknown> = { status: opts.to };
  const unset: Record<string, 1> = {};
  if (opts.to === "awaiting_reporter_confirmation") {
    set.awaitingConfirmationAt = now;
    set.confirmationDeadlineAt = confirmationDeadline(now);
  } else {
    unset.confirmationDeadlineAt = 1;
  }
  if (opts.to === "closed") {
    set.closedAt = now;
    set.resolvedAt = now;
    set.closureReason = opts.closureReason;
  }
  const filter: Record<string, unknown> = { _id: opts.complaintId, status: from };
  if (opts.deadlineBefore) filter.confirmationDeadlineAt = { $lte: opts.deadlineBefore };

  // Atomik: hanya berhasil bila status (dan tenggat, untuk job) masih cocok.
  const updated = await Complaint.findOneAndUpdate(
    filter,
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true },
  );
  if (!updated) throw new ApiError("CONFLICT", "Status tiket sudah berubah. Muat ulang.");
  await ComplaintStatusHistory.create({
    complaintId: opts.complaintId,
    fromStatus: from,
    toStatus: opts.to,
    actorType: opts.actor,
    actorUserId: opts.actorUserId,
    note: opts.closureReason && opts.actor === "system" ? opts.closureReason : opts.note,
  });
  return updated;
}

/**
 * Menutup tiket yang melewati tenggat 7 hari. Idempoten dan atomik per tiket (lihat applyTransition).
 * Dipanggil oleh cron dan secara oportunistik saat tiket dibuka, agar keterlambatan scheduler
 * (mis. cron harian di paket Hobby) tidak terlihat pengguna.
 */
export async function autoCloseDue(opts: { complaintId?: Types.ObjectId; limit?: number } = {}) {
  await connectDb();
  const now = new Date();
  const filter: Record<string, unknown> = { status: "awaiting_reporter_confirmation", confirmationDeadlineAt: { $lte: now } };
  if (opts.complaintId) filter._id = opts.complaintId;
  const due = await Complaint.find(filter, "_id").limit(opts.limit ?? 500).lean();
  let closed = 0;
  let skipped = 0;
  for (const c of due) {
    try {
      await applyTransition({ complaintId: c._id, to: "closed", actor: "system", closureReason: "auto_closed_no_reporter_response", deadlineBefore: now });
      closed++;
    } catch (e) {
      if (e instanceof ApiError && e.code === "CONFLICT") skipped++; // pelapor merespons lebih dulu
      else throw e;
    }
  }
  return { closed, skipped };
}
