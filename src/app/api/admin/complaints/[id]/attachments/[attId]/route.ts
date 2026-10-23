import { ApiError, clientIp, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { ComplaintAttachment } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { objectId } from "@/lib/crud";
import { audit } from "@/lib/audit";

// Proxy unduhan terotorisasi. Tidak ada URL publik untuk bukti pengaduan.
export const GET = route(async ({ req, ctx, requestId }) => {
  const user = await requireUser("complaints.view");
  const { id, attId } = await ctx.params;
  const complaintId = objectId(id);
  await connectDb();
  const a = await ComplaintAttachment.findOne({ _id: objectId(attId), complaintId }).lean();
  if (!a) throw new ApiError("NOT_FOUND");
  if (a.scanStatus !== "clean") {
    throw new ApiError("FORBIDDEN", "Lampiran belum lolos pemindaian keamanan dan tidak dapat diunduh.");
  }
  await audit({ actorId: user.id, action: "complaint.attachment_download", entity: "complaint", entityId: String(complaintId), ip: clientIp(req), requestId });
  return new Response(new Uint8Array(a.data as Buffer), {
    headers: {
      "content-type": a.mime ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${encodeURIComponent(a.name ?? "lampiran")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
});
