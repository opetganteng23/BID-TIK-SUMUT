import { timingSafeEqual } from "node:crypto";
import { ApiError, ok, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { env } from "@/lib/env";
import { Complaint, ComplaintAttachment, ComplaintMessage, ComplaintStatusHistory, ReporterSession } from "@/lib/models";
import { autoCloseDue } from "@/lib/complaint-service";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

// Retensi prototype: data pengaduan (sintetis) dihapus setelah 90 hari.
const RETENTION_DAYS = 90;

function authorized(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Auto-close idempoten: menutup tiket menunggu konfirmasi yang melewati tenggat 7 hari.
 * Setiap penutupan atomik dan hanya berhasil bila status dan tenggat masih cocok,
 * sehingga tiket yang baru direspons pelapor tidak ikut ditutup.
 */
export const GET = route(async ({ req, requestId }) => {
  if (!authorized(req)) throw new ApiError("UNAUTHENTICATED");
  await connectDb();
  const now = new Date();
  const { closed, skipped } = await autoCloseDue();

  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60_000);
  const old = await Complaint.find({ createdAt: { $lt: cutoff } }, "_id").limit(500).lean();
  if (old.length) {
    const ids = old.map((o) => o._id);
    await Promise.all([
      ComplaintMessage.deleteMany({ complaintId: { $in: ids } }),
      ComplaintStatusHistory.deleteMany({ complaintId: { $in: ids } }),
      ComplaintAttachment.deleteMany({ complaintId: { $in: ids } }),
      ReporterSession.deleteMany({ complaintId: { $in: ids } }),
      Complaint.deleteMany({ _id: { $in: ids } }),
    ]);
  }

  if (closed || old.length) {
    await audit({ action: "complaint.maintenance", entity: "complaint", summary: `auto_closed=${closed} purged=${old.length}`, requestId });
  }
  return ok({ closed, skipped, purged: old.length }, requestId);
});
