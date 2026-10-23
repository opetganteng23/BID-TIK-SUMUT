import { ApiError, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { ComplaintAttachment } from "@/lib/models";
import { requireReporter } from "@/lib/complaint-service";
import { objectId } from "@/lib/crud";

export const GET = route(async ({ ctx }) => {
  const complaintId = await requireReporter();
  const attId = objectId((await ctx.params).id);
  await connectDb();
  // Kepemilikan diperiksa di query: lampiran tiket lain tidak dapat dibaca.
  const a = await ComplaintAttachment.findOne({ _id: attId, complaintId }).lean();
  if (!a) throw new ApiError("NOT_FOUND");
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
