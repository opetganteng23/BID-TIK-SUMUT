import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint } from "@/lib/models";
import { accessSchema } from "@/lib/complaint-schemas";
import { hashAccessCode, normalizeTicket, verifyAccessCode } from "@/lib/complaint-codes";
import { complaintSecrets, startReporterSession } from "@/lib/complaint-service";
import { rateLimit } from "@/lib/ratelimit";

const GENERIC = "Nomor tiket atau kode akses tidak valid.";

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  const input = await readJson(req, accessSchema, 5_000);
  const ticket = normalizeTicket(input.ticketNumber);
  // Batas per IP dan per tiket (kunci sudah dinormalisasi), tanpa menyimpan kode akses.
  await rateLimit(`complaint:access:ip:${ip}`, 10, 15 * 60_000);
  await rateLimit(`complaint:access:ticket:${ticket}`, 5, 15 * 60_000);

  const { pepper } = complaintSecrets();
  await connectDb();
  const complaint = await Complaint.findOne({ ticketNumber: ticket }, "accessCodeHash").lean();
  // Selalu hitung hash agar waktu respons tidak membedakan tiket yang ada dan tidak ada.
  const expected = complaint?.accessCodeHash ?? hashAccessCode("x", pepper);
  const valid = verifyAccessCode(input.accessCode, expected, pepper) && !!complaint;
  if (!valid || !complaint) throw new ApiError("UNAUTHENTICATED", GENERIC);

  await startReporterSession(complaint._id);
  return ok({ authenticated: true }, requestId, 200, { "cache-control": "no-store" });
});
