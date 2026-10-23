import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint, ComplaintMessage } from "@/lib/models";
import { applyTransition, requireReporter } from "@/lib/complaint-service";
import { messageSchema } from "@/lib/complaint-schemas";
import { rateLimit } from "@/lib/ratelimit";

export const GET = route(async ({ requestId }) => {
  const id = await requireReporter();
  await connectDb();
  const items = await ComplaintMessage.find({ complaintId: id }, "senderType senderLabel body createdAt").sort({ createdAt: 1 }).limit(500).lean();
  return ok(
    {
      items: items.map((m) => ({
        id: String(m._id),
        from: m.senderType,
        label: m.senderType === "admin" ? "Petugas" : "Anda",
        body: m.body,
        at: m.createdAt,
      })),
    },
    requestId,
    200,
    { "cache-control": "no-store" },
  );
});

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const id = await requireReporter();
  await rateLimit(`complaint:msg:${id}`, 20, 60 * 60_000);
  const { body } = await readJson(req, messageSchema, 10_000);
  await connectDb();
  const c = await Complaint.findById(id, "status").lean();
  if (!c) throw new ApiError("NOT_FOUND");
  if (c.status === "closed") throw new ApiError("CONFLICT", "Tiket sudah ditutup. Buat pengaduan baru bila diperlukan.");

  const msg = await ComplaintMessage.create({ complaintId: id, senderType: "reporter", senderLabel: "Pelapor", body });
  await Complaint.updateOne({ _id: id }, { $set: { lastMessageAt: new Date() } });
  // Balasan atas permintaan informasi mengembalikan tiket ke "Sedang Diproses".
  if (c.status === "waiting_reporter") {
    await applyTransition({ complaintId: id, to: "in_progress", actor: "reporter", note: "Pelapor membalas permintaan informasi" });
  }
  return ok({ id: String(msg._id) }, requestId, 201);
});
