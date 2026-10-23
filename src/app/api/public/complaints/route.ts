import { Types } from "mongoose";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint, ComplaintCategory, ComplaintStatusHistory } from "@/lib/models";
import { createComplaintSchema } from "@/lib/complaint-schemas";
import { generateAccessCode, generateTicketNumber, hashAccessCode } from "@/lib/complaint-codes";
import { complaintSecrets, startReporterSession } from "@/lib/complaint-service";
import { rateLimit } from "@/lib/ratelimit";

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  await rateLimit(`complaint:create:${ip}`, 5, 60 * 60_000);
  const input = await readJson(req, createComplaintSchema, 30_000);
  // Honeypot terisi: tampak sukses, tidak menyimpan apa pun.
  if (input.website) return ok({ ticketNumber: generateTicketNumber(), accessCode: generateAccessCode() }, requestId, 201);

  const { pepper } = complaintSecrets();
  await connectDb();
  const category = await ComplaintCategory.findOne({ _id: input.categoryId, active: true }).lean();
  if (!category) throw new ApiError("VALIDATION_ERROR", undefined, { categoryId: "Kategori tidak valid." });

  const accessCode = generateAccessCode();
  const accessCodeHash = hashAccessCode(accessCode, pepper);
  let complaint;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      complaint = await Complaint.create({
        ticketNumber: generateTicketNumber(),
        accessCodeHash,
        reporter: { name: input.name, address: input.address, phone: input.phone },
        categoryId: new Types.ObjectId(input.categoryId),
        region: input.region,
        subject: input.subject,
        description: input.description,
        status: "submitted",
        lastMessageAt: new Date(),
      });
      break;
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e; // tabrakan nomor tiket: coba lagi
    }
  }
  if (!complaint) throw new ApiError("INTERNAL_ERROR");

  await ComplaintStatusHistory.create({
    complaintId: complaint._id,
    toStatus: "submitted",
    actorType: "reporter",
    note: "Pengaduan diajukan",
  });
  // Pelapor yang baru mengajukan langsung memiliki sesi untuk menambah lampiran.
  await startReporterSession(complaint._id);

  // Kode akses hanya ditampilkan sekali. Jangan di-cache.
  return ok({ ticketNumber: complaint.ticketNumber, accessCode }, requestId, 201, { "cache-control": "no-store" });
});
